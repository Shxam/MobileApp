// ===================================================
// Phase 2 Core Modules Integration Test Suite
// Menu Caching, Atomic Slot Lock, Order Placement & Wallet Ledger
// ===================================================

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../app.module';
import { FirebaseAdminService } from '../common/firebase/firebase-admin.service';

describe('Phase 2 Core Domain Modules (Integration Test)', () => {
  let app: INestApplication;
  let accessToken: string;
  const testPhone = '+919876543210';

  const mockFirebaseAdminService = {
    isConfigured: () => true,
    verifyIdToken: async () => ({
      uid: 'phase2_test_uid',
      phone_number: testPhone,
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseAdminService)
      .useValue(mockFirebaseAdminService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    // Authenticate via Firebase ID Token & get JWT Access Token
    const authRes = await supertest(app.getHttpServer())
      .post('/api/v1/auth/firebase')
      .send({ idToken: 'valid_test_token' });

    accessToken = authRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Menu Module: Fetch Menu Items with Redis Read Cache', async () => {
    const res = await supertest(app.getHttpServer())
      .get('/api/v1/menu')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('2. Bookings Module: Fetch Slots & Book Slot with Atomic Redis Lock & GatePass Token', async () => {
    // Fetch Slots
    const slotsRes = await supertest(app.getHttpServer())
      .get('/api/v1/bookings/slots')
      .expect(200);

    const slotToBook = slotsRes.body[0];
    expect(slotToBook).toBeDefined();

    // Create Booking
    const bookingRes = await supertest(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ slotId: slotToBook.id, addons: ['GoPro Recording'] })
      .expect(201);

    expect(bookingRes.body).toHaveProperty('gatePassToken');
    expect(bookingRes.body.gatePassToken).toContain('GATEPASS');
  });

  it('3. Orders Module: Place Order & Trigger Background Worker Queue', async () => {
    const orderRes = await supertest(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        items: [{ menuItem: { id: 'food_1', nameEn: 'Chicken Biryani', price: 349, category: 'biryani' }, quantity: 2 }],
        totalAmount: 698,
        deliveryType: 'turf_bench',
        deliveryTarget: 'Singarayakonda Turf - Cage 1 (Bench 1)',
      })
      .expect(201);

    expect(orderRes.body).toHaveProperty('id');
    expect(orderRes.body.status).toBe('placed');
  });

  it('4. Wallet Module: Wallet Top-Up & Deduct Internal Ledger', async () => {
    // Top up
    const topupRes = await supertest(app.getHttpServer())
      .post('/api/v1/wallet/topup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 500, description: 'UPI Scan & Pay Topup' })
      .expect(201);

    expect(topupRes.body.balance).toBeGreaterThanOrEqual(1000);

    // Deduct
    const deductRes = await supertest(app.getHttpServer())
      .post('/api/v1/wallet/deduct')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 200, description: 'Order Payment' })
      .expect(201);

    expect(deductRes.body.balance).toBeGreaterThanOrEqual(800);
  });
});
