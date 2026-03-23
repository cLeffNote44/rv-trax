'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

/**
 * Hook that subscribes to real-time WebSocket events and triggers
 * dashboard data refreshes when relevant events occur.
 *
 * Events that trigger refresh:
 * - unit:moved — unit position changed
 * - unit:status_changed — inventory status updated
 * - tracker:update — tracker telemetry received
 * - alert:new — new alert created
 * - alert:count — unread count changed
 *
 * Uses a debounce to batch rapid events (e.g., multiple units moving).
 */

interface LiveDashboardOptions {
  /** Callback to refresh dashboard data */
  onRefresh: () => void;
  /** Debounce interval in ms (default: 5000) */
  debounceMs?: number;
  /** Enable/disable live updates (default: true) */
  enabled?: boolean;
}

interface LiveStats {
  eventsReceived: number;
  lastEventAt: string | null;
  isConnected: boolean;
}

export function useLiveDashboard({
  onRefresh,
  debounceMs = 5000,
  enabled = true,
}: LiveDashboardOptions): LiveStats {
  const [stats, setStats] = useState<LiveStats>({
    eventsReceived: 0,
    lastEventAt: null,
    isConnected: false,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) return; // already scheduled
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      onRefreshRef.current();
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    if (!enabled) return;

    let cleanup: (() => void) | undefined;

    // Listen for custom events dispatched by the WebSocket system
    // The WebSocketProvider broadcasts events on the window object
    function handleWsEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail?.type) return;

      const eventType = detail.type as string;
      const relevantEvents = [
        'unit:moved',
        'unit:status_changed',
        'tracker:update',
        'alert:new',
        'alert:count',
        'gateway:status',
      ];

      if (relevantEvents.includes(eventType)) {
        setStats((prev) => ({
          ...prev,
          eventsReceived: prev.eventsReceived + 1,
          lastEventAt: new Date().toISOString(),
        }));
        scheduleRefresh();
      }
    }

    window.addEventListener('rv-trax:ws-event', handleWsEvent);

    // Also set up a periodic refresh as fallback (every 60s)
    const periodicRefresh = setInterval(() => {
      onRefreshRef.current();
    }, 60_000);

    cleanup = () => {
      window.removeEventListener('rv-trax:ws-event', handleWsEvent);
      clearInterval(periodicRefresh);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };

    return cleanup;
  }, [enabled, scheduleRefresh]);

  return stats;
}
