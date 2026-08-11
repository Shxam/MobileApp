# Work Log — IPL Dhaba Super App

_Last updated: 2026-08-10_

This document tracks the changes made to bring the app to full working condition.
Work is organized into phases (see the approved plan at
`.claude/plans/woolly-waddling-wind.md`). Each phase leaves the app runnable.

---

## Phase 0 — Secrets & test safety  ✅ complete

Goal: no hardcoded secret fallbacks anywhere, boot fails fast on missing
config, leaked keys rotated/removed, and tests can never touch production data.

### ✅ Done

**1. Central fail-fast environment validation — NEW FILE**
`apps/backend/src/common/config/env.ts`
- Loads `.env` (no longer `.env.example`) and validates every secret at boot.
- **Refuses to start** if a required secret is missing, shorter than 32 chars,
  or set to a known-public value that had previously been committed to git.
- Exposes a typed, frozen `env` object the whole backend imports instead of
  reading `process.env` directly.
- Production requires strictly more than development (CORS allowlist, Redis
  URL, Razorpay keys).

**2. Rotated the compromised secrets in your local `.env`**
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GATE_PASS_SECRET` were set to public
  values (they matched strings hardcoded in the source and pushed to GitHub).
  All three were regenerated with 48 bytes of crypto-random data.
- Added `CORS_ORIGINS` (was missing).
- A one-time backup of the old file was written to `.env.backup-pre-rotation`
  (gitignored). **You can delete it once you've confirmed everything works.**

**3. Removed every hardcoded secret fallback (8 sites)**
| File | Was | Now |
|---|---|---|
| `apps/backend/src/app.module.ts` | `envFilePath: ['.env', '.env.example']` | `['.env']` + `validate` |
| `apps/backend/src/modules/auth/auth.module.ts` | `JWT_SECRET \|\| 'super-secret…'` | `env.jwtSecret` |
| `apps/backend/src/modules/auth/auth.service.ts` | 4× `… \|\| 'super-secret…'` | `env.*` |
| `apps/backend/src/modules/auth/strategies/jwt.strategy.ts` | `JWT_SECRET \|\| '…'` | `env.jwtSecret` |
| `apps/backend/src/modules/bookings/bookings.service.ts` | `GATE_PASS_SECRET \|\| '…'` | `env.gatePassSecret` (+ fails if unset) |
| `apps/backend/src/modules/cricket/cricket.service.ts` | hardcoded live API key | `env.cricketApiKey` (+ skips if unset) |
| `apps/backend/src/modules/payment-gateway/payment-gateway.service.ts` | 2× fallbacks | `env.*` (+ fails if unset) |

**4. Removed the leaked 21st.dev API key from source control**
- `mcp.json` (a byte-identical duplicate of `.mcp.json`) deleted and
  `git rm --cached`'d.
- `.mcp.json` now uses `${TWENTYFIRST_API_KEY}` env expansion instead of the
  literal key.
- Both `mcp.json` and `.mcp.local.json` added to `.gitignore`.

**5. Rewrote `.env.example`** as a safe, documented template with **empty**
secret fields and generation instructions (previously it carried working weak
defaults that silently loaded as a fallback).

**6. Fixed real security bugs found while in these files:**
- `auth.service.ts` — **DB-outage-becomes-login** removed. Two `catch` blocks
  fabricated a valid `customer`/staff user when Prisma threw; a database outage
  was therefore a successful login for anyone. Deleted.
- `auth.service.ts` — **refresh no longer downgrades staff.** `refreshToken()`
  dropped the role, silently turning every kitchen/driver/admin into a
  `customer` on token refresh. Role is now re-read from the DB on refresh.
- `auth.service.ts` — refresh tokens are now **single-use** (rotation is
  verified against a stored digest) and stored in Redis as SHA-256 digests, not
  verbatim, so a Redis dump can't be replayed as credentials.
- `auth.service.ts` — staff PIN comparison is now **constant-time**.
- `payment-gateway.service.ts` — **webhook bypass removed.** A missing
  signature used to pass in every environment, and a bad signature passed
  outside production. Now every unsigned/mismatched webhook is rejected with a
  constant-time HMAC check.
- `payment-gateway.module.ts` / `main.ts` — webhook now verifies the **raw
  request bytes** (`{ rawBody: true }`), not a re-serialized `JSON.stringify`
  that could never match Razorpay's signature.
- `bookings.service.ts` — gate-pass HMAC no longer truncated to 16 hex chars
  (was 64-bit forgeable; now full 256-bit).
- `jwt.strategy.ts` — now carries `dhabaId` so tenant-scoped guards can work.

**7. Hardened `main.ts`**
- `helmet()` security headers.
- CORS changed from `origin:'*', credentials:true` (an invalid combo) to an
  explicit allowlist from `CORS_ORIGINS`.
- `ValidationPipe` now uses `forbidNonWhitelisted: true`, so a request sending
  an unexpected field (e.g. a client-supplied `price`) gets a clear `400`.
- Added `reflect-metadata`, graceful shutdown hooks, and a top-level catch so
  env-validation failures print a readable message and exit 1.

### ✅ Test isolation on the single Neon DB

The suite shares one Postgres instance with development, so isolation is a
dedicated **schema** plus guards that refuse to run anywhere else.

- `test/test-database.ts` — `TEST_SCHEMA = 'ipl_test_e2e'`, a
  `FORBIDDEN_SCHEMAS` set (`public`, `pg_catalog`, `information_schema`),
  `resolveTestDatabaseUrl()` which force-rewrites `?schema=` and throws
  `UnsafeTestDatabaseError` on anything else, and `assertTestDatabaseIsSafe()`
  which re-checks the live `DATABASE_URL`.
- `test/jest.global-setup.ts` — sets `NODE_ENV=test`, rewrites `DATABASE_URL`,
  drops + recreates `ipl_test_e2e`, then `prisma migrate deploy` into it.
- `test/jest.global-teardown.ts` — `DROP SCHEMA … CASCADE`. Set
  `KEEP_TEST_SCHEMA=1` to keep it for inspection.
- `test/jest.setup.ts` — per-worker (workers are separate processes, so the
  rewrite must be redone). Asserts safety before any connection opens, and
  supplies test-only secret values so the suite runs without a full `.env`.
- `jest.config.cjs` — `globalSetup` / `globalTeardown` / `setupFiles` wired,
  `maxWorkers: 1`, `testTimeout: 60000`. `npm test` now runs `--runInBand`.

### ⏳ Still pending in Phase 0

- **Externalize k8s/Helm secrets** (`deploy/k8s/02-secret.yaml`, Helm values) —
  deferred to Phase 8 with the rest of the infra work.

### 🔴 Action items that only YOU can do (require dashboard access)

1. **Rotate the 21st.dev API key** at https://21st.dev — the old key
   (`21st_sk_352b…`) is public in your git history and must be revoked. Put the
   new one in your shell env as `TWENTYFIRST_API_KEY`.
2. **Rotate `CRICKET_API_KEY`** (CricAPI dashboard) — the old UUID was hardcoded
   and pushed.
3. **Consider rotating** the Neon DB password, Upstash token, and Razorpay keys
   if they were ever committed. (They are currently gitignored and appear never
   to have been committed, so this is precautionary.)
4. **Purge secrets from git history** — the old keys remain in the 6 existing
   commits. Cleaning them requires `git filter-repo` + a force-push, which
   rewrites shared history. Tell me if you want me to prepare that.

---

## Phases 1–8 — not started

See `.claude/plans/woolly-waddling-wind.md` for the full plan:
1. Build integrity (add `@types/react`, enable `strict`, delete dead Express
   layer, throttler).
2. Data model (money → integer paise, migration-drift fix, new tables, indexes).
3. Server-authoritative pricing.
4. Payments — real Razorpay SDK + COD + wallet.
5. Dispatch & delivery (atomic driver claim, delivery OTP).
6. Authorization (`RolesGuard`, per-staff bcrypt PINs, ownership checks).
7. Realtime (authenticated socket.io rooms + Redis adapter).
8. Frontend de-mock, remaining domains, infra (Dockerfile, CI, health checks).

---

## How to verify Phase 0 so far

```bash
# 1. Boot with a required secret blanked → must FAIL, not fall back:
#    (temporarily empty JWT_SECRET in .env, then)
npm run dev:backend      # expect: "Environment validation failed … ✗ JWT_SECRET"

# 2. Confirm no secret literals remain in source:
git grep -nE "super-secret|ipl-dhaba-2026|21st_sk_|f53adacc-3763" -- . ':!*.md'
#    expect: no matches

# 3. Confirm mcp.json is gone and untracked:
git status --short mcp.json .mcp.json

# 4. Confirm the test suite is confined to its own schema.
#    Expect "[test-db] Using isolated schema ipl_test_e2e" in the output,
#    and zero new rows in public afterwards.
npm test
```
