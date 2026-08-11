/**
 * Jest globalTeardown — drops the isolated test schema.
 */
import 'dotenv/config';
import { Client } from 'pg';
import { TEST_SCHEMA, resolveTestDatabaseUrl } from './test-database';

export default async function globalTeardown(): Promise<void> {
  const keep = process.env.KEEP_TEST_SCHEMA === '1';
  if (keep) {
    // eslint-disable-next-line no-console
    console.log(`\n[test-db] KEEP_TEST_SCHEMA=1 — leaving "${TEST_SCHEMA}" in place for inspection.\n`);
    return;
  }

  const testUrl = resolveTestDatabaseUrl();
  const admin = new Client({ connectionString: testUrl });
  await admin.connect();
  try {
    await admin.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    // eslint-disable-next-line no-console
    console.log(`\n[test-db] Dropped schema "${TEST_SCHEMA}".\n`);
  } finally {
    await admin.end();
  }
}
