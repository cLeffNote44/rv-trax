'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Generic data-fetching hook with loading, error, and refetch support.
 *
 * @param fetcher  Async function that returns data of type T.
 * @param deps     Dependency array — refetches when any value changes.
 *
 * @example
 * ```tsx
 * const { data: units, isLoading, error, refetch } = useApi(
 *   () => getUnits({ status: filter }),
 *   [filter]
 * );
 * ```
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: true,
    error: null,
  });

  // Track the latest fetcher so we can refetch without stale closures
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Track mount state to avoid state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await fetcherRef.current();
      if (mountedRef.current) {
        setState({ data, isLoading: false, error: null });
      }
    } catch (err) {
      if (mountedRef.current) {
        setState({
          data: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'An error occurred',
        });
      }
    }
  }, []);

  // Fetch on mount and whenever deps change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    execute();
  }, [...deps, execute]);

  return {
    ...state,
    refetch: execute,
  };
}
