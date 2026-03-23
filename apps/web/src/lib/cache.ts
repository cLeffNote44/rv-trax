// ---------------------------------------------------------------------------
// Shared in-memory cache store for SWR-style data fetching
// ---------------------------------------------------------------------------

export interface CacheEntry {
  data: unknown;
  timestamp: number;
  /** In-flight promise for request deduplication */
  promise?: Promise<unknown>;
}

const cache = new Map<string, CacheEntry>();

/**
 * Retrieve a cache entry by key. Returns `undefined` if no entry exists.
 */
export function getCache(key: string): CacheEntry | undefined {
  return cache.get(key);
}

/**
 * Store data in the cache with the current timestamp.
 * Preserves any in-flight promise on the entry.
 */
export function setCache(key: string, data: unknown): void {
  const existing = cache.get(key);
  cache.set(key, {
    data,
    timestamp: Date.now(),
    // Clear the in-flight promise since we just resolved
    promise: existing?.promise,
  });
}

/**
 * Attach an in-flight promise to a cache entry for request deduplication.
 * If no entry exists yet, creates a placeholder with `data: null`.
 */
export function setCachePromise(key: string, promise: Promise<unknown>): void {
  const existing = cache.get(key);
  if (existing) {
    existing.promise = promise;
  } else {
    cache.set(key, { data: null as unknown, timestamp: 0, promise });
  }
}

/**
 * Clear the in-flight promise for a cache key (called after fetch settles).
 */
export function clearCachePromise(key: string): void {
  const existing = cache.get(key);
  if (existing) {
    existing.promise = undefined;
  }
}

/**
 * Remove a single key from the cache.
 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/**
 * Remove all entries from the cache.
 */
export function invalidateAll(): void {
  cache.clear();
}

/**
 * Check whether a cache entry is still fresh.
 */
export function isFresh(key: string, ttl: number): boolean {
  const entry = cache.get(key);
  if (!entry || entry.timestamp === 0) return false;
  return Date.now() - entry.timestamp < ttl;
}
