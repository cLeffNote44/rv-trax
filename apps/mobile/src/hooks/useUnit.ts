// ---------------------------------------------------------------------------
// RV Trax Mobile — useUnit Hook
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import type { Unit } from '@rv-trax/shared';
import { apiClient, AppError } from '../services/api';

export interface UseUnitReturn {
  unit: Unit | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetch a single unit by ID with loading/error state management.
 */
export function useUnit(unitId: string): UseUnitReturn {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getUnit(unitId);
      setUnit(data);
    } catch (e) {
      const message =
        e instanceof AppError ? e.message : 'Failed to load unit';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { unit, isLoading, error, refetch: fetch };
}
