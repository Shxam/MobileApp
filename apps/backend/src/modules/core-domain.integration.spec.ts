// ===================================================
// Core domain integration suite.
//
// Rewritten for the Phase 3–5 API. The previous version asserted the
// vulnerabilities as if they were features: it posted a whole menu item
// *including its price* to `POST /orders` and expected 201, and it topped up
// the wallet through `POST /wallet/topup` with a caller-chosen amount and no
// payment proof. Both endpoints are gone, so those assertions now encode the
// correct behaviour — a tampered price is rejected, and money only enters the
// wallet through a verified capture.
// ===================================================

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { FirebaseAdminService } from '../common/firebase/firebase-admin.service';

describe('Core domain modules (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  const testPhone = '+919876543210';

  const mockFirebaseAdminService = {
    isConfigured: () => true,
    verifyIdToken: async () => ({ uid: 'phase2_test_uid', phone_number: testPhone }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseAdminService)
      .useValue(mockFirebaseAdminService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    // The app's own client, not a second one. Every extra `new PrismaClient()`
    // opens its own pool against a Neon instance with a modest connection
    // ceiling, and the suites exhausting it surfaced as DNS/connection errors
    // that read like an outage rather than like saturation.
    prisma = app.get(PrismaService);

    const authRes = await supertest(app.getHttpServer())
      .post('/api/v1/auth/firebase')
      .send({ idToken: 'valid_test_token' });
    accessToken = authRes.body.accessToken;
    expect(accessToken).toBeDefined();
  });

  afterAll(async () => {
    // `app.close()` disconnects the shared Prisma client; disconnecting it here
    // as well would tear the pool down twice.
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  /** Puts money in the wallet the only way the app allows: a ledger credit. */
  async function fundWallet(amountPaise: number): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: testPhone } });
    const wallet = await prisma.wallet.upsert({
      where: { userId: user.id },
      update: { balancePaise: { increment: amountPaise } },
      create: { userId: user.id, balancePaise: amountPaise },
    });
    await prisma.walletTransaction.create({
      data: {
        userId: user.id,
        walletId: wallet.id,
        amountPaise,
        balanceAfterPaise: wallet.balancePaise,
        type: 'topup',
        category: 'topup',
        description: 'Test fixture funding',
      },
    });
  }

  it('serves the menu', async () => {
    const res = await supertest(app.getHttpServer()).get('/api/v1/menu').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('prices a cart server-side from menu ids alone', async () => {
    const menu = await supertest(app.getHttpServer()).get('/api/v1/menu').expect(200);
    const item = menu.body[0];

    const quote = await supertest(app.getHttpServer())
      .post('/api/v1/orders/quote')
      .set(auth())
      .send({ items: [{ menuItemId: item.id, quantity: 2 }], deliveryType: 'turf_bench' })
      .expect(200);

    // The server derived every figure; the client sent only an id and a count.
    expect(quote.body.quoteId).toBeDefined();
    expect(quote.body.bill.subtotalPaise).toBe(item.pricePaise * 2);
    expect(quote.body.bill.totalPaise).toBe(
      quote.body.bill.subtotalPaise +
        quote.body.bill.gstAmountPaise +
        quote.body.bill.deliveryFeePaise -
        quote.body.bill.discountPaise,
    );
  });

  it('rejects a cart line carrying a client-supplied price', async () => {
    const menu = await supertest(app.getHttpServer()).get('/api/v1/menu').expect(200);

    // `forbidNonWhitelisted` means an injected price is a 400, not a silently
    // honoured one. This is the regression guard for the original exploit.
    await supertest(app.getHttpServer())
      .post('/api/v1/orders/quote')
      .set(auth())
      .send({
        items: [{ menuItemId: menu.body[0].id, quantity: 1, pricePaise: 1 }],
        deliveryType: 'turf_bench',
      })
      .expect(400);
  });

  it('rejects an unknown menu id instead of creating the item', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/orders/quote')
      .set(auth())
      .send({ items: [{ menuItemId: 'food_1', quantity: 1 }], deliveryType: 'turf_bench' })
      .expect(400);

    // The old code `upsert`ed unknown ids into the menu. Nothing was created.
    expect(await prisma.menuItem.findUnique({ where: { id: 'food_1' } })).toBeNull();
  });

  it('places a wallet-paid order and charges exactly the quoted total', async () => {
    const menu = await supertest(app.getHttpServer()).get('/api/v1/menu').expect(200);
    const item = menu.body[0];

    const quote = await supertest(app.getHttpServer())
      .post('/api/v1/orders/quote')
      .set(auth())
      .send({ items: [{ menuItemId: item.id, quantity: 1 }], deliveryType: 'turf_bench' })
      .expect(200);

    await fundWallet(quote.body.bill.totalPaise);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: testPhone } });
    const before = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });

    const order = await supertest(app.getHttpServer())
      .post('/api/v1/orders')
      .set(auth())
      .set('Idempotency-Key', `test-${Date.now()}`)
      .send({
        quoteId: quote.body.quoteId,
        paymentMethod: 'wallet',
        deliveryTarget: 'Singarayakonda Turf - Cage 1 (Bench 1)',
      })
      .expect(201);

    expect(order.body.status).toBe('placed');
    expect(order.body.paymentStatus).toBe('paid');
    expect(order.body.bill.totalPaise).toBe(quote.body.bill.totalPaise);

    const after = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(before.balancePaise - after.balancePaise).toBe(quote.body.bill.totalPaise);
  });

  it('refuses a wallet order the balance cannot cover, and creates no order', async () => {
    const menu = await supertest(app.getHttpServer()).get('/api/v1/menu').expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: testPhone } });
    await prisma.wallet.update({ where: { userId: user.id }, data: { balancePaise: 0 } });

    const quote = await supertest(app.getHttpServer())
      .post('/api/v1/orders/quote')
      .set(auth())
      .send({ items: [{ menuItemId: menu.body[0].id, quantity: 1 }], deliveryType: 'turf_bench' })
      .expect(200);

    const countBefore = await prisma.order.count({ where: { userId: user.id } });

    await supertest(app.getHttpServer())
      .post('/api/v1/orders')
      .set(auth())
      .set('Idempotency-Key', `test-broke-${Date.now()}`)
      .send({
        quoteId: quote.body.quoteId,
        paymentMethod: 'wallet',
        deliveryTarget: 'Singarayakonda Turf - Cage 1 (Bench 1)',
      })
      .expect(400);

    // The debit and the insert share a transaction, so a rejected payment
    // leaves no order behind.
    expect(await prisma.order.count({ where: { userId: user.id } })).toBe(countBefore);
  });

  it('books a turf slot and issues a signed gate pass', async () => {
    const slots = await supertest(app.getHttpServer()).get('/api/v1/bookings/slots').expect(200);
    const slot = slots.body.find((s: { isBooked: boolean }) => !s.isBooked);
    expect(slot).toBeDefined();

    await fundWallet(slot.pricePaise * 3);

    const booking = await supertest(app.getHttpServer())
      .post('/api/v1/bookings')
      .set(auth())
      .send({ slotId: slot.id, addons: ['GoPro Recording'], paymentMethod: 'wallet' })
      .expect(201);

    expect(booking.body.gatePassToken).toContain('GATEPASS');
    expect(booking.body.bookingNumber).toMatch(/^TRF-/);

    // The slot is now unavailable — the double-book guard.
    await supertest(app.getHttpServer())
      .post('/api/v1/bookings')
      .set(auth())
      .send({ slotId: slot.id, paymentMethod: 'wallet' })
      .expect(409);
  });

  it('exposes the wallet read-only — no top-up or deduct endpoint survives', async () => {
    await supertest(app.getHttpServer()).get('/api/v1/wallet').set(auth()).expect(200);

    // Both of these credited or debited an arbitrary caller-specified amount
    // with no payment proof. They must stay gone.
    await supertest(app.getHttpServer())
      .post('/api/v1/wallet/topup')
      .set(auth())
      .send({ amount: 500 })
      .expect(404);
    await supertest(app.getHttpServer())
      .post('/api/v1/wallet/deduct')
      .set(auth())
      .send({ amount: 200 })
      .expect(404);
  });

  it('scopes order history to the caller', async () => {
    const res = await supertest(app.getHttpServer()).get('/api/v1/orders').set(auth()).expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: testPhone } });
    const ids = res.body.map((o: { id: string }) => o.id);
    const foreign = await prisma.order.count({ where: { id: { in: ids }, userId: { not: user.id } } });
    expect(foreign).toBe(0);
  });

  it('refuses unauthenticated access to protected routes', async () => {
    await supertest(app.getHttpServer()).get('/api/v1/orders').expect(401);
    await supertest(app.getHttpServer()).get('/api/v1/wallet').expect(401);
    await supertest(app.getHttpServer()).get('/api/v1/dispatch/available').expect(401);
  });

  it('refuses a customer on driver-only dispatch routes', async () => {
    // The token above is a customer's; dispatch is delivery_partner-only.
    await supertest(app.getHttpServer()).get('/api/v1/dispatch/available').set(auth()).expect(403);
    await supertest(app.getHttpServer())
      .post('/api/v1/dispatch/claim')
      .set(auth())
      .send({ orderId: 'whatever' })
      .expect(403);
  });
});
