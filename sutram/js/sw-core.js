// sutram/js/sw-core.js
// Phase 2: Abstracted Service Worker Core
const CACHE_NAME = self.OS_CACHE_VERSION ? `sutram-offline-${self.OS_CACHE_VERSION}` : 'sutram-offline-v2';
const APP_SHELL_KEY = '/__sutram_app_shell__';
// Host supplies HOST_ASSETS via self.HOST_ASSETS before importScripts; fallback is purely root '/'
const ASSETS = self.HOST_ASSETS || ['/'];

let isReconciling = false;

function _extractSameOriginAssetsFromHtml(htmlText) {
    if (!htmlText || typeof htmlText !== 'string') return [];
    const discovered = new Set();
    // 1. Extract <script type="importmap"> JSON paths
    const importMapMatch = htmlText.match(/<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i);
    if (importMapMatch && importMapMatch[1]) {
        try {
            const parsed = JSON.parse(importMapMatch[1]);
            Object.values(parsed.imports || {}).forEach((u) => {
                if (typeof u === 'string') discovered.add(u);
            });
        } catch (_) {}
    }
    // 2. Extract href/src from <link> and <script> tags
    const attrRegex = /<(?:link|script)\b[^>]*(?:href|src)=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = attrRegex.exec(htmlText)) !== null) {
        if (m[1]) discovered.add(m[1]);
    }
    const bypassPatterns = self.HOST_BYPASS_PATTERNS || [];
    const validPaths = [];
    discovered.forEach((raw) => {
        try {
            const u = new URL(raw, self.location.origin);
            if (u.origin === self.location.origin && !bypassPatterns.some(p => u.pathname.startsWith(p) || u.pathname === p)) {
                validPaths.push(u.pathname);
            }
        } catch (_) {}
    });
    return validPaths;
}

async function _cacheAssetResilient(cache, rawUrl) {
    try {
        const req = new Request(rawUrl, { cache: 'no-cache', credentials: 'same-origin' });
        const res = await fetch(req);
        if (res && res.status === 200) {
            await cache.put(rawUrl, res.clone());
            const parsed = new URL(rawUrl, self.location.origin);
            await cache.put(parsed.pathname, res.clone());
            if (parsed.pathname === '/') {
                await cache.put('/', res.clone());
                await cache.put(APP_SHELL_KEY, res.clone());
                const htmlText = await res.clone().text().catch(() => '');
                const discovered = _extractSameOriginAssetsFromHtml(htmlText);
                await Promise.allSettled(discovered.map(async (p) => {
                    if (p === '/') return;
                    const hit = await cache.match(p, { ignoreSearch: true });
                    if (!hit) {
                        const subRes = await fetch(new Request(p, { cache: 'no-cache', credentials: 'same-origin' }));
                        if (subRes && subRes.status === 200) {
                            await cache.put(p, subRes.clone());
                        }
                    }
                }));
            }
        }
    } catch (_) {}
}

async function _matchCachedShellOrAsset(cache, request, url, isNavigation) {
    const direct = await cache.match(request, { ignoreSearch: true });
    if (direct) return direct;
    const byPath = await cache.match(url.pathname, { ignoreSearch: true });
    if (byPath) return byPath;
    if (isNavigation || url.pathname === '/') {
        const rootMatch = await cache.match('/', { ignoreSearch: true });
        if (rootMatch) return rootMatch;
        const vaultMatch = await cache.match(APP_SHELL_KEY);
        if (vaultMatch) return vaultMatch;
    }
    return null;
}

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await Promise.allSettled(ASSETS.map((url) => _cacheAssetResilient(cache, url)));
        })
    );
});

self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'SET_RECONCILING') {
        isReconciling = data.value;
    } else if (data.type === 'SKIP_WAITING' && !isReconciling) {
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
    // Never intercept cross-origin requests (e.g. Google Fonts) so offline mode never throws on external CDNs
    if (url.origin !== self.location.origin) return;

    // Use host-injected bypass patterns to remain domain-agnostic
    const bypassPatterns = self.HOST_BYPASS_PATTERNS || [];
    if (bypassPatterns.some(pattern => url.pathname.startsWith(pattern) || url.pathname === pattern)) {
        return;
    }

    const isNavigation = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html');

    e.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const finalCached = await _matchCachedShellOrAsset(cache, e.request, url, isNavigation);

            // Always attempt Network-First (revalidating with the server) so fresh HTML/JS/CSS edits
            // pull through immediately on both localhost and Tailscale/remote hosts.
            try {
                const fetchReq = isNavigation
                    ? new Request(e.request.url, { method: 'GET', headers: e.request.headers, cache: 'no-cache', credentials: 'same-origin' })
                    : e.request;
                const response = await fetch(fetchReq);
                if (response && response.status === 200) {
                    cache.put(e.request, response.clone()).catch(() => {});
                    cache.put(url.pathname, response.clone()).catch(() => {});
                    if (isNavigation || url.pathname === '/') {
                        cache.put('/', response.clone()).catch(() => {});
                        cache.put(APP_SHELL_KEY, response.clone()).catch(() => {});
                        response.clone().text().then((htmlText) => {
                            const discovered = _extractSameOriginAssetsFromHtml(htmlText);
                            discovered.forEach((p) => {
                                if (p !== '/') {
                                    cache.match(p, { ignoreSearch: true }).then((hit) => {
                                        if (!hit) {
                                            fetch(new Request(p, { cache: 'no-cache', credentials: 'same-origin' }))
                                                .then((r) => { if (r && r.status === 200) cache.put(p, r); })
                                                .catch(() => {});
                                        }
                                    }).catch(() => {});
                                }
                            });
                        }).catch(() => {});
                    }
                    return response;
                }
                // If a reverse proxy (e.g. Tailscale Serve) returns 502/503/504 because the local daemon is stopped,
                // fall back to the cached App Shell / module rather than rendering a Bad Gateway error.
                if (finalCached && response && [502, 503, 504].includes(response.status)) {
                    return finalCached;
                }
                return response;
            } catch (err) {
                if (finalCached) return finalCached;
                if (isNavigation) {
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
            }
        })
    );
});