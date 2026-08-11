import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from './redis.service';

/**
 * Redis-backed storage for `@nestjs/throttler`.
 *
 * The default storage is an in-process `Map`. With the deployment's 2–10
 * replicas that silently multiplies every limit by the replica count — a
 * "120 requests per minute" rule actually admits up to 1200, and which limit a
 * caller hits depends on which pod the load balancer picked. Rate limiting is
 * the control standing in front of the login and payment endpoints, so it has
 * to be shared state.
 *
 * `RedisService` degrades to a per-process store when Redis is unreachable,
 * which is the pre-existing (and loudly logged) development behaviour; `env.ts`
 * refuses to boot production without Redis.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle-block:${throttlerName}:${key}`;

    // A caller already serving a block is rejected without touching the
    // counter, so hammering the endpoint cannot extend its own window.
    const blockedFor = await this.redis.pttl(blockKey);
    if (blockedFor > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: Math.ceil(blockedFor / 1000),
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockedFor / 1000),
      };
    }

    const { count, ttlMs } = await this.redis.incrementWithTtl(hitKey, ttl);

    if (count > limit) {
      // `blockDuration` is optional in the module config; fall back to the
      // window length so exceeding a limit always costs something.
      const blockMs = blockDuration > 0 ? blockDuration : ttl;
      await this.redis.set(blockKey, '1', Math.ceil(blockMs / 1000));
      return {
        totalHits: count,
        timeToExpire: Math.ceil(blockMs / 1000),
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockMs / 1000),
      };
    }

    return {
      totalHits: count,
      timeToExpire: Math.ceil(ttlMs / 1000),
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
