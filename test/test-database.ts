/**
 * Test database isolation.
 *
 * The project intentionally uses a single Neon Postgres instance for both
 * development and testing. Isolation is therefore achieved with a dedicated
 * Postgres *schema* rather than a separate database, plus the hard guards below.
 *
 * Nothing in the test suite is permitted to touch the `public` schema.
 */

/** Schema that the entire integration suite is confined to. */
export const TEST_SCHEMA = 'ipl_test_e2e';

/**
 * Connections each Prisma client may open during a test run.
 *
 * Prisma defaults to `cpus * 2 + 1`, which is sized for a single long-lived
 * application process. A test run is the opposite: every integration spec boots
 * its own `AppModule` (one client) alongside a raw client for assertions, and
 * Neon caps concurrent connections well below the total that default would ask
 * for. Exceeding it surfaces as "Can't reach database server", which reads like
 * an outage rather than what it is. Specs run serially, so a small pool is
 * ample.
 */
const TEST_CONNECTION_LIMIT = '5';

/** Schemas that must never be used as a test target. */
const FORBIDDEN_SCHEMAS = new Set(['public', 'pg_catalog', 'information_schema']);

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(
      `\n\n=========================================================\n` +
        `  REFUSING TO RUN TESTS — unsafe database target\n` +
        `=========================================================\n` +
        `  ${message}\n` +
        `  Tests would have written to real application data.\n` +
        `=========================================================\n`,
    );
    this.name = 'UnsafeTestDatabaseError';
  }
}

/**
 * Rewrites the configured DATABASE_URL so it points at the dedicated test
 * schema, and refuses to return anything that resolves to `public`.
 */
export function resolveTestDatabaseUrl(baseUrl = process.env.DATABASE_URL): string {
  if (!baseUrl || baseUrl.trim().length === 0) {
    throw new UnsafeTestDatabaseError('DATABASE_URL is not set.');
  }

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new UnsafeTestDatabaseError('DATABASE_URL is not a parseable connection string.');
  }

  // Force the schema, overriding whatever was configured.
  url.searchParams.set('schema', TEST_SCHEMA);
  url.searchParams.set('connection_limit', TEST_CONNECTION_LIMIT);
  // Fail fast instead of hanging when the pool is genuinely saturated.
  url.searchParams.set('pool_timeout', '20');

  const resolved = url.searchParams.get('schema');
  if (!resolved || FORBIDDEN_SCHEMAS.has(resolved.toLowerCase())) {
    throw new UnsafeTestDatabaseError(`Resolved test schema is "${resolved}", which is not allowed.`);
  }
  if (resolved !== TEST_SCHEMA) {
    throw new UnsafeTestDatabaseError(`Resolved test schema is "${resolved}", expected "${TEST_SCHEMA}".`);
  }

  return url.toString();
}

/**
 * Final assertion used by both globalSetup and the per-worker setup file.
 * Throws if the live DATABASE_URL is not confined to the test schema.
 */
export function assertTestDatabaseIsSafe(): void {
  const current = process.env.DATABASE_URL;
  if (!current) {
    throw new UnsafeTestDatabaseError('DATABASE_URL is not set.');
  }
  const schema = new URL(current).searchParams.get('schema');
  if (schema !== TEST_SCHEMA) {
    throw new UnsafeTestDatabaseError(
      `DATABASE_URL schema is "${schema ?? '(none — defaults to public)'}", expected "${TEST_SCHEMA}".`,
    );
  }
}
