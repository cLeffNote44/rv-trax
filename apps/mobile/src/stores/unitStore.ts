// ---------------------------------------------------------------------------
// RV Trax Mobile — Unit Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unit, UnitStatus, UnitType, PaginatedResponse } from '@rv-trax/shared';
import { apiClient, type UnitListParams } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnitFilters {
  status?: UnitStatus[];
  unitType?: UnitType[];
  make?: string[];
  search?: string;
}

export interface UnitState {
  units: Unit[];
  selectedUnit: Unit | null;
  isLoading: boolean;
  filters: UnitFilters;
  totalCount: number;
  cursor: string | null;

  /** Fetch (or re-fetch) the first page of units with current filters. */
  fetchUnits: () => Promise<void>;
  /** Load the next page of units (cursor-based). */
  fetchNextPage: () => Promise<void>;
  /** Full-text search against the API. */
  searchUnits: (query: string) => Promise<Unit[]>;
  /** Set the currently selected unit for detail view. */
  setSelectedUnit: (unit: Unit | null) => void;
  /** Update a unit's status via the API and refresh local state. */
  updateUnitStatus: (unitId: string, status: UnitStatus) => Promise<void>;
  /** Merge new filter values (partial). */
  setFilters: (filters: Partial<UnitFilters>) => void;
  /** In-memory location update from WebSocket. */
  updateUnitLocation: (
    unitId: string,
    lat: number,
    lng: number,
    zone: string,
    row: string,
    spot: number,
  ) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildParams(filters: UnitFilters, cursor?: string | null): UnitListParams {
  const params: UnitListParams = {};
  if (filters.status?.length) params.status = filters.status;
  if (filters.unitType?.length) params.unit_type = filters.unitType;
  if (filters.make?.length) params.make = filters.make;
  if (filters.search) params.search = filters.search;
  if (cursor) params.cursor = cursor;
  return params;
}

function applyLocationUpdate(
  units: Unit[],
  unitId: string,
  lat: number,
  lng: number,
  zone: string,
  row: string,
  spot: number,
): Unit[] {
  return units.map((u) =>
    u.id === unitId
      ? {
          ...u,
          current_lat: lat,
          current_lng: lng,
          current_zone: zone,
          current_row: row,
          current_spot: String(spot),
          last_moved_at: new Date().toISOString(),
        }
      : u,
  );
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUnitStore = create<UnitState>((set, get) => ({
  units: [],
  selectedUnit: null,
  isLoading: false,
  filters: {},
  totalCount: 0,
  cursor: null,

  fetchUnits: async () => {
    set({ isLoading: true });
    try {
      const params = buildParams(get().filters);
      const res: PaginatedResponse<Unit> = await apiClient.getUnits(params);
      set({
        units: res.data,
        totalCount: res.pagination.total_count,
        cursor: res.pagination.next_cursor,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchNextPage: async () => {
    const { cursor, filters, units } = get();
    if (!cursor) return;

    set({ isLoading: true });
    try {
      const params = buildParams(filters, cursor);
      const res: PaginatedResponse<Unit> = await apiClient.getUnits(params);
      set({
        units: [...units, ...res.data],
        totalCount: res.pagination.total_count,
        cursor: res.pagination.next_cursor,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  searchUnits: async (query) => {
    const results = await apiClient.searchUnits(query);
    return results;
  },

  setSelectedUnit: (unit) => set({ selectedUnit: unit }),

  updateUnitStatus: async (unitId, status) => {
    const updated = await apiClient.updateUnitStatus(unitId, status);
    set((state) => ({
      units: state.units.map((u) => (u.id === unitId ? updated : u)),
      selectedUnit:
        state.selectedUnit?.id === unitId ? updated : state.selectedUnit,
    }));
  },

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  updateUnitLocation: (unitId, lat, lng, zone, row, spot) =>
    set((state) => {
      const units = applyLocationUpdate(state.units, unitId, lat, lng, zone, row, spot);
      const selectedUnit =
        state.selectedUnit?.id === unitId
          ? {
              ...state.selectedUnit,
              current_lat: lat,
              current_lng: lng,
              current_zone: zone,
              current_row: row,
              current_spot: String(spot),
              last_moved_at: new Date().toISOString(),
            }
          : state.selectedUnit;
      return { units, selectedUnit };
    }),
}));
