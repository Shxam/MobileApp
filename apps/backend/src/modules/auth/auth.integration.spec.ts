// ===================================================
// IPL Dhaba NestJS Backend — Auth Module Integration Tests
// Firebase Phone Token Authentication, JWT Rotation & Logout Blocklist
// ===================================================

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../../app.module';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service';

describe('AuthModule (Firebase Integration Test)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;
  const testPhone = '+919876543210';
  const testFirebaseUid = 'firebase_test_uid_98765';

  const mockFirebaseAdminService = {
    isConfigured: () => true,
    verifyIdToken: async (token: string) => {
      if (token === 'valid_firebase_id_token') {
        return {
          uid: testFirebaseUid,
          phone_number: testPhone,
          iss: 'https://securetoken.google.com/ipldhaba',
          aud: 'ipldhaba',
          auth_time: Math.floor(Date.now() / 1000),
          sub: testFirebaseUid,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          firebase: { identities: { phone: [testPhone] }, sign_in_provider: 'phone' },
        };
      }
      throw new Error('Decoding Firebase ID token failed');
    },
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
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Reject Invalid Firebase ID Token payload', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/firebase')
      .send({ idToken: 'invalid_token' })
      .expect(401);
  });

  it('2. Reject Malformed Payload (class-validator whitelist)', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/firebase')
      .send({ idToken: 'valid_firebase_id_token', unknownField: 'malicious' })
      .expect(400);
  });

  it('3. Authenticate with Valid Firebase ID Token & Issue IPL Dhaba JWT', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/auth/firebase')
      .send({ idToken: 'valid_firebase_id_token', name: 'Test Fan', favoriteTeam: 'RCB' })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.phone).toBe(testPhone);

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('4. Access Protected Route /auth/me with Bearer Token', async () => {
    const res = await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.user.phone).toBe(testPhone);
  });

  it('5. Refresh Token Rotation', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');

    // Update refresh token
    refreshToken = res.body.refreshToken;
  });

  it('6. Logout & Blocklist Tokens in Redis', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);

    // Attempting to access protected route with logged out token must fail (401)
    await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});
