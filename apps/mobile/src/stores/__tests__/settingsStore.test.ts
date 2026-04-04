import { describe, it, expect, beforeEach } from 'vitest';
import { MMKV } from 'react-native-mmkv';
import { useSettingsStore } from '../settingsStore';

beforeEach(() => {
  // Clear MMKV and reset store
  const storage = new MMKV({ id: 'rv-trax-settings' });
  (storage as any).clearAll?.();

  useSettingsStore.setState({
    notificationsEnabled: true,
    darkMode: false,
    mapTypeSatellite: false,
  });
});

describe('settingsStore', () => {
  it('starts with default values', () => {
    const state = useSettingsStore.getState();
    expect(state.notificationsEnabled).toBe(true);
    expect(state.darkMode).toBe(false);
    expect(state.mapTypeSatellite).toBe(false);
  });

  it('sets notificationsEnabled and persists to MMKV', () => {
    useSettingsStore.getState().setNotificationsEnabled(false);

    expect(useSettingsStore.getState().notificationsEnabled).toBe(false);

    const storage = new MMKV({ id: 'rv-trax-settings' });
    expect(storage.getBoolean('settings.notificationsEnabled')).toBe(false);
  });

  it('sets darkMode and persists to MMKV', () => {
    useSettingsStore.getState().setDarkMode(true);

    expect(useSettingsStore.getState().darkMode).toBe(true);
  });

  it('sets mapTypeSatellite and persists to MMKV', () => {
    useSettingsStore.getState().setMapTypeSatellite(true);

    expect(useSettingsStore.getState().mapTypeSatellite).toBe(true);
  });

  it('allows toggling back and forth', () => {
    const { setDarkMode } = useSettingsStore.getState();
    setDarkMode(true);
    expect(useSettingsStore.getState().darkMode).toBe(true);
    setDarkMode(false);
    expect(useSettingsStore.getState().darkMode).toBe(false);
  });
});
