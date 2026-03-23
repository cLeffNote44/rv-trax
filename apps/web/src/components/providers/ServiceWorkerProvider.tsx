'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker for PWA support.
 * Only registers in production (not during development).
 */
export function ServiceWorkerProvider() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Registered:', registration.scope);

          // Check for updates every 60 minutes
          setInterval(
            () => {
              registration.update();
            },
            60 * 60 * 1000,
          );
        })
        .catch((error) => {
          console.warn('[SW] Registration failed:', error);
        });
    }
  }, []);

  return null;
}
