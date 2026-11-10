// sutram/js/sw-core.js
// Phase 2: Abstracted Service Worker Core
const DEFAULT_CACHE_NAME = self.OS_CACHE_VERSION ? `sutram-offline-${self.OS_CACHE_VERSION}` : 'sutram-offline-v2';
const APP_SHELL_KEY = '/__sutram_app_shell__';
const ACTIVE_BUILD_MARKER = '/__sutram_active_build__';
// T9: which build is active, and which complete build waits for the next page load, survive SW restarts here.
const META_CACHE = 'sutram-meta';
const PENDING_BUILD_MARKER = '/__sutram_pending_build__';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
// Host supplies HOST_ASSETS via self.HOST_ASSETS before importScripts; fallback is purely root '/'
const ASSETS = self.HOST_ASSETS || ['/'];

let activeBuildCacheName = self.OS_BUILD_ID ? `sutram-build-${self.OS_BUILD_ID}` : DEFAULT_CACHE_NAME;
let isReconciling = false;

function _isLoopbackOrigin() {
    const host = String(self.location?.hostname || '').toLowerCase();
    return LOOPBACK_HOSTS.has(host);
}

function _isCacheableResponse(res) {
    if (!res || res.status !== 200 || res.redirected) return false;
    if (res.type && res.type !== 'basic' && res.type !== 'default') return false;
    if (res.url) {
        try {
            if (new URL(res.url, self.location.origin).origin !== self.location.origin) return false;
        } catch (_) {
            return false;
        }
    }
    return true;
}

let metaLoaded = false;

async function _readMetaName(key) {
    try {
        const meta = await caches.open(META_CACHE);
        const hit = await meta.match(key);
        return hit ? (await hit.text()) : null;
    } catch (_) {
        return null;
    }
}

// T9: a staged build becomes active only on a page load, so a running page never gets another build's lazy imports.
async function _promotePendingBuild() {
    const pending = await _readMetaName(PENDING_BUILD_MARKER);
    if (!pending) return;
    const meta = await caches.open(META_CACHE);
    await meta.delete(PENDING_BUILD_MARKER);
    const keys = await caches.keys();
    if (!keys.includes(pending)) return;
    activeBuildCacheName = pending;
    metaLoaded = true;
    await meta.put(ACTIVE_BUILD_MARKER, new Response(pending, { status: 200 }));
    await Promise.all(keys
        .filter(k => (k.startsWith('sutram-build-') || k.startsWith('sutram-offline-')) && k !== pending)
        .map(k => caches.delete(k)));
}

async function _resolveActiveCache() {
    const keys = await caches.keys();
    if (!metaLoaded) {
        const recorded = await _readMetaName(ACTIVE_BUILD_MARKER);
        if (recorded && keys.includes(recorded)) activeBuildCacheName = recorded;
        metaLoaded = true;
    }
    if (keys.includes(activeBuildCacheName)) {
        return caches.open(activeBuildCacheName);
    }
    const pending = await _readMetaName(PENDING_BUILD_MARKER);
    const buildKeys = keys.filter(k => k.startsWith('sutram-build-') && k !== pending);
    if (buildKeys.length > 0) {
        activeBuildCacheName = buildKeys[buildKeys.length - 1];
        return caches.open(activeBuildCacheName);
    }
    return caches.open(DEFAULT_CACHE_NAME);
}

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
        if (_isCacheableResponse(res)) {
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
                        if (_isCacheableResponse(subRes)) {
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
        caches.open(activeBuildCacheName).then(async (cache) => {
            await Promise.allSettled(ASSETS.map((url) => _cacheAssetResilient(cache, url)));
            await cache.put(ACTIVE_BUILD_MARKER, new Response(activeBuildCacheName, { status: 200 }));
        })
    );
});

self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'SET_RECONCILING') {
        isReconciling = data.value;
    } else if (data.type === 'ACTIVATE_BUILD_CACHE' && data.cacheName) {
        activeBuildCacheName = String(data.cacheName);
    } else if (data.type === 'SKIP_WAITING' && !isReconciling) {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        // A new service worker keeps the recorded active build, a staged build and the meta cache.
        const keep = new Set([activeBuildCacheName, DEFAULT_CACHE_NAME, META_CACHE]);
        const recorded = await _readMetaName(ACTIVE_BUILD_MARKER);
        if (recorded) keep.add(recorded);
        const pending = await _readMetaName(PENDING_BUILD_MARKER);
        if (pending) keep.add(pending);
        const keyList = await caches.keys();
        await Promise.all(keyList.filter(key => !keep.has(key)).map(key => caches.delete(key)));
    })());
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    if (e.request.method !== 'GET') return;
    // Build staging (offline.js) must see the server, never this worker's cache.
    if (e.request.headers.get('X-Sutram-Revalidate') === '1') return;
    // Never intercept cross-origin requests (e.g. Google Fonts) so offline mode never throws on external CDNs
    if (url.origin !== self.location.origin) return;

    // Use host-injected bypass patterns to remain domain-agnostic
    const bypassPatterns = self.HOST_BYPASS_PATTERNS || [];
    if (bypassPatterns.some(pattern => url.pathname.startsWith(pattern) || url.pathname === pattern)) {
        return;
    }

    const isNavigation = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html');

    e.respondWith(
        (isNavigation ? _promotePendingBuild().catch(() => {}) : Promise.resolve()).then(() => _resolveActiveCache()).then(async (cache) => {
            const finalCached = await _matchCachedShellOrAsset(cache, e.request, url, isNavigation);
            const preferCacheFirst = !_isLoopbackOrigin();

            // Cache-First on non-localhost origins (Tailscale / mobile) when a complete build is cached;
            // Network-First on localhost so local edits appear on reload.
            if (preferCacheFirst && finalCached) {
                return finalCached;
            }

            try {
                const fetchReq = isNavigation
                    ? new Request(e.request.url, { method: 'GET', headers: e.request.headers, cache: 'no-cache', credentials: 'same-origin' })
                    : e.request;
                const response = await fetch(fetchReq);
                if (_isCacheableResponse(response)) {
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
                                                .then((r) => { if (_isCacheableResponse(r)) cache.put(p, r); })
                                                .catch(() => {});
                                        }
                                    }).catch(() => {});
                                }
                            });
                        }).catch(() => {});
                    }
                    return response;
                }
                // Fall back to cached shell/asset on reverse-proxy 502/503/504 or captive-portal 511 / redirects
                if (finalCached && response && ([502, 503, 504, 511].includes(response.status) || response.redirected)) {
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