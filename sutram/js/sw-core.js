// sutram/js/sw-core.js
// Phase 2: Abstracted Service Worker Core

const CACHE_NAME = 'sutram-offline-v2';
// Let the host supply ASSETS via global if needed, or default
const ASSETS = self.HOST_ASSETS || [
    '/',
    '/manifest.json',
    '/static/vendor/sutram/js/sutram-boot.js',
    '/static/vendor.json'
];

let isReconciling = false;

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_RECONCILING') {
        isReconciling = event.data.value;
    }
    if (event.data && event.data.type === 'SKIP_WAITING' && !isReconciling) {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        })
    );
    return self.clients.claim();
});
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    if (e.request.method !== 'GET') return;

    // Use host-injected bypass patterns to remain domain-agnostic
    const bypassPatterns = self.HOST_BYPASS_PATTERNS || [];
    if (bypassPatterns.some(pattern => url.pathname.startsWith(pattern) || url.pathname === pattern)) {
        return;
    }
    
    e.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
                let responsePromise = Promise.resolve(cachedResponse);
                if (!cachedResponse && e.request.mode === 'navigate') {
                    responsePromise = cache.match('/');
                }

                return responsePromise.then((finalCached) => {
                    const networkFetch = fetch(e.request).then((response) => {
                        if (response && response.status === 200) {
                            cache.put(e.request, response.clone());
                        }
                        return response;
                    }).catch((err) => {
                        if (finalCached) return finalCached;
                        if (e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html')) {
                            return new Response(
                                `<!DOCTYPE html>
                                <html>
                                <head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"></head>
                                <body style="font-family:monospace; background:#0f172a; color:#f8fafc; padding:20px; text-align:center;">
                                    <h2 style="color:#ef4444;">⚠️ Offline Boot Failed</h2>
                                    <p style="color:#94a3b8;">The Service Worker intercepted the launch, but the root cache for <code>/</code> was missing.</p>
                                </body>
                                </html>`,
                                { status: 200, headers: { 'Content-Type': 'text/html' } }
                            );
                        }
                        throw err;
                    });

                    if (finalCached) {
                        networkFetch.catch(() => {});
                        return finalCached;
                    }
                    return networkFetch;
                });
            });
        })
    );
});