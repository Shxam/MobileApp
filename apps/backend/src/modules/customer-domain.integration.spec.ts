// ===================================================
// Celebrations, reviews and saved addresses (integration).
//
// The three modules the earlier suites never reached. All three were
// browser-only before this rebuild — the party total was added up in
// `CelebrationsView.calculateTotal`, `ReviewModal` collected a rating and
// dropped it, and there were no saved addresses at all — so what is asserted
// here is that the server now owns each of those decisions.
//
// The three focus points, one per module:
//   • celebrations — the quote a customer is shown equals what the booking
//     charges, and the wallet is the only thing that can fund it
//   • reviews      — a review needs a *completed* target the caller owns
//   • addresses    — the default-address invariant survives every mutation
// ===================================================

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { FirebaseAdminService } from '../common/firebase/firebase-admin.service';
import {
  CELEBRATION_CAKE_PER_KG_PAISE,
  CELEBRATION_COMMENTARY_PAISE,
  CELEBRATION_EXTRA_GUEST_PAISE,
  CELEBRATION_INCLUDED_GUESTS,
  CELEBRATION_TROPHY_PAISE,
  TURF_GST_RATE,
  applyGst,
} from './pricing/pricing.constants';

describe('Customer domain: celebrations, reviews, addresses (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;

  // A phone of its own. The other suites sign in as +919876543210 and this one
  // asserts on row *counts* (one review per target, the address cap), which
  // another suite's leftovers would move.
  const testPhone = '+919812340077';

  const mockFirebaseAdminService = {
    isConfigured: () => true,
    verifyIdToken: async () => ({ uid: 'customer_domain_uid', phone_number: testPhone }),
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

    // The app's own client — a second `PrismaClient` would open its own pool
    // against a Neon instance with a modest connection ceiling.
    prisma = app.get(PrismaService);

    const authRes = await supertest(app.getHttpServer())
      .post('/api/v1/auth/firebase')
      .send({ idToken: 'valid_test_token' });
    accessToken = authRes.body.accessToken;
    expect(accessToken).toBeDefined();

    userId = (await prisma.user.findUniqueOrThrow({ where: { phone: testPhone } })).id;
  });

  afterAll(async () => {
    // Reviews first: they carry FKs to both targets. The user row itself is left
    // for the schema drop in globalTeardown.
    await prisma.review.deleteMany({ where: { userId } });
    await prisma.address.deleteMany({ where: { userId } });
    await prisma.celebrationBooking.deleteMany({ where: { userId } });
    // `app.close()` disconnects the shared client; a second disconnect here would
    // tear the pool down twice.
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  /** Money in, the only way the app allows: a ledger credit. */
  async function fundWallet(amountPaise: number): Promise<void> {
    const wallet = await prisma.wallet.upsert({
      where: { userId },
      update: { balancePaise: { increment: amountPaise } },
      create: { userId, balancePaise: amountPaise },
    });
    await prisma.walletTransaction.create({
      data: {
        userId,
        walletId: wallet.id,
        amountPaise,
        balanceAfterPaise: wallet.balancePaise,
        type: 'topup',
        category: 'topup',
        description: 'Test fixture funding',
      },
    });
  }

  /** Tomorrow in IST, which is how the service parses `eventDate`. */
  function tomorrowIst(): string {
    const d = new Date(Date.now() + 24 * 3600_000 + 5.5 * 3600_000);
    return d.toISOString().slice(0, 10);
  }

  describe('celebrations', () => {
    /** The seeded package, read through the public endpoint the app uses. */
    async function firstPackage() {
      const res = await supertest(app.getHttpServer()).get('/api/v1/celebrations').expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      return res.body[0];
    }

    it('lists packages bilingually with prices in paise', async () => {
      const pkg = await firstPackage();

      // Both languages are populated: the Hindi toggle in CelebrationsView reads
      // `titleHi`/`inclusionsHi` directly and would render blank if the serializer
      // let them through empty.
      expect(pkg.titleEn).toBeTruthy();
      expect(pkg.titleHi).toBeTruthy();
      expect(pkg.inclusionsEn.length).toBeGreaterThan(0);
      expect(pkg.inclusionsHi.length).toBe(pkg.inclusionsEn.length);

      // Paise, not rupees. A ₹5,999 package read as 5999 paise would undercharge
      // by 100×, and integer-ness is what makes that detectable.
      expect(Number.isInteger(pkg.basePricePaise)).toBe(true);
      expect(pkg.basePricePaise).toBeGreaterThan(1000_00);
    });

    it('quotes add-ons server-side from the option flags alone', async () => {
      const pkg = await firstPackage();
      const guestCount = CELEBRATION_INCLUDED_GUESTS + 5;

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/celebrations/quote')
        .send({
          packageId: pkg.id,
          eventDate: tomorrowIst(),
          timeSlot: '7:00 PM - 9:00 PM',
          guestCount,
          commentarySetup: true,
          trophyPackage: true,
          cakeKg: 2,
        })
        .expect(200);

      // Recomputed from the constants rather than compared to a copied literal,
      // so a change to a rate has to be a deliberate change to the constant.
      const expectedAddons =
        5 * CELEBRATION_EXTRA_GUEST_PAISE +
        CELEBRATION_COMMENTARY_PAISE +
        CELEBRATION_TROPHY_PAISE +
        2 * CELEBRATION_CAKE_PER_KG_PAISE;
      const expectedSubtotal = pkg.basePricePaise + expectedAddons;
      const expectedGst = applyGst(expectedSubtotal, TURF_GST_RATE);

      expect(res.body.addonsPaise).toBe(expectedAddons);
      expect(res.body.subtotalPaise).toBe(expectedSubtotal);
      // A venue service, so the 18% turf rate — not the 5% food rate.
      expect(res.body.gstAmountPaise).toBe(expectedGst);
      expect(res.body.totalAmountPaise).toBe(expectedSubtotal + expectedGst);
    });

    it('charges the wallet exactly what it quoted', async () => {
      const pkg = await firstPackage();
      const body = {
        packageId: pkg.id,
        eventDate: tomorrowIst(),
        timeSlot: '7:00 PM - 9:00 PM',
        guestCount: CELEBRATION_INCLUDED_GUESTS,
        paymentMethod: 'wallet' as const,
      };

      const quote = await supertest(app.getHttpServer())
        .post('/api/v1/celebrations/quote')
        .send({ ...body, paymentMethod: undefined })
        .expect(200);

      await fundWallet(quote.body.totalAmountPaise);
      const before = await prisma.wallet.findUniqueOrThrow({ where: { userId } });

      const booking = await supertest(app.getHttpServer())
        .post('/api/v1/celebrations/bookings')
        .set(auth())
        .send(body)
        .expect(201);

      expect(booking.body.totalAmountPaise).toBe(quote.body.totalAmountPaise);
      expect(booking.body.paymentStatus).toBe('paid');

      const after = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
      expect(before.balancePaise - after.balancePaise).toBe(quote.body.totalAmountPaise);
    });

    it('refuses a booking the wallet cannot cover, leaving no row behind', async () => {
      const pkg = await firstPackage();

      // Drain first: an earlier test's change is left in place otherwise, and a
      // funded wallet would make this pass for the wrong reason.
      await prisma.wallet.update({ where: { userId }, data: { balancePaise: 0 } });
      const bookingsBefore = await prisma.celebrationBooking.count({ where: { userId } });

      await supertest(app.getHttpServer())
        .post('/api/v1/celebrations/bookings')
        .set(auth())
        .send({
          packageId: pkg.id,
          eventDate: tomorrowIst(),
          timeSlot: '9:00 PM - 11:00 PM',
          guestCount: CELEBRATION_INCLUDED_GUESTS,
          paymentMethod: 'wallet',
        })
        .expect(400);

      // The debit runs inside the booking transaction, so the throw has to roll
      // the row back — otherwise the dhaba sees a confirmed party nobody paid for.
      expect(await prisma.celebrationBooking.count({ where: { userId } })).toBe(bookingsBefore);
    });

    it('rejects an unauthenticated booking and a client-supplied price', async () => {
      const pkg = await firstPackage();
      const base = {
        packageId: pkg.id,
        eventDate: tomorrowIst(),
        timeSlot: '7:00 PM - 9:00 PM',
        guestCount: CELEBRATION_INCLUDED_GUESTS,
      };

      await supertest(app.getHttpServer()).post('/api/v1/celebrations/bookings').send(base).expect(401);

      // `forbidNonWhitelisted` turns an injected total into a 400. This is the
      // regression guard for `calculateTotal` having lived in the browser.
      await supertest(app.getHttpServer())
        .post('/api/v1/celebrations/bookings')
        .set(auth())
        .send({ ...base, totalAmountPaise: 1, basePricePaise: 1 })
        .expect(400);
    });

    it('refunds to the wallet on cancellation, and a second cancel is a no-op', async () => {
      const pkg = await firstPackage();
      const body = {
        packageId: pkg.id,
        eventDate: tomorrowIst(),
        timeSlot: '5:00 PM - 7:00 PM',
        guestCount: CELEBRATION_INCLUDED_GUESTS,
        paymentMethod: 'wallet' as const,
      };

      const quote = await supertest(app.getHttpServer())
        .post('/api/v1/celebrations/quote')
        .send({ ...body, paymentMethod: undefined })
        .expect(200);
      await fundWallet(quote.body.totalAmountPaise);

      const booking = await supertest(app.getHttpServer())
        .post('/api/v1/celebrations/bookings')
        .set(auth())
        .send(body)
        .expect(201);

      const beforeRefund = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
      const cancel = await supertest(app.getHttpServer())
        .post(`/api/v1/celebrations/bookings/${booking.body.id}/cancel`)
        .set(auth())
        .expect(200);
      expect(cancel.body.refundedPaise).toBe(quote.body.totalAmountPaise);

      const afterRefund = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
      expect(afterRefund.balancePaise - beforeRefund.balancePaise).toBe(quote.body.totalAmountPaise);

      // Idempotent: the second call must not pay the customer twice.
      const again = await supertest(app.getHttpServer())
        .post(`/api/v1/celebrations/bookings/${booking.body.id}/cancel`)
        .set(auth())
        .expect(200);
      expect(again.body.refundedPaise).toBe(0);
      const afterSecond = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
      expect(afterSecond.balancePaise).toBe(afterRefund.balancePaise);
    });
  });

  describe('reviews', () => {
    /**
     * A delivered order to review. Written directly rather than driven through
     * the whole pay→kitchen→dispatch path, which `core-domain` and `dispatch`
     * already cover — here the order is a fixture, not the subject.
     */
    async function deliveredOrder(): Promise<string> {
      const order = await prisma.order.create({
        data: {
          orderNumber: `REV-${Date.now().toString(36).toUpperCase()}`,
          userId,
          status: 'delivered',
          subtotalPaise: 300_00,
          totalAmountPaise: 315_00,
          paymentStatus: 'paid',
          paymentMethod: 'wallet',
          deliveryTarget: 'Bench 4',
          deliveredAt: new Date(),
        },
      });
      return order.id;
    }

    it('records a review against a delivered order the caller owns', async () => {
      const orderId = await deliveredOrder();

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/reviews')
        .set(auth())
        .send({ orderId, rating: 5, comment: '  Biryani arrived hot.  ' })
        .expect(201);

      expect(res.body.rating).toBe(5);
      // Trimmed server-side: a comment of pure whitespace should not become a
      // visible blank review.
      expect(res.body.comment).toBe('Biryani arrived hot.');
      expect(res.body.orderId).toBe(orderId);

      const mine = await supertest(app.getHttpServer()).get('/api/v1/reviews/my').set(auth()).expect(200);
      expect(mine.body.some((r: { id: string }) => r.id === res.body.id)).toBe(true);
    });

    it('refuses a second review of the same order', async () => {
      const orderId = await deliveredOrder();
      const body = { orderId, rating: 4, comment: 'Good.' };

      await supertest(app.getHttpServer()).post('/api/v1/reviews').set(auth()).send(body).expect(201);
      await supertest(app.getHttpServer()).post('/api/v1/reviews').set(auth()).send(body).expect(409);

      expect(await prisma.review.count({ where: { userId, orderId } })).toBe(1);
    });

    it('refuses to review an order that has not been delivered', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: `REV-P-${Date.now().toString(36).toUpperCase()}`,
          userId,
          status: 'preparing',
          subtotalPaise: 200_00,
          totalAmountPaise: 210_00,
          paymentStatus: 'paid',
          paymentMethod: 'wallet',
          deliveryTarget: 'Bench 2',
        },
      });

      // Otherwise a rating reflects the checkout screen rather than the food.
      await supertest(app.getHttpServer())
        .post('/api/v1/reviews')
        .set(auth())
        .send({ orderId: order.id, rating: 5, comment: 'Looks promising.' })
        .expect(400);
    });

    it("404s on another customer's order rather than confirming it exists", async () => {
      const stranger = await prisma.user.create({
        data: { phone: '+919812340078', name: 'Someone Else', role: 'customer' },
      });
      const theirOrder = await prisma.order.create({
        data: {
          orderNumber: `REV-X-${Date.now().toString(36).toUpperCase()}`,
          userId: stranger.id,
          status: 'delivered',
          subtotalPaise: 100_00,
          totalAmountPaise: 105_00,
          paymentStatus: 'paid',
          paymentMethod: 'wallet',
          deliveryTarget: 'Bench 9',
          deliveredAt: new Date(),
        },
      });

      // 404, not 403: ownership is in the `where`, so a probe cannot use the
      // status code to learn that the id is real.
      await supertest(app.getHttpServer())
        .post('/api/v1/reviews')
        .set(auth())
        .send({ orderId: theirOrder.id, rating: 1, comment: 'Not mine.' })
        .expect(404);

      expect(await prisma.review.count({ where: { orderId: theirOrder.id } })).toBe(0);

      await prisma.order.delete({ where: { id: theirOrder.id } });
      await prisma.user.delete({ where: { id: stranger.id } });
    });

    it('rejects a review with no target, both targets, or an out-of-range rating', async () => {
      const orderId = await deliveredOrder();

      await supertest(app.getHttpServer())
        .post('/api/v1/reviews')
        .set(auth())
        .send({ rating: 5, comment: 'Nothing attached.' })
        .expect(400);

      await supertest(app.getHttpServer())
        .post('/api/v1/reviews')
        .set(auth())
        .send({ orderId, bookingId: orderId, rating: 5, comment: 'Both.' })
        .expect(400);

      await supertest(app.getHttpServer())
        .post('/api/v1/reviews')
        .set(auth())
        .send({ orderId, rating: 6, comment: 'Off the scale.' })
        .expect(400);

      await supertest(app.getHttpServer())
        .post('/api/v1/reviews')
        .set(auth())
        .send({ orderId, rating: 5, comment: '' })
        .expect(400);
    });

    it('needs a token to read your own reviews', async () => {
      await supertest(app.getHttpServer()).get('/api/v1/reviews/my').expect(401);
    });
  });

  describe('saved addresses', () => {
    // Each test starts from an empty book: the invariant under test is "exactly
    // one default", and a leftover row from the previous test would satisfy it
    // for the wrong reason.
    beforeEach(async () => {
      await prisma.address.deleteMany({ where: { userId } });
    });

    // `label` is prefixed rather than used bare: the DTO floor is 2 characters,
    // so a single-letter tag is a 400 and every test here would fail on setup.
    const addr = (label: string, isDefault?: boolean) => ({
      label: `Plot ${label}`,
      detail: `Plot ${label}, NH-16 Bypass Road, Singarayakonda`,
      landmark: 'Opposite the turf gate',
      pincode: '523101',
      ...(isDefault === undefined ? {} : { isDefault }),
    });

    async function create(body: Record<string, unknown>) {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/addresses')
        .set(auth())
        .send(body)
        .expect(201);
      return res.body;
    }

    it('makes the first saved address the default automatically', async () => {
      // Otherwise checkout opens with a list and nothing preselected.
      const first = await create(addr('A'));
      expect(first.isDefault).toBe(true);

      const second = await create(addr('B'));
      expect(second.isDefault).toBe(false);
    });

    it('moves the default rather than adding a second one', async () => {
      await create(addr('A'));
      const b = await create(addr('B', true));
      expect(b.isDefault).toBe(true);

      const list = await supertest(app.getHttpServer()).get('/api/v1/addresses').set(auth()).expect(200);
      expect(list.body.filter((a: { isDefault: boolean }) => a.isDefault)).toHaveLength(1);
      // Default first — the order the checkout sheet renders.
      expect(list.body[0].id).toBe(b.id);
    });

    it('promotes the next address when the default is deleted', async () => {
      const a = await create(addr('A'));
      const b = await create(addr('B'));

      const res = await supertest(app.getHttpServer())
        .delete(`/api/v1/addresses/${a.id}`)
        .set(auth())
        .expect(200);
      expect(res.body.promotedId).toBe(b.id);

      const list = await supertest(app.getHttpServer()).get('/api/v1/addresses').set(auth()).expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].isDefault).toBe(true);
    });

    it('leaves the default alone when a non-default is deleted', async () => {
      const a = await create(addr('A'));
      const b = await create(addr('B'));

      const res = await supertest(app.getHttpServer())
        .delete(`/api/v1/addresses/${b.id}`)
        .set(auth())
        .expect(200);
      // Nothing to promote: the default survived.
      expect(res.body.promotedId).toBeNull();

      const remaining = await prisma.address.findMany({ where: { userId } });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(a.id);
      expect(remaining[0].isDefault).toBe(true);
    });

    it('promoting by PATCH keeps exactly one default', async () => {
      const a = await create(addr('A'));
      const b = await create(addr('B'));

      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/addresses/${b.id}`)
        .set(auth())
        .send({ isDefault: true, landmark: 'Next to the floodlight mast' })
        .expect(200);
      expect(res.body.isDefault).toBe(true);
      expect(res.body.landmark).toBe('Next to the floodlight mast');

      const rows = await prisma.address.findMany({ where: { userId } });
      expect(rows.filter((r) => r.isDefault)).toHaveLength(1);
      expect(rows.find((r) => r.id === a.id)!.isDefault).toBe(false);
    });

    it("404s on another customer's address instead of editing it", async () => {
      const stranger = await prisma.user.create({
        data: { phone: '+919812340079', name: 'Address Stranger', role: 'customer' },
      });
      const theirs = await prisma.address.create({
        data: { userId: stranger.id, label: 'Theirs', detail: 'Somewhere else entirely', isDefault: true },
      });

      await supertest(app.getHttpServer())
        .patch(`/api/v1/addresses/${theirs.id}`)
        .set(auth())
        .send({ label: 'Mine now' })
        .expect(404);
      await supertest(app.getHttpServer())
        .delete(`/api/v1/addresses/${theirs.id}`)
        .set(auth())
        .expect(404);

      // Untouched, and still theirs.
      const after = await prisma.address.findUniqueOrThrow({ where: { id: theirs.id } });
      expect(after.label).toBe('Theirs');

      await prisma.address.delete({ where: { id: theirs.id } });
      await prisma.user.delete({ where: { id: stranger.id } });
    });

    it('validates the detail floor and the PIN code format', async () => {
      // A rider needs more than "home".
      await supertest(app.getHttpServer())
        .post('/api/v1/addresses')
        .set(auth())
        .send({ label: 'Home', detail: 'home' })
        .expect(400);

      await supertest(app.getHttpServer())
        .post('/api/v1/addresses')
        .set(auth())
        .send({ ...addr('C'), pincode: '0234' })
        .expect(400);

      // An injected `userId` must not be honoured — that is how one customer
      // would write into another's address book.
      await supertest(app.getHttpServer())
        .post('/api/v1/addresses')
        .set(auth())
        .send({ ...addr('D'), userId: 'someone-else' })
        .expect(400);
    });

    it('is private: every route needs a token', async () => {
      await supertest(app.getHttpServer()).get('/api/v1/addresses').expect(401);
      await supertest(app.getHttpServer()).post('/api/v1/addresses').send(addr('E')).expect(401);
    });
  });
});
