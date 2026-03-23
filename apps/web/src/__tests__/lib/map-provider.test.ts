import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// We dynamically import the module so we can swap env vars between tests.
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules();
});

function withEnv(token: string | undefined) {
  if (token !== undefined) {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', token);
  } else {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  }
}

async function importModule() {
  return import('@/lib/map-provider');
}

// ---------------------------------------------------------------------------
// getMapProvider
// ---------------------------------------------------------------------------

describe('getMapProvider', () => {
  it('returns "mapbox" when NEXT_PUBLIC_MAPBOX_TOKEN is set', async () => {
    withEnv('pk.testtoken123');
    const { getMapProvider } = await importModule();
    expect(getMapProvider()).toBe('mapbox');
  });

  it('returns "maplibre" when token is empty string', async () => {
    withEnv('');
    const { getMapProvider } = await importModule();
    expect(getMapProvider()).toBe('maplibre');
  });

  it('returns "maplibre" when token is undefined', async () => {
    withEnv(undefined);
    const { getMapProvider } = await importModule();
    expect(getMapProvider()).toBe('maplibre');
  });
});

// ---------------------------------------------------------------------------
// getDefaultStyle
// ---------------------------------------------------------------------------

describe('getDefaultStyle', () => {
  it('returns mapbox dark style for mapbox + streets', async () => {
    const { getDefaultStyle } = await importModule();
    expect(getDefaultStyle('mapbox', 'streets')).toBe('mapbox://styles/mapbox/dark-v11');
  });

  it('returns mapbox satellite style for mapbox + satellite', async () => {
    const { getDefaultStyle } = await importModule();
    expect(getDefaultStyle('mapbox', 'satellite')).toBe(
      'mapbox://styles/mapbox/satellite-streets-v12',
    );
  });

  it('returns CARTO dark-matter style for maplibre + streets', async () => {
    const { getDefaultStyle } = await importModule();
    expect(getDefaultStyle('maplibre', 'streets')).toBe(
      'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    );
  });

  it('returns CARTO voyager style for maplibre + satellite', async () => {
    const { getDefaultStyle } = await importModule();
    expect(getDefaultStyle('maplibre', 'satellite')).toBe(
      'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    );
  });

  it('defaults variant to streets when not specified', async () => {
    const { getDefaultStyle } = await importModule();
    expect(getDefaultStyle('mapbox')).toBe('mapbox://styles/mapbox/dark-v11');
    expect(getDefaultStyle('maplibre')).toBe(
      'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    );
  });
});

// ---------------------------------------------------------------------------
// getMapToken
// ---------------------------------------------------------------------------

describe('getMapToken', () => {
  it('returns the token when set', async () => {
    withEnv('pk.abc123');
    const { getMapToken } = await importModule();
    expect(getMapToken()).toBe('pk.abc123');
  });

  it('returns undefined when token is not set', async () => {
    withEnv(undefined);
    const { getMapToken } = await importModule();
    expect(getMapToken()).toBeUndefined();
  });
});
