import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';

/** A driver silent for this long is treated as gone. */
const DRIVER_STALE_MINUTES = 10;

/** An assigned order with no pickup after this long returns to the pool. */
const ASSIGNMENT_STALE_MINUTES = 20;

/**
 * Keeps dispatch honest when a driver's phone dies mid-delivery.
 *
 * Without this, an order claimed by a driver who then vanishes stays `assigned`
 * forever and no one else can take it.
 */
@Injectable()
export class DispatchSweepService {
  private readonly logger = new Logger(DispatchSweepService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventBus: EventBusService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweep(): Promise<void> {
    // One replica per sweep; the TTL is shorter than the interval so a crash
    // cannot wedge it.
    const ran = await this.redis.withLock('lock:dispatch-sweep', 4 * 60_000, async () => {
      await this.markStaleDriversOffline();
      await this.reclaimStalledAssignments();
      return true;
    });
    if (!ran) this.logger.debug('Another replica is sweeping dispatch; skipping.');
  }

  /** An online driver who stopped reporting location is no longer online. */
  private async markStaleDriversOffline(): Promise<void> {
    const cutoff = new Date(Date.now() - DRIVER_STALE_MINUTES * 60_000);
    const { count } = await this.prisma.driverProfile.updateMany({
      where: { isOnline: true, activeOrderId: null, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }] },
      data: { isOnline: false },
    });
    if (count > 0) this.logger.log(`Marked ${count} idle driver(s) offline.`);
  }

  /**
   * Returns stalled assignments to the pool.
   *
   * Only `assigned` orders are reclaimed — never `picked_up`. Once the food has
   * left the kitchen, taking the order away from the driver holding it would
   * send a second driver to collect an order that no longer exists.
   */
  private async reclaimStalledAssignments(): Promise<void> {
    const cutoff = new Date(Date.now() - ASSIGNMENT_STALE_MINUTES * 60_000);
    const stalled = await this.prisma.order.findMany({
      where: { status: 'assigned', assignedAt: { lt: cutoff } },
      // `userId`/`dhabaId` are selected only so the released event can be routed
      // to the customer and the dhaba's drivers.
      select: { id: true, orderNumber: true, driverId: true, userId: true, dhabaId: true },
      take: 50,
    });

    for (const order of stalled) {
      // Re-assert the predicate: the driver may have picked up since the query.
      const { count } = await this.prisma.order.updateMany({
        where: { id: order.id, status: 'assigned', assignedAt: { lt: cutoff } },
        data: { status: 'ready_for_pickup', driverId: null, assignedAt: null },
      });
      if (count === 0) continue;

      if (order.driverId) {
        await this.prisma.driverProfile.updateMany({
          where: { id: order.driverId, activeOrderId: order.id },
          data: { activeOrderId: null, isOnline: false },
        });
      }
      await this.eventBus.publish('order.released', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        driverId: order.driverId,
        userId: order.userId,
        dhabaId: order.dhabaId,
        reason: 'Driver did not pick up in time.',
      });
      this.logger.warn(`Reclaimed stalled order ${order.orderNumber} from driver ${order.driverId}.`);
    }
  }
}
