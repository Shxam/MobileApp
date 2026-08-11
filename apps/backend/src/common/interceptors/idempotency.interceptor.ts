import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../redis/redis.service';

/** How long a completed response stays replayable. */
const RESULT_TTL_SECONDS = 24 * 60 * 60;

/** How long a request may run before its in-flight marker is considered stale. */
const IN_FLIGHT_TTL_SECONDS = 60;

const IN_FLIGHT = '__in_flight__';

/**
 * Replays the response of a retried request instead of performing it twice.
 *
 * Three things were wrong with the original and are fixed here:
 *
 *  1. The cache key was the client-supplied header alone, so any user who
 *     guessed another user's key read their cached response. The key is now
 *     namespaced by user id *and* by the route, and the request body is
 *     fingerprinted so the same key cannot be reused for a different request.
 *  2. Two concurrent requests with the same key both missed the cache and both
 *     executed. An in-flight marker written with SET NX now rejects the second.
 *  3. A crash between handler and cache write left the marker forever; it now
 *     carries a short TTL and is cleared on failure.
 *
 * This is a convenience layer, not the guarantee. Order creation is made
 * idempotent by the unique `Order.idempotencyKey` column, which holds even when
 * Redis is unavailable.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(RedisService) private readonly redisService: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest();
    const rawKey: unknown = req.headers['idempotency-key'] ?? req.headers['x-idempotency-key'];

    if (typeof rawKey !== 'string' || rawKey.trim().length === 0) {
      return next.handle();
    }
    if (rawKey.length > 200) {
      throw new ConflictException('Idempotency-Key is too long.');
    }

    const userId: string = req.user?.userId ?? 'anonymous';
    const fingerprint = createHash('sha256')
      .update(`${req.method}:${req.route?.path ?? req.url}:${JSON.stringify(req.body ?? {})}`)
      .digest('hex')
      .slice(0, 32);
    const cacheKey = `idempotency:${userId}:${rawKey.trim()}:${fingerprint}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached === IN_FLIGHT) {
      throw new ConflictException('An identical request is still being processed.');
    }
    if (cached !== null) {
      return of(JSON.parse(cached));
    }

    // Claim the key. Losing this race means another request got there first.
    const claimed = await this.redisService.setNx(cacheKey, IN_FLIGHT, IN_FLIGHT_TTL_SECONDS * 1000);
    if (!claimed) {
      throw new ConflictException('An identical request is still being processed.');
    }

    return next.handle().pipe(
      tap({
        next: (result) => {
          void this.redisService.set(cacheKey, JSON.stringify(result ?? null), RESULT_TTL_SECONDS);
        },
        // Release on failure so the client can genuinely retry.
        error: () => {
          void this.redisService.del(cacheKey);
        },
      }),
    );
  }
}
