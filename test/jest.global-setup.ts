/**
 * Jest globalSetup — runs once, before any test file.
 *
 * Creates a dedicated Postgres schema on the shared Neon instance and applies
 * all Prisma migrations into it, so the suite never touches `public`.
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import { Client } from 'pg';
import { TEST_SCHEMA, resolveTestDatabaseUrl, assertTestDatabaseIsSafe } from './test-database';

export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';

  // Rewrite DATABASE_URL to the isolated schema. Throws loudly if this would
  // resolve to `public`.
  const testUrl = resolveTestDatabaseUrl();
  process.env.DATABASE_URL = testUrl;
  assertTestDatabaseIsSafe();

  // eslint-disable-next-line no-console
  console.log(`\n[test-db] Using isolated schema "${TEST_SCHEMA}" on the shared instance.`);

  // Create the schema. `CASCADE` drop first so each run starts clean.
  const admin = new Client({ connectionString: testUrl });
  await admin.connect();
  try {
    await admin.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await admin.query(`CREATE SCHEMA "${TEST_SCHEMA}"`);
  } finally {
    await admin.end();
  }

  // Apply migrations into the isolated schema.
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });

  // Seed it. Integration specs exercise real endpoints against real rows —
  // menu items, turf slots, vouchers — so an empty schema would fail them for
  // the wrong reason. Imported and called rather than shelled out to, so it runs
  // under ts-jest's compiler against the URL resolved above.
  process.env.SEED_STAFF_PIN ??= '135790';
  execSync('npx tsx prisma/seed.ts', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });

  // eslint-disable-next-line no-console
  console.log(`[test-db] Migrations applied and seeded into "${TEST_SCHEMA}".\n`);
}
