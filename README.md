# 🏏 🍲 IPL Dhaba — Super App & Operations Suite

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e.svg?logo=nestjs)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748.svg?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Neon_PostgreSQL-16-336791.svg?logo=postgresql)](https://neon.tech/)
[![Redis](https://img.shields.io/badge/Upstash_Redis-7-dc382d.svg?logo=redis)](https://upstash.com/)
[![Razorpay](https://img.shields.io/badge/Razorpay-2.9-0c2451.svg?logo=razorpay)](https://razorpay.com/)
[![Tests](https://img.shields.io/badge/tests-158_passing-brightgreen.svg?logo=jest)](#testing)

A cricket-themed super app for a roadside dhaba in Singarayakonda, Andhra Pradesh. It handles **food delivery**, **floodlit box-turf bookings**, **party packages**, **live cricket scores** and a **wallet** — with five separate frontends over one NestJS API.

Five apps, one backend, one database:

| App | Who uses it | Port | Source |
|---|---|---|---|
| **Customer super app** | Diners and players | 3000 | `src/` |
| **NestJS API** | — | 3001 | `apps/backend/` |
| **Kitchen KDS** | Kitchen staff | 3002 | `apps/kitchen-kds/` |
| **Admin portal** | Owner / manager | 3003 | `apps/admin/` |
| **Driver tracker** | Delivery partners | 3004 | `apps/driver/` |

---

## Design principles

These are the decisions the codebase actually enforces. They're listed first because most of the code only makes sense in light of them.

### Money is integer paise, everywhere

Every monetary column is `INTEGER` paise — `totalAmountPaise`, `pricePaise`, `balancePaise`. Floating-point money misrounds GST and cannot represent a Razorpay amount natively. Only the render layer divides, via `formatPaise()` in `packages/types/index.ts`.

### The server owns every price

The client sends `{ menuItemId, quantity }[]` — never a price, never a name. `PricingService` loads prices from the database and computes the breakdown itself. An unknown item id is a `400`, not a silently created menu row.

Checkout is a two-step quote:

1. `POST /orders/quote` → a short-TTL quote in Redis (10 min)
2. `POST /orders` with the quote id → the server **re-verifies** the total before charging

So the price cannot move between quote and payment, and the browser never gets a vote.

### Ownership is enforced inside the `where` clause

Never fetched-then-compared. A request for someone else's order or address returns **404, not 403** — a 403 would confirm the row exists.

```ts
// what the services do
prisma.order.findFirst({ where: { id, userId } })
```

### Concurrency is settled by the database, not by application logic

Two drivers tapping *Accept* on the same order is resolved by a conditional update, not a read-then-write:

```ts
const { count } = await tx.order.updateMany({
  where: { id: orderId, driverId: null, status: 'ready_for_pickup' },
  data: { driverId, status: 'assigned', assignedAt: new Date() },
});
if (count === 0) throw new ConflictException('Order already assigned');
```

Turf slots use a Redis `SET NX PX` lock. Wallet balance carries a database-level non-negative constraint, so an over-debit fails in Postgres rather than relying on a prior read.

### Delivery is closed by OTP

An OTP is generated at pickup, shown to the customer, and stored **bcrypt-hashed** in `deliveryOtpHash`. The driver must enter it to close the order. Without this, any authenticated delivery partner could mark any order delivered.

---

## Pricing rules

Defined once in `apps/backend/src/modules/pricing/pricing.constants.ts`:

| Rule | Value |
|---|---|
| Food GST | 5% |
| Turf GST | 18% |
| Pitch-side bench delivery | ₹30 |
| Home delivery | ₹45 |
| Floodlight surcharge | ₹100 |
| Turf add-on (GoPro, umpire, ball boys) | ₹150 each |
| Celebration base | 15 guests included, ₹200 per extra guest |
| Quote TTL | 10 minutes |
| Cart limits | 50 lines, max qty 20 per line |

Seeded vouchers: `IPL10` (10% off, cap ₹100, min ₹300) · `SIXER` (₹60 off over ₹500) · `HATTRICK` (₹150 off over ₹1200). Validity and per-user caps live in the `Voucher` table — not in the browser.

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│  Customer (3000)   KDS (3002)   Admin (3003)  Driver (3004)  │
│              Vite 6 · React 19 · Tailwind 4                  │
└───────────┬──────────────────────────────────┬───────────────┘
            │ REST /api/v1                    │ socket.io
            │ Bearer JWT                      │ (JWT in handshake)
            ▼                                 ▼
┌──────────────────────────────────────────────────────────────┐
│                    NestJS 11 API  (3001)                     │
│  helmet · throttler · CORS allowlist · ValidationPipe        │
│  JwtAuthGuard · RolesGuard · ownership scoping               │
└─────┬──────────────┬──────────────┬──────────────┬───────────┘
      ▼              ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────┐
│   Neon    │  │  Upstash  │  │ Razorpay │  │   Firebase   │
│ Postgres  │  │   Redis   │  │ Checkout │  │  Admin SDK   │
│ (Prisma)  │  │ locks +   │  │+ webhook │  │ (phone OTP   │
│           │  │ quotes +  │  │          │  │  ID tokens)  │
│           │  │ socket    │  │          │  │              │
│           │  │ adapter   │  │          │  │              │
└───────────┘  └───────────┘  └──────────┘  └──────────────┘
```

Realtime is **socket.io only**. The old SSE tracking endpoint was removed: it sat behind `JwtAuthGuard`, and a browser `EventSource` cannot send an `Authorization` header, so tracking could never have worked. Fan-out across replicas uses `@socket.io/redis-adapter`.

Rooms are scoped — `order:{id}`, `user:{id}`, `kitchen:{dhabaId}`, `drivers:{dhabaId}` — so one customer never receives another's order events.

---

## Tech stack

**Frontend** — Vite 6, React 19, TypeScript 5.8 (`strict`), Tailwind CSS 4, Framer Motion, Lucide, Leaflet 1.9, socket.io-client 4.8, Firebase Web SDK 12, `qrcode`

**Backend** — NestJS 11, Prisma 5.22, PostgreSQL 16 (Neon), ioredis 6 (Upstash), socket.io 4.8 + redis-adapter, passport-jwt, Firebase Admin 14, Razorpay 2.9, class-validator, helmet, `@nestjs/throttler`, `@nestjs/schedule`, bcrypt 6

**Testing** — Jest 30, ts-jest, supertest, two projects (node + jsdom)

**Infra** — Docker, Docker Compose, Kubernetes manifests, Helm charts, GitHub Actions

---

## Quickstart

### Prerequisites

- **Node.js 20+** and npm 10+
- A **PostgreSQL** database (Neon works out of the box)
- **Redis** (Upstash or local) — required in production; a loud in-memory fallback covers local dev
- A **Firebase** project with the Phone provider enabled
- **Razorpay** test keys

### Install

```bash
git clone https://github.com/Shxam/MobileApp.git
cd MobileApp
npm install
```

### Configure

```bash
cp .env.example .env
```

Then fill in `.env`. Boot **fails fast** on a missing or weak secret — there are no silent fallbacks, by design. Validation lives in `apps/backend/src/common/config/env.ts`.

### Migrate and seed

Use `migrate deploy`, not `db push` — the migration history is the source of truth:

```bash
npx prisma migrate deploy
npx prisma generate
```

```bash
SEED_STAFF_PIN=<choose-a-pin> npx prisma db seed
```

The seed writes the real menu (76 items), the Singarayakonda turf with a week of bookable slots across two pitches, the bilingual celebration package, and the three vouchers. Staff accounts are created **only** if `SEED_STAFF_PIN` is set; the PIN is bcrypt-hashed per employee.

Seeded staff employee IDs: `KDS-001` (kitchen) · `DRV-001` (driver) · `ADM-001` (admin). All are flagged `mustChangePin`.

### Run

Each in its own terminal:

```bash
npm run dev:backend
```

```bash
npm run dev
```

```bash
npm run dev:kds
```

```bash
npm run dev:admin
```

```bash
npm run dev:driver
```

In development the frontends call `/api` through the Vite proxy, so the browser stays same-origin and CORS is not involved.

---

## Environment variables

### Backend

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `development` \| `test` \| `production` only |
| `PORT` / `HOST` | no | defaults `3001` / `0.0.0.0` |
| `DATABASE_URL` | yes | Postgres connection string |
| `CORS_ORIGINS` | **in production** | comma-separated browser origin allowlist; boot aborts if empty |
| `APP_URL` | no | public app origin |
| `JWT_SECRET` | yes | |
| `JWT_REFRESH_SECRET` | yes | must differ from `JWT_SECRET` |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | no | default 15m / 7d |
| `STAFF_TOKEN_TTL` | no | |
| `GATE_PASS_SECRET` | **in production** | signs turf gate-pass QR tokens |
| `REDIS_URL` *or* `REDIS_HOST`+`REDIS_PORT`+`REDIS_PASSWORD` | yes in production | |
| `RAZORPAY_KEY_ID` | **in production** | |
| `RAZORPAY_KEY_SECRET` | **in production** | |
| `RAZORPAY_WEBHOOK_SECRET` | **in production** | verifies webhook HMAC |
| `GOOGLE_APPLICATION_CREDENTIALS` | yes | path to the service-account JSON |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | yes | alternative to the JSON file |
| `CRICKET_API_KEY` | no | live-score feed; the carousel degrades without it |
| `DEFAULT_DHABA_ID` | no | defaults `dhaba_singarayakonda` |
| `SEED_STAFF_PIN` | seed only | omit and no staff accounts are created |

A `COMPROMISED_SECRETS` set rejects any value known to have been committed previously, so a leaked secret cannot be reintroduced.

### Frontend (baked into the bundle at build time)

Only `VITE_`-prefixed variables reach the browser. **Never prefix a secret with `VITE_`.**

| Variable | Notes |
|---|---|
| `VITE_API_URL` | API origin for production builds. Empty in dev (the Vite proxy handles `/api`) |
| `VITE_DHABA_LAT` / `VITE_DHABA_LNG` | map fallback centre |
| `VITE_FIREBASE_*` | the six web-config values; public by design |

> **Vite env gotcha.** Vite loads `.env` in *every* mode and layers `.env.production` on top during `vite build`. Anything omitted from `.env.production` silently inherits the dev value — which is how a production bundle can end up calling `http://localhost:3001`. Keep `VITE_API_URL` set in both files.

---

## Order lifecycle

```text
awaiting_payment ─┐                          (Razorpay: until verified)
                  ├──► placed ──► accepted ──► preparing ──► ready_for_pickup
COD / wallet ─────┘                                                │
                                                                   ▼
              delivered ◄── picked_up ◄── assigned ◄── driver claim (atomic)
                  ▲             OTP verified
                  └─ COD settles paymentStatus → paid on delivery

  any state ──► cancelled ──► refunded          failure ──► payment_failed
```

`out_for_delivery` is retained as a migration alias of `picked_up`.

**Payment statuses:** `pending` · `cod_pending` · `paid` · `failed` · `refunded` · `partially_refunded`

**Roles:** `customer` · `kitchen_staff` · `delivery_partner` · `partner` · `admin`

### Payment methods

| Method | Flow |
|---|---|
| **Razorpay** | `POST /payments/intent` → Checkout → **both** the client callback signature *and* the webhook are verified → `placed` |
| **COD** | `placed` immediately, `paymentStatus: cod_pending`, settled to `paid` on delivery |
| **Wallet** | atomic conditional debit inside the order transaction; insufficient balance rejects before the order exists |

Webhook HMAC is computed over the **raw request body** (`rawBody: true`), not a re-serialized object — a re-serialized payload can never match Razorpay's signature. Replays are idempotent via a unique `WebhookEvent.providerEventId`; order creation is idempotent via a unique `Order.idempotencyKey`. A scheduled job polls Razorpay for orders stuck in `awaiting_payment` past 15 minutes, covering a webhook that never arrives.

---

## API reference

Base path `/api/v1`. Health endpoints are excluded from the prefix.

### Health

| Method | Path | Auth |
|---|---|---|
| `GET` | `/health` · `/health/live` · `/health/ready` | public |

### Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/firebase` | public | exchange a Firebase ID token for a JWT pair |
| `POST` | `/auth/staff-login` | public | employee ID + PIN, with lockout |
| `POST` | `/auth/staff/change-pin` | staff | mandatory on first login |
| `POST` | `/auth/refresh` | public | rotate the refresh token (role preserved) |
| `POST` | `/auth/logout` | bearer | Redis blocklist |
| `GET` `PATCH` | `/auth/me` | bearer | read / update profile |

### Menu

| Method | Path | Auth |
|---|---|---|
| `GET` | `/menu` · `/menu/categories` | public |
| `GET` | `/menu/manage` | admin |
| `POST` `PATCH` | `/menu` · `/menu/:id` · `/menu/:id/availability` | admin |

### Orders

| Method | Path | Auth |
|---|---|---|
| `POST` | `/orders/quote` | customer |
| `POST` | `/orders` | customer |
| `GET` | `/orders` · `/orders/:id` | owner / staff |
| `PATCH` | `/orders/:id/status` | kitchen / admin |
| `PATCH` | `/orders/:id/cancel` | owner / admin |
| `PATCH` | `/orders/:id/location` | assigned driver |

### Payments

| Method | Path | Auth |
|---|---|---|
| `POST` | `/payments/intent` · `/payments/verify` | customer |
| `POST` | `/payments/wallet-topup` · `/payments/wallet-topup/verify` | customer |
| `POST` | `/payments/webhook` | Razorpay HMAC |

### Dispatch (drivers)

| Method | Path |
|---|---|
| `GET` `PATCH` | `/dispatch/status` (online / offline) |
| `GET` | `/dispatch/available` · `/dispatch/current` |
| `POST` | `/dispatch/claim` (atomic) |
| `POST` | `/dispatch/:orderId/pickup` · `/deliver` (OTP) · `/release` |

### Turfs, bookings, celebrations

| Method | Path |
|---|---|
| `GET` | `/turfs` · `/turfs/:id` |
| `GET` | `/bookings/slots` · `/bookings/my` |
| `POST` | `/bookings` · `/bookings/:id/cancel` · `/bookings/verify-gate-pass` |
| `GET` | `/celebrations` (bilingual) · `/celebrations/bookings` |
| `POST` | `/celebrations/quote` · `/celebrations/bookings` · `/celebrations/bookings/:id/cancel` |

### Customer domain

| Method | Path |
|---|---|
| `GET` `POST` `PATCH` `DELETE` | `/addresses` · `/addresses/:id` |
| `POST` | `/reviews` |
| `GET` | `/reviews/my` · `/reviews/turf/:turfId` |
| `GET` | `/wallet` · `/wallet/balance` |
| `GET` | `/vouchers` |
| `GET` `PATCH` | `/notifications` · `/notifications/:id/read` · `/notifications/read-all` |

### Admin

| Method | Path |
|---|---|
| `GET` | `/admin/reports/summary` (real aggregates) · `/admin/orders` · `/admin/turf-slots` · `/admin/staff` |
| `POST` | `/admin/staff` · `/admin/staff/:employeeId/unlock` |

---

## Testing

```bash
npm test
```

**158 tests across 7 suites.** Two Jest projects: node (backend integration) and jsdom (React components).

```bash
npm run lint          # frontend typecheck
npm run lint:backend  # backend typecheck
```

### Test isolation

Tests run against a **dedicated Postgres schema** (`ipl_test_e2e`), not `public`. The global setup appends `?schema=ipl_test_e2e` to `DATABASE_URL`, runs `migrate deploy` into it, and **hard-aborts if the resolved schema is `public`** — so pointing the suite at a production URL cannot damage live data. Teardown drops the schema cascade.

This matters: before that guard existed, `npm test` wrote to the production database.

### What's covered

- **Auth** — Firebase token exchange, JWT issuance, refresh rotation preserving role, Redis blocklist logout
- **Core domain** — menu caching, atomic turf-slot locking, the order lifecycle, wallet ledger debits
- **Pricing** — the breakdown in paise, tampered prices rejected, quote total equals charged total
- **Payments** — signature verification, webhook replay is a no-op, concurrent wallet debits never go negative
- **Dispatch** — two concurrent claims, exactly one winner; a wrong OTP rejects delivery
- **Customer domain** — celebrations quoted server-side, reviews requiring a completed owned target, the single-default-address invariant across every mutation

---

## Deployment

### Docker Compose

```bash
docker compose up --build -d
```

### Kubernetes / Helm

```bash
helm upgrade --install ipl-dhaba-backend ./deploy/helm/ipl-dhaba-backend \
  --namespace ipl-dhaba --create-namespace \
  -f ./deploy/helm/ipl-dhaba-backend/values-prod.yaml
```

Secrets are **externalized** — the chart expects an External Secrets / SealedSecrets-managed `Secret` and contains no credential values. The chart `fail`s at template time if `NODE_ENV=production` without `CORS_ORIGINS`, matching the backend's own boot check.

### CI

`.github/workflows/ci-cd.yml` on `ubuntu-latest`: install → `prisma generate` → typecheck both configs → build all frontends → build backend → **full** integration suite. Then a Docker image push and a migrate-and-deploy job. `android-release.yml` covers the Expo app.

### Production build note

`vite build <root>` emits to `<root>/dist`, so the four frontends don't overwrite each other. `build:backend` emits `dist/apps/backend/src/main.js`; run it **after** `npm run build`.

---

## Repository layout

```text
├── apps/
│   ├── backend/              # NestJS API (3001)
│   │   └── src/
│   │       ├── common/       # prisma, redis, firebase, config/env.ts, event-bus
│   │       ├── health/       # real liveness + readiness probes
│   │       └── modules/      # 16 feature modules (+ integration specs)
│   ├── admin/                # Admin portal (3003)
│   ├── kitchen-kds/          # Kitchen display (3002)
│   ├── driver/               # Driver tracker (3004)
│   └── mobile/               # Expo / React Native (separate toolchain)
├── src/                      # Customer super app (3000)
│   ├── components/           # UI, modals, admin widgets
│   ├── context/              # AppContext
│   ├── services/             # apiClient, realtimeClient, razorpayCheckout, firebase
│   └── views/                # Home, Food, Turf, Celebrations, Wallet, MyBookings
├── packages/
│   ├── types/                # single source of domain types + formatPaise()
│   ├── api-client/           # shared client
│   ├── realtime/             # shared socket contracts
│   └── shared/               # validation schemas
├── prisma/
│   ├── schema.prisma         # 23 models
│   ├── migrations/           # 8 migrations
│   ├── seed.ts
│   └── seed-data/menu.ts     # the real 76-item card
├── deploy/{k8s,helm}/
├── docs/firebase-authentication.md
├── test/                     # jest setup, global setup/teardown, mocks
└── docker-compose.yml
```

Controllers are declared **inside** their `.module.ts` file — a house convention throughout, `auth` being the one exception with a separate `auth.controller.ts`.

---

## Operational notes

Things a new contributor will hit, recorded honestly rather than discovered the hard way.

**`enableImplicitConversion: false`** on the global `ValidationPipe`. Every numeric DTO field needs an explicit `@Type(() => Number)`, or it arrives as a string and fails validation.

**The backend loads only `.env`** (`app.module.ts`). `.env.production` is consumed by **Vite** at frontend build time — Nest never reads it. Production backend config comes from the k8s Secret / Helm values.

**`prisma generate` can fail with `EPERM` on Windows** when the repo sits in a OneDrive-synced folder: a running Node process holds `query_engine-windows.dll.node` memory-mapped, and Windows won't let it be replaced. Close Node processes or move the repo outside OneDrive. The generated client is unaffected once produced, and CI (Linux) never sees this.

**`bullmq` is declared in `package.json` but imported nowhere.** Queueing goes through the internal event bus. It's a removable dependency.

**No `LICENSE` file is present** despite earlier README claims of MIT. Add one before publishing, or state the licence explicitly.

**`apps/mobile/` still contains placeholder data** ([useAppStore.ts](apps/mobile/src/stores/useAppStore.ts)). It's an Expo app on a separate toolchain, excluded from the root `tsconfig` and workspaces, and was out of scope for the backend rebuild.

### Before going live

- [ ] Rotate any credential that has ever been committed — check `mcp.json` / `.mcp.json` history
- [ ] Rotate `CRICKET_API_KEY`
- [ ] Set `CORS_ORIGINS` for the real origins
- [ ] Set `VITE_API_URL` in `.env.production` (or the CI build env)
- [ ] Point `DATABASE_URL` at production and run `prisma migrate deploy`
- [ ] Configure the Razorpay webhook endpoint and `RAZORPAY_WEBHOOK_SECRET`
- [ ] Swap Razorpay test keys for live keys
- [ ] Force a PIN change for every seeded staff account

---

## License

Not yet specified — add a `LICENSE` file before distribution.
