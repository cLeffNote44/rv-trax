import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock NetInfo — capture the listener so tests can drive network changes
// ---------------------------------------------------------------------------

type NetInfoListener = (state: { isConnected: boolean | null }) => void;

let capturedListener: NetInfoListener | null = null;

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: vi.fn((cb: NetInfoListener) => {
      capturedListener = cb;
      // Return an unsubscribe function
      return vi.fn(() => { capturedListener = null; });
    }),
  },
}));

// ---------------------------------------------------------------------------
// Mock the offline store — give tests direct control over store state
// ---------------------------------------------------------------------------

const mockSetOnline = vi.fn();
const mockSyncData = vi.fn(() => Promise.resolve());
const mockProcessPendingActions = vi.fn(() => Promise.resolve());
const mockRefreshPendingCount = vi.fn();

// State that the store selector reads
let storeState = {
  isOnline: true,
  lastSyncAt: null as string | null,
  pendingActionsCount: 0,
};

vi.mock('../../stores/offlineStore', () => ({
  useOfflineStore: vi.fn((selector: (s: typeof storeState & {
    setOnline: typeof mockSetOnline;
    syncData: typeof mockSyncData;
    processPendingActions: typeof mockProcessPendingActions;
    refreshPendingCount: typeof mockRefreshPendingCount;
  }) => unknown) =>
    selector({
      ...storeState,
      setOnline: mockSetOnline,
      syncData: mockSyncData,
      processPendingActions: mockProcessPendingActions,
      refreshPendingCount: mockRefreshPendingCount,
    }),
  ),
}));

import { useOffline } from '../useOffline';

beforeEach(() => {
  capturedListener = null;
  storeState = { isOnline: true, lastSyncAt: null, pendingActionsCount: 0 };
  mockSetOnline.mockReset();
  mockSyncData.mockReset().mockResolvedValue(undefined);
  mockProcessPendingActions.mockReset().mockResolvedValue(undefined);
  mockRefreshPendingCount.mockReset();
});

describe('useOffline', () => {
  it('returns the current online status from the store', () => {
    storeState.isOnline = true;
    const { result } = renderHook(() => useOffline());
    expect(result.current.isOnline).toBe(true);
  });

  it('returns lastSyncAt and pendingActionsCount from the store', () => {
    storeState.lastSyncAt = '2026-04-03T12:00:00Z';
    storeState.pendingActionsCount = 3;

    const { result } = renderHook(() => useOffline());

    expect(result.current.lastSyncAt).toBe('2026-04-03T12:00:00Z');
    expect(result.current.pendingActionsCount).toBe(3);
  });

  it('calls refreshPendingCount on mount', () => {
    renderHook(() => useOffline());
    expect(mockRefreshPendingCount).toHaveBeenCalledTimes(1);
  });

  it('registers a NetInfo listener on mount', () => {
    renderHook(() => useOffline());
    expect(capturedListener).toBeTypeOf('function');
  });

  it('calls setOnline when network state changes', () => {
    renderHook(() => useOffline());

    act(() => {
      capturedListener?.({ isConnected: false });
    });

    expect(mockSetOnline).toHaveBeenCalledWith(false);
  });

  it('treats null isConnected as false', () => {
    renderHook(() => useOffline());

    act(() => {
      capturedListener?.({ isConnected: null });
    });

    expect(mockSetOnline).toHaveBeenCalledWith(false);
  });

  it('triggers syncData and processPendingActions when coming back online after being offline', async () => {
    renderHook(() => useOffline());

    // First go offline
    act(() => {
      capturedListener?.({ isConnected: false });
    });

    // Then come back online
    await act(async () => {
      capturedListener?.({ isConnected: true });
    });

    expect(mockSyncData).toHaveBeenCalledTimes(1);
    expect(mockProcessPendingActions).toHaveBeenCalledTimes(1);
  });

  it('does not trigger sync when already online and receiving another online event', async () => {
    renderHook(() => useOffline());

    // Never went offline — wasOffline starts false
    await act(async () => {
      capturedListener?.({ isConnected: true });
    });

    expect(mockSyncData).not.toHaveBeenCalled();
    expect(mockProcessPendingActions).not.toHaveBeenCalled();
  });

  it('unsubscribes from NetInfo on unmount', () => {
    const { unmount } = renderHook(() => useOffline());

    expect(capturedListener).toBeTypeOf('function');

    unmount();

    // The cleanup returned by addEventListener should have been called,
    // which sets capturedListener to null in our mock
    expect(capturedListener).toBeNull();
  });
});
