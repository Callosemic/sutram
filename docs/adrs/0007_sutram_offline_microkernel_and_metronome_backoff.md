# 7. Sutram Offline Micro-Kernel, Outbox Reconciliation, and Metronome Visibility Backoff

* **Status:** Accepted
* **Date:** 2026-09-04
* **Context:** Operating Sutram applications on mobile devices and air-gapped environments requires transparent offline mutation queuing, outbox reconciliation, service worker fallback caching, and battery-friendly metronome execution.

## Decision
1. **Offline Persistence & Outbox Reconciler (`offline.js` & `sw-core.js`):** Implement `SutramDB` using IndexedDB to manage `vfs_cache`, `manifest_cache`, `sutram_outbox`, and `dead_letter` stores. Route network mutations through `OfflineHttpProvider` when `EnvironmentStore.isOffline` is active. Process queued mutations sequentially via `OutboxReconciler.drain()`, automatically isolating 4xx client errors into the Dead Letter Queue (`dead_letter`) to prevent queue blockage.
2. **Declarative Offline Visual Degradation (`app_shell.js` & `primitives.js`):** `SutramAppShell` automatically filters primary and sub-navigation tabs during offline mode based on `offline_mode` declarations in extension manifests. `SutramAsyncBtn` subscribes to `EnvironmentStore` and renders `🚫 Offline` in read-only states when offline.
3. **Metronome Visibility Backoff (`sdk.js`):** `ExtensionRegistry.startMetronome()` replaces unconditional `setInterval` polling with a `setTimeout` loop observing `document.hidden` via the Visibility API. The tick interval backs off from 100 ms to 60,000 ms when the application is backgrounded, instantly waking upon tab refocus.

## Consequences
* **Positives:** Deterministic offline mutation durability, poison-pill resistance via DLQ isolation, transparent UI degradation, and significant mobile battery savings.
* **Negatives:** Requires extension manifests to explicitly declare `offline_mode` properties for granular offline routing.