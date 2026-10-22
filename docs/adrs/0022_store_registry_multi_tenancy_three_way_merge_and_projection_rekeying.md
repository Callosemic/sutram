# ADR-0022: StoreRegistry Multi-Tenancy Scoping, Three-Way Text Merge Engine, and Projection Rekeying

## Status
Accepted

## Date
2026-10-21

## Context
As the workspace environment expanded to support multi-tenant workspaces, collaborative text editing, and dynamic projection renaming, several architectural challenges were identified:
1. **Scope Switching Re-Render Storms:** Switching workspace scopes while dynamic extensions were loading triggered cascading `ExtensionRegistry.compileLayout()` calls, resulting in layout thrashing against partially hydrated store states.
2. **Asynchronous Fetch Race Conditions:** Network fetches initiated in one workspace scope frequently settled after the user had navigated to a different scope, poisoning the new scope's store with stale data.
3. **In-Flight Text Reconciliation:** Concurrent offline and remote modifications required a robust, zero-dependency 3-way text merger capable of resolving non-conflicting hunks, recognizing contiguous subslice snapshots (Zombie-ACK), and preserving CRLF line endings.
4. **Destructive Projection Renaming:** Renaming a file or projection required unmounting and remounting the entire component tree, causing lost buffer states, disrupted scroll positions, and broken popout window references.
5. **Host Domain Coupling:** `SutramAppShell` and `offline.js` retained direct references to host stores (`window.inSetu`) and domain-specific tab routes.

## Decision

1. **`StoreRegistry` & Transactional Scope Transitions (`sutram_sdk.js`)**:
   * Implement a centralized `StoreRegistry` managing store multi-tenancy, active scope resolution, and storage access (`getScopedStorage`, `setScopedStorage`, `removeScopedStorage`).
   * Wrap scope transitions in `StoreRegistry.beginScopeTransition(targetScopeId)` and `StoreRegistry.endScopeTransition()`. Suppress layout compilation during active transitions and dispatch `sutram:scope-transition-start` and `sutram:scope-transition-end`.
2. **Epoch-Guarded Asynchronous Store Fetching (`sutram_sdk.js`)**:
   * Auto-wrap all `fetch*` methods on stores created via `createSutramStore` with `_scopeEpoch` validation and `coalescedAsync`. Discard in-flight promise resolutions if the store epoch or active scope advances before completion.
   * Provide `store.resetMemoryOnly()` to reset in-memory store states cleanly during extension unloading without clobbering persistent storage.
3. **Deterministic Three-Way Text Merge Engine (`utils.js`)**:
   * Provide `threeWayMergeText(baseText, localText, remoteText)` utilizing dynamic programming LCS diff hunks (`_computeLcsDiffHunks`) with a $250,000$ matrix size safeguard.
   * Include a Zombie-ACK fast path for remote snapshots that are a contiguous line subslice of the local buffer, and retain CRLF carriage returns deterministically.
4. **Non-Destructive Projection Rekeying (`sutram_sdk.js`, `app_shell.js`)**:
   * Introduce `LayoutStore.rekeyProjection` to remap projection identifiers across pinned column arrays, active states, history stacks, open windows, and popout window registries.
   * Dispatch `sutram-rekey-projection` and broadcast `rekey_projection` over `_layoutBus` (`BroadcastChannel`), allowing `<sutram-app-shell>` to update cached node keys in `_activeNodes` and URL hashes without remounting elements.
5. **Contextual Sub-Tab Menus & Pure IoC Decoupling (`primitives.js`, `app_shell.js`, `offline.js`)**:
   * Introduce `<sutram-subtab-menu>` binding to `SelectionStore`, `EnvironmentStore`, and `menuStores` for group-scoped bulk actions.
   * Purge all `window.inSetu` and host-specific tab references, delegating metadata resolution to UI hooks (`sutram:resolve-primary-tab-meta`) and decoupled events (`sutram-projections-migrated`, `sutram-outbox-item-synced`).

## Consequences

### Positive
* Scope transitions execute without intermediate layout recompilations or visual flicker.
* Asynchronous store fetches are completely race-condition free across workspace boundaries.
* Text reconciliation occurs deterministically in pure JavaScript without external dependencies.
* Projections can be renamed cleanly without loss of DOM focus, scroll position, or popout synchronization.
* Core presentation kernel is fully decoupled from consuming host applications.

### Negative / Trade-offs
* LCS dynamic programming for large text buffers is memory-constrained to $250,000$ matrix entries, falling back to full-span hunks if exceeded.