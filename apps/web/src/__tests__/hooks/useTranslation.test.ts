import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// We mock the dynamic import of en.json so the translation messages are
// available synchronously in tests.
// ---------------------------------------------------------------------------

vi.mock('@/messages/en.json', () => ({
  default: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      loading: 'Loading...',
    },
    nav: {
      dashboard: 'Dashboard',
      inventory: 'Inventory',
    },
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Overview of your lot inventory and tracker health',
    },
    units: {
      count: '{count} units',
      detail: '{name} is at row {row}',
    },
    deeply: {
      nested: {
        key: 'Found it',
      },
    },
  },
}));

// Force the module to re-evaluate with the mock in place
beforeEach(async () => {
  vi.resetModules();
});

async function importHook() {
  const mod = await import('@/hooks/useTranslation');
  return mod.useTranslation;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTranslation', () => {
  it('returns key as fallback when message not found', async () => {
    const useTranslation = await importHook();
    const { result } = renderHook(() => useTranslation());
    expect(result.current('nonexistent.key')).toBe('nonexistent.key');
  });

  it('resolves namespaced keys (e.g., nav.dashboard)', async () => {
    const useTranslation = await importHook();
    const { result } = renderHook(() => useTranslation('nav'));
    expect(result.current('dashboard')).toBe('Dashboard');
  });

  it('resolves top-level keys without namespace', async () => {
    const useTranslation = await importHook();
    const { result } = renderHook(() => useTranslation());
    expect(result.current('nav.dashboard')).toBe('Dashboard');
  });

  it('handles parameter interpolation', async () => {
    const useTranslation = await importHook();
    const { result } = renderHook(() => useTranslation('units'));
    expect(result.current('count', { count: 42 })).toBe('42 units');
  });

  it('handles multiple parameters', async () => {
    const useTranslation = await importHook();
    const { result } = renderHook(() => useTranslation('units'));
    expect(result.current('detail', { name: 'Unit A', row: 3 })).toBe('Unit A is at row 3');
  });

  it('leaves unresolved params as-is', async () => {
    const useTranslation = await importHook();
    const { result } = renderHook(() => useTranslation('units'));
    expect(result.current('count')).toBe('{count} units');
  });

  it('works with nested namespaces', async () => {
    const useTranslation = await importHook();
    const { result } = renderHook(() => useTranslation('deeply'));
    expect(result.current('nested.key')).toBe('Found it');
  });

  it('returns key for non-string leaf values', async () => {
    const useTranslation = await importHook();
    const { result } = renderHook(() => useTranslation());
    // "nav" is an object, not a string
    expect(result.current('nav')).toBe('nav');
  });
});
