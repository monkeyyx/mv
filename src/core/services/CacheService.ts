import type { KVNamespace } from "@cloudflare/workers-types";

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CacheResult<T> {
  value: T | null;
  isStale: boolean;
}

export class CacheService implements ICacheService {
  private kv?: KVNamespace;
  private localCache = new Map<string, { value: any; expires: number; swrExpires: number }>();

  constructor(kvNamespace?: KVNamespace) {
    this.kv = kvNamespace;
  }

  /**
   * getWithMetadata returns the value and whether it is technically expired 
   * but still within the SWR window.
   */
  async getWithMetadata<T>(key: string): Promise<CacheResult<T>> {
    // 1. Try Local Map First (Faster)
    const cached = this.localCache.get(key);
    if (cached) {
      const now = Date.now();
      if (now < cached.expires) {
        return { value: cached.value as T, isStale: false };
      }
      if (now < cached.swrExpires) {
        return { value: cached.value as T, isStale: true };
      }
      this.localCache.delete(key);
    }

    // 2. Try KV if available
    if (this.kv) {
      try {
        const { value, metadata } = await this.kv.getWithMetadata<{ expires: number; swrExpires: number }>(key, "json");
        if (value) {
          const now = Date.now();
          const meta = metadata || { expires: 0, swrExpires: 0 };
          
          // Re-populate local cache for faster subsequent hits
          this.localCache.set(key, { 
            value, 
            expires: meta.expires, 
            swrExpires: meta.swrExpires 
          });

          if (now < meta.expires) {
            return { value: value as T, isStale: false };
          }
          if (now < meta.swrExpires) {
            return { value: value as T, isStale: true };
          }
        }
      } catch (e) {
        console.error(`[CacheService] KV Get Error for ${key}:`, e);
      }
    }

    return { value: null, isStale: false };
  }

  async get<T>(key: string): Promise<T | null> {
    const { value } = await this.getWithMetadata<T>(key);
    return value;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 3600, swrSeconds: number = 86400): Promise<void> {
    const now = Date.now();
    const expires = now + ttlSeconds * 1000;
    const swrExpires = now + (ttlSeconds + swrSeconds) * 1000;

    // 1. Set in KV if available
    if (this.kv) {
      try {
        await this.kv.put(key, JSON.stringify(value), {
          expirationTtl: Math.max(60, ttlSeconds + swrSeconds),
          metadata: { expires, swrExpires }
        });
      } catch (e) {
        console.error(`[CacheService] KV Set Error for ${key}:`, e);
      }
    }

    // 2. Set in Local Map
    this.localCache.set(key, { value, expires, swrExpires });
  }

  async delete(key: string): Promise<void> {
    if (this.kv) {
      await this.kv.delete(key);
    }
    this.localCache.delete(key);
  }
}
