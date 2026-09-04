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

    static async cacheVFSBlob(scopeId, filepath, blob) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('vfs_cache', 'readwrite');
            tx.objectStore('vfs_cache').put(blob, `${scopeId}::${filepath}`);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    static async getVFSBlob(scopeId, filepath) {
        const db = await this.getDB();
        return new Promise((resolve) => {
            const tx = db.transaction('vfs_cache', 'readonly');
            const req = tx.objectStore('vfs_cache').get(`${scopeId}::${filepath}`);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    }

    static async enqueueMutation(scopeId, path, method, payload) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('sutram_outbox', 'readwrite');
            const record = {
                scope_id: scopeId,
                path,
                method,
                payload,
                timestamp: Date.now()
            };
            const req = tx.objectStore('sutram_outbox').add(record);
            tx.oncomplete = () => resolve(req.result);
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
                const req = tx.objectStore('dead_letter').getAll();
                req.onsuccess = () => {
                    const items = req.result || [];
                    resolve(items.filter(i => i.scope_id === scopeId));
                };
                req.onerror = () => resolve([]);
            });
        } catch (e) {
            return [];
        }
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

        if (this.checkOfflineState()) {
            const cachedBlob = await SutramDB.getVFSBlob(scopeId, cacheKeyUrl);
            if (cachedBlob) return new Response(cachedBlob, { status: 200 });
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
            this.setOfflineState(true);
            const cachedBlob = await SutramDB.getVFSBlob(scopeId, cacheKeyUrl);
            if (cachedBlob) return new Response(cachedBlob, { status: 200 });
            throw err;
        }
    }

    async executeMutation(url, method, payload, options = {}, scopeId = 'default') {
        if (this.checkOfflineState()) {
            return this._handleOfflineQueue(url, method, payload, scopeId);
        }

        try {
            return await fetch(url, options);
        } catch (err) {
            this.setOfflineState(true);
            return this._handleOfflineQueue(url, method, payload, scopeId);
        }
    }

    async _handleOfflineQueue(url, method, payload, scopeId) {
        if (!this.isOfflineCapable(url)) {
            this.onError("Feature disabled or read-only while offline.", url);
            return new Response(JSON.stringify({ error: "Feature disabled while offline." }), { status: 503, statusText: "Service Unavailable" });
        }

        const isFormData = payload instanceof FormData;
        if (isFormData || url.includes('fs/upload')) {
            this.onError("Binary uploads not supported offline.", url);
            return new Response(JSON.stringify({ error: "Binary uploads not supported offline." }), { status: 503, statusText: "Service Unavailable" });
        }

        try {
            if (url.includes('fs/save') && payload.filepath && payload.content) {
                const fetchUrl = `/api/${scopeId}/fs/fetch?file=${encodeURIComponent(payload.filepath)}`;
                await SutramDB.cacheVFSBlob(scopeId, fetchUrl, new Blob([payload.content], { type: 'text/plain;charset=utf-8' })).catch(()=>{});
            }

            await SutramDB.enqueueMutation(scopeId, url, method, payload);
            const count = await SutramDB.getOutboxCount(scopeId);

            this.onEnqueue(count, payload, url, method, scopeId);

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
        this.consecutivePings = 0;
    }

    async check(onRestored) {
        try {
            const url = this.pingUrl.replace('{t}', Date.now());
            const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
            if (res.ok) {
                this.consecutivePings++;
                if (this.consecutivePings >= this.threshold) {
                    this.consecutivePings = 0;
                    await onRestored();
                }
            } else {
                this.consecutivePings = 0;
            }
        } catch (e) {
            this.consecutivePings = 0;
        }
    }

    reset() {
        this.consecutivePings = 0;
    }
}
export class OutboxReconciler {
    static async drain(scopeId, executePost) {
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
            try {
                const res = await executePost(data.path, data.method, data.payload, data.scope_id);
                if (res.ok || res.status === 202) {
                    window.inSetu?.offlineLog?.(`Drained mutation [${data.method}] ${data.path}`, 'success');
                    await new Promise((resolve) => {
                        const delTx = db.transaction('sutram_outbox', 'readwrite');
                        delTx.objectStore('sutram_outbox').delete(key);
                        delTx.oncomplete = () => resolve();
                    });
                } else if (res.status >= 400 && res.status < 500) {
                    window.inSetu?.offlineLog?.(`Poison pill moved to DLQ (HTTP ${res.status}): [${data.method}] ${data.path}`, 'error', data.payload);
                    // Dead Letter Queue: Safely sideline poison pills so the queue doesn't halt
                    await new Promise((resolve) => {
                        const dlqTx = db.transaction(['sutram_outbox', 'dead_letter'], 'readwrite');
                        dlqTx.objectStore('dead_letter').add({ ...data, error_status: res.status, failed_at: Date.now() });
                        dlqTx.objectStore('sutram_outbox').delete(key);
                        dlqTx.oncomplete = () => resolve();
                    });
                } else {
                    // 5xx Server Error - Halt the queue to preserve chronological integrity
                    window.inSetu?.offlineLog?.(`Server error (HTTP ${res.status}) on [${data.method}] ${data.path}. Halting queue.`, 'warning', data.payload);
                    break;
                }
            } catch (e) {
                window.inSetu?.offlineLog?.(`Connection dropped mid-drain on [${data.method}] ${data.path}. Halting queue.`, 'warning');
                break; // Connection dropped mid-drain; abort processing and preserve remaining queue
            }
        }
    }
}