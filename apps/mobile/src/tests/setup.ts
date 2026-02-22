// ---------------------------------------------------------------------------
// Mobile test setup — mock native modules not available in Jest
// ---------------------------------------------------------------------------

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  const store = new Map<string, unknown>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
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
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
  Swipeable: jest.fn(),
  DrawerLayout: jest.fn(),
  State: {},
  PanGestureHandler: jest.fn(),
  TapGestureHandler: jest.fn(),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  useSharedValue: jest.fn((v) => ({ value: v })),
  useAnimatedStyle: jest.fn(() => ({})),
  withTiming: jest.fn((v) => v),
  default: { createAnimatedComponent: jest.fn((c: unknown) => c) },
}));

export {};
