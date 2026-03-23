'use client';

import { getMapProvider } from '@/lib/map-provider';

/**
 * Small badge overlay indicating which map provider is active.
 * Helps self-hosters confirm they are using the free MapLibre provider
 * when no Mapbox token is configured.
 */
export default function MapProviderBadge() {
  const provider = getMapProvider();

  if (provider === 'mapbox') {
    return (
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-blue-600/90 px-2.5 py-1 text-[10px] font-medium text-white shadow-sm backdrop-blur-sm">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-300" />
        Mapbox GL
      </div>
    );
  }

  return (
    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-emerald-600/90 px-2.5 py-1 text-[10px] font-medium text-white shadow-sm backdrop-blur-sm">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
      MapLibre GL
      <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] leading-none">
        Open Source
      </span>
    </div>
  );
}
