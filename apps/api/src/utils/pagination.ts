// ---------------------------------------------------------------------------
// RV Trax API — Cursor pagination helpers
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
    total_count: number;
  };
}

/**
 * Encode an ID into a base64 cursor string.
 */
export function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf-8').toString('base64url');
}

/**
 * Decode a base64 cursor string back to an ID.
 */
export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf-8');
}

/**
 * Build a standardised paginated response.
 * Expects `data` to have been fetched with `limit + 1` rows so we can detect
 * whether a next page exists.
 */
export function buildPaginatedResponse<T extends { id: string }>(
  data: T[],
  limit: number,
  totalCount: number,
): PaginatedResult<T> {
  const hasMore = data.length > limit;
  const page = hasMore ? data.slice(0, limit) : data;
  const lastItem = page[page.length - 1];
  const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.id) : null;

  return {
    data: page,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
      total_count: totalCount,
    },
  };
}
