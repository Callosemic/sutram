import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ensureSutramAppShellCached } from '../../../sutram/js/offline.js';

class FakeCache {
    constructor() { this.store = new Map(); }
    _key(req) {
        const raw = typeof req === 'string' ? req : req.url;
        const u = new URL(raw, 'https://box.tailnet.ts.net');
        return u.pathname + u.search;
    }
    async match(req, opts = {}) {
        const raw = typeof req === 'string' ? req : req.url;
        const u = new URL(raw, 'https://box.tailnet.ts.net');
        const key = opts.ignoreSearch ? u.pathname : (u.pathname + u.search);
        const hit = this.store.get(key) || this.store.get(u.pathname);
        return hit ? hit.clone() : null;
    }
    async put(req, res) {
        this.store.set(this._key(req), res.clone());
    }
}

class FakeCacheStorage {
    constructor() { this.caches = new Map(); }
    async open(name) {
        if (!this.caches.has(name)) this.caches.set(name, new FakeCache());
        return this.caches.get(name);
    }
    async keys() { return Array.from(this.caches.keys()); }
    async delete(name) { return this.caches.delete(name); }
}

const cacheStorage = new FakeCacheStorage();
let serverReachable = true;
let serverBuildId = 'build-v1';
let serverAssets = {
    '/': () => `<!DOCTYPE html><html><head><meta name="sutram-build-id" content="${serverBuildId}"><script type="module" src="/static/app.js"></script></head><body>${serverBuildId}</body></html>`,
    '/static/app.js': () => `console.log("${serverBuildId}");`
};

async function networkFetch(input, init = {}) {
    if (!serverReachable) throw new TypeError('Failed to fetch (network unreachable)');
    const rawUrl = typeof input === 'string' ? input : input.url;
    const u = new URL(rawUrl, 'https://box.tailnet.ts.net');
    const bodyFn = serverAssets[u.pathname];
    if (!bodyFn) return new Response('Not Found', { status: 404 });
    return new Response(bodyFn(), {
        status: 200,
        headers: {
            'Content-Type': u.pathname === '/' ? 'text/html' : 'application/javascript',
            'X-Sutram-Build-ID': serverBuildId
        }
    });
}

// Load real sw-core.js in a ServiceWorkerGlobalScope sandbox on a non-loopback Tailscale origin
const swListeners = {};
const swSandbox = {
    OS_CACHE_VERSION: 'v2',
    OS_BUILD_ID: 'build-v1',
    HOST_ASSETS: ['/', '/static/app.js'],
    HOST_BYPASS_PATTERNS: ['/api/'],
    location: new URL('https://box.tailnet.ts.net/sw.js'),
    caches: cacheStorage,
    Request,
    Response,
    Headers,
    URL,
    fetch: networkFetch,
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    addEventListener: (type, fn) => { swListeners[type] = fn; }
};
swSandbox.self = swSandbox;
const swSource = fs.readFileSync(new URL('../../../sutram/js/sw-core.js', import.meta.url), 'utf8');
vm.runInNewContext(swSource, swSandbox, { filename: 'sw-core.js' });

// Route page fetch() through sw-core.js's real fetch listener
async function swInterceptedFetch(input, init = {}) {
    const req = input instanceof Request ? input : new Request(new URL(String(input), 'https://box.tailnet.ts.net').href, init);
    let respondedPromise = null;
    const evt = {
        request: req,
        respondWith: (p) => { respondedPromise = p; }
    };
    swListeners.fetch(evt);
    if (respondedPromise) return await respondedPromise;
    return await networkFetch(req);
}

// 1. Seed initial active build-v1 in cache
let installPromise = null;
swListeners.install({ waitUntil: (p) => { installPromise = p; } });
await installPromise;
const metaCache = await cacheStorage.open('sutram-meta');
await metaCache.put('/__sutram_active_build__', new Response('sutram-build-build-v1', { status: 200 }));

// Wire page globals to use swInterceptedFetch
globalThis.window = globalThis;
globalThis.location = new URL('https://box.tailnet.ts.net/');
globalThis.navigator = { onLine: true, serviceWorker: { controller: { postMessage: () => {} } } };
globalThis.caches = cacheStorage;
globalThis.fetch = swInterceptedFetch;
globalThis.document = {
    querySelector: () => ({ content: 'build-v1' }),
    querySelectorAll: (sel) => sel.includes('script') ? [{ getAttribute: () => '/static/app.js' }] : []
};

// 2. Advance server to build-v2 and run ensureSutramAppShellCached through the SW
serverBuildId = 'build-v2';
const stageRes = await ensureSutramAppShellCached({ buildId: 'build-v1' });
assert.equal(stageRes.complete, true, 'Staging must complete');
assert.equal(stageRes.updated, true, 'Staging must detect newer build-v2 despite cache-first SW');
assert.equal(stageRes.buildId, 'build-v2');

// Pending build must be recorded in sutram-meta, while active build remains build-v1
const pendingHit = await (await cacheStorage.open('sutram-meta')).match('/__sutram_pending_build__');
assert.equal(await pendingHit.text(), 'sutram-build-build-v2');
const stagedJs = await (await cacheStorage.open('sutram-build-build-v2')).match('/static/app.js');
assert.equal(await stagedJs.text(), 'console.log("build-v2");', 'Staged cache must contain fresh server asset, not old cached asset');

// 3. Unmarked asset request before navigation must still be answered from build-v1 cache
const preNavJs = await swInterceptedFetch('/static/app.js');
assert.equal(await preNavJs.text(), 'console.log("build-v1");');

// 4. Unreachable server during staging check must leave active build untouched
serverReachable = false;
const offlineStage = await ensureSutramAppShellCached({ buildId: 'build-v1' });
assert.equal(offlineStage.complete, false);

// 5. Navigation request promotes pending build-v2 and serves it from cache even while server is unreachable
const navReq = new Request('https://box.tailnet.ts.net/', { headers: { Accept: 'text/html' } });
const navRes = await swInterceptedFetch(navReq);
assert.ok((await navRes.text()).includes('build-v2'), 'Navigation must promote and serve staged build-v2');
const activeAfterNav = await (await cacheStorage.open('sutram-meta')).match('/__sutram_active_build__');
assert.equal(await activeAfterNav.text(), 'sutram-build-build-v2');
