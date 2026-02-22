import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, buildPaginatedResponse } from '../../utils/pagination.js';

describe('pagination helpers', () => {
  describe('encodeCursor / decodeCursor', () => {
    it('round-trips an ID through encode/decode', () => {
      const id = '550e8400-e29b-41d4-a716-446655440000';
      const cursor = encodeCursor(id);
      expect(typeof cursor).toBe('string');
      expect(cursor).not.toBe(id);
      expect(decodeCursor(cursor)).toBe(id);
    });
  });

  describe('buildPaginatedResponse', () => {
    it('returns has_more=false when data fits in limit', () => {
      const data = [
        { id: 'a', name: 'one' },
        { id: 'b', name: 'two' },
      ];
      const result = buildPaginatedResponse(data, 10, 2);
      expect(result.data).toHaveLength(2);
      expect(result.pagination.has_more).toBe(false);
      expect(result.pagination.next_cursor).toBeNull();
      expect(result.pagination.total_count).toBe(2);
    });

    it('returns has_more=true and cursor when data exceeds limit', () => {
      // buildPaginatedResponse expects data fetched with limit+1 rows
      // so passing 3 items with limit=2 signals there is a next page
      const data = [
        { id: 'a', name: 'one' },
        { id: 'b', name: 'two' },
        { id: 'c', name: 'three' },
      ];
      const result = buildPaginatedResponse(data, 2, 5);
      expect(result.data).toHaveLength(2);
      expect(result.pagination.has_more).toBe(true);
      expect(result.pagination.next_cursor).toBeTruthy();
      expect(result.pagination.total_count).toBe(5);

      // Cursor should decode to last item's id in the returned page
      const decoded = decodeCursor(result.pagination.next_cursor!);
      expect(decoded).toBe('b');
    });

    it('handles empty data', () => {
      const result = buildPaginatedResponse([], 10, 0);
      expect(result.data).toHaveLength(0);
      expect(result.pagination.has_more).toBe(false);
      expect(result.pagination.next_cursor).toBeNull();
    });
  });
});
