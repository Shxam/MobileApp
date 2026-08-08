// ===================================================
// IPL Dhaba Backend — Redis Caching & Token Blocklist
// Menu Reads, Turf Availability & Revocation Cache
// ===================================================

import { Logger } from './logger';

class MemoryRedisCache {
  private store: Map<string, { value: string; expiresAt: number }> = new Map();

  public async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  public async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  public async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const redisClient = new MemoryRedisCache();

export const CacheStrategy = {
  // Menu Cache (TTL 1 hour)
  getMenu: async () => {
    const cached = await redisClient.get('cache:menu:all');
    if (cached) {
      Logger.info('Cache HIT: Menu reads', undefined, 'RedisCache');
      return JSON.parse(cached);
    }
    Logger.info('Cache MISS: Menu reads', undefined, 'RedisCache');
    return null;
  },

  setMenu: async (data: any) => {
    await redisClient.set('cache:menu:all', JSON.stringify(data), 3600);
  },

  // Turf Availability Cache (TTL 5 mins)
  getTurfSlots: async (date: string) => {
    const cached = await redisClient.get(`cache:turf:availability:${date}`);
    if (cached) {
      Logger.info(`Cache HIT: Turf Availability ${date}`, undefined, 'RedisCache');
      return JSON.parse(cached);
    }
    return null;
  },

  setTurfSlots: async (date: string, slots: any) => {
    await redisClient.set(`cache:turf:availability:${date}`, JSON.stringify(slots), 300);
  },

  // JWT Blocklist (TTL 24 hours)
  blockJwtToken: async (token: string, ttlSeconds = 86400) => {
    await redisClient.set(`blocklist:jwt:${token}`, 'revoked', ttlSeconds);
  },

  isJwtBlocked: async (token: string): Promise<boolean> => {
    const res = await redisClient.get(`blocklist:jwt:${token}`);
    return res === 'revoked';
  },
};
