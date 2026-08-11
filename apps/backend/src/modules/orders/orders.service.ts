import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { PricingService, type DeliveryType } from '../pricing/pricing.service';
import { FOOD_GST_RATE } from '../pricing/pricing.constants';
import { VouchersService } from '../pricing/vouchers.service';
import { WalletService } from '../wallet/wallet.service';
import { env } from '../../common/config/env';
import { assertTransition, isTerminal, timestampFieldFor } from './order-state-machine';
import type { CreateOrderDto, ListOrdersQueryDto } from './dto/order.dto';

type AuthUser = { userId: string; role: Role | string; phone?: string };

/** Statuses a customer still considers "in progress". */
const ACTIVE_STATUSES: OrderStatus[] = [
  'awaiting_payment',
  'placed',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'assigned',
  'picked_up',
  'out_for_delivery',
];

const ORDER_INCLUDE = {
  items: { include: { menuItem: true } },
  driverLocation: true,
  driver: { include: { user: { select: { name: true, phone: true } } } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

/**
 * Order creation, reading, and status transitions.
 *
 * The client no longer sends prices. It sends a `quoteId` produced by
 * `POST /orders/quote`; the server re-prices that cart against the live menu and
 * refuses to proceed if the total has moved. The old code accepted whole menu
 * items — price included — from the browser and `upsert`ed them into the menu,
 * so a crafted request could order anything at any price.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly pricing: PricingService,
    private readonly vouchers: VouchersService,
    private readonly wallet: WalletService,
  ) {}

  /** Prices a cart without committing to it. */
  async quote(
    userId: string,
    items: { menuItemId: string; quantity: number }[],
    deliveryType: DeliveryType = 'turf_bench',
    promoCode?: string,
  ) {
    return this.pricing.createQuote(userId, items, deliveryType, promoCode ?? null);
  }

  /**
   * Places an order against a previously issued quote.
   *
   * Everything that must not race lives inside one transaction: the idempotency
   * insert, the wallet debit, and the voucher redemption. A failure at any point
   * rolls the whole thing back, so a debited wallet without an order is not a
   * reachable state.
   */
  async createOrder(user: AuthUser, dto: CreateOrderDto) {
    // A retried submission returns the original order rather than making a second.
    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: ORDER_INCLUDE,
      });
      if (existing) {
        if (existing.userId !== user.userId) {
          throw new ConflictException('That idempotency key is already in use.');
        }
        return this.serialize(existing);
      }
    }

    const redeemed = await this.pricing.redeemQuote(dto.quoteId, user.userId);
    const paymentMethod = dto.paymentMethod as PaymentMethod;

    if (redeemed.deliveryType === 'home_delivery' && !dto.deliveryAddress?.trim()) {
      throw new BadRequestException('A delivery address is required for home delivery.');
    }

    // Razorpay orders wait for a verified capture before entering the kitchen
    // queue. COD and wallet orders are payable at creation, so they go straight
    // to `placed`.
    const status: OrderStatus = paymentMethod === PaymentMethod.razorpay ? 'awaiting_payment' : 'placed';
    const paymentStatus =
      paymentMethod === PaymentMethod.cod
        ? PaymentStatus.cod_pending
        : paymentMethod === PaymentMethod.wallet
          ? PaymentStatus.paid
          : PaymentStatus.pending;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: this.newOrderNumber(),
          userId: user.userId,
          dhabaId: env.defaultDhabaId,
          status,
          subtotalPaise: redeemed.bill.subtotalPaise,
          gstAmountPaise: redeemed.bill.gstAmountPaise,
          deliveryFeePaise: redeemed.bill.deliveryFeePaise,
          discountPaise: redeemed.bill.discountPaise,
          totalAmountPaise: redeemed.bill.totalPaise,
          paymentStatus,
          paymentMethod,
          deliveryType: redeemed.deliveryType,
          deliveryTarget: dto.deliveryTarget.trim(),
          deliveryAddress: dto.deliveryAddress?.trim() || null,
          cookingInstructions: dto.cookingInstructions?.trim() || null,
          promoCode: redeemed.promoCode,
          idempotencyKey: dto.idempotencyKey || null,
          items: {
            create: redeemed.lines.map((line) => ({
              menuItemId: line.menuItemId,
              nameSnapshot: line.name,
              quantity: line.quantity,
              unitPricePaise: line.unitPricePaise,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });

      if (paymentMethod === PaymentMethod.wallet) {
        // Conditional debit: two concurrent orders read the same balance, but
        // only one satisfies `balancePaise >= amount`. Throwing here rolls the
        // order back, so an under-funded wallet never yields an order.
        await this.wallet.debitWithin(
          tx,
          user.userId,
          redeemed.bill.totalPaise,
          `Order ${created.orderNumber}`,
          created.id,
        );
        await tx.payment.create({
          data: {
            orderId: created.id,
            provider: 'wallet',
            amountPaise: redeemed.bill.totalPaise,
            status: PaymentStatus.paid,
            method: PaymentMethod.wallet,
            verifiedAt: new Date(),
          },
        });
      }

      if (redeemed.voucherId) {
        const claimed = await this.vouchers.recordRedemption(
          tx,
          redeemed.voucherId,
          user.userId,
          created.id,
          redeemed.bill.discountPaise,
        );
        if (!claimed) {
          // Someone took the last redemption between quote and checkout.
          throw new ConflictException('That voucher is no longer available. Please review your cart.');
        }
      }

      return created;
    });

    // Only once the order is durably committed. A quote left behind after a
    // failed transaction is harmless; one consumed too early is not.
    await this.pricing.consumeQuote(dto.quoteId);

    const serialized = this.serialize(order);
    // `userId`/`dhabaId` ride alongside the serialized order rather than inside
    // it: subscribers (notifications, and the realtime rooms in Phase 7) need to
    // know who to route to, but the HTTP response body has no business carrying
    // the recipient's own id back to them.
    await this.eventBus.publish('order.created', {
      order: serialized,
      userId: order.userId,
      dhabaId: order.dhabaId,
    });
    this.logger.log(`Order ${order.orderNumber} created (${paymentMethod}, ${order.totalAmountPaise} paise).`);
    return serialized;
  }

  async listOrders(user: AuthUser, query: ListOrdersQueryDto = {}) {
    const scope = query.scope ?? 'all';
    const where: Prisma.OrderWhereInput = {};

    if (user.role === Role.customer) {
      where.userId = user.userId;
    } else if (user.role === Role.delivery_partner) {
      // A driver sees the offer pool plus their own deliveries — never another
      // driver's orders.
      const profile = await this.prisma.driverProfile.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });
      where.OR = [
        { status: 'ready_for_pickup', driverId: null },
        ...(profile ? [{ driverId: profile.id }] : []),
      ];
    } else {
      where.dhabaId = env.defaultDhabaId;
    }

    if (scope === 'active') where.status = { in: ACTIVE_STATUSES };
    if (scope === 'history') where.status = { in: ['delivered', 'cancelled', 'refunded'] };

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
      include: ORDER_INCLUDE,
    });
    return orders.map((order) => this.serialize(order));
  }

  async getOrder(user: AuthUser, id: string) {
    const order = await this.getOrderRecord(id);
    await this.assertCanView(user, order);
    return this.serialize(order);
  }

  /**
   * Moves an order through the lifecycle.
   *
   * The legal moves live in `order-state-machine.ts`, which also decides which
   * role may make them. `awaiting_payment → placed` is absent from every role:
   * only the payment service promotes an order.
   */
  async updateStatus(user: AuthUser, id: string, status: OrderStatus, reason?: string) {
    const order = await this.getOrderRecord(id);

    if (user.role === Role.customer) {
      if (order.userId !== user.userId) throw new ForbiddenException('You cannot modify this order.');
      // A customer may withdraw only before the kitchen commits ingredients.
      if (!['awaiting_payment', 'placed'].includes(order.status)) {
        throw new BadRequestException('This order can no longer be cancelled here. Please call the dhaba.');
      }
    }
    if (user.role === Role.delivery_partner) {
      const profile = await this.prisma.driverProfile.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });
      if (!profile || order.driverId !== profile.id) {
        throw new ForbiddenException('You are not assigned to this order.');
      }
    }

    assertTransition(order.status, status, user.role);

    const stampField = timestampFieldFor(status);
    const data: Prisma.OrderUpdateInput = {
      status,
      ...(stampField ? { [stampField]: new Date() } : {}),
      ...(status === 'cancelled' ? { cancellationReason: reason?.trim() || 'Cancelled' } : {}),
    };

    // Re-assert the starting status so two concurrent transitions cannot both
    // apply — the loser sees count 0 and is told the order moved on.
    const { count } = await this.prisma.order.updateMany({
      where: { id, status: order.status },
      data: data as Prisma.OrderUpdateManyMutationInput,
    });
    if (count === 0) {
      throw new ConflictException('This order was updated by someone else. Please refresh.');
    }

    const updated = await this.getOrderRecord(id);
    const serialized = this.serialize(updated);
    await this.eventBus.publish('order.status_changed', {
      orderId: id,
      status,
      order: serialized,
      userId: updated.userId,
      dhabaId: updated.dhabaId,
    });
    return serialized;
  }

  async cancelOrder(user: AuthUser, id: string, reason?: string) {
    return this.updateStatus(user, id, 'cancelled', reason);
  }

  /** Publishes the driver's live position to everyone watching the order. */
  async updateDriverLocation(
    user: AuthUser,
    id: string,
    location: { latitude: number; longitude: number; heading?: number },
  ) {
    if (user.role !== Role.delivery_partner) {
      throw new ForbiddenException('Only a delivery partner can publish live location.');
    }

    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });
    const order = await this.getOrderRecord(id);
    if (!profile || order.driverId !== profile.id) {
      throw new ForbiddenException('You are not assigned to this order.');
    }
    if (!['assigned', 'picked_up', 'out_for_delivery'].includes(order.status)) {
      throw new BadRequestException('Location sharing begins once the order is assigned.');
    }

    await this.prisma.$transaction([
      this.prisma.driverLocation.upsert({
        where: { orderId: id },
        create: { orderId: id, ...location },
        update: location,
      }),
      this.prisma.driverProfile.update({
        where: { id: profile.id },
        data: { lastLat: location.latitude, lastLng: location.longitude, lastSeenAt: new Date() },
      }),
    ]);

    await this.eventBus.publish('driver.location_updated', { orderId: id, location });
    return { orderId: id, location, updatedAt: new Date().toISOString() };
  }

  // ─── internals ────────────────────────────────────────────────────────────

  private async getOrderRecord(id: string): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }

  private async assertCanView(user: AuthUser, order: OrderWithRelations): Promise<void> {
    if (user.role === Role.customer) {
      if (order.userId !== user.userId) throw new ForbiddenException('You cannot access this order.');
      return;
    }
    if (user.role === Role.delivery_partner) {
      const profile = await this.prisma.driverProfile.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });
      // Unassigned ready orders are the offer pool every driver may see.
      const isOffer = order.status === 'ready_for_pickup' && order.driverId === null;
      if (!isOffer && (!profile || order.driverId !== profile.id)) {
        throw new ForbiddenException('You cannot access this order.');
      }
    }
    // kitchen_staff, partner and admin see their dhaba's orders.
  }

  /**
   * A short human-readable reference, e.g. "IPL-7K3M2A".
   *
   * `randomBytes` rather than `Math.random` so two replicas creating orders in
   * the same millisecond do not collide; the unique constraint is the backstop.
   */
  private newOrderNumber(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(6);
    let suffix = '';
    for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
    return `IPL-${suffix}`;
  }

  private serialize(order: OrderWithRelations) {
    const driverUser = order.driver?.user;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      isTerminal: isTerminal(order.status),
      bill: {
        subtotalPaise: order.subtotalPaise,
        // `BillBreakdown` requires the rate, not just the amount: the bill screen
        // prints "GST (5%)" and cannot recover the rate from the amount once a
        // discount has moved the total. Food is always 5% — the same constant
        // `PricingService` charged with.
        gstRate: FOOD_GST_RATE,
        gstAmountPaise: order.gstAmountPaise,
        deliveryFeePaise: order.deliveryFeePaise,
        discountPaise: order.discountPaise,
        totalPaise: order.totalAmountPaise,
      },
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      deliveryType: order.deliveryType,
      deliveryTarget: order.deliveryTarget,
      deliveryAddress: order.deliveryAddress,
      cookingInstructions: order.cookingInstructions,
      estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
      promoCode: order.promoCode,
      createdAt: order.createdAt.toISOString(),
      acceptedAt: order.acceptedAt?.toISOString() ?? null,
      readyAt: order.readyAt?.toISOString() ?? null,
      assignedAt: order.assignedAt?.toISOString() ?? null,
      pickedUpAt: order.pickedUpAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
      cancellationReason: order.cancellationReason,
      driver: order.driver
        ? {
            id: order.driver.id,
            name: driverUser?.name ?? 'IPL Dhaba Delivery Partner',
            phone: driverUser?.phone ?? null,
            vehicleNumber: order.driver.vehicleNumber,
          }
        : null,
      location: order.driverLocation
        ? {
            latitude: order.driverLocation.latitude,
            longitude: order.driverLocation.longitude,
            heading: order.driverLocation.heading,
            updatedAt: order.driverLocation.updatedAt.toISOString(),
          }
        : null,
      items: order.items.map((item) => ({
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        lineTotalPaise: item.unitPricePaise * item.quantity,
        menuItem: {
          id: item.menuItemId,
          // The snapshot, so order history survives a menu rename.
          nameEn: item.nameSnapshot || item.menuItem.name,
          nameHi: item.menuItem.nameHi ?? item.menuItem.name,
          descriptionEn: item.menuItem.description,
          descriptionHi: item.menuItem.descriptionHi ?? item.menuItem.description,
          pricePaise: item.unitPricePaise,
          category: item.menuItem.category,
          image: item.menuItem.image,
          isVeg: item.menuItem.isVeg,
          rating: item.menuItem.rating,
          prepTimeMinutes: item.menuItem.prepTimeMinutes,
        },
      })),
    };
  }
}
