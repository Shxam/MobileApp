import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { WalletService } from '../wallet/wallet.service';
import { env } from '../../common/config/env';
import { RazorpayClient } from './razorpay.client';

export interface PaymentIntent {
  paymentId: string;
  orderId: string;
  providerOrderId: string;
  keyId: string;
  amountPaise: number;
  currency: string;
}

/** A Razorpay order opened to buy wallet credit rather than to pay for an order. */
export interface WalletTopUpIntent {
  topUpId: string;
  providerOrderId: string;
  keyId: string;
  amountPaise: number;
  currency: string;
}

export interface CallbackVerification {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/**
 * Payment verification and settlement.
 *
 * Two independent paths can confirm the same payment — the browser callback and
 * the server-to-server webhook — and either may arrive first, twice, or never.
 * Correctness rests on three things:
 *
 *   1. `Payment.providerPaymentId` is UNIQUE, so a replay cannot create a second
 *      payment row.
 *   2. `WebhookEvent.providerEventId` is UNIQUE, so a replayed webhook is a
 *      no-op at insert time rather than something we have to detect later.
 *   3. `markPaid` is written to be idempotent: the second caller to arrive sees
 *      the order is already paid and returns without re-crediting anything.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayClient,
    private readonly eventBus: EventBusService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * Opens a Razorpay order for an existing `awaiting_payment` order and returns
   * everything Checkout needs. The amount comes from the DB, never the client.
   */
  async createIntentForOrder(userId: string, orderId: string): Promise<PaymentIntent> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.userId !== userId) throw new ForbiddenException('That order belongs to a different account.');
    if (order.paymentStatus === PaymentStatus.paid) {
      throw new BadRequestException('This order is already paid.');
    }
    if (order.paymentMethod !== PaymentMethod.razorpay) {
      throw new BadRequestException('This order is not set up for online payment.');
    }
    if (!this.razorpay.isConfigured) {
      throw new ServiceUnavailableException('Online payment is temporarily unavailable.');
    }

    // Reuse a still-open intent so a customer who reloads Checkout does not
    // strand a second Razorpay order against the same bill.
    const existing = await this.prisma.payment.findFirst({
      where: { orderId, status: PaymentStatus.pending, provider: 'razorpay', providerOrderId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing?.providerOrderId && existing.amountPaise === order.totalAmountPaise) {
      return {
        paymentId: existing.id,
        orderId,
        providerOrderId: existing.providerOrderId,
        keyId: this.razorpay.keyId,
        amountPaise: existing.amountPaise,
        currency: existing.currency,
      };
    }

    const providerOrder = await this.razorpay.createOrder({
      amountPaise: order.totalAmountPaise,
      receipt: order.orderNumber,
      notes: { orderId: order.id, orderNumber: order.orderNumber },
    });

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        provider: 'razorpay',
        providerOrderId: providerOrder.id,
        amountPaise: order.totalAmountPaise,
        currency: 'INR',
        status: PaymentStatus.pending,
        method: PaymentMethod.razorpay,
      },
    });

    return {
      paymentId: payment.id,
      orderId,
      providerOrderId: providerOrder.id,
      keyId: this.razorpay.keyId,
      amountPaise: order.totalAmountPaise,
      currency: 'INR',
    };
  }

  // ─── Wallet top-ups ───────────────────────────────────────────────────────

  /**
   * Opens a Razorpay order that buys wallet credit.
   *
   * The amount is recorded here and the wallet is credited from *this* row on
   * capture, never from a figure the client repeats back later.
   */
  async createWalletTopUp(userId: string, amountPaise: number): Promise<WalletTopUpIntent> {
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      throw new BadRequestException('Top-up amount must be a positive whole number of paise.');
    }
    if (!this.razorpay.isConfigured) {
      throw new ServiceUnavailableException('Online payment is temporarily unavailable.');
    }

    // Reuse a pending top-up of the same amount so a reloaded Checkout does not
    // strand a second Razorpay order.
    const existing = await this.prisma.walletTopUp.findFirst({
      where: { userId, status: PaymentStatus.pending, amountPaise },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return {
        topUpId: existing.id,
        providerOrderId: existing.providerOrderId,
        keyId: this.razorpay.keyId,
        amountPaise: existing.amountPaise,
        currency: existing.currency,
      };
    }

    const providerOrder = await this.razorpay.createOrder({
      amountPaise,
      receipt: `wallet-${userId.slice(0, 8)}-${Date.now()}`,
      notes: { purpose: 'wallet_topup', userId },
    });

    const topUp = await this.prisma.walletTopUp.create({
      data: {
        userId,
        provider: 'razorpay',
        providerOrderId: providerOrder.id,
        amountPaise,
        currency: 'INR',
        status: PaymentStatus.pending,
      },
    });

    return {
      topUpId: topUp.id,
      providerOrderId: providerOrder.id,
      keyId: this.razorpay.keyId,
      amountPaise,
      currency: 'INR',
    };
  }

  /**
   * Confirms a wallet top-up from the browser callback.
   *
   * Same shape as `verifyCallback`, but the money lands in the wallet ledger
   * instead of settling an order.
   */
  async verifyWalletTopUp(userId: string, callback: CallbackVerification) {
    const topUp = await this.prisma.walletTopUp.findUnique({
      where: { providerOrderId: callback.razorpayOrderId },
    });
    if (!topUp) throw new NotFoundException('Top-up not found.');
    if (topUp.userId !== userId) throw new ForbiddenException('That top-up belongs to a different account.');

    const secret = env.razorpayKeySecret;
    if (!secret) throw new ServiceUnavailableException('Payment verification is not configured.');

    const expected = createHmac('sha256', secret)
      .update(`${callback.razorpayOrderId}|${callback.razorpayPaymentId}`)
      .digest('hex');
    if (!this.constantTimeEquals(expected, callback.razorpaySignature)) {
      this.logger.error(`Top-up signature mismatch for ${topUp.id}.`);
      throw new UnauthorizedException('Payment verification failed.');
    }

    // As with orders: the signature proves the ids, not the amount.
    const payment = await this.razorpay.fetchPayment(callback.razorpayPaymentId);
    if (payment.order_id !== callback.razorpayOrderId) {
      throw new UnauthorizedException('Payment does not belong to that top-up.');
    }
    if (!['captured', 'authorized'].includes(payment.status)) {
      throw new BadRequestException(`Payment is ${payment.status}; it has not completed.`);
    }

    return this.creditTopUp(topUp.id, callback.razorpayPaymentId, payment.amount);
  }

  /**
   * Credits a settled top-up. Safe to call from both the callback and the
   * webhook — the conditional `updateMany` lets exactly one caller through.
   */
  async creditTopUp(topUpId: string, providerPaymentId: string, capturedPaise: number) {
    const topUp = await this.prisma.walletTopUp.findUniqueOrThrow({ where: { id: topUpId } });
    if (topUp.status === PaymentStatus.paid) {
      return { credited: false, alreadyCredited: true, amountPaise: topUp.amountPaise };
    }

    // Credit what Razorpay actually captured, floored at the quoted amount, so a
    // short capture can never mint wallet credit we were not paid for.
    const amountPaise = Math.min(topUp.amountPaise, capturedPaise);
    if (amountPaise <= 0) {
      throw new BadRequestException('Captured amount is not creditable.');
    }
    if (capturedPaise !== topUp.amountPaise) {
      this.logger.warn(
        `Top-up ${topUpId}: captured ${capturedPaise} paise against a quoted ${topUp.amountPaise}; crediting ${amountPaise}.`,
      );
    }

    // Claim the top-up before touching the ledger. Only the caller that flips
    // pending → paid proceeds; a concurrent webhook sees count 0 and stops.
    const { count } = await this.prisma.walletTopUp.updateMany({
      where: { id: topUpId, status: PaymentStatus.pending },
      data: { status: PaymentStatus.paid, providerPaymentId, creditedAt: new Date() },
    });
    if (count === 0) {
      return { credited: false, alreadyCredited: true, amountPaise: topUp.amountPaise };
    }

    try {
      // `creditFromPayment` dedupes on referenceId as a second line of defence.
      const wallet = await this.wallet.creditFromPayment(topUp.userId, amountPaise, providerPaymentId);
      await this.eventBus.publish('wallet.topped_up', { userId: topUp.userId, amountPaise });
      this.logger.log(`Wallet credited ${amountPaise} paise for user ${topUp.userId}.`);
      return { credited: true, alreadyCredited: false, amountPaise, balancePaise: wallet.balancePaise };
    } catch (error) {
      // Release the claim so reconciliation or a webhook retry can try again.
      await this.prisma.walletTopUp.updateMany({
        where: { id: topUpId, status: PaymentStatus.paid, creditedAt: { not: null } },
        data: { status: PaymentStatus.pending, creditedAt: null },
      });
      throw error;
    }
  }

  private async markTopUpFailed(topUpId: string, reason: string): Promise<void> {
    await this.prisma.walletTopUp.updateMany({
      where: { id: topUpId, status: PaymentStatus.pending },
      data: { status: PaymentStatus.failed, failureReason: reason },
    });
  }

  /**
   * Verifies the signature Checkout hands back to the browser.
   *
   * Razorpay signs `order_id|payment_id` with the API secret. This is a genuine
   * proof, but it is client-relayed, so the amount is *also* re-fetched from
   * Razorpay before the order is marked paid.
   */
  async verifyCallback(userId: string, orderId: string, callback: CallbackVerification) {    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.userId !== userId) throw new ForbiddenException('That order belongs to a different account.');

    const secret = env.razorpayKeySecret;
    if (!secret) throw new ServiceUnavailableException('Payment verification is not configured.');

    const expected = createHmac('sha256', secret)
      .update(`${callback.razorpayOrderId}|${callback.razorpayPaymentId}`)
      .digest('hex');

    if (!this.constantTimeEquals(expected, callback.razorpaySignature)) {
      this.logger.error(`Checkout signature mismatch for order ${order.orderNumber}.`);
      await this.markFailed(orderId, callback.razorpayPaymentId, 'Signature verification failed');
      throw new UnauthorizedException('Payment verification failed.');
    }

    // The signature proves the ids are genuine; it says nothing about the
    // amount actually captured. Ask Razorpay directly.
    const payment = await this.razorpay.fetchPayment(callback.razorpayPaymentId);
    if (payment.order_id !== callback.razorpayOrderId) {
      throw new UnauthorizedException('Payment does not belong to that order.');
    }
    if (payment.amount !== order.totalAmountPaise) {
      this.logger.error(
        `Amount mismatch on ${order.orderNumber}: charged ${payment.amount}, expected ${order.totalAmountPaise}.`,
      );
      throw new BadRequestException('The amount paid does not match the order total.');
    }
    if (!['captured', 'authorized'].includes(payment.status)) {
      throw new BadRequestException(`Payment is ${payment.status}; it has not completed.`);
    }

    return this.markPaid(orderId, callback.razorpayPaymentId, callback.razorpayOrderId, payment.amount);
  }

  /**
   * Verifies a webhook's HMAC over the exact bytes Razorpay sent.
   *
   * A re-serialized `JSON.stringify(body)` can never match, which is why the raw
   * buffer is threaded all the way from `main.ts`.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string): void {
    const secret = env.razorpayWebhookSecret;
    if (!secret) throw new ServiceUnavailableException('Webhook verification is not configured.');
    if (!signature) throw new UnauthorizedException('Missing webhook signature.');

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!this.constantTimeEquals(expected, signature)) {
      this.logger.error('Webhook rejected: signature mismatch.');
      throw new UnauthorizedException('Invalid webhook signature.');
    }
  }

  /**
   * Processes a verified webhook exactly once.
   *
   * The unique insert on `providerEventId` is the idempotency gate: a replay
   * hits the constraint and returns `duplicate` without touching the order.
   */
  async handleWebhook(rawBody: Buffer, signature: string, eventId: string) {
    this.verifyWebhookSignature(rawBody, signature);

    const payload = this.parseWebhookBody(rawBody);
    const eventType = String(payload.event ?? 'unknown');
    // Razorpay's x-razorpay-event-id header is the canonical id; fall back to a
    // digest of the body so a missing header cannot bypass deduplication.
    const providerEventId =
      eventId || createHmac('sha256', 'webhook-dedupe').update(rawBody).digest('hex');

    try {
      await this.prisma.webhookEvent.create({
        data: { provider: 'razorpay', providerEventId, eventType, payload: payload as Prisma.InputJsonValue },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        this.logger.log(`Webhook ${providerEventId} already processed; ignoring replay.`);
        return { received: true, duplicate: true };
      }
      throw error;
    }

    try {
      await this.applyWebhookEvent(eventType, payload);
      await this.prisma.webhookEvent.update({
        where: { providerEventId },
        data: { processedAt: new Date() },
      });
    } catch (error) {
      // Leave processedAt null so the reconciliation sweep retries this order.
      this.logger.error(`Webhook ${providerEventId} (${eventType}) failed: ${(error as Error).message}`);
      throw error;
    }

    return { received: true, duplicate: false };
  }

  /**
   * Marks an order paid. Safe to call twice — the second call is a no-op.
   *
   * Returns `alreadyPaid` so the caller can tell a fresh settlement from a
   * replay without inspecting the order again.
   */
  async markPaid(orderId: string, providerPaymentId: string, providerOrderId: string | null, amountPaise: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (order.paymentStatus === PaymentStatus.paid) {
        return { order, alreadyPaid: true };
      }

      await tx.payment.upsert({
        where: { providerPaymentId },
        update: { status: PaymentStatus.paid, verifiedAt: new Date(), amountPaise },
        create: {
          orderId,
          provider: 'razorpay',
          providerOrderId,
          providerPaymentId,
          amountPaise,
          currency: 'INR',
          status: PaymentStatus.paid,
          method: PaymentMethod.razorpay,
          verifiedAt: new Date(),
        },
      });

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PaymentStatus.paid,
          // Only promote an unpaid order into the kitchen queue; an order that
          // already progressed keeps its current status.
          ...(order.status === 'awaiting_payment' || order.status === 'payment_failed'
            ? { status: 'placed' as const }
            : {}),
        },
      });
      return { order: updated, alreadyPaid: false };
    });

    if (!result.alreadyPaid) {
      // A capture usually arrives on a webhook, i.e. on no user's request — so
      // the payer and the dhaba have to be named on the event or the realtime
      // gateway has nobody to deliver it to.
      await this.eventBus.publish('payment.captured', {
        orderId,
        orderNumber: result.order.orderNumber,
        amountPaise,
        userId: result.order.userId,
        dhabaId: result.order.dhabaId,
        status: result.order.status,
      });
      this.logger.log(`Order ${result.order.orderNumber} paid (${amountPaise} paise).`);
    }
    return result;
  }

  async markFailed(orderId: string, providerPaymentId: string | null, reason: string) {
    const failed = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      // Never walk back an order that already settled.
      if (order.paymentStatus === PaymentStatus.paid) return null;

      if (providerPaymentId) {
        await tx.payment.upsert({
          where: { providerPaymentId },
          update: { status: PaymentStatus.failed, failureReason: reason },
          create: {
            orderId,
            provider: 'razorpay',
            providerPaymentId,
            amountPaise: order.totalAmountPaise,
            status: PaymentStatus.failed,
            method: PaymentMethod.razorpay,
            failureReason: reason,
          },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: PaymentStatus.failed, status: 'payment_failed' },
      });
      return order;
    });

    if (!failed) return;
    await this.eventBus.publish('payment.failed', {
      orderId,
      reason,
      userId: failed.userId,
      dhabaId: failed.dhabaId,
    });
  }

  private async applyWebhookEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const entity = this.extractPaymentEntity(payload);
    if (!entity) {
      this.logger.log(`Webhook ${eventType} carried no payment entity; nothing to apply.`);
      return;
    }

    // A wallet top-up resolves to no order, so it is dispatched first.
    if (await this.applyTopUpWebhook(eventType, entity)) return;

    const orderId = await this.resolveOrderId(entity);
    if (!orderId) {
      this.logger.warn(`Webhook ${eventType} references unknown order (rzp order ${entity.order_id}).`);
      return;
    }

    switch (eventType) {
      case 'payment.captured':
      case 'order.paid':
        await this.markPaid(orderId, entity.id, entity.order_id ?? null, entity.amount);
        break;
      case 'payment.failed':
        await this.markFailed(orderId, entity.id, entity.error_description ?? 'Payment failed at gateway');
        break;
      case 'refund.processed':
      case 'refund.created':
        await this.recordRefund(orderId, entity.id, entity.amount);
        break;
      default:
        this.logger.log(`Webhook ${eventType} needs no action.`);
    }
  }

  /**
   * Handles the event if it belongs to a wallet top-up.
   *
   * Returns true when the event was consumed here, so the order path is skipped.
   */
  private async applyTopUpWebhook(
    eventType: string,
    entity: { id: string; order_id?: string | null; amount: number; error_description?: string },
  ): Promise<boolean> {
    if (!entity.order_id) return false;
    const topUp = await this.prisma.walletTopUp.findUnique({
      where: { providerOrderId: entity.order_id },
      select: { id: true },
    });
    if (!topUp) return false;

    switch (eventType) {
      case 'payment.captured':
      case 'order.paid':
        await this.creditTopUp(topUp.id, entity.id, entity.amount);
        break;
      case 'payment.failed':
        await this.markTopUpFailed(topUp.id, entity.error_description ?? 'Payment failed at gateway');
        break;
      default:
        this.logger.log(`Webhook ${eventType} needs no action for top-up ${topUp.id}.`);
    }
    return true;
  }

  /**
   * Refunds a paid order through whichever rail it was paid on.
   *
   *  - razorpay → gateway refund; the ledger entry is written when the
   *    `refund.processed` webhook lands.
   *  - wallet   → immediate wallet credit.
   *  - cod      → nothing was ever captured, so this is a no-op.
   */
  async refundOrder(orderId: string, reason: string): Promise<{ refunded: boolean; method: PaymentMethod; amountPaise: number }> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { payments: { where: { status: PaymentStatus.paid }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (order.paymentStatus !== PaymentStatus.paid) {
      return { refunded: false, method: order.paymentMethod, amountPaise: 0 };
    }

    const amountPaise = order.totalAmountPaise;

    switch (order.paymentMethod) {
      case PaymentMethod.wallet: {
        await this.wallet.refund(order.userId, amountPaise, `order-refund:${orderId}`, reason);
        await this.prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: PaymentStatus.refunded },
        });
        break;
      }
      case PaymentMethod.razorpay: {
        const providerPaymentId = order.payments[0]?.providerPaymentId;
        if (!providerPaymentId) {
          this.logger.error(`Order ${order.orderNumber} is paid but has no provider payment id; refund needs manual action.`);
          return { refunded: false, method: order.paymentMethod, amountPaise };
        }
        // The webhook writes the ledger entry; this only asks for the refund.
        await this.razorpay.refund(providerPaymentId, amountPaise, { orderId, reason });
        break;
      }
      case PaymentMethod.cod:
        // Nothing was captured — the customer simply never pays.
        return { refunded: false, method: order.paymentMethod, amountPaise: 0 };
    }

    await this.eventBus.publish('payment.refund_requested', {
      orderId,
      amountPaise,
      reason,
      userId: order.userId,
      dhabaId: order.dhabaId,
    });
    return { refunded: true, method: order.paymentMethod, amountPaise };
  }

  private async recordRefund(orderId: string, providerPaymentId: string, amountPaise: number): Promise<void> {
    const refunded = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { providerPaymentId } });
      if (payment) {
        const refundedPaise = Math.min(payment.amountPaise, payment.refundedPaise + amountPaise);
        await tx.payment.update({
          where: { providerPaymentId },
          data: {
            refundedPaise,
            status: refundedPaise >= payment.amountPaise ? PaymentStatus.refunded : PaymentStatus.partially_refunded,
          },
        });
      }
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus:
            amountPaise >= order.totalAmountPaise ? PaymentStatus.refunded : PaymentStatus.partially_refunded,
          ...(amountPaise >= order.totalAmountPaise ? { status: 'refunded' as const } : {}),
        },
      });
      return order;
    });
    await this.eventBus.publish('payment.refunded', {
      orderId,
      amountPaise,
      userId: refunded.userId,
      dhabaId: refunded.dhabaId,
    });
  }

  /** Resolves our order from a Razorpay entity, preferring the notes we set. */
  private async resolveOrderId(entity: { order_id?: string | null; notes?: Record<string, string> }): Promise<string | null> {
    const fromNotes = entity.notes?.orderId;
    if (fromNotes) {
      const exists = await this.prisma.order.findUnique({ where: { id: fromNotes }, select: { id: true } });
      if (exists) return exists.id;
    }
    if (entity.order_id) {
      const payment = await this.prisma.payment.findFirst({
        where: { providerOrderId: entity.order_id },
        select: { orderId: true },
      });
      if (payment) return payment.orderId;
    }
    return null;
  }

  private extractPaymentEntity(
    payload: Record<string, unknown>,
  ): { id: string; order_id?: string | null; amount: number; error_description?: string; notes?: Record<string, string> } | null {
    const entities = (payload.payload ?? {}) as Record<string, { entity?: Record<string, unknown> }>;
    const entity = entities.payment?.entity ?? entities.refund?.entity ?? entities.order?.entity;
    if (!entity || typeof entity.id !== 'string' || typeof entity.amount !== 'number') return null;
    return {
      id: entity.id,
      order_id: (entity.order_id as string | undefined) ?? null,
      amount: entity.amount,
      error_description: entity.error_description as string | undefined,
      notes: entity.notes as Record<string, string> | undefined,
    };
  }

  private parseWebhookBody(rawBody: Buffer): Record<string, unknown> {
    try {
      return JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Webhook body is not valid JSON.');
    }
  }

  private constantTimeEquals(expected: string, received: string): boolean {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received ?? '', 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
