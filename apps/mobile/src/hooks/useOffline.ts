// ---------------------------------------------------------------------------
// RV Trax Mobile — useOffline Hook (NetInfo connectivity monitor)
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useOfflineStore } from '../stores/offlineStore';

export interface UseOfflineReturn {
  isOnline: boolean;
  lastSyncAt: string | null;
  pendingActionsCount: number;
}

/**
 * Monitors network connectivity via NetInfo.
 * - Updates `offlineStore.isOnline` on every change.
 * - When connectivity is restored, triggers data sync and pending action replay.
 */
export function useOffline(): UseOfflineReturn {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const lastSyncAt = useOfflineStore((s) => s.lastSyncAt);
  const pendingActionsCount = useOfflineStore((s) => s.pendingActionsCount);
  const setOnline = useOfflineStore((s) => s.setOnline);
  const syncData = useOfflineStore((s) => s.syncData);
  const processPendingActions = useOfflineStore((s) => s.processPendingActions);
  const refreshPendingCount = useOfflineStore((s) => s.refreshPendingCount);

  const wasOfflineRef = useRef(false);

  useEffect(() => {
    // Initial count
    refreshPendingCount();

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected ?? false;
      setOnline(connected);

      if (connected && wasOfflineRef.current) {
        // We just came back online — sync.
        void syncData();
        void processPendingActions();
      }

      wasOfflineRef.current = !connected;
    });

    return () => {
      unsubscribe();
    };
  }, [setOnline, syncData, processPendingActions, refreshPendingCount]);

  return { isOnline, lastSyncAt, pendingActionsCount };
}
