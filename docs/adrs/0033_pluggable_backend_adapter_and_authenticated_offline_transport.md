# ADR-0033: Pluggable Backend Adapter Contract, Akasa Reference Adapter, and Adapter-Routed Offline Transport

* **Status:** Accepted
* **Date:** 2026-11-18
* **Scope:** `sutram/js/client.js`, `sutram/js/offline.js`, `sutram/js/index.js`, `tests/unit/test_sutram_registry.py`

## Context

Previously, `sutram/js/offline.js` (`OfflineHttpProvider`, `NetworkHysteresisManager`, `ensureSutramAppShellCached`, and `SutramCacheWarmer`) issued direct, unauthenticated `fetch()` calls, while authentication headers, build-ID sniffing, 401 re-authentication, scoped URL resolution, and SSE stream wiring were left to ad-hoc host wrappers. On authenticated or reverse-proxied deployments, those background sweeps, health probes, and replays went out without the host's token and outside its build-mismatch hooks.

## Decision

1. **Pluggable Backend Adapter Contract (`sutram/js/client.js`)**:
   - Standardize `REQUIRED_BACKEND_ADAPTER_METHODS` (`bootstrap`, `fetchRaw`, `request`, `resolveScopedUrl`, `probeHealth`, `getBuildId`, `pollJob`, `connectStream`) and enforce contract compliance at registration via `validateBackendAdapter(adapter)`.
   - Provide `BackendAdapterRegistry` (`registerBackendAdapter`, `getBackendAdapter`) and a minimal base class `SutramBackendAdapter`.
2. **Akasa Reference Adapter (`AkasaBackendAdapter`)**:
   - Implement token storage persistence (`sessionStorage`/`localStorage`), header injection (`tokenHeader`, `tokenAliasHeader`, `scopeHeader`), single-flight `bootstrap()` with automatic 401 retry, passive `X-Akasa-Build-ID` / `X-Sutram-Build-ID` sniffing with `onBuildMismatch` callbacks, per-scope `AbortController` signals, `OfflineHttpProvider` delegation, scope-guarded `pollJob()`, and `EventSource` `connectStream()`.
3. **Adapter-Routed Offline Transport & Bounded App-Shell Sync (`sutram/js/offline.js`)**:
   - Route `OfflineHttpProvider`, `NetworkHysteresisManager`, `ensureSutramAppShellCached`, and `SutramCacheWarmer` through `getBackendAdapter()` when registered.
   - Deduplicate concurrent `ensureSutramAppShellCached` calls (`_shellSyncInFlight`), memoize settled builds (`_shellSettled`), bound asset revalidation concurrency (`concurrency = 4`), support `If-None-Match` ETag `304` responses, and defer initial Service Worker shell sweeps via `shellSyncDelayMs`.

## Consequences

### Positive
- When an adapter is registered, offline caching, health checks, cache warming and app-shell staging send their requests through it (`_netFetch`, `_pingOnce`, `_syncAppShell`'s `netFetch`, `SutramCacheWarmer.drain`). Without one, each falls back to a bare `fetch()`; those four fallback sites remain.
- Gives host applications a single, validated IoC seam (`registerBackendAdapter`) for auth, build-ID tracking, and streaming.
- Prevents connection starvation during boot via bounded revalidation concurrency and deferred shell sync.

### Negative / Trade-offs
- Hosts requiring authenticated transport must register their adapter before invoking `bootSutramServiceWorker` or `SutramCacheWarmer`.
