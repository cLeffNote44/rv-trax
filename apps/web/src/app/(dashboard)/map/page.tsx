'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Download } from 'lucide-react';
import type { Unit, Lot, GeoFence } from '@rv-trax/shared';
import MapControls from './components/MapControls';
import UnitSidePanel from './components/UnitSidePanel';
import MapProviderBadge from './components/MapProviderBadge';

// Dynamically import LotMap to avoid SSR issues with Mapbox/MapLibre GL
const LotMap = dynamic(() => import('./components/LotMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-100">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
        <p className="mt-3 text-sm text-slate-500">Loading map...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [lot, setLot] = useState<Lot | null>(null);
  const [zones, setZones] = useState<GeoFence[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'streets'>('satellite');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{
    status: string[];
    type: string[];
    make: string[];
  }>({ status: [], type: [], make: [] });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const api = await import('@/lib/api');
        const [unitsRes, lotsRes, zonesRes] = await Promise.all([
          api.getUnits({}),
          api.getLots(),
          api.getGeofences(),
        ]);

        if (!cancelled) {
          setUnits(unitsRes.data);
          // getLots returns Lot[] directly
          if (lotsRes.length > 0) {
            setLot(lotsRes[0]!);
          }
          setZones(zonesRes.data);
        }
      } catch {
        // Keep empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const availableMakes = useMemo(() => {
    const makes = new Set(units.map((u) => u.make));
    return Array.from(makes).sort();
  }, [units]);

  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (filters.status.length > 0 && !filters.status.includes(u.status)) return false;
      if (filters.type.length > 0 && !filters.type.includes(u.unit_type)) return false;
      if (filters.make.length > 0 && !filters.make.includes(u.make)) return false;
      return true;
    });
  }, [units, filters]);

  const handleCenterLot = useCallback(() => {
    // The map will re-center to lot when center prop changes
    // This is a simplified approach; a more sophisticated version
    // would use a map ref to fly to the lot
  }, []);

  const handleUnitSelect = useCallback((unitId: string) => {
    setSelectedUnitId(unitId);
  }, []);

  const mapCenter: [number, number] = lot ? [lot.center_lng, lot.center_lat] : [-98.5795, 39.8283];

  return (
    <div className="relative flex h-[calc(100vh-64px)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Lot Map</h1>
          {lot && <p className="text-xs text-slate-500">{lot.name}</p>}
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          Export Map
        </button>
      </div>

      {/* Map container */}
      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center bg-slate-100">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
              <p className="mt-3 text-sm text-slate-500">Loading lot data...</p>
            </div>
          </div>
        ) : (
          <>
            <LotMap
              units={filteredUnits}
              lotBoundary={lot?.boundary}
              zones={zones}
              selectedUnitId={selectedUnitId}
              onUnitSelect={handleUnitSelect}
              mapStyle={mapStyle}
              center={mapCenter}
              zoom={17}
            />

            <MapProviderBadge />

            <MapControls
              unitCount={filteredUnits.length}
              mapStyle={mapStyle}
              onMapStyleChange={setMapStyle}
              onCenterLot={handleCenterLot}
              filters={filters}
              onFiltersChange={setFilters}
              availableMakes={availableMakes}
            />

            {selectedUnitId && (
              <UnitSidePanel unitId={selectedUnitId} onClose={() => setSelectedUnitId(null)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
