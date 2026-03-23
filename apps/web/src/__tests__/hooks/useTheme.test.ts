import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((_i: number) => null),
  };
})();

let matchMediaMatches = false;
const changeListeners: Array<(e: { matches: boolean }) => void> = [];

const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
  matches: matchMediaMatches,
  media: query,
  onchange: null,
  addEventListener: vi.fn((_event: string, handler: (e: { matches: boolean }) => void) => {
    changeListeners.push(handler);
  }),
  removeEventListener: vi.fn((_event: string, handler: (e: { matches: boolean }) => void) => {
    const idx = changeListeners.indexOf(handler);
    if (idx >= 0) changeListeners.splice(idx, 1);
  }),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
  Object.defineProperty(window, 'matchMedia', { value: matchMediaMock, writable: true });
  localStorageMock.clear();
  matchMediaMatches = false;
  changeListeners.length = 0;
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  vi.resetModules();
});

// We need a fresh import for each test because the hook is a module-level
// export. resetModules + dynamic import gives us a clean slate.
async function importHook() {
  const mod = await import('@/hooks/useTheme');
  return mod.useTheme;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTheme', () => {
  it('defaults to "system" theme', async () => {
    const useTheme = await importHook();
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
  });

  it('setting "dark" adds dark class to documentElement', async () => {
    const useTheme = await importHook();
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setting "light" removes dark class from documentElement', async () => {
    document.documentElement.classList.add('dark');
    const useTheme = await importHook();
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setting "system" respects matchMedia (dark)', async () => {
    matchMediaMatches = true;
    const useTheme = await importHook();
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('system');
    });

    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists theme to localStorage', async () => {
    const useTheme = await importHook();
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('rv-trax-theme', 'dark');
  });

  it('reads stored theme from localStorage on mount', async () => {
    localStorageMock.getItem.mockReturnValueOnce('dark');
    const useTheme = await importHook();
    const { result } = renderHook(() => useTheme());

    // The effect runs asynchronously; wait for it
    await vi.waitFor(() => {
      expect(result.current.theme).toBe('dark');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
