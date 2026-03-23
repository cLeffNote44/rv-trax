import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCache,
  setCache,
  invalidateCache,
  invalidateAll,
  setCachePromise,
  clearCachePromise,
  isFresh,
} from '@/lib/cache';

// ---------------------------------------------------------------------------
// Start each test with a clean cache
// ---------------------------------------------------------------------------

beforeEach(() => {
  invalidateAll();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cache', () => {
  describe('setCache / getCache', () => {
    it('stores data with a timestamp', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      setCache('units', [{ id: 1 }]);
      const entry = getCache('units');

      expect(entry).toBeDefined();
      expect(entry!.data).toEqual([{ id: 1 }]);
      expect(entry!.timestamp).toBe(now);

      vi.useRealTimers();
    });

    it('returns undefined for missing key', () => {
      expect(getCache('missing')).toBeUndefined();
    });

    it('overwrites existing data', () => {
      setCache('key', 'first');
      setCache('key', 'second');
      expect(getCache('key')!.data).toBe('second');
    });
  });

  describe('invalidateCache', () => {
    it('removes a specific key', () => {
      setCache('a', 1);
      setCache('b', 2);

      invalidateCache('a');

      expect(getCache('a')).toBeUndefined();
      expect(getCache('b')).toBeDefined();
    });

    it('is a no-op for non-existing key', () => {
      expect(() => invalidateCache('nope')).not.toThrow();
    });
  });

  describe('invalidateAll', () => {
    it('clears all entries', () => {
      setCache('x', 1);
      setCache('y', 2);
      setCache('z', 3);

      invalidateAll();

      expect(getCache('x')).toBeUndefined();
      expect(getCache('y')).toBeUndefined();
      expect(getCache('z')).toBeUndefined();
    });
  });

  describe('setCachePromise / clearCachePromise', () => {
    it('attaches a promise to an existing entry', () => {
      setCache('key', 'data');
      const p = Promise.resolve('new');
      setCachePromise('key', p);

      expect(getCache('key')!.promise).toBe(p);
    });

    it('creates a placeholder entry when key does not exist', () => {
      const p = Promise.resolve('value');
      setCachePromise('new-key', p);

      const entry = getCache('new-key');
      expect(entry).toBeDefined();
      expect(entry!.promise).toBe(p);
      expect(entry!.timestamp).toBe(0);
    });

    it('clears promise from entry', () => {
      setCache('key', 'data');
      setCachePromise('key', Promise.resolve());
      clearCachePromise('key');

      expect(getCache('key')!.promise).toBeUndefined();
    });
  });

  describe('isFresh', () => {
    it('returns true when within TTL', () => {
      const now = 1000000;
      vi.setSystemTime(now);
      setCache('key', 'data');

      vi.setSystemTime(now + 5000); // 5 seconds later
      expect(isFresh('key', 10000)).toBe(true); // 10s TTL

      vi.useRealTimers();
    });

    it('returns false when past TTL', () => {
      const now = 1000000;
      vi.setSystemTime(now);
      setCache('key', 'data');

      vi.setSystemTime(now + 15000); // 15 seconds later
      expect(isFresh('key', 10000)).toBe(false); // 10s TTL

      vi.useRealTimers();
    });

    it('returns false for non-existing key', () => {
      expect(isFresh('nope', 10000)).toBe(false);
    });

    it('returns false for placeholder entries (timestamp 0)', () => {
      setCachePromise('pending', Promise.resolve());
      expect(isFresh('pending', 10000)).toBe(false);
    });
  });
});
