# ADR-0031: Offline App Shell Vault, Atomic Read-Your-Writes Cache Overlays, Functional Store Initializers, User Column Capacity, and Editor Markdown Link Widgets

* **Status:** Accepted
* **Date:** 2026-11-08
* **Scope:** `sutram/js/offline.js`, `sutram/js/sw-core.js`, `sutram/js/sutram_sdk.js`, `sutram/js/app_shell.js`, `sutram/js/primitives.js`, `yenvui/js/editor.js`

## Context

As Sutram and yenVUI deployments scaled across reverse-proxied development environments (such as Tailscale Serve) and multi-tenant workspaces, four architectural challenges surfaced:
1. **Service Worker Stale-Lock & Bad Gateway Failures:** Cache-first serving on remote hosts served stale JS/HTML bundles during active development, while stopped local daemons behind reverse proxies returned HTTP `502`/`503`/`504` responses that bypassed `fetch()` catch blocks and broke offline fallback. Additionally, first-install Service Worker registration triggered an artificial `window.location.reload()`.
2. **Offline Read-Your-Writes Divergence:** Queuing mutations in `sutram_outbox` was decoupled from `vfs_cache` updates and deletions, allowing subsequent offline reads to return stale pre-mutation file blobs or deleted entries.
3. **Store Initialization TDZ & Viewport Capacity Overwrites:** Stores referencing their own symbol inside initializers or `schema.urlParser` risked Temporal Dead Zone (TDZ) errors during synchronous hydration, and `LayoutStore.capacity` was unconditionally overwritten by `maxCapacity` on window resize, discarding user-selected 1- or 2-column preferences on wide monitors.
4. **Markdown Link Ergonomics in CodeMirror:** Navigating Markdown links inside `<yenvui-editor>` required manual URL copying because editors lacked inline clickable link widgets and `Ctrl`/`Cmd`-click event routing.

## Decision

1. **Network-First Service Worker, App Shell Vault (`/__sutram_app_shell__`), & Gateway Resilience (`sw-core.js`, `offline.js`)**:
   - Transition `sw-core.js` and online `OfflineHttpProvider.get` to network-first revalidation (`cache: 'no-cache'` / `'no-store'`), falling back to cached responses on network errors or HTTP `502`/`503`/`504` gateway errors.
   - Automatically parse `<script type="importmap">`, `<script src>`, and `<link href>` from `/` HTML responses in both `sw-core.js` and `ensureSutramAppShellCached()`, caching discovered same-origin module assets and storing the root document under `/__sutram_app_shell__`.
   - Remove the disruptive first-install `window.location.reload()` from `bootSutramServiceWorker()` and add `SutramCacheWarmer` for low-priority background warming.
2. **Atomic Outbox Cache Overlays, Prefix Eviction, & Offline Telemetry (`offline.js`)**:
   - Extend `SutramDB.enqueueMutation` with `cacheOverlay` (`{ cacheBlobUrl, cacheBlobContent, deletedCacheUrls }`), updating or tombstoning `vfs_cache` atomically within the same `readwrite` transaction as `sutram_outbox`.
   - Add `SutramDB.evictByPrefix(scopeId, substringOrPrefix)`, `SutramDB.configure({ isTenantAgnosticUrl })` with `default::` fallback lookup, and structured `sutram:offline-telemetry` / `sutram:offline-state-changed` event emissions.
3. **Functional Store Initializers, TDZ-Safe `urlParser`, & `userCapacity` Clamping (`sutram_sdk.js`, `app_shell.js`)**:
   - Allow `createSutramStore` to accept `(set, get, store) => state` and pass `(hash, hydratedState)` to `schema.urlParser`.
   - Introduce `userCapacity` and `setUserCapacity(cap)` in `LayoutStore`, clamping effective `capacity` to `Math.min(userCapacity, maxCapacity)` across viewport resizes and scope transitions.
4. **Viewport-Scoped Markdown Link Widgets (`yenvui/js/editor.js`, `sutram/js/primitives.js`)**:
   - Add `enableMarkdownLinks` (default `true`) and `mdLinksConf` compartment to `<yenvui-editor>`, rendering `.cm-md-link-widget` (`↗`) decorations and handling `Ctrl`/`Cmd`-clicks outside code contexts to emit `yenvui-editor-link-clicked` (bridged to `editor-link-clicked` on `<sutram-editor>`).

## Consequences

### Positive
- Seamless offline survival across stopped daemons and reverse proxies without stale-cache lock-in or first-install reload flicker.
- Deterministic read-your-own-writes consistency for offline saves and deletions.
- Zero TDZ hazards during store initialization and persistent user column-count preferences across window resizes.
- Single-click and `Ctrl`/`Cmd`-click Markdown link navigation in editors with full host routing autonomy.

### Negative / Trade-offs
- Network-first Service Worker fetches incur one network round-trip when online before serving cached assets on failure.
