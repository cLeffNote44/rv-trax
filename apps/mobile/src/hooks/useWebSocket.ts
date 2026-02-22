// ---------------------------------------------------------------------------
// RV Trax Mobile — useWebSocket Hook
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useUnitStore } from '../stores/useUnitStore';
import { useTrackerStore } from '../stores/useTrackerStore';
import {
  wsManager,
  type LocationUpdate,
  type UnitStatusChange,
  type TrackerStatusEvent,
  type AlertEvent,
} from '../services/websocket';
import type { TrackerStatus } from '@rv-trax/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseWebSocketReturn {
  isConnected: boolean;
  reconnect: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the WebSocket lifecycle:
 * - Connects when the user is authenticated.
 * - Disconnects when the component unmounts or the user logs out.
 * - Routes incoming events to the relevant Zustand stores.
 */
export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const updateUnitLocation = useUnitStore((s) => s.updateUnitLocation);
  const updateTrackerStatus = useTrackerStore((s) => s.updateTrackerStatus);

  // Store callbacks in refs so the effect does not re-run on every render.
  const updateLocationRef = useRef(updateUnitLocation);
  updateLocationRef.current = updateUnitLocation;

  const updateTrackerRef = useRef(updateTrackerStatus);
  updateTrackerRef.current = updateTrackerStatus;

  // ── Connect / Disconnect ────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !token) {
      wsManager.disconnect();
      setIsConnected(false);
      return;
    }

    wsManager.connect(token);

    // Register event handlers
    const unsubConnection = wsManager.onConnectionChange((connected) => {
      setIsConnected(connected);
    });

    const unsubLocation = wsManager.onLocationUpdate((data: LocationUpdate) => {
      updateLocationRef.current(
        data.unit_id,
        data.lat,
        data.lng,
        data.zone,
        data.row,
        data.spot,
      );
    });

    const unsubStatus = wsManager.onUnitStatusChange((_data: UnitStatusChange) => {
      // The unit store will be refreshed — for now we rely on the next fetch
      // or a dedicated store action if full real-time status sync is needed.
    });

    const unsubTracker = wsManager.onTrackerStatus((data: TrackerStatusEvent) => {
      updateTrackerRef.current(
        data.tracker_id,
        data.status as TrackerStatus,
        data.battery_pct,
      );
    });

    const unsubAlert = wsManager.onAlert((_data: AlertEvent) => {
      // Alerts can be handled here or forwarded to a dedicated alert store.
    });

    return () => {
      unsubConnection();
      unsubLocation();
      unsubStatus();
      unsubTracker();
      unsubAlert();
      wsManager.disconnect();
    };
  }, [isAuthenticated, token]);

  // ── Manual reconnect ────────────────────────────────────────────────────
  const reconnect = useCallback(() => {
    if (token) {
      wsManager.disconnect();
      wsManager.connect(token);
    }
  }, [token]);

  return { isConnected, reconnect };
}
