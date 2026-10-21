// sutram/js/offline.js
// Phase 1: Sutram Offline Micro-Kernel
const DB_NAME = 'sutram_offline_db';
const DB_VERSION = 4;
export class SutramDB {
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
        return new Promise((resolve, reject) => {
            const tx = db.transaction('vfs_cache', 'readwrite');
            tx.objectStore('vfs_cache').put({ blob, ts: Date.now() }, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    static async deleteVFSBlob(scopeId, filepath) {
        const db = await this.getDB();
        const key = this._normalizeCacheKey(scopeId, filepath);
        return new Promise((resolve, reject) => {
            const tx = db.transaction('vfs_cache', 'readwrite');
            tx.objectStore('vfs_cache').delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    static async getVFSBlob(scopeId, filepath) {
        const db = await this.getDB();
        const key = this._normalizeCacheKey(scopeId, filepath);
        return new Promise((resolve) => {
            const tx = db.transaction('vfs_cache', 'readwrite');
            const req = tx.objectStore('vfs_cache').get(key);
            req.onsuccess = () => {
                const data = req.result;
                if (!data) return resolve(null);

                // Backwards compatibility for legacy pure blobs
                if (data instanceof Blob) {
                    resolve(data);
                } else if (data.blob) {
                    // Update access timestamp for true LRU execution
                    data.ts = Date.now();
                    tx.objectStore('vfs_cache').put(data, key);
                    resolve(data.blob);
                } else {
                    resolve(null);
                }
            };
            req.onerror = () => resolve(null);
        });
    }

    static async pruneCache(targetBytesToFree) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('vfs_cache', 'readwrite');
            const store = tx.objectStore('vfs_cache');

            let entries = [];
            const cursorReq = store.openCursor();

            cursorReq.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const size = cursor.value instanceof Blob ? cursor.value.size : (cursor.value.blob ? cursor.value.blob.size : 0);
                    const ts = cursor.value instanceof Blob ? 0 : (cursor.value.ts || 0);
                    entries.push({ key: cursor.primaryKey, size, ts });
                    cursor.continue();
                } else {
                    // Sort by oldest access time (Least Recently Used)
                    entries.sort((a, b) => a.ts - b.ts);
                    let freed = 0;
                    for (const entry of entries) {
                        if (freed >= targetBytesToFree) break;
                        store.delete(entry.key);
                        freed += entry.size;
                    }
                    resolve(freed);
                }
            };
            cursorReq.onerror = () => reject(cursorReq.error);
        });
    }
    static async enqueueMutation(scopeId, path, method, headers, bodyString, collapseKey = null) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('sutram_outbox', 'readwrite');
            const store = tx.objectStore('sutram_outbox');
            const record = {
                scope_id: scopeId,
                path,
                method,
                headers,
                bodyString,
                collapseKey,
                timestamp: Date.now()
            };

            if (collapseKey) {
                const index = store.index('by_scope');
                const req = index.openCursor(IDBKeyRange.only(scopeId));
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

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    static async getOutboxCount(scopeId) {
        const db = await this.getDB();
        return new Promise((resolve) => {
            const tx = db.transaction('sutram_outbox', 'readonly');
            const index = tx.objectStore('sutram_outbox').index('by_scope');
            const req = index.count(IDBKeyRange.only(scopeId));
            req.onsuccess = () => resolve(req.result || 0);
            req.onerror = () => resolve(0);
        });
    }
    static async getCacheManifest(scopeId) {
        const db = await this.getDB();
        return new Promise((resolve) => {
            try {
                const tx = db.transaction('vfs_cache', 'readonly');
                const req = tx.objectStore('vfs_cache').getAllKeys();
                req.onsuccess = () => {
                    const keys = req.result || [];
                    const scopePrefix = `${scopeId}::`;
                    const defaultPrefix = 'default::';
                    const matches = keys
                        .filter(k => typeof k === 'string' && (k.startsWith(scopePrefix) || k.startsWith(defaultPrefix)))
                        .map(k => k.replace(/^(?:[^:]+)::/, ''));
                    resolve(matches);
                };
                req.onerror = () => resolve([]);
            } catch (e) {
                console.error("Failed to read vfs_cache keys:", e);
                resolve([]);
            }
        });
    }

    static async getOutboxItems(scopeId) {
        try {
            const db = await this.getDB();
            return new Promise((resolve) => {
                const tx = db.transaction('sutram_outbox', 'readonly');
                const index = tx.objectStore('sutram_outbox').index('by_scope');
                const req = index.getAll(IDBKeyRange.only(scopeId));
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        } catch (e) {
            return [];
        }
    }
    static async getDeadLetters(scopeId) {
        try {
            const db = await this.getDB();
            return new Promise((resolve) => {
                const tx = db.transaction('dead_letter', 'readonly');
                const req = tx.objectStore('dead_letter').openCursor();
                const items = [];
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        if (cursor.value.scope_id === scopeId) {
                            items.push({ _key: cursor.primaryKey, ...cursor.value });
                        }
                        cursor.continue();
                    } else {
                        resolve(items);
                    }
                };
                req.onerror = () => resolve([]);
            });
        } catch (e) {
            return [];
        }
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

            // Reconstruct the outbox envelope
            const record = {
                scope_id: item.scope_id,
                path: item.path,
                method: item.method,
                headers: item.headers,
                bodyString: item.bodyString,
                collapseKey: item.collapseKey,
                timestamp: Date.now() // Fresh timestamp for the retry
            };

            if (item.collapseKey) {
                const index = tx.objectStore('sutram_outbox').index('by_scope');
                const req = index.openCursor(IDBKeyRange.only(item.scope_id));
                let updated = false;

                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        if (cursor.value.collapseKey === item.collapseKey) {
                            cursor.update(record);
                            updated = true;
                        }
                        cursor.continue();
                    } else if (!updated) {
                        tx.objectStore('sutram_outbox').add(record);
                    }
                };
            } else {
                tx.objectStore('sutram_outbox').add(record);
            }

            // Remove it from the DLQ
            tx.objectStore('dead_letter').delete(item._key);

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
}

export class OfflineHttpProvider {
    constructor(options = {}) {
        this.isOfflineCapable = options.isOfflineCapable || (() => true);
        this.onEnqueue = options.onEnqueue || (() => {});
        this.onError = options.onOfflineError || (() => {});
        this.onCacheWrite = options.onCacheWrite || (() => {});
        this.checkOfflineState = options.checkOfflineState || (() => false);
        this.setOfflineState = options.setOfflineState || (() => {});
    }
    async get(url, options = {}, scopeId = 'default') {
        const cacheKeyUrl = url.replace(/([?&])t=\d+&?/, '$1').replace(/[?&]$/, '');

        if (this.checkOfflineState() || options.onlyIfMissing) {
            const cachedBlob = await SutramDB.getVFSBlob(scopeId, cacheKeyUrl);
            if (cachedBlob) return new Response(cachedBlob, { status: 200 });
            if (options.onlyIfMissing && this.checkOfflineState()) {
                throw new TypeError("Failed to fetch (offline)");
            }
        }

        // Circuit Breaker: Abort background warming if cache is heavily loaded
        if (options.onlyIfMissing) {
            const offlineState = window.Sutram?.stores?.Offline?.getState() || {};
            const limitBytes = 250 * 1024 * 1024; // Align with core schema setting
            if (offlineState.storageUsage > limitBytes * 0.8) {
                return new Response(null, { status: 204, statusText: 'Cache Full Circuit Breaker' });
            }
        }
        try {
            const res = await fetch(url, options);
            if (!this.checkOfflineState() && res.ok && !cacheKeyUrl.includes('/deltas') && !cacheKeyUrl.includes('/jobs/')) {
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
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    this.setOfflineState(true);
                } else {
                    try {
                        const probe = await fetch('/?t=' + Date.now(), { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(1500) });
                        if (!probe.ok) this.setOfflineState(true);
                    } catch (_) {
                        this.setOfflineState(true);
                    }
                }
            }
            const cachedBlob = await SutramDB.getVFSBlob(scopeId, cacheKeyUrl);
            if (cachedBlob) return new Response(cachedBlob, { status: 200 });
            throw err;
        }
    }
    async executeMutation(url, method, bodyString, options = {}, scopeId = 'default') {
        if (this.checkOfflineState()) {
            return this._handleOfflineQueue(url, method, bodyString, options, scopeId, false);
        }

        try {
            return await fetch(url, options);
        } catch (err) {
            const isAbort = err.name === 'AbortError' || err.name === 'TimeoutError';
            if (isAbort) {
                throw err;
            }
            let serverUnreachable = (typeof navigator !== 'undefined' && navigator.onLine === false);
            if (!serverUnreachable) {
                try {
                    const probe = await fetch('/?t=' + Date.now(), { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(1500) });
                    if (!probe.ok) serverUnreachable = true;
                } catch (_) {
                    serverUnreachable = true;
                }
            }
            if (!serverUnreachable) {
                throw err;
            }
            this.setOfflineState(true);
            return this._handleOfflineQueue(url, method, bodyString, options, scopeId, false);
        }
    }

    async _handleOfflineQueue(url, method, bodyString, options, scopeId, isAbort = false) {
        if (!this.isOfflineCapable(url) || (isAbort && url.includes('/search'))) {
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
            await SutramDB.enqueueMutation(scopeId, url, method, headers, bodyString, collapseKey);
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
                const req = index.openCursor(IDBKeyRange.only(scopeId));
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
            const logger = window.Sutram?.offlineLog || (() => {});
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

export async function purgeSutramCaches() {
    if ('caches' in window) {
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
}

export function bootSutramServiceWorker(options = {}) {
    const {
        swUrl = '/sw.js',
        staticPathPrefix = '/static/',
        excludePathPrefix = '/api/',
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
    let isFirstInstall = !hadControllerOnBoot;
    let reloadScheduled = false;

    const warmDynamicBootAssets = () => {
        try {
            const resources = window.performance.getEntriesByType('resource');
            const urlsToCache = resources
                .filter(r => r.name.includes(staticPathPrefix) && (!excludePathPrefix || !r.name.includes(excludePathPrefix)))
                .map(r => r.name);

            urlsToCache.forEach(url => fetch(url, { priority: 'low' }).catch(() => {}));
            if (onLog) {
                onLog(`First install: Warmed SW cache with ${urlsToCache.length} dynamic boot assets.`, 'success');
            }
        } catch (e) {}
    };

    const scheduleFirstInstallReload = () => {
        if (reloadScheduled) return;
        reloadScheduled = true;
        warmDynamicBootAssets();
        console.log('SW installed for the first time. Hydrating dynamic module cache...');
        setTimeout(() => window.location.reload(), 500);
    };

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (isFirstInstall) {
            isFirstInstall = false;
            scheduleFirstInstallReload();
        }
    });

    const trackInstallingWorker = (worker) => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') {
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
                } else {
                    scheduleFirstInstallReload();
                }
            }
        });
    };

    navigator.serviceWorker.register(swUrl).then(reg => {
        if (onStatus) onStatus("Service Worker Active", 3000);

        if (reg.installing) {
            trackInstallingWorker(reg.installing);
        } else if (!hadControllerOnBoot && (reg.waiting || reg.active)) {
            scheduleFirstInstallReload();
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