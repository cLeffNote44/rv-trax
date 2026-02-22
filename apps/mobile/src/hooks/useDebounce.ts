// ---------------------------------------------------------------------------
// RV Trax Mobile — useDebounce Hook
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms of
 * inactivity. Useful for search inputs where you want to avoid firing an API
 * call on every keystroke.
 *
 * @example
 * const debouncedQuery = useDebounce(searchText, 300);
 * useEffect(() => { search(debouncedQuery); }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
