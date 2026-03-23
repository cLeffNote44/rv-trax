// ---------------------------------------------------------------------------
// RV Trax — Service Worker (PWA offline support)
//
// Strategy: Network-first with cache fallback for navigation requests.
// Static assets use cache-first for performance.
// API calls are never cached (real-time data must be fresh).
// ---------------------------------------------------------------------------

const CACHE_NAME = 'rv-trax-v1';
const STATIC_CACHE = 'rv-trax-static-v1';

// Shell files to pre-cache on install
const PRECACHE_URLS = ['/offline'];

// ── Install: pre-cache shell ────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Offline page may not exist yet — that's ok
      });
    }),
  );
  // Activate immediately (don't wait for old SW to stop)
  self.skipWaiting();
});

// ── Activate: clean old caches ──────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      );
    }),
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ── Fetch: network-first for pages, cache-first for static assets ───────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API calls — always go to network (real-time data)
  if (url.pathname.startsWith('/api/')) return;

  // Skip WebSocket upgrades
  if (request.headers.get('upgrade') === 'websocket') return;

  // Skip browser extensions and chrome-extension URLs
  if (!url.protocol.startsWith('http')) return;

  // Static assets (JS, CSS, images, fonts): cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|ico)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached;

          return fetch(request).then((response) => {
            // Only cache successful responses
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        });
      }),
    );
    return;
  }

  // Navigation requests (HTML pages): network-first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: try cache, then offline page
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline');
          });
        }),
    );
    return;
  }
});

// ── Push notifications (future use) ─────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'RV Trax', {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: data.data || {},
        tag: data.tag || 'rv-trax-notification',
      }),
    );
  } catch {
    // Invalid push payload
  }
});

// ── Notification click handler ──────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const deepLink = event.notification.data?.deep_link;
  const url = deepLink || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return self.clients.openWindow(url);
    }),
  );
});
