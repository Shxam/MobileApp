/**
 * Per-worker setup. Jest workers are separate processes, so the DATABASE_URL
 * rewritten in globalSetup does not automatically reach them — we redo the
 * rewrite here and assert it before a single test runs.
 */
import 'dotenv/config';
import { resolveTestDatabaseUrl, assertTestDatabaseIsSafe } from './test-database';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = resolveTestDatabaseUrl();

// Hard stop: if anything above failed to confine us to the test schema, no test
// in this worker is allowed to open a connection.
assertTestDatabaseIsSafe();

// Integration specs boot the real AppModule, which fails fast on missing
// secrets. Supply test-only values for anything that does not talk to a real
// third-party service, so the suite runs without a fully populated .env.
const testDefaults: Record<string, string> = {
  JWT_SECRET: 'test-only-jwt-secret-never-used-outside-jest-0123456789',
  JWT_REFRESH_SECRET: 'test-only-refresh-secret-never-used-outside-jest-0123456789',
  GATE_PASS_SECRET: 'test-only-gate-pass-secret-never-used-outside-jest-0123456789',
};
for (const [key, value] of Object.entries(testDefaults)) {
  if (!process.env[key]) process.env[key] = value;
}

// Third-party keys are cleared outright rather than defaulted. No test calls a
// live external API, and a developer's real (or leaked-and-not-yet-rotated) key
// must not decide whether the suite can run. `dotenv` does not overwrite a key
// that is already present, so setting these here wins over `.env`.
process.env.CRICKET_API_KEY = '';
process.env.RAZORPAY_KEY_ID ??= '';
process.env.RAZORPAY_KEY_SECRET ??= '';
process.env.RAZORPAY_WEBHOOK_SECRET ??= '';
