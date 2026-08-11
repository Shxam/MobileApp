// ===================================================
// Phase 6 verification: authorization.
//
// The plan's acceptance line for this phase is "every endpoint probed with each
// role; unauthorized combinations return 403". That is what this file does — a
// matrix of (route × role) driven from a table, so adding a route means adding a
// row rather than remembering to write a test.
//
// It also covers the two things a role matrix alone would miss:
//
//   1. *Ownership*, which is orthogonal to role. Two customers hold the same
//      role, and role checks alone would let either read the other's order.
//   2. The staff PIN path — per-employee bcrypt hashes with lockout, replacing
//      the single shared plaintext `STAFF_PIN` that used to gate every staff
//      account at once.
// ===================================================

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import supertest from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';

/** Every role the guard chain has to distinguish, plus the unauthenticated case. */
type Principal = 'anonymous' | 'customer' | 'kitchen_staff' | 'delivery_partner' | 'partner' | 'admin';

const AUTHENTICATED_ROLES: Exclude<Principal, 'anonymous'>[] = [
  'customer',
  'kitchen_staff',
  'delivery_partner',
  'partner',
  'admin',
];

describe('Authorization matrix (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let http: supertest.Agent;

  const tokens: Record<Exclude<Principal, 'anonymous'>, string> = {} as any;
  const userIds: Record<Exclude<Principal, 'anonymous'>, string> = {} as any;

  /** A second customer, used to prove role-equal principals are still isolated. */
  let otherCustomerToken: string;
  let otherCustomerOrderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    http = supertest(app.getHttpServer());

    // Tokens are signed with the app's own key and claim shape, so every request
    // below runs the real JwtAuthGuard → RolesGuard chain rather than a stub.
    const mint = async (role: Exclude<Principal, 'anonymous'>, phone: string, name: string) => {
      const user = await prisma.user.upsert({
        where: { phone },
        update: { role: role as Role },
        create: { phone, name, role: role as Role, dhabaId: env.defaultDhabaId },
      });
      userIds[role] = user.id;
      tokens[role] = jwt.sign(
        { sub: user.id, phone, role, dhabaId: env.defaultDhabaId, type: 'access' },
        { secret: env.jwtSecret, expiresIn: '30m' },
      );
      return user;
    };

    await mint('customer', '+919000100001', 'Matrix Customer');
    await mint('kitchen_staff', '+919000100002', 'Matrix Kitchen');
    await mint('delivery_partner', '+919000100003', 'Matrix Driver');
    await mint('partner', '+919000100004', 'Matrix Partner');
    await mint('admin', '+919000100005', 'Matrix Admin');

    const other = await prisma.user.upsert({
      where: { phone: '+919000100009' },
      update: { role: Role.customer },
      create: { phone: '+919000100009', name: 'Other Customer', role: Role.customer, dhabaId: env.defaultDhabaId },
    });
    otherCustomerToken = jwt.sign(
      { sub: other.id, phone: other.phone, role: 'customer', dhabaId: env.defaultDhabaId, type: 'access' },
      { secret: env.jwtSecret, expiresIn: '30m' },
    );

    // An order belonging to the *other* customer. Nothing about it is special;
    // it exists so the ownership assertions have a real row to be refused.
    const menuItem = await prisma.menuItem.findFirstOrThrow({ where: { isAvailable: true } });
    const order = await prisma.order.create({
      data: {
        orderNumber: `IPL-AUTHZ${Date.now().toString().slice(-4)}`,
        userId: other.id,
        dhabaId: env.defaultDhabaId,
        status: 'placed',
        subtotalPaise: menuItem.pricePaise,
        gstAmountPaise: 0,
        deliveryFeePaise: 0,
        discountPaise: 0,
        totalAmountPaise: menuItem.pricePaise,
        paymentStatus: 'cod_pending',
        paymentMethod: 'cod',
        deliveryTarget: 'Bench 4',
        items: {
          create: [
            {
              menuItemId: menuItem.id,
              quantity: 1,
              unitPricePaise: menuItem.pricePaise,
              nameSnapshot: menuItem.name,
            },
          ],
        },
      },
    });
    otherCustomerOrderId = order.id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { id: otherCustomerOrderId } });
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // The matrix.
  //
  // `allowed` lists the roles that may reach the handler. Every other role must
  // get 403 and anonymous must get 401 — the distinction matters: 401 says "who
  // are you", 403 says "I know who you are and the answer is no".
  //
  // Each probe is deliberately *shaped* to fail validation if it gets past the
  // guard, so a 400 is proof the guard let it through. That is why `expected`
  // below accepts a set: the assertion is "not 401/403", not "200".
  // ─────────────────────────────────────────────────────────────────────────
  const ROUTES: Array<{
    name: string;
    method: 'get' | 'post' | 'patch';
    path: string;
    body?: Record<string, unknown>;
    allowed: Exclude<Principal, 'anonymous'>[];
    /** Set when the route is intentionally reachable without a token. */
    publicRoute?: boolean;
  }> = [
    // Public reads — the app's landing screens render before sign-in.
    { name: 'GET /menu', method: 'get', path: '/api/v1/menu', allowed: AUTHENTICATED_ROLES, publicRoute: true },
    { name: 'GET /bookings/slots', method: 'get', path: '/api/v1/bookings/slots', allowed: AUTHENTICATED_ROLES, publicRoute: true },
    { name: 'GET /cricket/live-scores', method: 'get', path: '/api/v1/cricket/live-scores', allowed: AUTHENTICATED_ROLES, publicRoute: true },

    // Menu administration. A customer being able to create menu items — and so
    // to set prices — was one of the original findings.
    {
      name: 'POST /menu',
      method: 'post',
      path: '/api/v1/menu',
      body: { name: 'Authz Probe', pricePaise: 1, category: 'starters' },
      allowed: ['admin', 'partner'],
    },
    { name: 'GET /menu/manage', method: 'get', path: '/api/v1/menu/manage', allowed: ['admin', 'partner', 'kitchen_staff'] },

    // Back office. `POST /admin/staff` had no guard at all and was reachable by
    // anyone on the internet.
    { name: 'GET /admin/reports/summary', method: 'get', path: '/api/v1/admin/reports/summary', allowed: ['admin', 'partner'] },
    { name: 'GET /admin/staff', method: 'get', path: '/api/v1/admin/staff', allowed: ['admin', 'partner'] },
    {
      name: 'POST /admin/staff',
      method: 'post',
      path: '/api/v1/admin/staff',
      body: { employeeId: 'PROBE-1', name: 'Probe', phone: '+919000199999', role: 'kitchen_staff', pin: '424242' },
      // Admin only: a partner must not be able to mint an admin account.
      allowed: ['admin'],
    },

    // Dispatch is the driver's console; nobody else belongs in it.
    { name: 'GET /dispatch/available', method: 'get', path: '/api/v1/dispatch/available', allowed: ['delivery_partner'] },
    { name: 'GET /dispatch/status', method: 'get', path: '/api/v1/dispatch/status', allowed: ['delivery_partner'] },
    {
      name: 'POST /dispatch/claim',
      method: 'post',
      path: '/api/v1/dispatch/claim',
      body: { orderId: '00000000-0000-4000-8000-000000000000' },
      allowed: ['delivery_partner'],
    },

    // Turf.
    {
      name: 'POST /bookings',
      method: 'post',
      path: '/api/v1/bookings',
      body: { slotId: 'no-such-slot' },
      allowed: ['customer', 'admin', 'partner'],
    },
    {
      name: 'POST /bookings/verify-gate-pass',
      method: 'post',
      path: '/api/v1/bookings/verify-gate-pass',
      body: { token: 'not-a-real-pass' },
      allowed: ['admin', 'partner', 'kitchen_staff'],
    },

    // Authenticated-but-unrestricted routes: any signed-in role, no anonymous.
    { name: 'GET /orders', method: 'get', path: '/api/v1/orders', allowed: AUTHENTICATED_ROLES },
    { name: 'GET /wallet', method: 'get', path: '/api/v1/wallet', allowed: AUTHENTICATED_ROLES },
    { name: 'GET /notifications', method: 'get', path: '/api/v1/notifications', allowed: AUTHENTICATED_ROLES },
  ];

  describe.each(ROUTES)('$name', ({ method, path, body, allowed, publicRoute }) => {
    it(publicRoute ? 'is reachable without a token' : 'rejects an anonymous caller with 401', async () => {
      const res = await http[method](path).send(body ?? {});
      if (publicRoute) {
        expect(res.status).toBeLessThan(400);
      } else {
        expect(res.status).toBe(401);
      }
    });

    it.each(AUTHENTICATED_ROLES)('%s', async (role) => {
      const res = await http[method](path).set('Authorization', `Bearer ${tokens[role]}`).send(body ?? {});

      if (allowed.includes(role)) {
        // Reached the handler. The probe bodies reference ids that do not exist,
        // so 400/404/409 are all "the guard let me in" — which is the claim.
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      } else {
        expect(res.status).toBe(403);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Ownership — the checks a role matrix cannot express.
  // ─────────────────────────────────────────────────────────────────────────
  describe('ownership', () => {
    it('a customer cannot read another customer\'s order', async () => {
      const mine = await http
        .get(`/api/v1/orders/${otherCustomerOrderId}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`);
      expect(mine.status).toBe(200);

      const theirs = await http
        .get(`/api/v1/orders/${otherCustomerOrderId}`)
        .set('Authorization', `Bearer ${tokens.customer}`);
      // 404 rather than 403: confirming the order exists is itself a leak.
      expect([403, 404]).toContain(theirs.status);
    });

    it('a customer sees only their own orders in the list', async () => {
      const res = await http.get('/api/v1/orders').set('Authorization', `Bearer ${tokens.customer}`);
      expect(res.status).toBe(200);

      const ids: string[] = res.body.map((o: { id: string }) => o.id);
      expect(ids).not.toContain(otherCustomerOrderId);
    });

    it('a driver cannot move an order that is not assigned to them', async () => {
      const res = await http
        .patch(`/api/v1/orders/${otherCustomerOrderId}/status`)
        .set('Authorization', `Bearer ${tokens.delivery_partner}`)
        .send({ status: 'delivered' });

      // The role check passes — drivers may transition orders — so this is
      // ownership doing the work, not `@Roles`.
      expect(res.status).toBeGreaterThanOrEqual(400);
      const after = await prisma.order.findUniqueOrThrow({ where: { id: otherCustomerOrderId } });
      expect(after.status).toBe('placed');
      expect(after.deliveredAt).toBeNull();
    });

    it('a customer cannot mark another customer\'s notification read', async () => {
      const notification = await prisma.notification.create({
        data: { userId: userIds.admin, title: 'Private', message: 'Not yours.', type: 'general' },
      });

      const res = await http
        .patch(`/api/v1/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${tokens.customer}`);
      expect(res.status).toBe(404);

      const after = await prisma.notification.findUniqueOrThrow({ where: { id: notification.id } });
      expect(after.read).toBe(false);

      await prisma.notification.delete({ where: { id: notification.id } });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Staff PIN authentication.
  //
  // The property that matters is that each employee's PIN is their own: the old
  // implementation compared against one shared `STAFF_PIN` env var, so one
  // leaked PIN was every staff account and rotating it locked out the team.
  // ─────────────────────────────────────────────────────────────────────────
  describe('staff PIN login', () => {
    const employeeId = 'AUTHZ-STAFF-1';
    // Deliberately *not* the seed PIN. An earlier version of this file reused it
    // and the "one employee's PIN does not work for another" case passed a login
    // against the seeded KDS-001 — the PINs really were the same, so the test
    // could not tell a shared secret from two identical ones.
    const pin = '246813';

    beforeAll(async () => {
      const user = await prisma.user.upsert({
        where: { phone: '+919000100011' },
        update: { role: Role.kitchen_staff, employeeId },
        create: {
          phone: '+919000100011',
          name: 'PIN Probe',
          role: Role.kitchen_staff,
          employeeId,
          dhabaId: env.defaultDhabaId,
        },
      });
      await prisma.staffCredential.upsert({
        where: { employeeId },
        update: { pinHash: await bcrypt.hash(pin, 10), failedAttempts: 0, lockedUntil: null },
        create: { userId: user.id, employeeId, pinHash: await bcrypt.hash(pin, 10) },
      });
    });

    afterEach(async () => {
      // Each case starts from an unlocked account; the lockout case deliberately
      // leaves one behind.
      await prisma.staffCredential.update({
        where: { employeeId },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    });

    it('accepts the correct PIN and never returns the hash', async () => {
      const res = await http.post('/api/v1/auth/staff-login').send({ employeeId, pin });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.role).toBe('kitchen_staff');
      expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
    });

    it('rejects a wrong PIN', async () => {
      const res = await http.post('/api/v1/auth/staff-login').send({ employeeId, pin: '000000' });
      expect(res.status).toBe(401);
      expect(res.body.accessToken).toBeUndefined();
    });

    it('does not accept one employee\'s PIN for another employee', async () => {
      // The seeded staff accounts use a different PIN entirely. If PINs were
      // still a single shared secret, this would succeed.
      const res = await http.post('/api/v1/auth/staff-login').send({ employeeId: 'KDS-001', pin });
      expect(res.status).toBe(401);
    });

    it('locks the account after repeated wrong PINs, and the lockout outlives the correct PIN', async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        await http.post('/api/v1/auth/staff-login').send({ employeeId, pin: '999999' });
      }

      const credential = await prisma.staffCredential.findUniqueOrThrow({ where: { employeeId } });
      expect(credential.failedAttempts).toBeGreaterThanOrEqual(5);
      expect(credential.lockedUntil).not.toBeNull();
      expect(credential.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

      // Even the right PIN is refused while the lock stands — otherwise the
      // counter is decoration. 401 rather than 403: the caller never
      // authenticated, and a distinct code here would tell an attacker which
      // ids are real enough to have been locked.
      const res = await http.post('/api/v1/auth/staff-login').send({ employeeId, pin });
      expect(res.status).toBe(401);
    });

    it('an unknown employee id is refused without revealing that it is unknown', async () => {
      const unknown = await http.post('/api/v1/auth/staff-login').send({ employeeId: 'NO-SUCH-ID', pin });
      const wrongPin = await http.post('/api/v1/auth/staff-login').send({ employeeId, pin: '111111' });

      expect(unknown.status).toBe(401);
      expect(wrongPin.status).toBe(401);
      // Identical wording: a different message for "no such employee" is an
      // enumeration oracle just as surely as a different status code.
      expect(unknown.body.message).toEqual(wrongPin.body.message);
    });  });
});
