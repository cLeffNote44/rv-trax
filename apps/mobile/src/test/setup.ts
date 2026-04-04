// ---------------------------------------------------------------------------
// @rv-trax/mobile — Vitest test setup
// ---------------------------------------------------------------------------

import { vi } from 'vitest';

// Mock React Native modules that aren't available in Node
vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: vi.fn((obj: Record<string, unknown>) => obj['ios']) },
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
  Alert: { alert: vi.fn() },
  Linking: { openURL: vi.fn() },
  AppState: { currentState: 'active', addEventListener: vi.fn() },
}));

vi.mock('react-native-mmkv', () => ({
  MMKV: vi.fn().mockImplementation(() => ({
    getString: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    contains: vi.fn(() => false),
    getAllKeys: vi.fn(() => []),
  })),
}));

vi.mock('@react-native-community/netinfo', () => ({
  addEventListener: vi.fn(() => vi.fn()),
  fetch: vi.fn(() => Promise.resolve({ isConnected: true, type: 'wifi' })),
}));

vi.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  default: () => ({
    getToken: vi.fn(() => Promise.resolve('mock-fcm-token')),
    onMessage: vi.fn(() => vi.fn()),
    requestPermission: vi.fn(() => Promise.resolve(1)),
  }),
}));
