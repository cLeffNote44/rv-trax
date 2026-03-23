'use client';

import { useCallback } from 'react';

// ---------------------------------------------------------------------------
// Translation messages loaded at build time
// ---------------------------------------------------------------------------

let messages: Record<string, unknown> = {};

// Lazy-load English messages
const loadMessages = (() => {
  let loaded = false;
  return async () => {
    if (!loaded) {
      try {
        messages = (await import('../messages/en.json')).default;
        loaded = true;
      } catch {
        // Messages not available
      }
    }
  };
})();

// Eager load on module init
if (typeof window !== 'undefined') {
  loadMessages();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Simple translation hook that reads from static JSON files.
 * Drop-in replacement for next-intl's useTranslations when ready to migrate.
 *
 * Usage:
 *   const t = useTranslation('nav');
 *   t('dashboard') // "Dashboard"
 */
export function useTranslation(namespace?: string) {
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const path = namespace ? `${namespace}.${key}` : key;
      const parts = path.split('.');
      let value: unknown = messages;

      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          return key; // fallback to key
        }
      }

      if (typeof value !== 'string') return key;

      // Simple parameter interpolation: {name} -> value
      if (params) {
        return value.replace(/\{(\w+)\}/g, (_, k) =>
          params[k] !== undefined ? String(params[k]) : `{${k}}`,
        );
      }

      return value;
    },
    [namespace],
  );

  return t;
}
