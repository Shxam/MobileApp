// ===================================================
// Phase 5 verification: dispatch and delivery.
//
// Two properties here are the ones worth proving, because both are the kind
// that a single-threaded test would pass while production fails:
//
//   1. Two drivers tapping Accept on the same order at the same instant — one
//      must win, one must be told it is gone. Never both.
//   2. A wrong delivery OTP must not close the order. Before Phase 5 any
//      authenticated `delivery_partner` could mark *any* order delivered.
// ===================================================

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import supertest from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';

describe('Dispatch and delivery (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  // Two distinct drivers, so the claim race is between real principals rather
  // than two requests from one account.
  const drivers: { userId: string; token: string }[] = [];
  let customerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    // The app's own client, not a second one. Every extra `new PrismaClient()`
    // opens its own pool against a Neon instance with a modest connection
    // ceiling, and the suites exhausting it surfaced as DNS/connection errors
    // that read like an outage rather than like saturation.
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    const customer = await prisma.user.findUniqueOrThrow({ where: { phone: '+919876543210' } });
    customerId = customer.id;

    for (const suffix of ['a', 'b']) {
      const user = await prisma.user.upsert({
        where: { phone: `+9199990000${suffix === 'a' ? 1 : 2}` },
        update: { role: 'delivery_partner' },
        create: {
          phone: `+9199990000${suffix === 'a' ? 1 : 2}`,
          name: `Race Driver ${suffix.toUpperCase()}`,
          role: 'delivery_partner',
          dhabaId: env.defaultDhabaId,
        },
      });
      // Signed with the app's own key and shape, so this exercises the real
      // guard chain rather than a stubbed request user.
      const token = jwt.sign(
        { sub: user.id, phone: user.phone, role: 'delivery_partner', dhabaId: env.defaultDhabaId, type: 'access' },
        { secret: env.jwtSecret, expiresIn: '30m' },
      );
      drivers.push({ userId: user.id, token });
    }
  });

  afterAll(async () => {
    // `app.close()` disconnects the shared Prisma client; disconnecting it here
    // as well would tear the pool down twice.
    await app.close();
  });

  // Each test stages its own preconditions. A driver left holding an order is
  // correct behaviour for the test that left it there — an undelivered order
  // stays assigned — but it is not a starting state the next test asked for.
  afterEach(async () => {
    await prisma.driverProfile.updateMany({
      where: { userId: { in: drivers.map((d) => d.userId) } },
      data: { activeOrderId: null },
    });
  });

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** A paid order parked at `ready_for_pickup` — the state dispatch starts from. */
  async function stageReadyOrder() {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return prisma.order.create({
      data: {
        orderNumber: `IPL-T${suffix}`,
        userId: customerId,
        dhabaId: env.defaultDhabaId,
        status: 'ready_for_pickup',
        subtotalPaise: 349_00,
        gstAmountPaise: 17_45,
        deliveryFeePaise: 30_00,
        totalAmountPaise: 396_45,
        paymentStatus: 'paid',
        paymentMethod: 'wallet',
        deliveryType: 'turf_bench',
        deliveryTarget: 'Cage 1 (Bench 2)',
        readyAt: new Date(),
      },
    });
  }

  async function goOnline(token: string) {
    await supertest(app.getHttpServer())
      .patch('/api/v1/dispatch/status')
      .set(as(token))
      .send({ isOnline: true })
      .expect(200);
  }

  it('assigns a contested order to exactly one of two concurrent drivers', async () => {
    const order = await stageReadyOrder();
    await Promise.all(drivers.map((d) => goOnline(d.token)));

    // Fired without awaiting in between: both claims are in flight together.
    const results = await Promise.all(
      drivers.map((d) =>
        supertest(app.getHttpServer())
          .post('/api/v1/dispatch/claim')
          .set(as(d.token))
          .send({ orderId: order.id }),
      ),
    );

    const won = results.filter((r) => r.status === 200);
    const lost = results.filter((r) => r.status === 409);

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(won[0].body.status).toBe('assigned');

    // And the row agrees with the winner — the losing update touched nothing.
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe('assigned');
    expect(stored.driverId).not.toBeNull();

    const winnerProfile = await prisma.driverProfile.findFirstOrThrow({ where: { activeOrderId: order.id } });
    expect(stored.driverId).toBe(winnerProfile.id);
  });

  it('rejects a wrong delivery OTP and refuses to close the order', async () => {
    const order = await stageReadyOrder();
    const driver = drivers[0];
    await goOnline(driver.token);

    await supertest(app.getHttpServer())
      .post('/api/v1/dispatch/claim')
      .set(as(driver.token))
      .send({ orderId: order.id })
      .expect(200);

    const pickup = await supertest(app.getHttpServer())
      .post(`/api/v1/dispatch/${order.id}/pickup`)
      .set(as(driver.token))
      .expect(200);
    expect(pickup.body.otpIssued).toBe(true);

    // The OTP reaches the customer over the event bus; the driver's response
    // carries no code, which is the point. Only the hash is stored.
    const pickedUp = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(pickedUp.status).toBe('picked_up');
    expect(pickedUp.deliveryOtpHash).toBeTruthy();
    expect(pickedUp.deliveryOtpHash).not.toMatch(/^\d{6}$/);

    const wrong = await supertest(app.getHttpServer())
      .post(`/api/v1/dispatch/${order.id}/deliver`)
      .set(as(driver.token))
      .send({ otp: '000000' })
      .expect(400);
    expect(wrong.body.message).toMatch(/incorrect delivery code/i);

    // Still undelivered, and the failed attempt was counted.
    const afterWrong = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterWrong.status).toBe('picked_up');
    expect(afterWrong.deliveredAt).toBeNull();
    expect(afterWrong.deliveryOtpAttempts).toBeGreaterThan(0);
  });

  it('refuses a driver acting on an order assigned to someone else', async () => {
    const order = await stageReadyOrder();
    const [first, second] = drivers;
    await goOnline(first.token);
    await goOnline(second.token);

    await supertest(app.getHttpServer())
      .post('/api/v1/dispatch/claim')
      .set(as(first.token))
      .send({ orderId: order.id })
      .expect(200);

    // The second driver holds no assignment on this order, so pickup is not
    // theirs to perform — this is the "any driver, any order" hole closed.
    await supertest(app.getHttpServer())
      .post(`/api/v1/dispatch/${order.id}/pickup`)
      .set(as(second.token))
      .expect(403);

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe('assigned');
  });
});
