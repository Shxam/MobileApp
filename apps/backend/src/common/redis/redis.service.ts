import { Injectable, OnModuleInit, OnModuleDestroy, Logger, ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';

type MemoryRecord = { value: string; expiresAt?: number };

/**
 * Namespace prepended to every key.
 *
 * There is one Redis instance, shared the way the one Postgres instance is
 * shared. The database is isolated per environment by schema; this is the
 * equivalent for the cache. Without it a test run and production write the same
 * rate-limit counters, quote ids, and lock keys — and because these keys carry
 * TTLs rather than being torn down at the end of a run, the pollution outlives
 * the process that caused it.
 *
 * Applied centrally here rather than via ioredis's own `keyPrefix` option,
 * because that option is not applied to the `KEYS` arguments of `eval` — it
 * would prefix `get`/`set`/`del` while leaving the Lua scripts operating on
 * unprefixed keys, which is worse than no prefix at all.
 */
const KEY_NAMESPACE = env.isTest ? 'test:' : '';

/**
 * Redis with an in-memory fallback for local development only.
 *
 * The fallback is per-process, so it is *not* correct across replicas — a lock
 * taken in one pod is invisible to another. Production therefore refuses to use
 * it: `env.ts` already requires REDIS_URL/REDIS_HOST when NODE_ENV=production,
 * and every fallback path here logs loudly rather than failing silently.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly memoryStore = new Map<string, MemoryRecord>();
  private isConnected = false;
  /** Logged once per process so a Redis outage is visible without spamming. */
  private warnedAboutFallback = false;

  onModuleInit() {
    try {
      this.client = env.redisUrl
        ? new Redis(env.redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
            retryStrategy: () => null,
          })
        : new Redis({
            host: env.redisHost || 'localhost',
            port: env.redisPort,
            password: env.redisPassword,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
            retryStrategy: () => null,
          });

      // An 'error' listener is mandatory; without one ioredis escalates
      // connection errors to an uncaught exception and kills the process.
      this.client.on('error', () => {
        this.isConnected = false;
      });

      this.client
        .connect()
        .then(() => {
          this.isConnected = true;
          this.logger.log('Connected to Redis.');
        })
        .catch((error: Error) => {
          this.isConnected = false;
          this.degrade(`connect failed: ${error.message}`);
        });
    } catch (error) {
      this.isConnected = false;
      this.degrade((error as Error).message);
    }
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  /** True when a real Redis connection is serving requests. */
  get isHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }

  private degrade(reason: string): void {
    if (env.isProduction) {
      // env.ts already refuses to boot production without Redis; if we somehow
      // get here anyway, surface it rather than silently going per-process.
      this.logger.error(`Redis unavailable in production (${reason}). Distributed state is broken.`);
      return;
    }
    if (!this.warnedAboutFallback) {
      this.warnedAboutFallback = true;
      this.logger.warn(
        `Redis unavailable (${reason}). Falling back to a per-process in-memory store — ` +
          'locks and caches are NOT shared across replicas. Development only.',
      );
    }
  }

  public async ping(): Promise<string> {
    if (this.isHealthy) return this.client!.ping();
    throw new ServiceUnavailableException('Redis is not connected.');
  }

  /**
   * Applies the environment namespace. Every public method routes its key
   * through here — including the fallback store, so a key means the same thing
   * whether Redis is up or not.
   */
  private namespaced(key: string): string {
    return `${KEY_NAMESPACE}${key}`;
  }

  public async get(key: string): Promise<string | null> {
    const k = this.namespaced(key);
    if (this.isHealthy) {
      try {
        return await this.client!.get(k);
      } catch (error) {
        this.degrade((error as Error).message);
      }
    }
    return this.memoryGet(k);
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const k = this.namespaced(key);
    if (this.isHealthy) {
      try {
        if (ttlSeconds) await this.client!.set(k, value, 'EX', ttlSeconds);
        else await this.client!.set(k, value);
        return; // Do NOT also write to memory — that shadow copy would go stale.
      } catch (error) {
        this.degrade((error as Error).message);
      }
    }
    this.memorySet(k, value, ttlSeconds);
  }

  public async del(key: string): Promise<void> {
    const k = this.namespaced(key);
    if (this.isHealthy) {
      try {
        await this.client!.del(k);
        return;
      } catch (error) {
        this.degrade((error as Error).message);
      }
    }
    this.memoryStore.delete(k);
  }

  /**
   * Atomic "acquire if absent" — the primitive behind every distributed lock in
   * this codebase. Returns true only if this caller created the key.
   */
  public async setNx(key: string, value: string, ttlMs: number): Promise<boolean> {
    const k = this.namespaced(key);
    if (this.isHealthy) {
      try {
        const result = await this.client!.set(k, value, 'PX', ttlMs, 'NX');
        return result === 'OK';
      } catch (error) {
        this.degrade((error as Error).message);
      }
    }
    // Single-threaded event loop makes this check-then-set atomic per process.
    if (this.memoryGet(k) !== null) return false;
    this.memorySet(k, value, Math.ceil(ttlMs / 1000));
    return true;
  }

  /**
   * Releases a lock only if this caller still owns it, so a lock that already
   * expired and was re-acquired by someone else is never stolen.
   */
  public async releaseLock(key: string, token: string): Promise<boolean> {
    const k = this.namespaced(key);
    const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    if (this.isHealthy) {
      try {
        const result = await this.client!.eval(script, 1, k, token);
        return result === 1;
      } catch (error) {
        this.degrade((error as Error).message);
      }
    }
    if (this.memoryGet(k) !== token) return false;
    this.memoryStore.delete(k);
    return true;
  }

  /** Atomically runs `fn` while holding `key`, releasing it even if `fn` throws. */
  public async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
    const token = `${process.pid}-${Math.random().toString(36).slice(2)}`;
    if (!(await this.setNx(key, token, ttlMs))) return null;
    try {
      return await fn();
    } finally {
      await this.releaseLock(key, token);
    }
  }

  /**
   * Atomically increments a counter and returns its new value together with the
   * milliseconds left on its TTL. The TTL is applied only when the key is
   * created, so a window measures from its first hit rather than sliding
   * forward on every request.
   *
   * A GET-then-SET pair would lose increments whenever two requests interleave,
   * which is exactly the case a shared rate limiter exists to handle — so this
   * is a single Lua script, evaluated server-side.
   */
  public async incrementWithTtl(key: string, ttlMs: number): Promise<{ count: number; ttlMs: number }> {
    const script = `
      local count = redis.call("incr", KEYS[1])
      if count == 1 then
        redis.call("pexpire", KEYS[1], ARGV[1])
      end
      return { count, redis.call("pttl", KEYS[1]) }
    `;
    const k = this.namespaced(key);
    if (this.isHealthy) {
      try {
        const [count, pttl] = (await this.client!.eval(script, 1, k, ttlMs)) as [number, number];
        return { count, ttlMs: pttl > 0 ? pttl : ttlMs };
      } catch (error) {
        this.degrade((error as Error).message);
      }
    }

    // Per-process fallback. Correct within one replica, which is all the
    // in-memory store ever claims to be.
    const record = this.memoryStore.get(k);
    const now = Date.now();
    if (!record || (record.expiresAt && now > record.expiresAt)) {
      this.memoryStore.set(k, { value: '1', expiresAt: now + ttlMs });
      return { count: 1, ttlMs };
    }
    const count = Number(record.value) + 1;
    record.value = String(count);
    return { count, ttlMs: Math.max(0, (record.expiresAt ?? now) - now) };
  }

  /** Milliseconds left on a key, or 0 when it is absent or has no expiry set. */
  public async pttl(key: string): Promise<number> {
    const k = this.namespaced(key);
    if (this.isHealthy) {
      try {
        const result = await this.client!.pttl(k);
        return result > 0 ? result : 0;
      } catch (error) {
        this.degrade((error as Error).message);
      }
    }
    const record = this.memoryStore.get(k);
    if (!record?.expiresAt) return 0;
    return Math.max(0, record.expiresAt - Date.now());
  }

  public async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Discarding malformed JSON at key "${key}".`);
      return null;
    }
  }

  public async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  private memoryGet(key: string): string | null {
    const record = this.memoryStore.get(key);
    if (!record) return null;
    if (record.expiresAt && Date.now() > record.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return record.value;
  }

  private memorySet(key: string, value: string, ttlSeconds?: number): void {
    this.memoryStore.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }
}
