import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@/hooks/useApi';

describe('useApi', () => {
  it('starts in loading state', () => {
    const fetcher = vi.fn(() => new Promise<string>(() => {})); // never resolves
    const { result } = renderHook(() => useApi(fetcher));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns data on success', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [1, 2, 3] });
    const { result } = renderHook(() => useApi(fetcher));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({ items: [1, 2, 3] });
    expect(result.current.error).toBeNull();
  });

  it('returns error on failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useApi(fetcher));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('returns generic error for non-Error rejections', async () => {
    const fetcher = vi.fn().mockRejectedValue('string error');
    const { result } = renderHook(() => useApi(fetcher));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('An error occurred');
  });

  it('refetches data when refetch is called', async () => {
    let callCount = 0;
    const fetcher = vi.fn(() => {
      callCount++;
      return Promise.resolve(`data-${callCount}`);
    });

    const { result } = renderHook(() => useApi(fetcher));

    await waitFor(() => {
      expect(result.current.data).toBe('data-1');
    });

    result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toBe('data-2');
    });
  });

  it('refetches when deps change', async () => {
    const fetcher = vi.fn().mockResolvedValue('result');

    const { result, rerender } = renderHook(
      ({ dep }: { dep: string }) => useApi(() => fetcher(dep), [dep]),
      { initialProps: { dep: 'a' } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ dep: 'b' });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  it('provides a refetch function', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useApi(fetcher));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');
  });
});
