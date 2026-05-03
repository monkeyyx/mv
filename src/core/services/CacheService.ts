import type { KVNamespace } from "@cloudflare/workers-types";

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class CacheService implements ICacheService {
  private kv?: KVNamespace;
  private localCache = new Map<string, { value: any; expires: number }>();

  constructor(kvNamespace?: KVNamespace) {
    this.kv = kvNamespace;
  }

  async get<T>(key: string): Promise<T | null> {
    // 1. Try KV if available
    if (this.kv) {
      try {
        const val = await this.kv.get(key, "json");
        if (val) return val as T;
      } catch (e) {
        console.error(`[CacheService] KV Get Error for ${key}:`, e);
      }
    }

    // 2. Fallback to Local Map
    const cached = this.localCache.get(key);
    if (cached) {
      if (Date.now() < cached.expires) {
        return cached.value as T;
      }
      this.localCache.delete(key);
    }

    return null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    // 1. Set in KV if available
    if (this.kv) {
      try {
        await this.kv.put(key, JSON.stringify(value), {
          expirationTtl: Math.max(60, ttlSeconds), // KV minimum is 60s
        });
      } catch (e) {
        console.error(`[CacheService] KV Set Error for ${key}:`, e);
      }
    }

    // 2. Set in Local Map
    this.localCache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    if (this.kv) {
      await this.kv.delete(key);
    }
    this.localCache.delete(key);
  }
}
