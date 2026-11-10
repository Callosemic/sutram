// sutram/js/offline.js
// Phase 1: Sutram Offline Micro-Kernel
const DB_NAME = 'sutram_offline_db', DB_VERSION = 4;
const _idbOnly = (val) => (typeof IDBKeyRange !== 'undefined' ? IDBKeyRange.only(val) : val);

export function emitOfflineTelemetry(message, type = 'info', category = 'offline', details = null, scopeId = 'default') {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sutram:offline-telemetry', {
            detail: {
                timestamp: Date.now(),
                type,
                category,
                message,
                details,
                scopeId
            }
        }));
        if (typeof window.Sutram?.offlineLog === 'function') {
            window.Sutram.offlineLog(message, type, details);
        }
    }
}

export class SutramDB {
    static _lruBuffer = new Map();

    static subscribeTelemetry(listener) {
        if (typeof window === 'undefined' || typeof listener !== 'function') return () => {};
        const handler = (e) => listener(e.detail || {});
        window.addEventListener('sutram:offline-telemetry', handler);
        return () => window.removeEventListener('sutram:offline-telemetry', handler);
    }
    static _lruFlushTimer = null;
    static _tenantAgnosticUrlPredicate = (filepath) => !String(filepath || '').includes('://');

    static configure(options = {}) {
        if (typeof options.isTenantAgnosticUrl === 'function') {
            this._tenantAgnosticUrlPredicate = options.isTenantAgnosticUrl;
        }
    }

    static _scheduleLRUFlush(delayMs = 5000) {
        if (this._lruFlushTimer) return;
        this._lruFlushTimer = setTimeout(() => {
            this._lruFlushTimer = null;
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(() => { this._flushLRUQueue().catch(() => {}); });
            } else {
                this._flushLRUQueue().catch(() => {});
            }
        }, delayMs);
    }

    static async _flushLRUQueue() {
        if (this._lruFlushTimer) {
            clearTimeout(this._lruFlushTimer);
            this._lruFlushTimer = null;
        }
        if (!this._lruBuffer || this._lruBuffer.size === 0) return;
        const pendingEntries = Array.from(this._lruBuffer.entries());
        this._lruBuffer.clear();

        const db = await this.getDB();
        return new Promise((resolve) => {
            const tx = db.transaction('manifest_cache', 'readwrite');
            const store = tx.objectStore('manifest_cache');
            const req = store.get('vfs_lru_index');
            req.onsuccess = () => {
                const indexMap = (req.result && typeof req.result === 'object') ? req.result : {};
                for (const [k, ts] of pendingEntries) {
                    if (ts === null) delete indexMap[k];
                    else indexMap[k] = ts;
                }
                store.put(indexMap, 'vfs_lru_index');
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    }

    static async getDB() {
        if (this._db) return this._db;
        if (this._dbPromise) return this._dbPromise;

        this._dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('vfs_cache')) {
                    db.createObjectStore('vfs_cache');
                }
                if (!db.objectStoreNames.contains('manifest_cache')) {
                    db.createObjectStore('manifest_cache');
                }
                if (!db.objectStoreNames.contains('sutram_outbox')) {
                    const store = db.createObjectStore('sutram_outbox', { autoIncrement: true });
                    store.createIndex('by_scope', 'scope_id');
                }
                if (!db.objectStoreNames.contains('dead_letter')) {
                    db.createObjectStore('dead_letter', { autoIncrement: true });
                }
            };
            req.onsuccess = () => {
                this._db = req.result;
                resolve(this._db);
            };
            req.onerror = () => {
                this._dbPromise = null;
                reject(req.error);
            };
        });
        return this._dbPromise;
    }
    static _normalizeCacheKey(scopeId, filepath) {
        const clean = String(filepath || '').replace(/([?&])t=\d+&?/, '$1').replace(/[?&]$/, '');
        return `${scopeId}::${clean}`;
    }
    static async cacheVFSBlob(scopeId, filepath, blob) {
        const db = await this.getDB();
        const key = this._normalizeCacheKey(scopeId, filepath);
        const now = Date.now();
        this._lruBuffer.set(key, now);
        this._scheduleLRUFlush();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('vfs_cache', 'readwrite');
            tx.objectStore('vfs_cache').put({ blob, ts: now }, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    static async deleteVFSBlob(scopeId, filepath) {
        const db = await this.getDB();
        const key = this._normalizeCacheKey(scopeId, filepath);
        this._lruBuffer.set(key, null);
        this._scheduleLRUFlush();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('vfs_cache', 'readwrite');
            tx.objectStore('vfs_cache').delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    static async evictByPrefix(scopeId, substringOrPrefix) {
        if (!substringOrPrefix) return 0;
        await this._flushLRUQueue();
        const db = await this.getDB();
        const scopePrefix = `${scopeId}::`;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['vfs_cache', 'manifest_cache'], 'readwrite');
            const store = tx.objectStore('vfs_cache');
            const manifestStore = tx.objectStore('manifest_cache');
            const idxReq = manifestStore.get('vfs_lru_index');
            idxReq.onsuccess = () => {
                const lruIndex = (idxReq.result && typeof idxReq.result === 'object') ? idxReq.result : {};
                let evictedCount = 0;
                const cursorReq = store.openKeyCursor();
                cursorReq.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        const k = String(cursor.key || '');
                        if (k.startsWith(scopePrefix) && k.includes(substringOrPrefix)) {
                            store.delete(cursor.key);
                            delete lruIndex[k];
                            this._lruBuffer.delete(k);
                            evictedCount++;
                        }
                        cursor.continue();
                    } else {
                        manifestStore.put(lruIndex, 'vfs_lru_index');
                        if (evictedCount > 0) {
                            emitOfflineTelemetry(`Evicted ${evictedCount} cached blob(s) matching '${substringOrPrefix}'`, 'warning', 'cache', { evictedCount, prefix: substringOrPrefix }, scopeId);
                        }
                        resolve(evictedCount);
                    }
                };
                cursorReq.onerror = () => reject(cursorReq.error);
            };
            idxReq.onerror = () => reject(idxReq.error);
        });
    }

    static _isTenantAgnosticUrl(filepath) {
        return Boolean(this._tenantAgnosticUrlPredicate(String(filepath || '')));
    }

    static async getVFSBlob(scopeId, filepath) {
        const db = await this.getDB();
        const primaryKey = this._normalizeCacheKey(scopeId, filepath);
        const fallbackKey = (scopeId !== 'default' && this._isTenantAgnosticUrl(filepath))
            ? this._normalizeCacheKey('default', filepath)
            : null;
        return new Promise((resolve) => {
            const tx = db.transaction('vfs_cache', 'readonly');
            const store = tx.objectStore('vfs_cache');
            const extractBlob = (keyUsed, data) => {
                if (!data) return null;
                if (data instanceof Blob) {
                    this._lruBuffer.set(keyUsed, Date.now());
                    this._scheduleLRUFlush();
                    return data;
                }
                if (data.blob) {
                    this._lruBuffer.set(keyUsed, Date.now());
                    this._scheduleLRUFlush();
                    return data.blob;
                }
                return null;
            };
            const req = store.get(primaryKey);
            req.onsuccess = () => {
                const found = extractBlob(primaryKey, req.result);
                if (found || !fallbackKey) {
                    return resolve(found);
                }
                const fbReq = store.get(fallbackKey);
                fbReq.onsuccess = () => resolve(extractBlob(fallbackKey, fbReq.result));
                fbReq.onerror = () => resolve(null);
            };
            req.onerror = () => resolve(null);
        });
    }

    static async pruneCache(targetBytesToFree) {
        await this._flushLRUQueue();
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['vfs_cache', 'manifest_cache'], 'readwrite');
            const store = tx.objectStore('vfs_cache');
            const manifestStore = tx.objectStore('manifest_cache');
            const idxReq = manifestStore.get('vfs_lru_index');

            idxReq.onsuccess = () => {
                const lruIndex = (idxReq.result && typeof idxReq.result === 'object') ? idxReq.result : {};
                const entries = [];
                const cursorReq = store.openCursor();

                cursorReq.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        const key = cursor.primaryKey;
                        const size = cursor.value instanceof Blob ? cursor.value.size : (cursor.value.blob ? cursor.value.blob.size : 0);
                        const baseTs = cursor.value instanceof Blob ? 0 : (cursor.value.ts || 0);
                        const ts = this._lruBuffer.get(key) || lruIndex[key] || baseTs;
                        entries.push({ key, size, ts });
                        cursor.continue();
                    } else {
                        // Sort by oldest access time (Least Recently Used)
                        entries.sort((a, b) => a.ts - b.ts);
                        let freed = 0;
                        for (const entry of entries) {
                            if (freed >= targetBytesToFree) break;
                            store.delete(entry.key);
                            delete lruIndex[entry.key];
                            this._lruBuffer.delete(entry.key);
                            freed += entry.size;
                        }
                        manifestStore.put(lruIndex, 'vfs_lru_index');
                        if (freed > 0) {
                            emitOfflineTelemetry(`Pruned ${Math.round(freed / 1024)} KB from LRU VFS cache`, 'warning', 'cache', { freedBytes: freed }, 'default');
                        }
                        resolve(freed);
                    }
                };
                cursorReq.onerror = () => reject(cursorReq.error);
            };
            idxReq.onerror = () => reject(idxReq.error);
        });
    }
    static async enqueueMutation(scopeId, path, method, headers, bodyString, collapseKey = null, cacheOverlay = null) {
        const db = await this.getDB();
        const now = Date.now();
        const hasBlobOverlay = Boolean(cacheOverlay && typeof cacheOverlay === 'object' && cacheOverlay.cacheBlobUrl && cacheOverlay.cacheBlobContent !== undefined);
        const hasDeleteOverlay = Boolean(cacheOverlay && typeof cacheOverlay === 'object' && Array.isArray(cacheOverlay.deletedCacheUrls) && cacheOverlay.deletedCacheUrls.length > 0);
        const pendingMutations = (cacheOverlay && Array.isArray(cacheOverlay.pendingMutations)) ? [...cacheOverlay.pendingMutations] : [];
        const deletedMutations = (cacheOverlay && Array.isArray(cacheOverlay.deletedMutations)) ? [...cacheOverlay.deletedMutations] : [];
        const needsVfsStore = hasBlobOverlay || hasDeleteOverlay;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(needsVfsStore ? ['sutram_outbox', 'vfs_cache'] : 'sutram_outbox', 'readwrite');
            const store = tx.objectStore('sutram_outbox');
            const vfsStore = needsVfsStore ? tx.objectStore('vfs_cache') : null;
            const record = {
                scope_id: scopeId,
                path,
                method,
                headers,
                bodyString,
                collapseKey,
                pendingMutations,
                deletedMutations,
                timestamp: now
            };

            // Atomic Read-Your-Writes Overlay: update or tombstone vfs_cache in the same transaction
            if (needsVfsStore && vfsStore) {
                if (hasBlobOverlay) {
                    const cacheKey = this._normalizeCacheKey(scopeId, cacheOverlay.cacheBlobUrl);
                    const blob = cacheOverlay.cacheBlobContent instanceof Blob
                        ? cacheOverlay.cacheBlobContent
                        : new Blob([String(cacheOverlay.cacheBlobContent)], { type: 'text/plain;charset=utf-8' });
                    vfsStore.put({ blob, ts: now }, cacheKey);
                    this._lruBuffer.set(cacheKey, now);
                    this._scheduleLRUFlush();
                }
                if (hasDeleteOverlay) {
                    cacheOverlay.deletedCacheUrls.forEach((delUrl) => {
                        if (!delUrl) return;
                        const delKey = this._normalizeCacheKey(scopeId, delUrl);
                        vfsStore.delete(delKey);
                        this._lruBuffer.set(delKey, null);
                    });
                    this._scheduleLRUFlush();
                }
            }

            if (collapseKey) {
                const index = store.index('by_scope');
                const req = index.openCursor(_idbOnly(scopeId));
                let updated = false;
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        if (cursor.value.collapseKey === collapseKey) {
                            try {
                                const prevPayload = JSON.parse(cursor.value.bodyString || '{}');
                                const nextPayload = JSON.parse(record.bodyString || '{}');
                                if (prevPayload.base_hash && !nextPayload._forceNewBase) {
                                    nextPayload.base_hash = prevPayload.base_hash;
                                }
                                if (prevPayload.base_content !== undefined && !nextPayload._forceNewBase) {
                                    nextPayload.base_content = prevPayload.base_content;
                                }
                                record.bodyString = JSON.stringify(nextPayload);
                            } catch (_) {}
                            const mergedPending = new Set([...(cursor.value.pendingMutations || []), ...pendingMutations]);
                            const mergedDeleted = new Set([...(cursor.value.deletedMutations || []), ...deletedMutations]);
                            record.pendingMutations = Array.from(mergedPending);
                            record.deletedMutations = Array.from(mergedDeleted);
                            cursor.update(record);
                            updated = true;
                        }
                        cursor.continue();
                    } else if (!updated) {
                        store.add(record);
                    }
                };
            } else {
                store.add(record);
            }

            tx.oncomplete = () => {
                emitOfflineTelemetry(`Queued offline mutation: [${method}] ${path}`, 'warning', 'outbox', { collapseKey, hasBlobOverlay, hasDeleteOverlay }, scopeId);
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }
    static async getOutboxCount(scopeId) {
        const db = await this.getDB();
        return new Promise((resolve) => {
            const req = db.transaction('sutram_outbox', 'readonly').objectStore('sutram_outbox').index('by_scope').count(_idbOnly(scopeId));
            req.onsuccess = () => resolve(req.result || 0);
            req.onerror = () => resolve(0);
        });
    }
    static async getCacheManifest(scopeId) {
        const db = await this.getDB();
        return new Promise((resolve) => {
            try {
                const req = db.transaction('vfs_cache', 'readonly').objectStore('vfs_cache').getAllKeys();
                req.onsuccess = () => {
                    const scopePrefix = `${scopeId}::`, defaultPrefix = 'default::';
                    const matches = (req.result || []).filter(k => typeof k === 'string' && (
                        k.startsWith(scopePrefix) || (scopeId !== 'default' && k.startsWith(defaultPrefix) && this._isTenantAgnosticUrl(k.slice(defaultPrefix.length)))
                    )).map(k => k.replace(/^(?:[^:]+)::/, ''));
                    resolve(Array.from(new Set(matches)));
                };
                req.onerror = () => resolve([]);
            } catch (_) { resolve([]); }
        });
    }
    static async getOutboxItems(scopeId) {
        try {
            const db = await this.getDB();
            return new Promise((resolve) => {
                const req = db.transaction('sutram_outbox', 'readonly').objectStore('sutram_outbox').index('by_scope').getAll(_idbOnly(scopeId));
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        } catch (_) { return []; }
    }
    static async getDeadLetters(scopeId) {
        try {
            const db = await this.getDB();
            return new Promise((resolve) => {
                const req = db.transaction('dead_letter', 'readonly').objectStore('dead_letter').openCursor();
                const items = [];
                req.onsuccess = (e) => {
                    const c = e.target.result;
                    if (c) {
                        if (c.value.scope_id === scopeId) items.push({ _key: c.primaryKey, ...c.value });
                        c.continue();
                    } else resolve(items);
                };
                req.onerror = () => resolve([]);
            });
        } catch (_) { return []; }
    }
    static async deleteDeadLetter(key) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('dead_letter', 'readwrite');
            tx.objectStore('dead_letter').delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    static async retryDeadLetter(item) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['dead_letter', 'sutram_outbox'], 'readwrite');
            const record = {
                scope_id: item.scope_id, path: item.path, method: item.method, headers: item.headers,
                bodyString: item.bodyString, collapseKey: item.collapseKey,
                pendingMutations: Array.isArray(item.pendingMutations) ? [...item.pendingMutations] : [],
                deletedMutations: Array.isArray(item.deletedMutations) ? [...item.deletedMutations] : [],
                timestamp: Date.now()
            };
            if (item.collapseKey) {
                const req = tx.objectStore('sutram_outbox').index('by_scope').openCursor(_idbOnly(item.scope_id));
                let updated = false;
                req.onsuccess = (e) => {
                    const c = e.target.result;
                    if (c) {
                        if (c.value.collapseKey === item.collapseKey) { c.update(record); updated = true; }
                        c.continue();
                    } else if (!updated) tx.objectStore('sutram_outbox').add(record);
                };
            } else {
                tx.objectStore('sutram_outbox').add(record);
            }
            tx.objectStore('dead_letter').delete(item._key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
}

export class OfflineHttpProvider {
    constructor(options = {}) {
        this.isOfflineCapable = options.isOfflineCapable || (() => true);
        this.shouldCacheGet = options.shouldCacheGet || (() => true);
        this.probeUrl = options.probeUrl || '/';
        this.probeMethod = options.probeMethod || 'HEAD';
        this.onEnqueue = options.onEnqueue || (() => {});
        this.onError = options.onOfflineError || (() => {});
        this.onCacheWrite = options.onCacheWrite || (() => {});
        this.checkOfflineState = options.checkOfflineState || (() => false);
        const rawSetOffline = options.setOfflineState || (() => {});
        this.setOfflineState = (val) => {
            const boolVal = Boolean(val);
            const prev = Boolean(this.checkOfflineState());
            rawSetOffline(boolVal);
            if (prev !== boolVal && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('sutram:offline-state-changed', {
                    detail: { isOffline: boolVal, timestamp: Date.now() }
                }));
                emitOfflineTelemetry(
                    boolVal ? 'Transitioned to Offline Mode' : 'Restored Online Mode',
                    boolVal ? 'warning' : 'success',
                    'network',
                    { isOffline: boolVal }
                );
            }
        };
    }

    async _verifyDaemonUnreachable() {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
        try {
            const sep = this.probeUrl.includes('?') ? '&' : '?';
            const probeOpts = {
                method: this.probeMethod,
                cache: 'no-store',
                signal: AbortSignal.timeout(1500)
            };
            if (this.probeMethod === 'POST') {
                probeOpts.headers = { 'Content-Type': 'application/json' };
                probeOpts.body = '{}';
            }
            const probe = await fetch(`${this.probeUrl}${sep}t=${Date.now()}`, probeOpts);
            return !probe || [502, 503, 504].includes(probe.status);
        } catch (_) {
            return true;
        }
    }

    async get(url, options = {}, scopeId = 'default') {
        const cacheKeyUrl = url.replace(/([?&])t=\d+&?/, '$1').replace(/[?&]$/, '');
        const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

        // 1. Background cache warming (onlyIfMissing) or hard browser offline state: check SutramDB first.
        // For interactive reads when navigator.onLine is true, ALWAYS try the network first so fresh files pull through!
        if (options.onlyIfMissing || (this.checkOfflineState() && browserOffline)) {
            const cachedBlob = await SutramDB.getVFSBlob(scopeId, cacheKeyUrl);
            if (cachedBlob) return new Response(cachedBlob, { status: 200 });
            if (options.onlyIfMissing && (this.checkOfflineState() || browserOffline)) {
                throw new TypeError("Failed to fetch (offline)");
            }
        }

        // Circuit Breaker: Abort background warming if cache is heavily loaded
        if (options.onlyIfMissing) {
            const offlineStore = window.Sutram?.storeRegistry?.get?.('Offline') || window.Sutram?.stores?.Offline;
            const offlineState = offlineStore?.getState?.() || {};
            const limitBytes = this.maxCacheBytes || (250 * 1024 * 1024);
            if (offlineState.storageUsage > limitBytes * 0.8) {
                return new Response(null, { status: 204, statusText: 'Cache Full Circuit Breaker' });
            }
        }
        try {
            const fetchOptions = { cache: 'no-store', ...options };
            const res = await fetch(url, fetchOptions);

            if ([502, 503, 504].includes(res.status)) {
                throw new TypeError(`Gateway unreachable (HTTP ${res.status})`);
            }

            if (res.ok && this.shouldCacheGet(cacheKeyUrl, scopeId)) {
                try {
                    const clone = res.clone();
                    const blob = await clone.blob();
                    await SutramDB.cacheVFSBlob(scopeId, cacheKeyUrl, blob);
                    this.onCacheWrite(cacheKeyUrl, blob.size);
                } catch (e) {}
            }
            return res;
        } catch (err) {
            if (err.name === 'AbortError' || err.name === 'TimeoutError') throw err;
            if (!options.onlyIfMissing) {
                const unreachable = await this._verifyDaemonUnreachable();
                if (unreachable) {
                    this.setOfflineState(true);
                }
            }
            const cachedBlob = await SutramDB.getVFSBlob(scopeId, cacheKeyUrl);
            if (cachedBlob) {
                emitOfflineTelemetry(`Served cached offline blob: ${cacheKeyUrl}`, 'info', 'cache', null, scopeId);
                return new Response(cachedBlob, { status: 200 });
            }
            throw err;
        }
    }

    async executeMutation(url, method, bodyString, options = {}, scopeId = 'default') {
        if (this.checkOfflineState() && (typeof navigator !== 'undefined' && navigator.onLine === false)) {
            return this._handleOfflineQueue(url, method, bodyString, options, scopeId, false);
        }

        try {
            const res = await fetch(url, options);
            if ([502, 503, 504].includes(res.status)) {
                throw new TypeError(`Gateway unreachable (HTTP ${res.status})`);
            }
            return res;
        } catch (err) {
            const isAbort = err.name === 'AbortError' || err.name === 'TimeoutError';
            if (isAbort) {
                throw err;
            }
            const serverUnreachable = await this._verifyDaemonUnreachable();
            if (!serverUnreachable) {
                throw err;
            }
            this.setOfflineState(true);
            return this._handleOfflineQueue(url, method, bodyString, options, scopeId, false);
        }
    }

    async _handleOfflineQueue(url, method, bodyString, options, scopeId, isAbort = false) {
        if (!this.isOfflineCapable(url, method, options)) {
            if (isAbort) throw new DOMException("Aborted", "AbortError");
            this.onError("Feature disabled or read-only while offline.", url);
            return new Response(JSON.stringify({ error: "Feature disabled while offline." }), { status: 503, statusText: "Service Unavailable" });
        }

        const isFormData = bodyString instanceof FormData;
        if (isFormData || (bodyString !== null && typeof bodyString !== 'string')) {
            this.onError("Payload must be stringified or FormData (which is unsupported offline).", url);
            return new Response(JSON.stringify({ error: "Invalid offline payload format." }), { status: 503, statusText: "Service Unavailable" });
        }
        try {
            const collapseKey = options.collapseKey || null;
            const headers = options.plainHeaders || {};
            const cacheOverlay = {
                cacheBlobUrl: options.cacheBlobUrl || null,
                cacheBlobContent: options.cacheBlobContent,
                deletedCacheUrls: options.deletedCacheUrls || [],
                pendingMutations: options.pendingMutations || [],
                deletedMutations: options.deletedMutations || []
            };
            await SutramDB.enqueueMutation(scopeId, url, method, headers, bodyString, collapseKey, cacheOverlay);
            const count = await SutramDB.getOutboxCount(scopeId);

            this.onEnqueue(count, bodyString, headers, url, method, scopeId, options);

            return new Response(JSON.stringify({ status: "accepted", job_id: "offline_queue", message: "Queued for offline sync." }), { status: 202 });
        } catch (e) {
            throw e;
        }
    }
}
export class NetworkHysteresisManager {
    constructor(pingUrl, threshold = 3) {
        this.pingUrl = pingUrl;
        this.threshold = threshold;
        this.isChecking = false;
    }

    async check(onRestored) {
        // Concurrency Guard: Prevent overlapping bursts if interval fires before execution finishes
        if (this.isChecking) return;
        this.isChecking = true;

        try {
            // Primary slow-polling ping with a strict 2s fail-fast timeout
            const url = this.pingUrl.replace('{t}', Date.now());
            const res = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(2000) });

            if (res.ok) {
                // First ping succeeded! Enter rapid verification burst.
                let successCount = 1;
                for (let i = 1; i < this.threshold; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const burstUrl = this.pingUrl.replace('{t}', Date.now());
                    try {
                        const burstRes = await fetch(burstUrl, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(2000) });
                        if (burstRes.ok) {
                            successCount++;
                        } else {
                            break; // Burst failed, revert to slow polling
                        }
                    } catch (e) {
                        break; // Network dropped or timed out during burst
                    }
                }

                if (successCount >= this.threshold) {
                    await onRestored();
                }
            }
        } catch (e) {
            // Network remains offline, continue slow polling
        } finally {
            this.isChecking = false;
        }
    }

    reset() {}
}
export class OutboxReconciler {
    static async drain(scopeId, executePost) {
        if (navigator.locks) {
            return navigator.locks.request('sutram_outbox_drain', { ifAvailable: true }, async (lock) => {
                if (!lock) return;
                await this._executeDrain(scopeId, executePost);
            });
        }
        return this._executeDrain(scopeId, executePost);
    }

    static async _executeDrain(scopeId, executePost) {
        const db = await SutramDB.getDB();

        // Stage 1: Read pending items into memory in a distinct transaction using an IDB cursor
        const pendingItems = await new Promise((resolve) => {
            try {
                const tx = db.transaction('sutram_outbox', 'readonly');
                const index = tx.objectStore('sutram_outbox').index('by_scope');
                const req = index.openCursor(_idbOnly(scopeId));
                const results = [];
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        results.push({ key: cursor.primaryKey, data: cursor.value });
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };
                req.onerror = () => resolve([]);
            } catch (e) {
                resolve([]);
            }
        });

        if (!pendingItems || pendingItems.length === 0) return;
        // Stage 2: Sequentially process network mutations and shift IDB keys
        for (const { key, data } of pendingItems) {
            const logger = (msg, type = 'info', details = null) => {
                emitOfflineTelemetry(msg, type, 'reconciler', details, data.scope_id || scopeId);
            };
            try {
                const fetchOptions = {
                    method: data.method,
                    headers: data.headers,
                    body: data.bodyString
                };
                const res = await executePost(data.path, fetchOptions, data.scope_id);
                if (res.ok || res.status === 202) {
                    logger(`Drained mutation [${data.method}] ${data.path}`, 'success');
                    let responseData = null;
                    try {
                        responseData = await res.clone().json();
                    } catch (_) {}
                    await new Promise((resolve) => {
                        const delTx = db.transaction('sutram_outbox', 'readwrite');
                        delTx.objectStore('sutram_outbox').delete(key);
                        delTx.oncomplete = () => resolve();
                    });
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('sutram-outbox-item-synced', {
                            detail: {
                                path: data.path,
                                scopeId: data.scope_id,
                                bodyString: data.bodyString,
                                responseData
                            }
                        }));
                    }
                } else if (res.status >= 400 && res.status < 500) {
                    logger(`Poison pill moved to DLQ (HTTP ${res.status}): [${data.method}] ${data.path}`, 'error', data.bodyString);
                    // Dead Letter Queue: Safely sideline poison pills so the queue doesn't halt
                    await new Promise((resolve) => {
                        const dlqTx = db.transaction(['sutram_outbox', 'dead_letter'], 'readwrite');
                        dlqTx.objectStore('dead_letter').add({ ...data, error_status: res.status, failed_at: Date.now() });
                        dlqTx.objectStore('sutram_outbox').delete(key);
                        dlqTx.oncomplete = () => resolve();
                    });
                } else {
                    // 5xx Server Error - Halt the queue to preserve chronological integrity
                    logger(`Server error (HTTP ${res.status}) on [${data.method}] ${data.path}. Halting queue.`, 'warning', data.bodyString);
                    break;
                }
            } catch (e) {
                logger(`Connection dropped mid-drain on [${data.method}] ${data.path}. Halting queue.`, 'warning');
                break; // Connection dropped mid-drain; abort processing and preserve remaining queue
            }
        }
    }
}

export async function purgeSutramCaches({ forceWhenOffline = false } = {}) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false && !forceWhenOffline) {
        console.warn('[Sutram Offline] Refusing to purge Service Worker & CacheStorage while offline.');
        return false;
    }
    if (typeof caches !== 'undefined') {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        } catch (e) {}
    }
    if ('serviceWorker' in navigator) {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) await reg.unregister();
        } catch (e) {}
    }
    return true;
}

function _isCacheableBuildResponse(res) {
    if (!res || res.status !== 200 || res.redirected) return false;
    if (res.type && res.type !== 'basic' && res.type !== 'default') return false;
    if (res.url && typeof window !== 'undefined' && window.location?.origin) {
        try { if (new URL(res.url, window.location.origin).origin !== window.location.origin) return false; } catch (_) { return false; }
    }
    return true;
}

export async function ensureSutramAppShellCached(options = {}) {
    if (typeof window === 'undefined' || typeof caches === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        return { complete: false, updated: false };
    }
    const {
        cacheVersion = 'v9',
        buildId = (typeof window !== 'undefined' && (window.SUTRAM_BUILD_ID || document?.querySelector?.('meta[name="sutram-build-id"]')?.content)) || null,
        buildIdHeader = 'X-Sutram-Build-ID',
        serverBuildIdUrl = null,
        staticPathPrefix = '/static/',
        excludePathPrefix = null,
        additionalAssets = [],
        onLog = null,
        onUpdateReady = null
    } = options;

    try {
        const rootRes = await fetch('/', { cache: 'no-cache', credentials: 'same-origin', headers: { 'X-Sutram-Revalidate': '1' } });
        if (!_isCacheableBuildResponse(rootRes)) return { complete: false, updated: false };

        let discoveredBuildId = null;
        if (serverBuildIdUrl) {
            try {
                const bRes = await fetch(serverBuildIdUrl, { cache: 'no-store', credentials: 'same-origin' });
                if (_isCacheableBuildResponse(bRes)) {
                    const bData = await bRes.json().catch(() => ({}));
                    if (bData?.build_id) discoveredBuildId = String(bData.build_id);
                }
            } catch (_) {}
        }

        const rootHtml = await rootRes.clone().text().catch(() => '');
        const metaMatch = rootHtml.match(/<meta\s+name=["'][^"']*build-id["']\s+content=["']([^"']+)["']/i);
        const headerBuildId = discoveredBuildId || rootRes.headers?.get?.(buildIdHeader) || rootRes.headers?.get?.('X-Sutram-Build-ID') || (metaMatch ? metaMatch[1] : null);
        const effectiveBuildId = headerBuildId || buildId || cacheVersion;
        const isNewerBuild = Boolean(buildId && headerBuildId && headerBuildId !== buildId);
        const targetCacheName = effectiveBuildId ? `sutram-build-${effectiveBuildId}` : `sutram-offline-${cacheVersion}`;

        const candidateUrls = new Set((typeof additionalAssets === 'function' ? additionalAssets() : additionalAssets) || []);
        if (typeof document !== 'undefined') {
            document.querySelectorAll('script[type="importmap"]').forEach(el => {
                try { Object.values(JSON.parse(el.textContent || '{}').imports || {}).forEach(u => { if (typeof u === 'string') candidateUrls.add(u); }); } catch (_) {}
            });
            document.querySelectorAll('link[rel="stylesheet"], link[rel="modulepreload"], script[src]').forEach(el => {
                const raw = el.getAttribute('href') || el.getAttribute('src');
                if (raw) candidateUrls.add(raw);
            });
        }
        if (typeof window.performance?.getEntriesByType === 'function') {
            window.performance.getEntriesByType('resource').forEach(r => {
                if (r.name && r.name.includes(staticPathPrefix) && (!excludePathPrefix || !r.name.includes(excludePathPrefix))) candidateUrls.add(r.name);
            });
        }

        const sameOriginPaths = [];
        candidateUrls.forEach(rawUrl => {
            if (!rawUrl) return;
            try {
                const u = new URL(rawUrl, window.location.origin);
                if (u.origin === window.location.origin && u.pathname !== '/recovery' && (!excludePathPrefix || !u.pathname.startsWith(excludePathPrefix))) {
                    sameOriginPaths.push(u.pathname);
                }
            } catch (_) {}
        });

        const uniquePaths = Array.from(new Set(sameOriginPaths));
        const cache = await caches.open(targetCacheName);
        await cache.put('/', rootRes.clone());
        await cache.put('/__sutram_app_shell__', rootRes.clone());

        let syncedCount = 0, failedCount = 0;
        await Promise.all(uniquePaths.map(async (pathname) => {
            if (pathname === '/') return;
            try {
                const res = await fetch(pathname, { cache: 'no-cache', priority: 'low', credentials: 'same-origin', headers: { 'X-Sutram-Revalidate': '1' } });
                if (_isCacheableBuildResponse(res)) { await cache.put(pathname, res.clone()); syncedCount++; }
                else failedCount++;
            } catch (_) { failedCount++; }
        }));

        if (failedCount === 0) {
            await cache.put('/__sutram_active_build__', new Response(targetCacheName, { status: 200 }));
            const meta = await caches.open('sutram-meta');
            if (isNewerBuild) {
                await meta.put('/__sutram_pending_build__', new Response(targetCacheName, { status: 200 }));
                if (syncedCount > 0 && onLog) onLog(`App Shell Vault [${effectiveBuildId}]: Staged ${syncedCount} boot module asset(s) for the next load.`, 'success');
                if (typeof onUpdateReady === 'function') onUpdateReady(effectiveBuildId, targetCacheName);
                return { complete: true, updated: true, buildId: effectiveBuildId, cacheName: targetCacheName };
            }
            await meta.put('/__sutram_active_build__', new Response(targetCacheName, { status: 200 }));
            if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'ACTIVATE_BUILD_CACHE', cacheName: targetCacheName, buildId: effectiveBuildId });
            }
            const allKeys = await caches.keys();
            await Promise.all(allKeys.filter(k => (k.startsWith('sutram-build-') || k.startsWith('sutram-offline-')) && k !== targetCacheName).map(k => caches.delete(k)));
            if (syncedCount > 0 && onLog) onLog(`App Shell Vault [${effectiveBuildId}]: Synced ${syncedCount} boot module asset(s).`, 'success');
            return { complete: true, updated: false, buildId: effectiveBuildId, cacheName: targetCacheName };
        }
        return { complete: false, updated: false, buildId: effectiveBuildId, cacheName: targetCacheName };
    } catch (_) { return { complete: false, updated: false }; }
}

export class SutramCacheWarmer {
    static _queue = [];
    static _isDraining = false;

    static get size() {
        return this._queue.length;
    }

    static enqueue(scopeId, urls = [], fetcher = null) {
        if (!Array.isArray(urls) || urls.length === 0) return;
        const existingKeys = new Set(this._queue.map(item => `${item.scopeId}::${item.url}`));
        urls.forEach((url) => {
            if (url && !existingKeys.has(`${scopeId}::${url}`)) {
                this._queue.push({ scopeId, url, fetcher });
                existingKeys.add(`${scopeId}::${url}`);
            }
        });
        this.drain();
    }

    static removeByPrefix(scopeId, urlPrefix) {
        if (!urlPrefix) return;
        this._queue = this._queue.filter(item => !(item.scopeId === scopeId && String(item.url || '').startsWith(urlPrefix)));
    }

    static clear() {
        this._queue = [];
    }

    static async drain(delayMs = 150) {
        if (this._isDraining) return;
        this._isDraining = true;
        try {
            while (this._queue.length > 0) {
                if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
                if (window.Sutram?.stores?.Environment?.getState?.()?.isOffline) break;
                const next = this._queue.shift();
                if (!next) continue;
                try {
                    if (typeof next.fetcher === 'function') {
                        await next.fetcher(next.url, next.scopeId);
                    } else {
                        await fetch(next.url, { priority: 'low', credentials: 'same-origin' });
                    }
                } catch (_) {}
                if (delayMs > 0 && this._queue.length > 0) {
                    await new Promise(r => setTimeout(r, delayMs));
                }
            }
        } finally {
            this._isDraining = false;
        }
    }
}

export function bootSutramServiceWorker(options = {}) {
    const {
        swUrl = '/sw.js',
        staticPathPrefix = '/static/',
        excludePathPrefix = null,
        additionalAssets = [],
        isReconciling = () => false,
        subscribeReconciling = null,
        onStatus = null,
        onLog = null,
        onError = null
    } = options;

    if (!('serviceWorker' in navigator)) {
        if (onError) {
            onError("Offline mode disabled: Service Workers require a secure context (HTTPS or localhost).");
        }
        return;
    }

    const hadControllerOnBoot = Boolean(navigator.serviceWorker.controller);

    const syncShellVault = () => {
        ensureSutramAppShellCached({
            staticPathPrefix,
            excludePathPrefix,
            additionalAssets,
            onLog
        }).catch(() => {});
    };

    const trackInstallingWorker = (worker) => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') {
                syncShellVault();
                if (hadControllerOnBoot) {
                    if (isReconciling()) {
                        console.log('New update deferred until outbox drains...');
                        window.addEventListener('sutram-sync-complete', () => {
                            worker.postMessage({ type: 'SKIP_WAITING' });
                            window.location.reload();
                        }, { once: true });
                    } else {
                        console.log('New update available. Refreshing...');
                        worker.postMessage({ type: 'SKIP_WAITING' });
                        window.location.reload();
                    }
                }
            } else if (worker.state === 'activated') {
                syncShellVault();
            }
        });
    };

    navigator.serviceWorker.register(swUrl).then(reg => {
        if (onStatus) onStatus("Service Worker Active", 3000);
        syncShellVault();

        if (reg.installing) {
            trackInstallingWorker(reg.installing);
        }

        reg.addEventListener('updatefound', () => {
            trackInstallingWorker(reg.installing);
        });

        if (typeof subscribeReconciling === 'function') {
            subscribeReconciling((isRec) => {
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'SET_RECONCILING', value: isRec });
                }
            });
        }
    }).catch(err => {
        if (onError) onError("SW Registration Failed: " + err.message);
    });
}

