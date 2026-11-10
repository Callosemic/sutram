# ADR-0032: Versioned Build Staging, Navigation-Gated Cutover, Captive-Portal Defense, and Zero-Dependency ESM Test Loader

* **Status:** Accepted
* **Date:** 2026-11-10
* **Scope:** `sutram/js/offline.js`, `sutram/js/sw-core.js`, `sutram/js/inputs.js`, `tests/unit/js_loader.mjs`, `tests/unit/test_sutram_registry.py`, `tests/fitness/rules_sutram.py`

## Context

As Sutram and yenVUI applications deployed across edge tailnets, reverse proxies (such as Tailscale Serve), and mobile environments, five architectural vulnerabilities surfaced:
1. **Lazy-Import Version Skew**: Updating CacheStorage immediately upon discovering a new server build caused running application tabs to fetch new secondary module chunks that mismatched in-memory code, resulting in execution errors.
2. **Captive-Portal Cache Poisoning**: When mobile clients connected to Wi-Fi networks requiring captive portal logins (returning HTTP 511 or HTTP 302 redirects), Service Worker cache warming interpreted the login HTML as valid application code, overwriting the App Shell vault.
3. **Loopback vs Remote Serving Divergence**: Local developers required Network-First fetching so live code edits appeared immediately without unregistering workers; mobile users over Tailscale required Cache-First fetching to eliminate network round-trip latency.
4. **Outbox Mutation Collapsing Data Loss**: When rapid offline mutations collapsed under a single `collapseKey`, tracking sets (`pendingMutations`, `deletedMutations`) were overwritten rather than merged.
5. **Node.js Test Environment Identity Splitting**: Unit tests assigning detached mocks (`globalThis.window = { ... }`) broke reference equality between `window` and `globalThis`, leading to silent behavioral divergences in custom element registries and event handling.

## Decision

1. **Versioned Build Staging & Atomic Navigation Cutover (`offline.js`, `sw-core.js`)**:
   - Stage newer application builds in isolated `sutram-build-<buildId>` cache buckets.
   - Record staged cache names in `sutram-meta` under `/__sutram_pending_build__`.
   - In `sw-core.js`, promote the pending build to active status (`_promotePendingBuild()`) strictly on top-level navigation requests (`isNavigation`), guaranteeing that running pages are never disrupted by newly deployed module chunks.
2. **Captive-Portal & Non-200 Defense (`_isCacheableResponse`)**:
   - Validate responses before writing to CacheStorage: reject any response that is not HTTP 200, is redirected (`res.redirected === true`), is of non-basic type, or points to an external origin.
   - Fall back to the active cached App Shell on HTTP 511, 502, 503, or 504.
3. **Origin-Aware Serving Physics (`sw-core.js`)**:
   - On loopback origins (`localhost`, `127.0.0.1`, `::1`), default to Network-First to preserve instant developer iteration.
   - On non-loopback origins (Tailscale tailnets, remote servers), default to Cache-First when a complete build is cached to guarantee instant launch and offline survivability.
4. **Outbox Mutation Manifest Merging (`offline.js`)**:
   - Merge `pendingMutations` and `deletedMutations` via Set unions during outbox collapse and preserve both manifests during DLQ retry operations.
5. **Canonical Browser Identity Invariant & `js_loader.mjs`**:
   - Provide a zero-dependency ESM loader (`tests/unit/js_loader.mjs`) mapping bare specifiers (`'sutram-chassis'`, `'sutram/*'`, `'yenvui/*'`) and enforcing `globalThis.window = globalThis`.
   - Enforce `DETACHED_WINDOW_MOCK_BAN` across static fitness tests.

## Consequences

### Positive
- Complete protection against version skew and runtime lazy-import mismatches.
- Immunity to captive portal cache poisoning.
- High-performance, latency-free launch on remote/tailnet connections alongside zero-friction local development.
- Durable mutation tracking across repeated offline mutation collapses.
- Reliable, fast Node.js test execution directly against repository sources.

### Negative / Trade-offs
- Staged builds take effect only upon user reload/navigation rather than live in-place swapping (an intentional safety property).
