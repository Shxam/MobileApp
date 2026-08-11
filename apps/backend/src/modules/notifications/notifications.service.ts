import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';

/** Newest-first page size ceiling. Notifications are a feed, not an archive. */
const MAX_PAGE_SIZE = 50;

/**
 * How long delivered notifications are kept before the sweep removes them.
 *
 * Without this the table grows without bound: every order writes four or five
 * rows and nothing ever deletes them.
 */
const RETENTION_DAYS = 30;

type NotificationType = 'order' | 'booking' | 'payment' | 'wallet' | 'general';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * The caller's own notifications, newest first.
   *
   * Scoped by `userId` from the JWT rather than a query parameter — the previous
   * controller returned a hardcoded empty array, so the frontend's bell icon was
   * permanently silent no matter what happened to the order.
   */
  async list(userId: string, limit: number, unreadOnly: boolean) {
    const take = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);

    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, ...(unreadOnly ? { read: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return { items, unreadCount };
  }

  /**
   * Marks one notification read.
   *
   * The `userId` is part of the `where`, not checked afterwards, so a request
   * for someone else's notification id updates nothing and 404s rather than
   * revealing that the id exists.
   */
  async markRead(userId: string, notificationId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
    if (count === 0) throw new NotFoundException('Notification not found.');
    return { success: true };
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { success: true, markedRead: count };
  }

  /**
   * Writes a notification.
   *
   * Never throws: a notification is a side effect of an order or payment, and
   * failing to record one must not roll back the thing that caused it. Failures
   * are logged instead.
   */
  async create(userId: string, title: string, message: string, type: NotificationType = 'general'): Promise<void> {
    try {
      await this.prisma.notification.create({ data: { userId, title, message, type } });
    } catch (error) {
      this.logger.warn(`Could not write notification for ${userId}: ${(error as Error).message}`);
    }
  }

  /** Removes read notifications past the retention window. Called by the sweep. */
  async pruneExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.notification.deleteMany({
      where: { read: true, createdAt: { lt: cutoff } },
    });
    return count;
  }

  /**
   * Subscribes to the domain events worth telling a user about.
   *
   * Wiring lives here rather than in each publisher so adding a notification
   * never means editing the service that owns the transaction — and so a
   * notification bug can never fail an order.
   */
  registerListeners(): void {
    this.eventBus.subscribe<{ userId: string; order: { orderNumber: string } }>(
      'order.created',
      ({ userId, order }) =>
        this.create(userId, 'Order placed', `Order ${order.orderNumber} is with the kitchen.`, 'order'),
    );

    this.eventBus.subscribe<{ userId: string; status: string; order: { orderNumber: string } }>(
      'order.status_changed',
      ({ userId, status, order }) => {
        const template = STATUS_MESSAGES[status];
        if (!template) return;
        return this.create(userId, template.title, template.body(order.orderNumber), 'order');
      },
    );

    this.eventBus.subscribe<{ bookingId: string; userId: string; bookingNumber: string }>(
      'booking.created',
      ({ userId, bookingNumber }) =>
        this.create(userId, 'Turf booked', `Booking ${bookingNumber} is confirmed. Show your gate pass on arrival.`, 'booking'),
    );

    this.eventBus.subscribe<{ bookingId: string; userId: string; refundedPaise: number }>(
      'booking.cancelled',
      ({ userId, refundedPaise }) =>
        this.create(
          userId,
          'Booking cancelled',
          refundedPaise > 0
            ? `Your booking was cancelled. ₹${(refundedPaise / 100).toFixed(2)} is back in your wallet.`
            : 'Your booking was cancelled.',
          'booking',
        ),
    );

    this.eventBus.subscribe<{ userId: string; amountPaise: number }>('wallet.topped_up', ({ userId, amountPaise }) =>
      this.create(userId, 'Wallet topped up', `₹${(amountPaise / 100).toFixed(2)} added to your wallet.`, 'wallet'),
    );
  }
}

/**
 * Only the transitions a customer cares about produce a notification. The
 * kitchen-internal ones (`accepted`, `assigned`) are deliberately absent —
 * a phone that buzzes eight times per order gets muted.
 */
const STATUS_MESSAGES: Record<string, { title: string; body: (orderNumber: string) => string }> = {
  preparing: { title: 'Cooking started', body: (n) => `Order ${n} is on the stove.` },
  ready_for_pickup: { title: 'Order ready', body: (n) => `Order ${n} is packed and waiting for a rider.` },
  picked_up: { title: 'On the way', body: (n) => `Order ${n} has left the dhaba. Keep your OTP handy.` },
  delivered: { title: 'Delivered', body: (n) => `Order ${n} was delivered. Enjoy!` },
  cancelled: { title: 'Order cancelled', body: (n) => `Order ${n} was cancelled.` },
  refunded: { title: 'Refund issued', body: (n) => `Your refund for order ${n} is on its way.` },
};
