// ---------------------------------------------------------------------------
// RV Trax Mobile — Settings Store (Zustand + MMKV persistence)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

// ---------------------------------------------------------------------------
// MMKV instance for user settings
// ---------------------------------------------------------------------------

const storage = new MMKV({ id: 'rv-trax-settings' });

const KEYS = {
  notifications: 'settings.notificationsEnabled',
  darkMode: 'settings.darkMode',
  mapSatellite: 'settings.mapTypeSatellite',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsState {
  notificationsEnabled: boolean;
  darkMode: boolean;
  mapTypeSatellite: boolean;

  setNotificationsEnabled: (enabled: boolean) => void;
  setDarkMode: (enabled: boolean) => void;
  setMapTypeSatellite: (enabled: boolean) => void;
}

// ---------------------------------------------------------------------------
// Store (hydrated synchronously from MMKV at creation time)
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsState>((set) => ({
  notificationsEnabled: storage.getBoolean(KEYS.notifications) ?? true,
  darkMode: storage.getBoolean(KEYS.darkMode) ?? false,
  mapTypeSatellite: storage.getBoolean(KEYS.mapSatellite) ?? false,

  setNotificationsEnabled: (enabled) => {
    storage.set(KEYS.notifications, enabled);
    set({ notificationsEnabled: enabled });
  },

  setDarkMode: (enabled) => {
    storage.set(KEYS.darkMode, enabled);
    set({ darkMode: enabled });
  },

  setMapTypeSatellite: (enabled) => {
    storage.set(KEYS.mapSatellite, enabled);
    set({ mapTypeSatellite: enabled });
  },
}));
