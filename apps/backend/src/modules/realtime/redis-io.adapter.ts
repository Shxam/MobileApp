import { IoAdapter } from '@nestjs/platform-socket.io';
import { Logger, type INestApplicationContext } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';
import { env } from '../../common/config/env';

/**
 * Cross-replica socket.io fan-out.
 *
 * Rooms are per-process by default: `server.to('user:x').emit(...)` reaches only
 * the sockets connected to *this* pod. The deployment runs 2–10 replicas behind
 * a load balancer, so a customer's browser and the driver whose location updates
 * they are watching will usually be on different ones — and without this adapter
 * the customer's map simply never moves, with nothing logged anywhere.
 *
 * The adapter needs two dedicated connections: a Redis client in subscriber mode
 * cannot issue ordinary commands, so the publisher cannot be shared with it, and
 * neither can be `RedisService`'s client (which is busy with rate-limit counters
 * and locks).
 */
export class RedisIoAdapter extends IoAdapter {
  private static readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private clients: Redis[] = [];

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  /**
   * Returns false when Redis is unreachable, so the caller can decide whether
   * that is fatal. It is in production — `env.ts` refuses to boot without
   * REDIS_URL there — but single-process development is perfectly serviceable
   * with per-process rooms, and failing to start would be worse than degrading.
   */
  async connect(): Promise<boolean> {
    const options = {
      lazyConnect: true,
      maxRetriesPerRequest: null as null,
      connectTimeout: 3000,
      // The default strategy reconnects forever; that is right for a long-lived
      // pub/sub link, but the initial connect below must not hang on boot.
      retryStrategy: (times: number) => Math.min(times * 500, 5000),
    };

    const pubClient = env.redisUrl
      ? new Redis(env.redisUrl, options)
      : new Redis({ host: env.redisHost || 'localhost', port: env.redisPort, password: env.redisPassword, ...options });
    const subClient = pubClient.duplicate();

    // Mandatory: without an 'error' listener ioredis escalates a connection
    // error to an uncaught exception and takes the process down.
    for (const client of [pubClient, subClient]) {
      client.on('error', (error: Error) => {
        RedisIoAdapter.logger.error(`Socket.io Redis adapter error: ${error.message}`);
      });
    }
    this.clients = [pubClient, subClient];

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.adapterConstructor = createAdapter(pubClient, subClient);
      RedisIoAdapter.logger.log('Socket.io Redis adapter connected; rooms span replicas.');
      return true;
    } catch (error) {
      RedisIoAdapter.logger.warn(
        `Socket.io Redis adapter unavailable (${(error as Error).message}). ` +
          'Rooms are per-process — realtime will not fan out across replicas.',
      );
      this.disposeClients();
      return false;
    }
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      (server as { adapter: (a: unknown) => void }).adapter(this.adapterConstructor);
    }
    return server;
  }

  /**
   * Nest calls this on shutdown. Both pub/sub connections use an infinite
   * `retryStrategy`, so without releasing them here the process would keep two
   * sockets reconnecting to Redis after `app.close()` and never exit.
   */
  override async close(server: Parameters<IoAdapter['close']>[0]): Promise<void> {
    await super.close(server);
    this.disposeClients();
  }

  private disposeClients(): void {
    for (const client of this.clients) client.disconnect();
    this.clients = [];
    this.adapterConstructor = undefined;
  }
}
