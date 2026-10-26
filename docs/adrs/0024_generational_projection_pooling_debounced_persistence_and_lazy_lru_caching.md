# ADR-0024: Generational Projection Pooling, Debounced Store Persistence, and Lazy LRU Cache Buffering

* **Status:** Accepted
* **Date:** 2026-10-26
* **Scope:** `sutram/js/projection_engine.js`, `sutram/js/app_shell.js`, `sutram/js/sutram_sdk.js`, `sutram/js/offline.js`, `sutram/js/utils.js`

## Context

As the Sutram micro-kernel scaled to accommodate high-density multi-column spatial views and continuous offline file operations, three runtime bottlenecks emerged:
1. **Ad-Hoc DOM Element Retention**: Dynamic projection nodes were previously managed through an informal `Map` inside `<sutram-app-shell>`. Without a generational pass contract, elements that were closed or unpinned could linger in memory unless explicitly evicted by custom events.
2. **Synchronous Storage Serialization Stalls**: Stores created via `createSutramStore` serialized their subscribed keys to `localStorage` and `sessionStorage` synchronously on every state mutation. Rapid mutations (such as slider drags or typing) caused main-thread I/O micro-stutters.
3. **IndexedDB Readwrite Lock Contention**: `SutramDB.getVFSBlob` previously opened a `readwrite` IndexedDB transaction on every blob retrieval simply to update the access timestamp (`ts`) for LRU tracking. This blocked concurrent reads and added significant overhead to file viewing.
4. **Worker Message Overhead on Small Datasets**: Dispatching trivial fuzzy search queries (< 500 items) to Web Workers incurred structured clone serialization overhead that exceeded the cost of main-thread execution.

## Decision

1. **Generational Mark-and-Sweep Projection Pool (`SutramProjectionPool`)**:
   * Implement a modular `SutramProjectionPool` in `sutram/js/projection_engine.js`.
   * Projection compilation and rendering cycles must invoke `beginPass()` prior to element resolution, resolve elements via `resolve(componentTag, subId, props)`, and finalize the cycle via `commitPass()`.
   * Unreferenced DOM nodes are swept from the pool during `commitPass()`, while rekeyed projections preserve their underlying element instances via `pool.rekey(oldId, newId)`.
2. **Debounced Store Persistence & Flush Barriers**:
   * In `createSutramStore`, debounce `localStorage` and `sessionStorage` commitments by 250ms with dirty key tracking (`dirtyLocalKeys`, `dirtySessionKeys`).
   * Provide `store.flushPersistence()` and `StoreRegistry.flushAll()`. Invoke synchronous flush barriers during `switchTenantScope()`, `store.switchScope()`, and document `pagehide`.
3. **Non-Blocking Readonly VFS Reads & Lazy LRU Buffering**:
   * Change `SutramDB.getVFSBlob` to open `readonly` transactions exclusively.
   * Buffer LRU access timestamps in an in-memory `_lruBuffer` (`Map`), lazily flushing changes into `manifest_cache` under `vfs_lru_index` via `requestIdleCallback`.
   * Ensure `SutramDB.pruneCache` flushes pending in-memory timestamps before calculating eviction candidates.
4. **Worker Broker Synchronous Fast-Path**:
   * In `SutramWorkerBroker.prototype.dispatch`, evaluate the dataset size for `FUZZY_SEARCH`. Items arrays with length under 500 execute synchronously on the main thread via `fuzzyFilterObjects`.

## Consequences

### Positive
* Projection lifecycle memory is strictly bounded by active render passes without manual pool tracking.
* High-frequency store mutations execute without synchronous storage serialization overhead.
* VFS blob retrieval latency is decoupled from IndexedDB write transactions.
* Small fuzzy search operations return instantly without worker IPC latency.

### Negative / Trade-offs
* `requestIdleCallback` deferral means sudden power loss or process termination could lose recent LRU access timestamps (mitigated by fallback timestamp preservation on stored blobs).