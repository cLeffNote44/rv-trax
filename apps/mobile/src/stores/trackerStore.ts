// ---------------------------------------------------------------------------
// RV Trax Mobile — Tracker Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Tracker, TrackerStatus, Unit } from '@rv-trax/shared';
import { apiClient } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanResult {
  deviceEui: string;
  status: TrackerStatus;
  assignedUnit?: Unit;
}

export interface TrackerState {
  trackers: Tracker[];
  scanResult: ScanResult | null;
  isScanning: boolean;
  isLoading: boolean;

  /** Fetch all trackers for the current dealership. */
  fetchTrackers: () => Promise<void>;
  /** Assign a tracker to a unit via the API. */
  assignTracker: (trackerId: string, unitId: string) => Promise<void>;
  /** Unassign a tracker from its current unit. */
  unassignTracker: (trackerId: string) => Promise<void>;
  /** Store the result of a BLE/NFC scan. */
  setScanResult: (result: ScanResult) => void;
  /** Clear scan result (e.g., after assignment or dismiss). */
  clearScanResult: () => void;
  /** Update scanning state. */
  setScanning: (scanning: boolean) => void;
  /** Update a single tracker's status in memory (from WebSocket). */
  updateTrackerStatus: (trackerId: string, status: TrackerStatus, batteryPct: number) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTrackerStore = create<TrackerState>((set, get) => ({
  trackers: [],
  scanResult: null,
  isScanning: false,
  isLoading: false,

  fetchTrackers: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.getTrackers();
      set({ trackers: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  assignTracker: async (trackerId, unitId) => {
    await apiClient.assignTracker(trackerId, unitId);
    // Refresh trackers list so the local state is up-to-date.
    await get().fetchTrackers();
  },

  unassignTracker: async (trackerId) => {
    await apiClient.unassignTracker(trackerId);
    await get().fetchTrackers();
  },

  setScanResult: (result) => set({ scanResult: result }),

  clearScanResult: () => set({ scanResult: null }),

  setScanning: (scanning) => set({ isScanning: scanning }),

  updateTrackerStatus: (trackerId, status, batteryPct) =>
    set((state) => ({
      trackers: state.trackers.map((t) =>
        t.id === trackerId
          ? { ...t, status, battery_pct: batteryPct }
          : t,
      ),
    })),
}));
