import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { PaymentsService } from './payments.service';
import { RazorpayClient } from './razorpay.client';

/** Orders older than this with no settlement are worth asking Razorpay about. */
const STALE_AFTER_MINUTES = 15;

/** Give up and cancel after this long — the customer has clearly walked away. */
const ABANDON_AFTER_MINUTES = 120;

/**
 * Catches the case a webhook alone cannot: Razorpay captured the money but the
 * webhook never reached us (deploy window, network partition, bad TLS).
 *
 * Runs every five minutes, asks Razorpay the state of each stuck order, and
 * settles or abandons accordingly. Everything it calls is idempotent, so
 * overlapping with a late webhook is harmless.
 */
@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly razorpay: RazorpayClient,
    private readonly redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcilePendingPayments(): Promise<void> {
    if (!this.razorpay.isConfigured) return;

    // One replica per sweep. The TTL is shorter than the interval, so a crashed
    // run cannot wedge reconciliation permanently.
    const ran = await this.redis.withLock('lock:payment-reconciliation', 4 * 60_000, async () => {
      await this.sweep();
      return true;
    });
    if (!ran) this.logger.debug('Another replica is reconciling; skipping.');
  }

  private async sweep(): Promise<void> {
    const staleBefore = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000);
    const abandonBefore = new Date(Date.now() - ABANDON_AFTER_MINUTES * 60_000);

    const stuck = await this.prisma.order.findMany({
      where: {
        status: 'awaiting_payment',
        paymentStatus: PaymentStatus.pending,
        createdAt: { lt: staleBefore },
      },
      include: { payments: { where: { providerOrderId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1 } },
      take: 100,
    });

    if (stuck.length === 0) return;
    this.logger.log(`Reconciling ${stuck.length} order(s) stuck in awaiting_payment.`);

    for (const order of stuck) {
      try {
        const providerOrderId = order.payments[0]?.providerOrderId;
        if (!providerOrderId) {
          // No intent was ever opened; the customer abandoned before Checkout.
          if (order.createdAt < abandonBefore) await this.abandon(order.id, 'No payment was started.');
          continue;
        }

        const attempts = await this.razorpay.fetchPaymentsForOrder(providerOrderId);
        const captured = attempts.find((p) => p.status === 'captured');

        if (captured) {
          this.logger.warn(`Order ${order.orderNumber} was captured at Razorpay but never settled here — settling now.`);
          await this.payments.markPaid(order.id, captured.id, providerOrderId, captured.amount);
          continue;
        }

        const authorized = attempts.find((p) => p.status === 'authorized');
        if (authorized) {
          // Authorized but not captured: leave it. Razorpay auto-captures, and
          // cancelling here could strand a hold on the customer's card.
          this.logger.log(`Order ${order.orderNumber} is authorized pending capture; leaving it.`);
          continue;
        }

        if (order.createdAt < abandonBefore) {
          const failed = attempts.find((p) => p.status === 'failed');
          await this.abandon(order.id, failed?.error_description ?? 'Payment was not completed in time.');
        }
      } catch (error) {
        // One bad order must not stop the sweep.
        this.logger.error(`Reconciling ${order.orderNumber} failed: ${(error as Error).message}`);
      }
    }
  }

  private async abandon(orderId: string, reason: string): Promise<void> {
    await this.prisma.order.updateMany({
      // Re-assert the predicate: a webhook may have settled this order between
      // the query above and now.
      where: { id: orderId, status: 'awaiting_payment', paymentStatus: PaymentStatus.pending },
      data: {
        status: 'cancelled',
        paymentStatus: PaymentStatus.failed,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });
    this.logger.log(`Abandoned unpaid order ${orderId}: ${reason}`);
  }
}
