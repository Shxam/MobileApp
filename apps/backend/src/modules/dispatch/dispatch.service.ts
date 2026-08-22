import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { env, FEATURES } from '../../common/config/env';

/** Wrong-OTP attempts before the driver must call the dhaba. */
const MAX_OTP_ATTEMPTS = 5;

const OTP_SALT_ROUNDS = 10;

export interface DriverStatusView {
  driverId: string;
  isOnline: boolean;
  activeOrderId: string | null;
  vehicleNumber: string | null;
  rating: number;
}

/**
 * Driver dispatch: going online, claiming an order, pickup, and OTP delivery.
 *
 * None of this existed before — there was no `driverId` on an order, no
 * assignment step, and any authenticated `delivery_partner` could mark *any*
 * order delivered.
 */
@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /** Creates the driver's profile on first use. */
  async ensureProfile(userId: string) {
    return this.prisma.driverProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, dhabaId: env.defaultDhabaId },
    });
  }

  async setOnline(userId: string, isOnline: boolean): Promise<DriverStatusView> {
    const profile = await this.ensureProfile(userId);
    const updated = await this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: { isOnline, lastSeenAt: new Date() },
    });
    this.logger.log(`Driver ${updated.id} is now ${isOnline ? 'online' : 'offline'}.`);
    return this.toStatusView(updated);
  }

  async getStatus(userId: string): Promise<DriverStatusView> {
    return this.toStatusView(await this.ensureProfile(userId));
  }

  /**
   * Orders waiting for a driver.
   *
   * A driver already carrying an order sees an empty pool — one delivery at a
   * time keeps food hot and makes the assignment invariant simple.
   */
  async availableOrders(userId: string) {
    const profile = await this.ensureProfile(userId);
    if (profile.activeOrderId) return [];

    const orders = await this.prisma.order.findMany({
      where: { status: 'ready_for_pickup', driverId: null, dhabaId: profile.dhabaId },
      orderBy: { readyAt: 'asc' },
      take: 20,
      include: { items: { select: { quantity: true, nameSnapshot: true } } },
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      deliveryType: order.deliveryType,
      deliveryTarget: order.deliveryTarget,
      deliveryAddress: order.deliveryAddress,
      totalPaise: order.totalAmountPaise,
      // The driver must know whether to collect cash.
      collectCashPaise: order.paymentMethod === PaymentMethod.cod ? order.totalAmountPaise : 0,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      readyAt: order.readyAt?.toISOString() ?? null,
    }));
  }

  /**
   * Claims an order for this driver.
   *
   * The correctness crux of the whole dispatch path. Two drivers tapping Accept
   * at the same instant must not both win, so this is a conditional
   * `updateMany` — never a read-then-write. Postgres serialises the two updates;
   * the second matches zero rows because `driverId` is no longer null.
   */
  async claimOrder(userId: string, orderId: string) {
    const profile = await this.ensureProfile(userId);
    if (!profile.isOnline) {
      throw new BadRequestException('Go online before accepting deliveries.');
    }
    if (profile.activeOrderId && profile.activeOrderId !== orderId) {
      throw new ConflictException('Finish your current delivery first.');
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, driverId: null, status: 'ready_for_pickup' },
        data: { driverId: profile.id, status: 'assigned', assignedAt: new Date() },
      });
      if (count === 0) {
        // Either another driver won the race, or the order is not claimable.
        const current = await tx.order.findUnique({ where: { id: orderId }, select: { driverId: true } });
        if (!current) throw new NotFoundException('Order not found.');
        throw new ConflictException('That order has already been assigned.');
      }

      // Mirror the claim onto the profile so the one-delivery-at-a-time rule is
      // enforceable without scanning orders.
      await tx.driverProfile.update({
        where: { id: profile.id },
        data: { activeOrderId: orderId },
      });

      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    });

    // `userId`/`dhabaId` are routing fields: the realtime gateway addresses this
    // to the customer, the dhaba's kitchen, and the remaining drivers (so the
    // order leaves their offer list) without a second database read per socket.
    await this.eventBus.publish('order.assigned', {
      orderId,
      orderNumber: order.orderNumber,
      driverId: profile.id,
      userId: order.userId,
      dhabaId: order.dhabaId,
    });
    this.logger.log(`Order ${order.orderNumber} claimed by driver ${profile.id}.`);
    return { orderId, orderNumber: order.orderNumber, status: order.status };
  }

  /**
   * Marks the order picked up and issues the delivery OTP.
   *
   * The plaintext OTP goes to the customer only — the driver receives nothing
   * but confirmation. Only a bcrypt hash is stored, so a database read cannot
   * be used to close someone else's delivery.
   */
  async markPickedUp(userId: string, orderId: string) {
    const profile = await this.requireAssignment(userId, orderId);
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status !== 'assigned') {
      throw new BadRequestException(`This order is ${order.status}; it cannot be picked up.`);
    }

    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const deliveryOtpHash = await bcrypt.hash(otp, OTP_SALT_ROUNDS);

    const { count } = await this.prisma.order.updateMany({
      where: { id: orderId, status: 'assigned', driverId: profile.id },
      data: { status: 'picked_up', pickedUpAt: new Date(), deliveryOtpHash, deliveryOtpAttempts: 0 },
    });
    if (count === 0) throw new ConflictException('This order was updated by someone else. Please refresh.');

    // The customer's copy of the OTP travels on the event, addressed to them.
    // The gateway routes `deliveryOtp` to the customer's private room *only* —
    // it must never reach the order room, which the driver is also in.
    await this.eventBus.publish('order.picked_up', {
      orderId,
      orderNumber: order.orderNumber,
      userId: order.userId,
      dhabaId: order.dhabaId,
      driverId: profile.id,
      deliveryOtp: otp,
    });
    this.logger.log(`Order ${order.orderNumber} picked up by driver ${profile.id}.`);
    return { orderId, status: 'picked_up' as OrderStatus, otpIssued: true };
  }

  /**
   * Completes the delivery against the customer's OTP.
   *
   * This is what replaces "any driver can mark any order delivered". A wrong
   * code increments a counter and the order locks after `MAX_OTP_ATTEMPTS`.
   */
  async completeDelivery(userId: string, orderId: string, otp: string) {
    const profile = await this.requireAssignment(userId, orderId);
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    if (!['picked_up', 'out_for_delivery'].includes(order.status)) {
      throw new BadRequestException(`This order is ${order.status}; it cannot be delivered.`);
    }
    if (!order.deliveryOtpHash) {
      throw new BadRequestException('No delivery code was issued for this order.');
    }
    if (order.deliveryOtpAttempts >= MAX_OTP_ATTEMPTS) {
      throw new ForbiddenException('Too many incorrect codes. Please call the dhaba to complete this delivery.');
    }

    const matches = await bcrypt.compare(otp.trim(), order.deliveryOtpHash);
    if (!matches) {
      const { deliveryOtpAttempts } = await this.prisma.order.update({
        where: { id: orderId },
        data: { deliveryOtpAttempts: { increment: 1 } },
        select: { deliveryOtpAttempts: true },
      });
      const remaining = Math.max(0, MAX_OTP_ATTEMPTS - deliveryOtpAttempts);
      throw new BadRequestException(
        remaining > 0
          ? `Incorrect delivery code. ${remaining} attempt(s) remaining.`
          : 'Too many incorrect codes. Please call the dhaba to complete this delivery.',
      );
    }

    const delivered = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, driverId: profile.id, status: { in: ['picked_up', 'out_for_delivery'] } },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
          // Cash changes hands at the door, so COD settles here.
          ...(order.paymentMethod === PaymentMethod.cod ? { paymentStatus: PaymentStatus.paid } : {}),
          // Burn the code so it cannot be replayed.
          deliveryOtpHash: null,
        },
      });
      if (count === 0) throw new ConflictException('This order was updated by someone else. Please refresh.');

      if (order.paymentMethod === PaymentMethod.cod) {
        await tx.payment.create({
          data: {
            orderId,
            provider: 'cash',
            amountPaise: order.totalAmountPaise,
            status: PaymentStatus.paid,
            method: PaymentMethod.cod,
            verifiedAt: new Date(),
          },
        });
      }

      // Free the driver for the next delivery.
      await tx.driverProfile.updateMany({
        where: { id: profile.id, activeOrderId: orderId },
        data: { activeOrderId: null },
      });

      // Credit fan points to customer: 1 point per ₹10 (1000 paise) spent (if feature enabled).
      if (FEATURES.loyaltyAndVouchersEnabled) {
        const points = Math.floor(order.totalAmountPaise / 1000);
        if (points > 0) {
          await tx.fanPoints.upsert({
            where: { userId: order.userId },
            update: { balance: { increment: points } },
            create: { userId: order.userId, balance: points },
          });
        }
      }

      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    });

    await this.eventBus.publish('order.delivered', {
      orderId,
      orderNumber: delivered.orderNumber,
      userId: delivered.userId,
      dhabaId: delivered.dhabaId,
      driverId: profile.id,
    });
    this.logger.log(`Order ${delivered.orderNumber} delivered by driver ${profile.id}.`);
    return { orderId, status: delivered.status, paymentStatus: delivered.paymentStatus };
  }

  /**
   * Hands an order back to the pool — a breakdown, a wrong address, anything.
   *
   * The order returns to `ready_for_pickup` rather than being cancelled, so
   * another driver can take it.
   */
  async releaseOrder(userId: string, orderId: string, reason?: string) {
    const profile = await this.requireAssignment(userId, orderId);

    const released = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, driverId: profile.id, status: { in: ['assigned', 'picked_up', 'out_for_delivery'] } },
        data: {
          status: 'ready_for_pickup',
          driverId: null,
          assignedAt: null,
          pickedUpAt: null,
          // The next driver gets a fresh code.
          deliveryOtpHash: null,
          deliveryOtpAttempts: 0,
        },
      });
      if (count === 0) throw new ConflictException('This order is no longer yours to release.');

      await tx.driverProfile.updateMany({
        where: { id: profile.id, activeOrderId: orderId },
        data: { activeOrderId: null },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { userId: true, dhabaId: true, orderNumber: true },
      });
    });

    // Routed to the dhaba's drivers so the order reappears in their offer list
    // without waiting for a poll, and to the customer so the app stops showing a
    // rider who is no longer coming.
    await this.eventBus.publish('order.released', {
      orderId,
      orderNumber: released.orderNumber,
      driverId: profile.id,
      userId: released.userId,
      dhabaId: released.dhabaId,
      reason: reason ?? null,
    });
    this.logger.warn(`Driver ${profile.id} released order ${orderId}: ${reason ?? 'no reason given'}`);
    return { orderId, status: 'ready_for_pickup' as OrderStatus };
  }

  /** The order this driver is currently carrying, if any. */
  async currentDelivery(userId: string) {
    const profile = await this.ensureProfile(userId);
    if (!profile.activeOrderId) return null;
    return this.prisma.order.findUnique({
      where: { id: profile.activeOrderId },
      include: { items: true, driverLocation: true },
    });
  }

  /** Flags a problem on an active delivery without changing order status. */
  async reportIssue(userId: string, orderId: string, reason: string) {
    const profile = await this.requireAssignment(userId, orderId);
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { isFlagged: true, flaggedReason: reason, flaggedAt: new Date() },
    });

    await this.eventBus.publish('order.issue_reported', {
      orderId,
      orderNumber: order.orderNumber,
      driverId: profile.id,
      reason,
      dhabaId: order.dhabaId,
    });

    this.logger.warn(`Driver ${profile.id} reported issue on order ${order.orderNumber}: ${reason}`);
    return { orderId, isFlagged: true, flaggedReason: reason };
  }

  private async requireAssignment(userId: string, orderId: string) {
    const profile = await this.ensureProfile(userId);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { driverId: true },
    });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.driverId !== profile.id) {
      throw new ForbiddenException('You are not assigned to this order.');
    }
    return profile;
  }

  private toStatusView(profile: Prisma.DriverProfileGetPayload<object>): DriverStatusView {
    return {
      driverId: profile.id,
      isOnline: profile.isOnline,
      activeOrderId: profile.activeOrderId,
      vehicleNumber: profile.vehicleNumber,
      rating: profile.rating,
    };
  }
}
