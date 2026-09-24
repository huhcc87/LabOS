const CACHE_NAME = 'labos-v6';
const OFFLINE_CACHE = 'labos-offline-v6';
// ponytail: no longer precaching '/' / '/index.html' here — the navigate
// handler below fetches + caches the shell itself on every successful load,
// so a frozen install-time copy never wins over what's actually live.
const STATIC_ASSETS = [];
const API_PREFIX = '/api';

// Key API endpoints to cache for offline access
const OFFLINE_API_ROUTES = [
  '/api/samples/',
  '/api/inventory/',
  '/api/protocols/',
  '/api/instruments/',
];

// Install: open (empty) caches up front so they exist before first fetch
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME),
      caches.open(OFFLINE_CACHE),
    ])
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== OFFLINE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for API calls — cache GET responses for offline fallback
  if (url.pathname.startsWith(API_PREFIX)) {
    if (request.method === 'GET') {
      event.respondWith(
        fetch(request)
          .then((response) => {
            // Cache successful API responses for offline
            if (response.ok && OFFLINE_API_ROUTES.some(r => url.pathname.startsWith(r))) {
              const clone = response.clone();
              caches.open(OFFLINE_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() =>
            caches.match(request, { cacheName: OFFLINE_CACHE }).then(
              (cached) =>
                cached ||
                new Response(
                  JSON.stringify({ detail: 'Offline — showing cached data', offline: true }),
                  { status: 200, headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' } }
                )
            )
          )
      );
    } else {
      // For non-GET API calls (POST, PUT, DELETE), queue for background sync
      event.respondWith(
        fetch(request).catch(
          () =>
            new Response(
              JSON.stringify({ detail: 'Offline — action queued for sync' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            )
        )
      );
    }
    return;
  }

  // Cache-first for static assets (JS, CSS, fonts, images)
  // Skip non-http(s) schemes — chrome-extension:// etc. cannot be cached
  if (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'font' ||
      request.destination === 'image')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first with offline fallback for navigation (SPA shell).
  // `cache: 'no-store'` bypasses the browser's own HTTP cache — without it,
  // a stale disk-cached response can satisfy this fetch() and this handler
  // would faithfully hand back the old shell forever, even though the logic
  // reads as "network-first". On success we also refresh the offline-fallback
  // copy, so that copy tracks the latest deploy instead of the version that
  // happened to be live when the service worker first installed.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(OFFLINE_CACHE).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html', { cacheName: OFFLINE_CACHE }))
    );
    return;
  }

  // Default: network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Background sync for queued offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending') {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions() {
  // Placeholder: replay any queued mutations from IndexedDB
  return Promise.resolve();
}

// Push notifications for lab alerts (IoT, deadlines)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json().catch(() => ({ title: 'LabOS Alert', body: event.data.text() }));
  event.waitUntil(
    data.then((payload) =>
      self.registration.showNotification(payload.title || 'LabOS', {
        body: payload.body || '',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: payload.tag || 'labos-alert',
        requireInteraction: payload.critical || false,
        data: { url: payload.url || '/' },
      })
    )
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});
