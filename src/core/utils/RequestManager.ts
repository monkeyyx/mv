/**
 * RequestManager prevents "Cache Stampede" by coalescing simultaneous 
 * requests for the same resource into a single execution.
 */
export class RequestManager {
  private inFlight = new Map<string, Promise<any>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      console.log(`[RequestManager] Coalescing request for: ${key}`);
      return existing;
    }

    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }
}

export const requestManager = new RequestManager();
