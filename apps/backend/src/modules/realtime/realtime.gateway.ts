import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { env } from '../../common/config/env';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { blocklistKey } from '../auth/token-keys';
import { ClientEvent, ServerEvent, driversRoom, kitchenRoom, orderRoom, userRoom } from './realtime.rooms';

/** What the handshake proved about the connecting socket. */
interface Principal {
  userId: string;
  role: string;
  dhabaId: string;
}

const STAFF_ROLES = new Set(['kitchen_staff', 'partner', 'admin']);

/**
 * Authenticated, room-scoped realtime.
 *
 * Two things were wrong with the gateway this replaces, and they compounded:
 * `handleConnection` accepted every socket without looking at a token, and every
 * emit went through `server.emit(...)`. Together that meant anyone who could
 * open a WebSocket to the host received every customer's order — items,
 * delivery address, total — as it happened. No account required.
 *
 * The fix is the same shape as the HTTP side: authenticate once, then decide
 * what you are allowed to see from claims the server verified. Here that means
 * rooms. A socket is placed into its rooms at connection time from its own JWT;
 * the only room it can ask for is `order:{id}`, and that request is checked
 * against the database before it is honoured.
 *
 * Fan-out crosses replicas via the Redis adapter (see `RedisIoAdapter`), because
 * a customer's browser and the kitchen display will usually be connected to
 * different pods.
 */
@WebSocketGateway({
  // Same allowlist the HTTP server uses. `origin: '*'` here would undo the CORS
  // work in main.ts — socket.io does its own CORS handling on the upgrade.
  cors: {
    origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── connection ───────────────────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    try {
      const principal = await this.authenticate(client);
      client.data.principal = principal;

      // Every socket gets its owner's private room. Order, payment, wallet and
      // booking events for one person are addressed here.
      await client.join(userRoom(principal.userId));

      if (STAFF_ROLES.has(principal.role)) {
        await client.join(kitchenRoom(principal.dhabaId));
      }
      if (principal.role === 'delivery_partner') {
        await client.join(driversRoom(principal.dhabaId));
      }

      client.emit(ClientEvent.Ready, { userId: principal.userId, role: principal.role, dhabaId: principal.dhabaId });
      this.logger.debug(`Socket ${client.id} authenticated as ${principal.role} ${principal.userId}.`);
    } catch (error) {
      // Emitted before the disconnect so the client can tell "your token is bad,
      // refresh it" from "the network dropped, retry" — otherwise every auth
      // failure looks like a transient outage and the client reconnect-loops
      // forever against a token that will never work.
      client.emit(ClientEvent.Unauthorized, { message: (error as Error).message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const principal = client.data?.principal as Principal | undefined;
    if (principal) this.logger.debug(`Socket ${client.id} (${principal.userId}) disconnected.`);
  }

  /**
   * Verifies the handshake token.
   *
   * Read from `handshake.auth`, with the `Authorization` header as a fallback
   * for non-browser clients. Deliberately *not* from the query string: query
   * strings are recorded verbatim in access logs, proxy logs and browser
   * history, and this token is a bearer credential.
   */
  private async authenticate(client: Socket): Promise<Principal> {
    const fromAuth = client.handshake.auth?.token;
    const header = client.handshake.headers?.authorization;
    const raw =
      (typeof fromAuth === 'string' && fromAuth) ||
      (typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '');

    if (!raw) throw new Error('Authentication token missing.');

    let payload: { sub?: string; role?: string; dhabaId?: string | null; type?: string };
    try {
      payload = await this.jwt.verifyAsync(raw, { secret: env.jwtSecret });
    } catch {
      throw new Error('Authentication token is invalid or expired.');
    }

    // A refresh token verifies against a different secret, so it cannot reach
    // here — but check anyway rather than relying on that staying true.
    if (payload.type !== 'access' || !payload.sub) {
      throw new Error('Authentication token is not an access token.');
    }

    // Same revocation check the HTTP guard runs. Without it, logging out closes
    // the REST session while leaving the socket subscribed to the user's orders
    // until the token's own expiry.
    if (await this.redis.get(blocklistKey(raw))) {
      throw new Error('Token has been revoked or logged out.');
    }

    return {
      userId: payload.sub,
      role: payload.role || 'customer',
      // Staff tokens carry a dhaba; customer tokens may not. The fallback
      // mirrors `AuthService.staffLogin` so both paths agree on tenancy.
      dhabaId: payload.dhabaId ?? env.defaultDhabaId,
    };
  }

  // ─── client-requested subscriptions ───────────────────────────────────────

  /**
   * Joins one order's live feed after checking the caller is entitled to it.
   *
   * This is the only room a client can ask for, so it is the only place where a
   * room name comes from user input — hence the database check. Returning a
   * plain `{ ok }` rather than throwing keeps a refused subscription from
   * looking like a transport error to the client.
   */
  @SubscribeMessage(ServerEvent.SubscribeOrder)
  async subscribeToOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { orderId?: string } | string,
  ): Promise<{ ok: boolean; orderId?: string; reason?: string }> {
    const principal = client.data?.principal as Principal | undefined;
    if (!principal) return { ok: false, reason: 'Not authenticated.' };

    const orderId = typeof body === 'string' ? body : body?.orderId;
    if (!orderId) return { ok: false, reason: 'orderId is required.' };

    if (!(await this.canWatchOrder(principal, orderId))) {
      // Deliberately the same answer whether the order does not exist or exists
      // and belongs to someone else — distinguishing them turns this into an
      // order-id oracle.
      return { ok: false, orderId, reason: 'Order not found.' };
    }

    await client.join(orderRoom(orderId));
    return { ok: true, orderId };
  }

  @SubscribeMessage(ServerEvent.UnsubscribeOrder)
  async unsubscribeFromOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { orderId?: string } | string,
  ): Promise<{ ok: boolean }> {
    const orderId = typeof body === 'string' ? body : body?.orderId;
    if (orderId) await client.leave(orderRoom(orderId));
    return { ok: true };
  }

  /**
   * The realtime equivalent of `OrdersService.assertCanView`, as a predicate.
   *
   * Kept here rather than reused from `OrdersService` because the question is
   * different: that one throws to shape an HTTP response, this one has to answer
   * yes/no for a socket, and the two would drift into each other's concerns if
   * merged.
   */
  private async canWatchOrder(principal: Principal, orderId: string): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, dhabaId: true, driverId: true, status: true },
    });
    if (!order) return false;

    if (principal.role === 'customer') {
      return order.userId === principal.userId;
    }

    if (principal.role === 'delivery_partner') {
      const profile = await this.prisma.driverProfile.findUnique({
        where: { userId: principal.userId },
        select: { id: true },
      });
      // An unclaimed ready order is the shared offer pool every driver may see.
      const isOffer = order.status === 'ready_for_pickup' && order.driverId === null;
      return isOffer || (!!profile && order.driverId === profile.id);
    }

    // kitchen_staff, partner, admin — their own dhaba only.
    return STAFF_ROLES.has(principal.role) && order.dhabaId === principal.dhabaId;
  }

  // ─── domain events → rooms ────────────────────────────────────────────────

  onModuleInit(): void {
    this.eventBus.subscribe<{ order: any; userId: string; dhabaId: string }>('order.created', (e) => {
      this.emit([userRoom(e.userId), kitchenRoom(e.dhabaId)], ClientEvent.OrderCreated, { order: e.order });
    });

    this.eventBus.subscribe<{ orderId: string; status: string; order: any; userId: string; dhabaId: string }>(
      'order.status_changed',
      (e) => {
        const rooms = [userRoom(e.userId), kitchenRoom(e.dhabaId), orderRoom(e.orderId)];
        if (e.status === 'cancelled' || e.status === 'delivery_failed') {
          rooms.push(driversRoom(e.dhabaId));
        }
        this.emit(
          rooms,
          ClientEvent.OrderUpdated,
          { orderId: e.orderId, status: e.status, order: e.order },
        );
        // Entering the pool is a separate signal so a driver app can render its
        // offer list from one event instead of filtering every status change.
        if (e.status === 'ready_for_pickup') {
          this.emit([driversRoom(e.dhabaId)], ClientEvent.OrderOffered, { orderId: e.orderId, order: e.order });
        }
      },
    );

    this.eventBus.subscribe<{ orderId: string; orderNumber: string; driverId: string; reason: string; dhabaId: string }>(
      'order.issue_reported',
      (e) => {
        this.emit([kitchenRoom(e.dhabaId), orderRoom(e.orderId)], ClientEvent.OrderUpdated, {
          orderId: e.orderId,
          isFlagged: true,
          flaggedReason: e.reason,
        });
      },
    );

    this.eventBus.subscribe<{ orderId: string; orderNumber: string; driverId: string; userId: string; dhabaId: string }>(
      'order.assigned',
      (e) => {
        this.emit(
          [userRoom(e.userId), kitchenRoom(e.dhabaId), orderRoom(e.orderId)],
          ClientEvent.OrderUpdated,
          { orderId: e.orderId, orderNumber: e.orderNumber, status: 'assigned', driverId: e.driverId },
        );
        // Tells the other drivers to drop it from their list. It carries no
        // order detail — the drivers who did not win the claim are not entitled
        // to the customer's address.
        this.emit([driversRoom(e.dhabaId)], ClientEvent.OrderTaken, { orderId: e.orderId });
      },
    );

    this.eventBus.subscribe<{
      orderId: string;
      orderNumber: string;
      userId: string;
      dhabaId: string;
      driverId: string;
      deliveryOtp: string;
    }>('order.picked_up', (e) => {
      // The OTP is the only thing standing between "the driver has the food" and
      // "the driver can close the order without handing it over", so it goes to
      // exactly one room: the customer's own. It must never be included in the
      // order-room payload — the driver is in that room.
      this.emit([userRoom(e.userId)], ClientEvent.DeliveryOtpIssued, {
        orderId: e.orderId,
        orderNumber: e.orderNumber,
        deliveryOtp: e.deliveryOtp,
      });

      this.emit(
        [userRoom(e.userId), kitchenRoom(e.dhabaId), orderRoom(e.orderId)],
        ClientEvent.OrderUpdated,
        { orderId: e.orderId, orderNumber: e.orderNumber, status: 'picked_up', driverId: e.driverId },
      );
    });

    this.eventBus.subscribe<{ orderId: string; orderNumber: string; userId: string; dhabaId: string }>(
      'order.delivered',
      (e) => {
        this.emit(
          [userRoom(e.userId), kitchenRoom(e.dhabaId), orderRoom(e.orderId)],
          ClientEvent.OrderUpdated,
          { orderId: e.orderId, orderNumber: e.orderNumber, status: 'delivered' },
        );
      },
    );

    this.eventBus.subscribe<{
      orderId: string;
      orderNumber?: string;
      userId: string;
      dhabaId: string;
      reason: string | null;
    }>('order.released', (e) => {
      this.emit(
        [userRoom(e.userId), kitchenRoom(e.dhabaId), orderRoom(e.orderId)],
        ClientEvent.OrderUpdated,
        { orderId: e.orderId, status: 'ready_for_pickup', reason: e.reason },
      );
      this.emit([driversRoom(e.dhabaId)], ClientEvent.OrderOffered, { orderId: e.orderId });
    });

    // The highest-frequency event in the system — one per driver every few
    // seconds. Order room only: nobody who is not watching this specific
    // delivery has any use for a rider's coordinates.
    this.eventBus.subscribe<{ orderId: string; location: unknown }>('driver.location_updated', (e) => {
      this.emit([orderRoom(e.orderId)], ClientEvent.DriverLocation, { orderId: e.orderId, location: e.location });
    });

    for (const topic of ['payment.captured', 'payment.failed', 'payment.refunded'] as const) {
      this.eventBus.subscribe<{ orderId: string; userId: string; dhabaId: string; amountPaise?: number; reason?: string }>(
        topic,
        (e) => {
          const rooms = [userRoom(e.userId), orderRoom(e.orderId)];
          // The kitchen needs to know an order was paid for (it can start
          // cooking) and that one failed (it must not) — but a refund is between
          // the customer and the business.
          if (topic !== 'payment.refunded') rooms.push(kitchenRoom(e.dhabaId));
          this.emit(rooms, ClientEvent.PaymentUpdated, {
            orderId: e.orderId,
            event: topic,
            amountPaise: e.amountPaise,
            reason: e.reason,
          });
        },
      );
    }

    this.eventBus.subscribe<{ userId: string; amountPaise: number }>('wallet.topped_up', (e) => {
      this.emit([userRoom(e.userId)], ClientEvent.WalletUpdated, { amountPaise: e.amountPaise });
    });

    for (const topic of ['booking.created', 'booking.cancelled'] as const) {
      this.eventBus.subscribe<{ bookingId: string; userId: string }>(topic, (e) => {
        this.emit([userRoom(e.userId)], ClientEvent.BookingUpdated, { bookingId: e.bookingId, event: topic });
      });
    }

    this.logger.log('RealtimeGateway subscribed to domain events.');
  }

  /**
   * Emits to a set of rooms.
   *
   * Chained `.to()` calls union the rooms and deduplicate recipients, so a
   * socket in two of them receives one copy rather than two. Empty room names
   * are dropped: a `user:undefined` room silently matches nobody, which would
   * turn a missing routing field into a mysteriously quiet client instead of a
   * loud failure.
   */
  private emit(rooms: string[], event: string, payload: unknown): void {
    if (!this.server) return;

    const targets = rooms.filter((room) => !room.endsWith(':undefined') && !room.endsWith(':null'));
    if (targets.length !== rooms.length) {
      this.logger.warn(`Dropped malformed room(s) for ${event}: ${rooms.filter((r) => !targets.includes(r)).join(', ')}`);
    }
    if (targets.length === 0) return;

    let channel = this.server.to(targets[0]);
    for (const room of targets.slice(1)) channel = channel.to(room);
    channel.emit(event, { ...(payload as object), timestamp: new Date().toISOString() });
  }
}
