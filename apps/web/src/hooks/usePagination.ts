'use client';

import { useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaginationState {
  /** Current cursor for cursor-based pagination (null = first page). */
  cursor: string | null;
  /** Number of items per page. */
  pageSize: number;
  /** Whether there are more items to fetch. */
  hasMore: boolean;
  /** Total count of items (if returned by the API). */
  totalCount: number | null;
  /** History of cursors for "previous page" navigation. */
  cursorHistory: string[];
  /** Current page number (1-based, derived from cursor history). */
  page: number;
}

interface UsePaginationReturn extends PaginationState {
  /** Advance to the next page using the provided cursor. */
  nextPage: (nextCursor: string) => void;
  /** Go back to the previous page. */
  prevPage: () => void;
  /** Reset to the first page. */
  reset: () => void;
  /** Update hasMore and totalCount from API response. */
  setPageInfo: (info: { hasMore: boolean; totalCount?: number }) => void;
  /** Update the page size. */
  setPageSize: (size: number) => void;
  /** Whether there is a previous page to go back to. */
  hasPrev: boolean;
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages cursor-based pagination state.
 *
 * @param initialPageSize  Items per page (default: 50).
 *
 * @example
 * ```tsx
 * const pagination = usePagination(25);
 *
 * const { data } = useApi(
 *   () => getUnits({ cursor: pagination.cursor, limit: pagination.pageSize }),
 *   [pagination.cursor, pagination.pageSize]
 * );
 *
 * // After fetching:
 * useEffect(() => {
 *   if (data) {
 *     pagination.setPageInfo({
 *       hasMore: data.pagination.has_more,
 *       totalCount: data.pagination.total_count,
 *     });
 *   }
 * }, [data]);
 * ```
 */
export function usePagination(initialPageSize = DEFAULT_PAGE_SIZE): UsePaginationReturn {
  const [state, setState] = useState<PaginationState>({
    cursor: null,
    pageSize: initialPageSize,
    hasMore: false,
    totalCount: null,
    cursorHistory: [],
    page: 1,
  });

  const nextPage = useCallback((nextCursor: string) => {
    setState((prev) => ({
      ...prev,
      cursorHistory: prev.cursor
        ? [...prev.cursorHistory, prev.cursor]
        : prev.cursorHistory,
      cursor: nextCursor,
      page: prev.page + 1,
    }));
  }, []);

  const prevPage = useCallback(() => {
    setState((prev) => {
      if (prev.cursorHistory.length === 0) return prev;
      const history = [...prev.cursorHistory];
      const previousCursor = history.pop() ?? null;
      return {
        ...prev,
        cursor: previousCursor,
        cursorHistory: history,
        page: Math.max(prev.page - 1, 1),
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      cursor: null,
      cursorHistory: [],
      page: 1,
      hasMore: false,
      totalCount: null,
    }));
  }, []);

  const setPageInfo = useCallback(
    (info: { hasMore: boolean; totalCount?: number }) => {
      setState((prev) => ({
        ...prev,
        hasMore: info.hasMore,
        totalCount: info.totalCount ?? prev.totalCount,
      }));
    },
    []
  );

  const setPageSize = useCallback((size: number) => {
    setState((prev) => ({
      ...prev,
      pageSize: size,
      cursor: null,
      cursorHistory: [],
      page: 1,
    }));
  }, []);

  return {
    ...state,
    nextPage,
    prevPage,
    reset,
    setPageInfo,
    setPageSize,
    hasPrev: state.cursorHistory.length > 0 || state.cursor !== null,
  };
}
