'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { getMapProvider, getMapToken, getDefaultStyle, type MapProvider } from '@/lib/map-provider';
import type { Unit, GeoFence } from '@rv-trax/shared';

const STATUS_COLORS: Record<string, string> = {
  new_arrival: '#8b5cf6',
  pdi_pending: '#f97316',
  pdi_in_progress: '#f97316',
  lot_ready: '#06b6d4',
  available: '#10b981',
  hold: '#eab308',
  shown: '#3b82f6',
  deposit: '#6366f1',
  sold: '#ef4444',
  pending_delivery: '#f43f5e',
  delivered: '#64748b',
  in_service: '#f59e0b',
  wholesale: '#78716c',
  archived: '#94a3b8',
};

interface LotMapProps {
  units: Unit[];
  lotBoundary?: [number, number][];
  zones?: GeoFence[];
  selectedUnitId?: string | null;
  onUnitSelect?: (unitId: string) => void;
  mapStyle?: 'satellite' | 'streets';
  center?: [number, number];
  zoom?: number;
}

export default function LotMap({
  units,
  lotBoundary,
  zones,
  selectedUnitId,
  onUnitSelect,
  mapStyle = 'satellite',
  center = [-98.5795, 39.8283],
  zoom = 16,
}: LotMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const onUnitSelectRef = useRef(onUnitSelect);
  onUnitSelectRef.current = onUnitSelect;

  const [provider] = useState<MapProvider>(getMapProvider);

  const getStyleUrl = useCallback(
    (style: string) => {
      return getDefaultStyle(provider, style === 'satellite' ? 'satellite' : 'streets');
    },
    [provider],
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let map: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    let cancelled = false;

    async function initMap() {
      if (cancelled || !mapContainerRef.current) return;

      if (provider === 'mapbox') {
        const mapboxgl = (await import('mapbox-gl')).default;
        await import('mapbox-gl/dist/mapbox-gl.css');

        mapboxgl.accessToken = getMapToken() ?? '';

        map = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: getStyleUrl(mapStyle),
          center: center,
          zoom: zoom,
          attributionControl: false,
        });

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
      } else {
        const maplibregl = (await import('maplibre-gl')).default;
        await import('maplibre-gl/dist/maplibre-gl.css');

        map = new maplibregl.Map({
          container: mapContainerRef.current!,
          style: getStyleUrl(mapStyle),
          center: center,
          zoom: zoom,
          attributionControl: false,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(new maplibregl.FullscreenControl(), 'top-right');
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      }

      if (cancelled) {
        map.remove();
        return;
      }

      map.on('load', () => {
        // Unit markers source
        map.addSource('units', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
          id: 'units-circle',
          type: 'circle',
          source: 'units',
          paint: {
            'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], 10, 7],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9,
          },
        });

        map.addLayer({
          id: 'units-label',
          type: 'symbol',
          source: 'units',
          layout: {
            'text-field': ['get', 'stock_number'],
            'text-size': 10,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-optional': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1,
          },
        });

        // Lot boundary source
        map.addSource('lot-boundary', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer(
          {
            id: 'lot-boundary-fill',
            type: 'fill',
            source: 'lot-boundary',
            paint: {
              'fill-color': '#3b82f6',
              'fill-opacity': 0.08,
            },
          },
          'units-circle',
        );

        map.addLayer(
          {
            id: 'lot-boundary-line',
            type: 'line',
            source: 'lot-boundary',
            paint: {
              'line-color': '#3b82f6',
              'line-width': 2,
              'line-dasharray': [2, 2],
            },
          },
          'units-circle',
        );

        // Zones source
        map.addSource('zones', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer(
          {
            id: 'zones-fill',
            type: 'fill',
            source: 'zones',
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': 0.15,
            },
          },
          'units-circle',
        );

        map.addLayer(
          {
            id: 'zones-line',
            type: 'line',
            source: 'zones',
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 1.5,
            },
          },
          'units-circle',
        );

        map.addLayer({
          id: 'zones-label',
          type: 'symbol',
          source: 'zones',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 12,
            ...(provider === 'mapbox' ? { 'text-font': ['Open Sans Bold'] } : {}),
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
          },
        });
      });

      // Click handler for unit markers
      map.on('click', 'units-circle', (e: any) => {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const unitId = feature?.properties?.id;
          if (unitId && onUnitSelectRef.current) {
            onUnitSelectRef.current(unitId);
          }
        }
      });

      map.on('mouseenter', 'units-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'units-circle', () => {
        map.getCanvas().style.cursor = '';
      });

      mapRef.current = map;
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Only initialize once
  }, []);

  // Update map style
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(getStyleUrl(mapStyle));
  }, [mapStyle, getStyleUrl]);

  // Update unit markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function updateUnits() {
      const source = map!.getSource('units');
      if (!source) return;

      const features = units
        .filter((u) => u.current_lat != null && u.current_lng != null)
        .map((u) => ({
          type: 'Feature' as const,
          id: u.id,
          geometry: {
            type: 'Point' as const,
            coordinates: [u.current_lng!, u.current_lat!],
          },
          properties: {
            id: u.id,
            stock_number: u.stock_number,
            status: u.status,
            color: STATUS_COLORS[u.status] ?? '#94a3b8',
            make: u.make,
            model: u.model,
            year: u.year,
          },
        }));

      source.setData({ type: 'FeatureCollection', features });
    }

    if (map.isStyleLoaded()) {
      updateUnits();
    } else {
      map.on('style.load', updateUnits);
    }
  }, [units]);

  // Update lot boundary
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !lotBoundary || lotBoundary.length < 3) return;

    function updateBoundary() {
      const source = map!.getSource('lot-boundary');
      if (!source) return;

      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              // Close the polygon ring
              coordinates: [[...lotBoundary!, lotBoundary![0]!].map(([lat, lng]) => [lng, lat])],
            },
          },
        ],
      });
    }

    if (map.isStyleLoaded()) {
      updateBoundary();
    } else {
      map.on('style.load', updateBoundary);
    }
  }, [lotBoundary]);

  // Update zones
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zones || zones.length === 0) return;

    function updateZones() {
      const source = map!.getSource('zones');
      if (!source) return;

      const features = zones!
        .filter((z) => z.boundary && z.boundary.length >= 3)
        .map((z) => ({
          type: 'Feature' as const,
          properties: {
            name: z.name,
            color: z.color ?? '#6366f1',
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[...z.boundary, z.boundary[0]!].map(([lat, lng]) => [lng, lat])],
          },
        }));

      source.setData({ type: 'FeatureCollection', features });
    }

    if (map.isStyleLoaded()) {
      updateZones();
    } else {
      map.on('style.load', updateZones);
    }
  }, [zones]);

  // Highlight selected unit
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Reset all feature states then set selected
    function updateSelection() {
      map!.removeFeatureState({ source: 'units' });
      if (selectedUnitId) {
        map!.setFeatureState({ source: 'units', id: selectedUnitId }, { selected: true });
      }
    }

    if (map.isStyleLoaded()) {
      updateSelection();
    }
  }, [selectedUnitId]);

  return <div ref={mapContainerRef} className="h-full w-full" />;
}
