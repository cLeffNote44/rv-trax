/**
 * Map provider abstraction.
 *
 * Uses Mapbox GL if NEXT_PUBLIC_MAPBOX_TOKEN is set.
 * Falls back to MapLibre GL (open-source, no API key) otherwise.
 *
 * MapLibre GL JS is a fork of Mapbox GL JS v1 with a compatible API,
 * so most code works with both libraries unchanged.
 */

export type MapProvider = 'mapbox' | 'maplibre';

export function getMapProvider(): MapProvider {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  return token && token.length > 0 ? 'mapbox' : 'maplibre';
}

export function getMapToken(): string | undefined {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;
}

/**
 * Default style URLs for each provider.
 * MapLibre uses free CARTO OpenStreetMap-based tiles.
 */
export function getDefaultStyle(
  provider: MapProvider,
  variant: 'streets' | 'satellite' = 'streets',
): string {
  if (provider === 'mapbox') {
    return variant === 'satellite'
      ? 'mapbox://styles/mapbox/satellite-streets-v12'
      : 'mapbox://styles/mapbox/dark-v11';
  }

  // MapLibre free tile styles (CARTO)
  return variant === 'satellite'
    ? 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
}
