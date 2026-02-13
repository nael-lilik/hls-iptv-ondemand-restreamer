const CACHE_NAME = 'iptv-restreamer-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/player.js',
    '/manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Network first for API and streams
    if (event.request.url.includes('/api/') || event.request.url.includes('/stream/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response('Offline', { status: 503 });
            })
        );
        return;
    }

    // Cache first for static assets
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((fetchResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, fetchResponse.clone());
                    return fetchResponse;
                });
            });
        }).catch(() => {
            return new Response('Offline', { status: 503 });
        })
    );
});
