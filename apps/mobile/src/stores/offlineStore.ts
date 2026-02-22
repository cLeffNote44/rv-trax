// ---------------------------------------------------------------------------
// RV Trax Mobile — Offline Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { apiClient } from '../services/api';
import {
  cacheUnits,
  getPendingActions,
  removePendingAction,
} from '../services/offline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OfflineState {
  isOnline: boolean;
  lastSyncAt: string | null;
  pendingActionsCount: number;

  /** Update online/offline flag. */
  setOnline: (online: boolean) => void;
  /** Pull latest units from API and cache locally. */
  syncData: () => Promise<void>;
  /** Replay queued offline actions against the API. */
  processPendingActions: () => Promise<void>;
  /** Refresh the pending action count from the local DB. */
  refreshPendingCount: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: true,
  lastSyncAt: null,
  pendingActionsCount: 0,

  setOnline: (online) => set({ isOnline: online }),

  syncData: async () => {
    try {
      const res = await apiClient.getUnits({ limit: 100 });
      cacheUnits(res.data);
      set({ lastSyncAt: new Date().toISOString() });
    } catch {
      // Sync failed — we are likely offline. Swallow the error.
    }
  },

  processPendingActions: async () => {
    const actions = getPendingActions();

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'status_change': {
            const { unitId, status } = action.payload as {
              unitId: string;
              status: string;
            };
            await apiClient.updateUnitStatus(unitId, status);
            break;
          }
          case 'add_note': {
            const { unitId, content } = action.payload as {
              unitId: string;
              content: string;
            };
            await apiClient.addUnitNote(unitId, content);
            break;
          }
          case 'assign_tracker': {
            const { trackerId, unitId } = action.payload as {
              trackerId: string;
              unitId: string;
            };
            await apiClient.assignTracker(trackerId, unitId);
            break;
          }
        }

        removePendingAction(action.id);
      } catch {
        // If one action fails (e.g., 409 conflict), skip it and continue.
        // It will remain in the queue for manual resolution.
        continue;
      }
    }

    // Update the pending count after processing.
    get().refreshPendingCount();
  },

  refreshPendingCount: () => {
    const count = getPendingActions().length;
    set({ pendingActionsCount: count });
  },
}));
