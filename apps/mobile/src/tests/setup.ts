// ---------------------------------------------------------------------------
// Mobile test setup — mock native modules not available in Vitest
// ---------------------------------------------------------------------------

import { vi } from 'vitest';

// Mock react-native-mmkv
vi.mock('react-native-mmkv', () => {
  const store = new Map<string, unknown>();
  return {
    MMKV: vi.fn().mockImplementation(() => ({
      getString: (key: string) => {
        const v = store.get(key);
        return typeof v === 'string' ? v : undefined;
      },
      getBoolean: (key: string) => {
        const v = store.get(key);
        return typeof v === 'boolean' ? v : undefined;
      },
      getNumber: (key: string) => {
        const v = store.get(key);
        return typeof v === 'number' ? v : undefined;
      },
      set: (key: string, value: unknown) => store.set(key, value),
      delete: (key: string) => store.delete(key),
      contains: (key: string) => store.has(key),
      clearAll: () => store.clear(),
      getAllKeys: () => Array.from(store.keys()),
    })),
    __store: store,
  };
});

// Mock react-native-gesture-handler
vi.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
  Swipeable: vi.fn(),
  DrawerLayout: vi.fn(),
  State: {},
  PanGestureHandler: vi.fn(),
  TapGestureHandler: vi.fn(),
}));

// Mock react-native-reanimated
vi.mock('react-native-reanimated', () => ({
  useSharedValue: vi.fn((v: unknown) => ({ value: v })),
  useAnimatedStyle: vi.fn(() => ({})),
  withTiming: vi.fn((v: unknown) => v),
  default: { createAnimatedComponent: vi.fn((c: unknown) => c) },
}));

export {};
