// ===================================================
// Phase 7 verification: realtime.
//
// The plan's acceptance line is "customer A cannot receive customer B's order
// events". That is the headline, but the gateway this replaces failed it in two
// independent ways, so both are covered:
//
//   1. `handleConnection` accepted every socket without reading a token, so
//      there was no "customer A" to speak of — only sockets.
//   2. Every emit went through `server.emit(...)`, which reaches all of them, so
//      even an authenticated gateway would still have leaked every order.
//
// Events are published straight onto the event bus rather than driven through
// HTTP. The routing table is what Phase 7 changed; re-driving the whole order
// lifecycle would re-test Phases 3–5 and would hide a routing bug behind a
// lifecycle failure.
// ===================================================

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OrderStatus, Role } from '@prisma/client';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { env } from '../../common/config/env';
import { blocklistKey } from '../auth/token-keys';
import { ClientEvent, ServerEvent } from './realtime.rooms';

interface TestUser {
  id: string;
  token: string;
}

describe('Realtime gateway (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let redis: RedisService;
  let bus: EventBusService;
  let url: string;

  const sockets: Socket[] = [];

  let customerA: TestUser;
  let customerB: TestUser;
  let driver: TestUser;
  let driverProfileId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();

    // A real listener rather than `init()`: socket.io attaches to the HTTP
    // server, so there is nothing to connect to until it is bound. Port 0 lets
    // the OS choose one that is free.
    await app.listen(0);
    // `getUrl()` reports the IPv6 loopback on some hosts, which resolves fine
    // but reads badly in failure output.
    url = (await app.getUrl()).replace('[::1]', '127.0.0.1');

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    redis = app.get(RedisService);
    bus = app.get(EventBusService);

    customerA = await makeUser('+919555000101', 'Realtime Customer A', Role.customer);
    customerB = await makeUser('+919555000102', 'Realtime Customer B', Role.customer);
    driver = await makeUser('+919555000103', 'Realtime Driver', Role.delivery_partner);

    const profile = await prisma.driverProfile.upsert({
      where: { userId: driver.id },
      update: { isOnline: true },
      create: { userId: driver.id, dhabaId: env.defaultDhabaId, isOnline: true },
    });
    driverProfileId = profile.id;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.close();
    await app.close();
  });

  async function makeUser(phone: string, name: string, role: Role): Promise<TestUser> {
    const user = await prisma.user.upsert({
      where: { phone },
      update: { role },
      create: { phone, name, role, dhabaId: env.defaultDhabaId },
    });
    // Signed with the app's own key and claim shape, so the handshake exercises
    // the real verification path rather than a stubbed principal.
    const token = jwt.sign(
      { sub: user.id, phone: user.phone, role, dhabaId: env.defaultDhabaId, type: 'access' },
      { secret: env.jwtSecret, expiresIn: '30m' },
    );
    return { id: user.id, token };
  }

  /** Connects and registers the socket for teardown. `reconnection: false` so a
   *  rejected handshake fails the test instead of looping until the timeout. */
  function connect(token?: string): Socket {
    const socket = io(url, {
      transports: ['websocket'],
      reconnection: false,
      ...(token ? { auth: { token } } : {}),
    });
    sockets.push(socket);
    return socket;
  }

  async function connectReady(token: string): Promise<Socket> {
    const socket = connect(token);
    await next(socket, ClientEvent.Ready);
    return socket;
  }

  /** Resolves with the first payload for `event`; rejects if it never arrives. */
  function next<T = Record<string, unknown>>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}".`)), timeoutMs);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  /**
   * Records every occurrence of `event` from this moment on.
   *
   * The negative assertions need this rather than `next()`: a promise cannot
   * prove absence, and attaching a listener after publishing would miss a leak
   * that arrived promptly — the only kind this gateway would ever produce.
   */
  function collect(socket: Socket, event: string): unknown[] {
    const seen: unknown[] = [];
    socket.on(event, (payload: unknown) => seen.push(payload));
    return seen;
  }

  /** Long enough for a `setImmediate` publish plus a loopback round trip. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 750));

  async function stageOrder(
    userId: string,
    status: OrderStatus = OrderStatus.ready_for_pickup,
    driverId: string | null = null,
  ) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return prisma.order.create({
      data: {
        orderNumber: `IPL-R${suffix}`,
        userId,
        driverId,
        dhabaId: env.defaultDhabaId,
        status,
        subtotalPaise: 200_00,
        gstAmountPaise: 10_00,
        deliveryFeePaise: 30_00,
        totalAmountPaise: 240_00,
        paymentStatus: 'paid',
        paymentMethod: 'wallet',
        deliveryType: 'turf_bench',
        deliveryTarget: 'Cage 2 (Bench 1)',
      },
    });
  }

  /**
   * Asserts a handshake was refused.
   *
   * Every listener is attached before anything is awaited. The server emits and
   * then disconnects in the same tick, so a listener attached after the first
   * `await` can miss both packets and report a timeout that says nothing about
   * which of the two actually happened.
   */
  async function expectRefused(socket: Socket): Promise<{ message?: string }> {
    const refusals: { message?: string }[] = [];
    const admissions: unknown[] = [];
    let disconnected = false;

    socket.on(ClientEvent.Unauthorized, (payload: { message?: string }) => refusals.push(payload));
    socket.on(ClientEvent.Ready, (payload: unknown) => admissions.push(payload));
    socket.on('disconnect', () => {
      disconnected = true;
    });

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && refusals.length === 0 && admissions.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Named explicitly so a regression reads as "the socket was admitted"
    // rather than as an inscrutable timeout.
    expect(admissions).toEqual([]);
    expect(refusals).toHaveLength(1);

    while (Date.now() < deadline && !disconnected) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(disconnected || socket.disconnected).toBe(true);
    return refusals[0];
  }

  it('rejects a socket that arrives without a token', async () => {
    // The gateway emits `realtime:unauthorized` before disconnecting, so the
    // client can distinguish a bad token from a dropped network — otherwise
    // every auth failure would read as an outage and reconnect-loop forever.
    const refusal = await expectRefused(connect());
    expect(refusal.message).toMatch(/token/i);
  });

  it('rejects a garbage token', async () => {
    const refusal = await expectRefused(connect('not.a.jwt'));
    expect(refusal.message).toMatch(/invalid or expired/i);
  });

  it('refuses a revoked token at the handshake (logged-out user)', async () => {
    // Logging out must close the socket session too. Without this check the REST
    // session ends while the socket stays subscribed to the user's orders until
    // the token's own expiry.
    await redis.set(blocklistKey(customerB.token), '1', 3600);
    try {
      const refusal = await expectRefused(connect(customerB.token));
      expect(refusal.message).toMatch(/revoked|logged out/i);
    } finally {
      // In a `finally` so a failure here cannot leave customer B's token
      // blocklisted for the tests that follow.
      await redis.del(blocklistKey(customerB.token));
    }
  });

  it('does not let customer A receive customer B’s order events', async () => {
    const orderB = await stageOrder(customerB.id, OrderStatus.placed);
    const socketA = await connectReady(customerA.token);

    const orderUpdated = collect(socketA, ClientEvent.OrderUpdated);

    await bus.publish('order.status_changed', {
      orderId: orderB.id,
      status: OrderStatus.accepted,
      order: { id: orderB.id, status: OrderStatus.accepted },
      userId: customerB.id,
      dhabaId: env.defaultDhabaId,
    });

    await settle();

    // The whole assertion: after the event was routed and time was given for a
    // leak to arrive, A has heard nothing about B's order.
    expect(orderUpdated).toEqual([]);
    socketA.close();
  });

  it('delivers an order update to the customer it belongs to', async () => {
    const orderA = await stageOrder(customerA.id, OrderStatus.placed);
    const socketA = await connectReady(customerA.token);

    const orderUpdated = collect(socketA, ClientEvent.OrderUpdated);

    await bus.publish('order.status_changed', {
      orderId: orderA.id,
      status: OrderStatus.accepted,
      order: { id: orderA.id, status: OrderStatus.accepted },
      userId: customerA.id,
      dhabaId: env.defaultDhabaId,
    });

    const payload = await next(socketA, ClientEvent.OrderUpdated);
    expect(payload).toMatchObject({ orderId: orderA.id, status: OrderStatus.accepted });
    socketA.close();
  });

  it('refuses order:subscribe on another customer’s order without joining the room', async () => {
    const orderB = await stageOrder(customerB.id, OrderStatus.placed);
    const socketA = await connectReady(customerA.token);
    const orderUpdated = collect(socketA, ClientEvent.OrderUpdated);

    // Same answer whether the order is missing or belongs to someone else, so
    // this endpoint never becomes an order-id oracle.
    const reply = (await socketA.timeout(5000).emitWithAck(ServerEvent.SubscribeOrder, { orderId: orderB.id })) as {
      ok: boolean;
    };
    expect(reply.ok).toBe(false);

    await bus.publish('order.status_changed', {
      orderId: orderB.id,
      status: OrderStatus.accepted,
      order: { id: orderB.id, status: OrderStatus.accepted },
      userId: customerB.id,
      dhabaId: env.defaultDhabaId,
    });

    // A refused subscribe must not join the room anyway — the event addressed
    // to `order:{id}` reaches A only if it did.
    await settle();
    expect(orderUpdated).toEqual([]);
    socketA.close();
  });

  it('routes the delivery OTP to the customer’s room only, never the order room', async () => {
    // Assigned to the driver, so their `order:subscribe` is honoured — this is
    // the real post-pickup arrangement, and the reason the OTP cannot ride the
    // order room: the person it defends against is a member of it.
    const order = await stageOrder(customerA.id, OrderStatus.picked_up, driverProfileId);

    const driverSocket = await connectReady(driver.token);
    const joined = (await driverSocket.timeout(5000).emitWithAck(ServerEvent.SubscribeOrder, {
      orderId: order.id,
    })) as { ok: boolean };
    expect(joined.ok).toBe(true);

    const customerSocket = await connectReady(customerA.token);

    const otpOnCustomerRoom = collect(customerSocket, ClientEvent.DeliveryOtpIssued);
    const otpOnOrderRoom = collect(driverSocket, ClientEvent.DeliveryOtpIssued);
    const updateOnOrderRoom = collect(driverSocket, ClientEvent.OrderUpdated);

    await bus.publish('order.picked_up', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      deliveryOtp: '987654',
      userId: customerA.id,
      dhabaId: env.defaultDhabaId,
      driverId: driverProfileId,
    });

    await expect(next(customerSocket, ClientEvent.DeliveryOtpIssued)).resolves.toMatchObject({
      orderId: order.id,
      deliveryOtp: '987654',
    });
    await settle();

    expect(otpOnCustomerRoom).toHaveLength(1);
    // The driver is in the room and demonstrably receiving from it — the status
    // update arrived — yet the code did not. Without this second assertion an
    // unjoined room would pass the test for the wrong reason.
    expect(updateOnOrderRoom).toHaveLength(1);
    expect(otpOnOrderRoom).toEqual([]);
    expect(JSON.stringify(updateOnOrderRoom)).not.toContain('987654');

    customerSocket.close();
    driverSocket.close();
  });
});
