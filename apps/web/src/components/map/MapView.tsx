'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { getMapProvider, getMapToken, getDefaultStyle } from '@/lib/map-provider';
import type { MapProvider } from '@/lib/map-provider';

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  style?: 'streets' | 'satellite';
  className?: string;
  onLoad?: (map: unknown) => void;
  children?: React.ReactNode;
}

/**
 * Unified map component that renders either Mapbox GL or MapLibre GL
 * depending on whether a Mapbox token is configured.
 *
 * Both libraries share a nearly identical API, so this component
 * works transparently with either one.
 */
export default function MapView({
  center = [-98.5795, 39.8283],
  zoom = 14,
  style = 'streets',
  className = 'h-full w-full',
  onLoad,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [provider] = useState<MapProvider>(getMapProvider);

  const initMap = useCallback(async () => {
    if (!containerRef.current) return;

    if (provider === 'mapbox') {
      const mapboxgl = (await import('mapbox-gl')).default;
      await import('mapbox-gl/dist/mapbox-gl.css');

      mapboxgl.accessToken = getMapToken() ?? '';

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: getDefaultStyle('mapbox', style),
        center,
        zoom,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

      mapRef.current = map;
      map.on('load', () => onLoad?.(map));
    } else {
      const maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: getDefaultStyle('maplibre', style),
        center,
        zoom,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      mapRef.current = map;
      map.on('load', () => onLoad?.(map));
    }
  }, [provider, center, zoom, style, onLoad]);

  useEffect(() => {
    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} className={className} />;
}
