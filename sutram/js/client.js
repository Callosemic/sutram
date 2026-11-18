// sutram/js/client.js
// Layer 2: Pluggable SutramBackendAdapter Contract & Akasa Reference Adapter

import { StoreRegistry } from './sutram_sdk.js';
import { createJobPoller } from './poller.js';
import { OfflineHttpProvider } from './offline.js';

export const REQUIRED_BACKEND_ADAPTER_METHODS = [
    'bootstrap',
    'fetchRaw',
    'request',
    'resolveScopedUrl',
    'probeHealth',
    'getBuildId',
    'pollJob',
    'connectStream'
];

export function validateBackendAdapter(adapter) {
    const adapterName = adapter?.name || adapter?.constructor?.name || 'unknown-adapter';
    if (!adapter || typeof adapter !== 'object') {
        throw new Error(`[Sutram Boot Error] Backend adapter '${adapterName}' fails contract. Adapter must be an object instance.`);
    }
    const missing = REQUIRED_BACKEND_ADAPTER_METHODS.filter(method => typeof adapter[method] !== 'function');
    if (missing.length > 0) {
        throw new Error(`[Sutram Boot Error] Backend adapter '${adapterName}' fails contract. Missing methods: ${missing.join(', ')}`);
    }
    return true;
}

export const BackendAdapterRegistry = {
    _adapter: null,
    register(adapter) {
        validateBackendAdapter(adapter);
        this._adapter = adapter;
        globalThis.__SUTRAM_BACKEND_ADAPTER__ = adapter;
        if (typeof window !== 'undefined') {
            window.Sutram = window.Sutram || {};
            window.Sutram.backendAdapter = adapter;
        }
        return adapter;
    },
    get() {
        return this._adapter || globalThis.__SUTRAM_BACKEND_ADAPTER__ || null;
    },
    clear() {
        this._adapter = null;
        delete globalThis.__SUTRAM_BACKEND_ADAPTER__;
        if (typeof window !== 'undefined' && window.Sutram) {
            delete window.Sutram.backendAdapter;
        }
    }
};

export function registerBackendAdapter(adapter) {
    return BackendAdapterRegistry.register(adapter);
}

export function getBackendAdapter() {
    return BackendAdapterRegistry.get();
}

export class SutramBackendAdapter {
    constructor(options = {}) {
        this.name = options.name || 'SutramBackendAdapter';
        this.fetchImpl = typeof options.fetchImpl === 'function'
            ? options.fetchImpl
            : (...args) => globalThis.fetch(...args);
    }

    async bootstrap() {
        return { authenticated: true };
    }

    async fetchRaw(url, options = {}) {
        return this.fetchImpl(url, options);
    }

    async request(url, options = {}, scopeId = 'default') {
        return this.fetchRaw(url, options, scopeId);
    }

    resolveScopedUrl(path, scopeId = 'default') {
        const cleanPath = String(path || '').replace(/^\/+/, '');
        return `/api/${encodeURIComponent(scopeId || 'default')}/${cleanPath}`;
    }

    async probeHealth() {
        try {
            const res = await this.fetchRaw('/', { method: 'HEAD', cache: 'no-store' });
            return Boolean(res && res.ok);
        } catch (_) {
            return false;
        }
    }

    getBuildId() {
        return null;
    }

    pollJob(jobId, options = {}) {
        const poller = createJobPoller({
            get: (path) => this.request(this.resolveScopedUrl(`system/${path}`), { method: 'GET' })
        });
        return poller(jobId, options);
    }

    connectStream() {
        return { disconnect() {} };
    }
}

export class AkasaBackendAdapter extends SutramBackendAdapter {
    constructor(options = {}) {
        super({ name: options.name || 'AkasaBackendAdapter', fetchImpl: options.fetchImpl });
        this.namespace = options.namespace || 'akasa';
        this.tokenHeader = options.tokenHeader || 'X-Akasa-Token';
        this.tokenAliasHeader = options.tokenAliasHeader || null;
        this.scopeHeader = options.scopeHeader || 'X-Workspace-ID';
        this.buildIdHeader = options.buildIdHeader || 'X-Akasa-Build-ID';
        this.bootstrapUrl = options.bootstrapUrl || '/auth/bootstrap';
        this.streamUrl = options.streamUrl || '/api/system/stream';
        this.apiPrefix = (options.apiPrefix || '/api').replace(/\/+$/, '');
        this.probeUrl = options.probeUrl || this.bootstrapUrl;
        this.probeMethod = options.probeMethod || 'POST';
        this.getActiveScope = typeof options.getActiveScope === 'function'
            ? options.getActiveScope
            : () => StoreRegistry.getActiveScope();
        this.onBuildMismatch = typeof options.onBuildMismatch === 'function' ? options.onBuildMismatch : null;
        this.onAuthRequired = typeof options.onAuthRequired === 'function' ? options.onAuthRequired : null;
        this.isExtensionEnabled = typeof options.isExtensionEnabled === 'function' ? options.isExtensionEnabled : null;
        this.isStreamConnected = typeof options.isStreamConnected === 'function' ? options.isStreamConnected : () => false;

        this._token = options.initialToken || this._readStoredToken() || '';
        this._buildId = options.initialBuildId || this._readDomBuildId() || null;
        this._reauthPromise = null;
        this._abortControllers = new Map();

        this.offlineProvider = options.offlineProvider || new OfflineHttpProvider({
            adapter: this,
            probeUrl: this.probeUrl,
            probeMethod: this.probeMethod,
            maxCacheBytes: options.maxCacheBytes,
            isOfflineCapable: options.isOfflineCapable,
            shouldCacheGet: options.shouldCacheGet,
            onEnqueue: options.onEnqueue,
            onOfflineError: options.onOfflineError,
            onCacheWrite: options.onCacheWrite,
            checkOfflineState: options.checkOfflineState,
            setOfflineState: options.setOfflineState
        });
    }

    _storageKey() {
        return `${this.namespace}_boot_token`;
    }

    _readStoredToken() {
        try {
            return sessionStorage.getItem(this._storageKey()) || localStorage.getItem(this._storageKey()) || '';
        } catch (_) {
            return '';
        }
    }

    _writeStoredToken(token) {
        this._token = token || '';
        try {
            if (token) {
                sessionStorage.setItem(this._storageKey(), token);
                localStorage.setItem(this._storageKey(), token);
            } else {
                sessionStorage.removeItem(this._storageKey());
                localStorage.removeItem(this._storageKey());
            }
        } catch (_) {}
    }

    _readDomBuildId() {
        if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null;
        const meta = document.querySelector('meta[name$="-build-id"]');
        return meta?.content ? String(meta.content) : null;
    }

    getToken() {
        if (!this._token) {
            this._token = this._readStoredToken();
        }
        return this._token || '';
    }

    setToken(token) {
        this._writeStoredToken(token);
    }

    getBuildId() {
        return this._buildId || null;
    }

    getScopeSignal(scopeId = null) {
        const effectiveScope = scopeId || this.getActiveScope() || 'default';
        if (!this._abortControllers.has(effectiveScope)) {
            this._abortControllers.set(effectiveScope, new AbortController());
        }
        return this._abortControllers.get(effectiveScope).signal;
    }

    abortScope(scopeId) {
        if (this._abortControllers.has(scopeId)) {
            this._abortControllers.get(scopeId).abort();
            this._abortControllers.delete(scopeId);
        }
    }

    _recordObservedBuildId(candidateId) {
        const clean = candidateId ? String(candidateId).trim() : '';
        if (!clean || clean === 'dev') return;
        const prev = this._buildId;
        if (prev !== clean) {
            this._buildId = clean;
            if (prev && this.onBuildMismatch) {
                try {
                    this.onBuildMismatch(clean, prev);
                } catch (_) {}
            }
        }
    }

    _sniffBuildId(res) {
        if (!res || !res.headers || typeof res.headers.get !== 'function') return;
        const headerVal = res.headers.get(this.buildIdHeader)
            || res.headers.get('X-Akasa-Build-ID')
            || res.headers.get('X-Sutram-Build-ID');
        if (headerVal) {
            this._recordObservedBuildId(headerVal);
        }
    }

    buildHeaders(scopeId = null, extraHeaders = null) {
        const headers = new Headers();
        const token = this.getToken();
        if (token) {
            headers.set(this.tokenHeader, token);
            if (this.tokenAliasHeader && this.tokenAliasHeader !== this.tokenHeader) {
                headers.set(this.tokenAliasHeader, token);
            }
        }
        const effectiveScope = scopeId || this.getActiveScope() || 'default';
        if (effectiveScope && this.scopeHeader) {
            headers.set(this.scopeHeader, effectiveScope);
        }
        if (extraHeaders) {
            const authKeys = new Set([this.tokenHeader, this.tokenAliasHeader].filter(Boolean).map(k => String(k).toLowerCase()));
            new Headers(extraHeaders).forEach((value, key) => {
                // The token comes from the adapter, so a retry after re-authentication never resends a stale one.
                if (!authKeys.has(String(key).toLowerCase())) {
                    headers.set(key, value);
                }
            });
        }
        return headers;
    }

    async bootstrap(credentials = null) {
        if (!credentials && this._reauthPromise) {
            return this._reauthPromise;
        }
        const runBootstrap = async () => {
            const payload = credentials ? { token: String(credentials).trim() } : {};
            const res = await this.fetchImpl(this.bootstrapUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                cache: 'no-store'
            });
            this._sniffBuildId(res);
            let data = null;
            try {
                data = await res.clone().json();
            } catch (_) {}
            if (data && data.build_id) {
                this._recordObservedBuildId(data.build_id);
            }
            if (res.ok && data) {
                if (data.status === 'recovery') {
                    return { authenticated: false, recovery: true, buildId: this._buildId, data };
                }
                if (data.token) {
                    this._writeStoredToken(data.token);
                    return { authenticated: true, token: data.token, buildId: this._buildId, data };
                }
            }
            if (res.status === 401 && this.onAuthRequired) {
                const suppliedToken = await this.onAuthRequired(res);
                if (suppliedToken) {
                    return this.bootstrap(suppliedToken);
                }
            }
            return { authenticated: false, status: res.status, buildId: this._buildId, data };
        };

        if (credentials) {
            return runBootstrap();
        }
        this._reauthPromise = runBootstrap().finally(() => {
            this._reauthPromise = null;
        });
        return this._reauthPromise;
    }

    async fetchRaw(url, options = {}, scopeId = null) {
        const effectiveScope = scopeId || this.getActiveScope() || 'default';
        const { _skipAuthRetry, ...fetchInit } = options;
        const headers = this.buildHeaders(effectiveScope, fetchInit.headers);
        const reqInit = {
            ...fetchInit,
            headers,
            signal: fetchInit.signal || this.getScopeSignal(effectiveScope)
        };

        let res = await this.fetchImpl(url, reqInit);
        this._sniffBuildId(res);

        if (res && res.status === 401 && !_skipAuthRetry && url !== this.bootstrapUrl) {
            const authRes = await this.bootstrap();
            if (authRes && authRes.authenticated) {
                const retryHeaders = this.buildHeaders(effectiveScope, fetchInit.headers);
                res = await this.fetchImpl(url, {
                    ...fetchInit,
                    headers: retryHeaders,
                    signal: fetchInit.signal || this.getScopeSignal(effectiveScope)
                });
                this._sniffBuildId(res);
            }
        }
        return res;
    }

    async request(url, options = {}, scopeId = null) {
        const effectiveScope = scopeId || this.getActiveScope() || 'default';
        const method = options.method ? options.method.toUpperCase() : 'GET';
        const headers = this.buildHeaders(effectiveScope, options.headers);

        if (method !== 'GET' && options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        const reqOptions = {
            ...options,
            method,
            headers,
            signal: options.signal || this.getScopeSignal(effectiveScope)
        };

        if (method === 'GET') {
            return this.offlineProvider.get(url, reqOptions, effectiveScope);
        }

        const isFormData = options.body instanceof FormData;
        const bodyString = isFormData
            ? options.body
            : (options.body !== undefined && options.body !== null
                ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
                : null);

        if (options.body !== undefined) {
            reqOptions.body = bodyString;
        }

        const plainHeaders = {};
        headers.forEach((val, key) => { plainHeaders[key] = val; });
        reqOptions.plainHeaders = plainHeaders;

        return this.offlineProvider.executeMutation(url, method, bodyString, reqOptions, effectiveScope);
    }

    resolveScopedUrl(path, scopeId = null) {
        const effectiveScope = scopeId || this.getActiveScope() || 'default';
        const cleanPath = String(path || '').replace(/^\/+/, '');
        if (cleanPath.startsWith(`${this.apiPrefix.replace(/^\/+/, '')}/`)) {
            return `/${cleanPath}`;
        }
        return `${this.apiPrefix}/${encodeURIComponent(effectiveScope)}/${cleanPath}`;
    }

    async probeHealth() {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
        try {
            const sep = this.probeUrl.includes('?') ? '&' : '?';
            const probeOpts = {
                method: this.probeMethod,
                cache: 'no-store',
                signal: AbortSignal.timeout(2000)
            };
            if (this.probeMethod === 'POST') {
                probeOpts.headers = { 'Content-Type': 'application/json' };
                probeOpts.body = '{}';
            }
            const res = await this.fetchRaw(`${this.probeUrl}${sep}t=${Date.now()}`, probeOpts);
            return Boolean(res && res.ok);
        } catch (_) {
            return false;
        }
    }

    pollJob(jobId, options = {}, scopeId = null) {
        const initScope = scopeId || this.getActiveScope() || 'default';
        const safeOptions = { ...options };
        ['onProgress', 'onComplete', 'onError'].forEach(cbName => {
            if (typeof options[cbName] === 'function') {
                safeOptions[cbName] = (...args) => {
                    if (this.getActiveScope() !== initScope) return;
                    if (cbName === 'onProgress' && this.isStreamConnected()) return;
                    return options[cbName](...args);
                };
            }
        });
        const scopedPoller = createJobPoller({
            get: (path) => this.request(this.resolveScopedUrl(`system/${path}`, initScope), { method: 'GET' }, initScope)
        });
        return scopedPoller(jobId, safeOptions);
    }

    connectStream(handlers = {}) {
        if (typeof EventSource === 'undefined') {
            return { disconnect() {} };
        }
        const token = this.getToken();
        const sep = this.streamUrl.includes('?') ? '&' : '?';
        const streamTarget = token ? `${this.streamUrl}${sep}token=${encodeURIComponent(token)}` : this.streamUrl;
        const source = new EventSource(streamTarget);
        if (typeof handlers.onOpen === 'function') source.onopen = handlers.onOpen;
        if (typeof handlers.onError === 'function') source.onerror = handlers.onError;
        if (handlers.events && typeof handlers.events === 'object') {
            Object.entries(handlers.events).forEach(([eventName, listener]) => {
                if (typeof listener === 'function') {
                    source.addEventListener(eventName, listener);
                }
            });
        }
        return {
            source,
            disconnect() {
                try { source.close(); } catch (_) {}
            }
        };
    }

    _dispatchScoped(path, options = {}, scopeId = null) {
        const effectiveScope = scopeId || this.getActiveScope() || 'default';
        const cleanPath = String(path || '').replace(/^\/+/, '');
        const moduleName = cleanPath.split('/')[0];
        if (moduleName && this.isExtensionEnabled && !this.isExtensionEnabled(moduleName)) {
            return Promise.resolve(new Response(
                JSON.stringify({ error: `Module '${moduleName}' is disabled in scope '${effectiveScope}'.` }),
                { status: 403, statusText: 'Forbidden' }
            ));
        }
        return this.request(this.resolveScopedUrl(cleanPath, effectiveScope), options, effectiveScope);
    }

    get(path, options = {}, scopeId = null) {
        return this._dispatchScoped(path, { ...options, method: 'GET' }, scopeId);
    }

    post(path, payload = {}, options = {}, scopeId = null) {
        const isFD = payload instanceof FormData;
        const headers = isFD ? { ...(options.headers || {}) } : { 'Content-Type': 'application/json', ...(options.headers || {}) };
        const body = isFD ? payload : JSON.stringify(payload);
        return this._dispatchScoped(path, { ...options, method: 'POST', headers, body }, scopeId);
    }

    delete(path, options = {}, scopeId = null) {
        return this._dispatchScoped(path, { ...options, method: 'DELETE' }, scopeId);
    }

    async getJson(path, options = {}, scopeId = null) {
        const res = await this.get(path, options, scopeId);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        return res.json();
    }

    async postJson(path, payload = {}, options = {}, scopeId = null) {
        const res = await this.post(path, payload, options, scopeId);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        return res.json();
    }

    async deleteJson(path, options = {}, scopeId = null) {
        const res = await this.delete(path, options, scopeId);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        return res.json();
    }
}

export class SutramDataClient {
    constructor(provider) {
        this.provider = provider;
    }

    async get(path, options = {}) {
        return this.provider.get(path, options);
    }

    async post(path, payload = {}, options = {}) {
        return this.provider.post(path, payload, options);
    }

    async delete(path, options = {}) {
        return this.provider.delete(path, options);
    }
}

export class HttpProvider {
    constructor(fetchImpl = (...args) => globalThis.fetch(...args)) {
        this.fetchImpl = fetchImpl;
    }

    async get(url, options = {}) {
        return this.fetchImpl(url, { ...options, method: 'GET' });
    }

    async post(url, payload = {}, options = {}) {
        const isFD = payload instanceof FormData;
        const headers = isFD ? (options.headers || {}) : { 'Content-Type': 'application/json', ...(options.headers || {}) };
        const body = isFD ? payload : JSON.stringify(payload);
        return this.fetchImpl(url, { ...options, method: 'POST', headers, body });
    }

    async delete(url, options = {}) {
        return this.fetchImpl(url, { ...options, method: 'DELETE' });
    }
}