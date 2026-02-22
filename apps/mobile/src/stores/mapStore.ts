// ---------------------------------------------------------------------------
// RV Trax Mobile — Map Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapZone {
  id: string;
  name: string;
  color: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
}

export interface MapFilters {
  statuses: string[];
  types: string[];
  makes: string[];
}

export interface MapState {
  region: MapRegion;
  mapType: 'satellite' | 'standard';
  showBoundary: boolean;
  showZones: boolean;
  lotBoundary: Array<{ latitude: number; longitude: number }>;
  zones: MapZone[];
  filters: MapFilters;

  /** Update the visible map region. */
  setRegion: (region: MapRegion) => void;
  /** Toggle between satellite and standard map types. */
  toggleMapType: () => void;
  /** Toggle lot boundary visibility. */
  toggleBoundary: () => void;
  /** Toggle zone overlay visibility. */
  toggleZones: () => void;
  /** Set the lot boundary polygon coordinates. */
  setLotBoundary: (coords: Array<{ latitude: number; longitude: number }>) => void;
  /** Set the zone overlays. */
  setZones: (zones: MapZone[]) => void;
  /** Animate the map to centre on a specific coordinate. */
  centerOnUnit: (lat: number, lng: number) => void;
  /** Set map filters. */
  setFilters: (filters: MapFilters) => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_REGION: MapRegion = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMapStore = create<MapState>((set) => ({
  region: DEFAULT_REGION,
  mapType: 'satellite',
  showBoundary: true,
  showZones: true,
  lotBoundary: [],
  zones: [],
  filters: { statuses: [], types: [], makes: [] },

  setRegion: (region) => set({ region }),

  toggleMapType: () =>
    set((state) => ({
      mapType: state.mapType === 'satellite' ? 'standard' : 'satellite',
    })),

  toggleBoundary: () =>
    set((state) => ({ showBoundary: !state.showBoundary })),

  toggleZones: () =>
    set((state) => ({ showZones: !state.showZones })),

  setLotBoundary: (coords) => set({ lotBoundary: coords }),

  setZones: (zones) => set({ zones }),

  centerOnUnit: (lat, lng) =>
    set((state) => ({
      region: {
        ...state.region,
        latitude: lat,
        longitude: lng,
      },
    })),

  setFilters: (filters) => set({ filters }),
}));
