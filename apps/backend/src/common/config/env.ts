/**
 * Centralised environment loading + validation.
 *
 * This module MUST be imported before any other application module so that
 * `process.env` is populated before decorators / module metadata are evaluated.
 *
 * Rules enforced here:
 *  - No secret has a hardcoded fallback. A missing secret aborts boot.
 *  - Secrets that previously leaked into source control are explicitly rejected.
 *  - Production requires strictly more configuration than development.
 */
import { config as loadDotenv } from 'dotenv';
import path from 'path';

// `.env.example` is intentionally NOT loaded — it is committed to git and
// carries placeholder values that must never silently satisfy a real secret.
loadDotenv({ path: path.resolve(process.cwd(), '.env') });

export type NodeEnv = 'development' | 'test' | 'production';

/**
 * A `ms`-compatible duration such as "15m" or "7d". `@nestjs/jwt` types
 * `expiresIn` against this shape, so TTLs are narrowed here rather than at each
 * call site.
 */
export type Duration = `${number}${'s' | 'm' | 'h' | 'd'}`;

const DURATION_PATTERN = /^\d+[smhd]$/;

function duration(key: string, fallback: Duration): Duration {
  const raw = readRaw(key);
  if (!raw) return fallback;
  if (!DURATION_PATTERN.test(raw)) {
    problems.push(`${key} must be a duration like "15m", "12h" or "7d" (got "${raw}")`);
    return fallback;
  }
  return raw as Duration;
}

/**
 * Secret values that were previously hardcoded in this repository (and are
 * therefore public). Refuse to boot with any of them.
 */
const COMPROMISED_SECRETS = new Set([
  'super-secret-jwt-key-ipl-dhaba-2026',
  'super-secret-refresh-key-ipl-dhaba-2026',
  'super-secret-razorpay-webhook-2026',
  'ipl-dhaba-gatepass-secret-2026',
  'dev-jwt-secret-key-ipl-dhaba-2026',
  'dev-refresh-secret-key-ipl-dhaba-2026',
  'CHANGE_THIS_TO_A_SECURE_PIN',
  'f53adacc-3763-44a3-8d45-e829cde91475',
]);

const MIN_SECRET_LENGTH = 32;

class EnvironmentError extends Error {
  constructor(problems: string[]) {
    super(
      `\nEnvironment validation failed — refusing to start.\n\n` +
        problems.map((p) => `  ✗ ${p}`).join('\n') +
        `\n\nSet the missing values in .env (see .env.example for the full list).\n`,
    );
    this.name = 'EnvironmentError';
  }
}

const problems: string[] = [];

function readRaw(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function required(key: string, opts: { minLength?: number; secret?: boolean } = {}): string {
  const value = readRaw(key);
  if (!value) {
    problems.push(`${key} is required but not set`);
    return '';
  }
  if (opts.secret && COMPROMISED_SECRETS.has(value)) {
    problems.push(`${key} is set to a value that was previously committed to git and is public. Generate a new one.`);
    return '';
  }
  if (opts.minLength && value.length < opts.minLength) {
    problems.push(`${key} must be at least ${opts.minLength} characters (got ${value.length})`);
    return '';
  }
  return value;
}

function optional(key: string, fallback?: string): string | undefined {
  const value = readRaw(key);
  if (value && COMPROMISED_SECRETS.has(value)) {
    problems.push(`${key} is set to a value that was previously committed to git and is public. Generate a new one.`);
    return undefined;
  }
  return value ?? fallback;
}

const rawNodeEnv = readRaw('NODE_ENV') ?? 'development';
if (!['development', 'test', 'production'].includes(rawNodeEnv)) {
  problems.push(`NODE_ENV must be one of development|test|production (got "${rawNodeEnv}")`);
}
const nodeEnv = rawNodeEnv as NodeEnv;
const isProduction = nodeEnv === 'production';

/** Required only when running in production. */
function requiredInProduction(key: string, opts: { minLength?: number; secret?: boolean } = {}): string | undefined {
  if (isProduction) return required(key, opts);
  return optional(key);
}

function parsePort(key: string, fallback: number): number {
  const raw = readRaw(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    problems.push(`${key} must be a valid TCP port (got "${raw}")`);
    return fallback;
  }
  return parsed;
}

function parseList(key: string): string[] {
  const raw = readRaw(key);
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const corsOrigins = parseList('CORS_ORIGINS');
if (isProduction && corsOrigins.length === 0) {
  problems.push('CORS_ORIGINS is required in production (comma-separated list of allowed browser origins)');
}

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  isDevelopment: nodeEnv === 'development',

  port: parsePort('PORT', 3001),
  host: optional('HOST', '0.0.0.0')!,
  appUrl: optional('APP_URL', 'http://localhost:3000')!,
  corsOrigins,

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET', { minLength: MIN_SECRET_LENGTH, secret: true }),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', { minLength: MIN_SECRET_LENGTH, secret: true }),
  jwtAccessTtl: duration('JWT_ACCESS_TTL', '15m'),
  jwtRefreshTtl: duration('JWT_REFRESH_TTL', '7d'),
  staffTokenTtl: duration('STAFF_TOKEN_TTL', '12h'),

  gatePassSecret: requiredInProduction('GATE_PASS_SECRET', { minLength: MIN_SECRET_LENGTH, secret: true }),

  redisUrl: optional('REDIS_URL'),
  redisHost: optional('REDIS_HOST'),
  redisPort: parsePort('REDIS_PORT', 6379),
  redisPassword: optional('REDIS_PASSWORD'),

  razorpayKeyId: requiredInProduction('RAZORPAY_KEY_ID'),
  razorpayKeySecret: requiredInProduction('RAZORPAY_KEY_SECRET', { secret: true }),
  razorpayWebhookSecret: requiredInProduction('RAZORPAY_WEBHOOK_SECRET', { secret: true }),

  firebaseProjectId: optional('FIREBASE_PROJECT_ID'),
  firebaseClientEmail: optional('FIREBASE_CLIENT_EMAIL'),
  firebasePrivateKey: optional('FIREBASE_PRIVATE_KEY'),
  googleApplicationCredentials: optional('GOOGLE_APPLICATION_CREDENTIALS'),

  cricketApiKey: optional('CRICKET_API_KEY'),

  defaultDhabaId: optional('DEFAULT_DHABA_ID', 'dhaba_singarayakonda')!,
} as const;

if (isProduction && !env.redisUrl && !env.redisHost) {
  problems.push('REDIS_URL or REDIS_HOST is required in production (in-memory fallback is not safe across replicas)');
}

if (problems.length > 0) {
  throw new EnvironmentError(problems);
}

/**
 * Used by `ConfigModule.forRoot({ validate })`. Validation has already run at
 * import time above; this simply passes the config through so Nest's
 * ConfigService stays in sync.
 */
export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  return raw;
}
