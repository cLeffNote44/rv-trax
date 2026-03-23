'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  clearCachePromise,
  getCache,
  isFresh,
  setCachePromise,
  setCache,
  type CacheEntry,
} from '@/lib/cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseApiCacheOptions<T> {
  /** Cache key — must be unique per endpoint+params */
  key: string;
  /** Fetch function that returns the data */
  fetcher: () => Promise<T>;
  /** Time-to-live in ms before background revalidation (default: 30 000) */
  ttl?: number;
  /** Revalidate when the browser tab regains focus (default: true) */
  revalidateOnFocus?: boolean;
  /** Revalidate on mount even when cached data exists (default: true) */
  revalidateOnMount?: boolean;
}

interface UseApiCacheResult<T> {
  data: T | null;
  error: Error | null;
  /** `true` on the very first load when no cached data is available */
  isLoading: boolean;
  /** `true` while revalidating in the background (cached data is still shown) */
  isValidating: boolean;
  /** Optimistically update cached data without refetching */
  mutate: (data?: T) => void;
  /** Force revalidation regardless of TTL */
  refetch: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Global subscription system — lets multiple hook instances sharing the same
// key stay in sync without prop-drilling or context.
// ---------------------------------------------------------------------------

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

function subscribe(key: string, listener: Listener): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(key);
  };
}

function notify(key: string): void {
  const set = listeners.get(key);
  if (set) {
    set.forEach((l) => l());
  }
}

// ---------------------------------------------------------------------------
// Snapshot helpers for useSyncExternalStore — provides a tear-free read of
// the cache entry that re-renders subscribers whenever `notify` fires.
// ---------------------------------------------------------------------------

function getSnapshot(key: string): CacheEntry | undefined {
  return getCache(key);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEFAULT_TTL = 30_000; // 30 seconds

/**
 * SWR-inspired data-fetching hook with in-memory caching.
 *
 * - Returns cached data immediately while revalidating in the background.
 * - Deduplicates concurrent requests to the same cache key.
 * - Supports optimistic mutation and manual refetch.
 * - Optionally revalidates when the browser tab regains focus.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch, mutate } = useApiCache({
 *   key: `units-${status}`,
 *   fetcher: () => getUnits({ status }),
 * });
 * ```
 */
export function useApiCache<T>(options: UseApiCacheOptions<T>): UseApiCacheResult<T> {
  const {
    key,
    fetcher,
    ttl = DEFAULT_TTL,
    revalidateOnFocus = true,
    revalidateOnMount = true,
  } = options;

  // Keep refs to latest values so callbacks never go stale
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const ttlRef = useRef(ttl);
  ttlRef.current = ttl;
  const keyRef = useRef(key);
  keyRef.current = key;

  // ---------------------------------------------------------------------------
  // Sync with cache via useSyncExternalStore for tear-free reads
  // ---------------------------------------------------------------------------

  const subscribeToKey = useCallback((listener: Listener) => subscribe(key, listener), [key]);

  const snap = useSyncExternalStore(
    subscribeToKey,
    () => getSnapshot(key),
    () => getSnapshot(key), // SSR snapshot — always undefined on server
  );

  // ---------------------------------------------------------------------------
  // Local state for error / validating flags (these are per-instance)
  // ---------------------------------------------------------------------------

  const [error, setError] = useState<Error | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Core revalidation logic
  // ---------------------------------------------------------------------------

  const revalidate = useCallback(async (force = false): Promise<void> => {
    const currentKey = keyRef.current;

    // If the cache is fresh and we're not forcing, skip
    if (!force && isFresh(currentKey, ttlRef.current)) {
      return;
    }

    // Deduplicate: if there's already a fetch in-flight for this key, wait
    const existing = getCache(currentKey);
    if (existing?.promise) {
      if (mountedRef.current) setIsValidating(true);
      try {
        await existing.promise;
      } finally {
        if (mountedRef.current) setIsValidating(false);
      }
      return;
    }

    if (mountedRef.current) {
      setIsValidating(true);
      setError(null);
    }

    const promise = fetcherRef.current();
    setCachePromise(currentKey, promise as Promise<unknown>);

    try {
      const data = await promise;
      setCache(currentKey, data);
      clearCachePromise(currentKey);
      notify(currentKey);
      if (mountedRef.current) {
        setError(null);
      }
    } catch (err) {
      clearCachePromise(currentKey);
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('An error occurred'));
      }
    } finally {
      if (mountedRef.current) {
        setIsValidating(false);
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Mount effect — serve from cache or fetch
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const entry = getCache(key);
    const hasCachedData = entry && entry.timestamp > 0;

    if (hasCachedData) {
      // We have cached data. Optionally revalidate in background.
      if (revalidateOnMount) {
        revalidate();
      }
    } else {
      // No cached data — must fetch
      revalidate(true);
    }
  }, [key]);

  // ---------------------------------------------------------------------------
  // Focus revalidation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!revalidateOnFocus) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [revalidateOnFocus, revalidate]);

  // ---------------------------------------------------------------------------
  // Mutate — optimistic update
  // ---------------------------------------------------------------------------

  const mutate = useCallback(
    (newData?: T) => {
      if (newData !== undefined) {
        setCache(key, newData);
        notify(key);
      } else {
        // Called without data — trigger revalidation
        revalidate(true);
      }
    },
    [key, revalidate],
  );

  // ---------------------------------------------------------------------------
  // Refetch — forced revalidation
  // ---------------------------------------------------------------------------

  const refetch = useCallback(() => revalidate(true), [revalidate]);

  // ---------------------------------------------------------------------------
  // Derive return values
  // ---------------------------------------------------------------------------

  const cachedData = (snap?.data as T) ?? null;
  const hasCachedData = snap !== undefined && snap.timestamp > 0;

  // isLoading is true only when there's no cached data to show
  const isLoading = !hasCachedData && isValidating;

  return {
    data: cachedData,
    error,
    isLoading,
    isValidating,
    mutate,
    refetch,
  };
}
