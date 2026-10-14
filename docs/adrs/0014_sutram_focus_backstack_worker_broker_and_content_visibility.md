# ADR-0014: Focus Backstack Navigation, Singleton Worker Broker, and Content-Visibility Performance

## Status
Accepted

## Context
As the `sutram` and `yenVUI` UI substrate scaled to accommodate multi-column spatial workflows, complex file trees, and dynamic projection surfaces, three architectural challenges emerged:
1. **Focus State Collapse on Tab Eviction**: When pinned projections were closed or unpinned, columns frequently dropped into empty states rather than restoring focus to the previously viewed projection.
2. **Worker Thread Proliferation**: Primitives such as `<sutram-folder-browser>` and `<sutram-selector-modal>` created individual `Worker` instances upon connection, increasing thread memory overhead and complicating lifecycle teardown.
3. **Large List Layout Overhead**: Rendering long lists of cards and nested collapsible sections caused layout recalculation overhead during tab switches.
4. **Bootloader Prototype Interception**: Wrapping `customElements.define` globally in `sutram-boot.js` introduced unnecessary runtime coupling into Stage 1 bootloader initialization.

## Decision
1. **MRU Focus Backstack in `LayoutStore`**:
   * Implement a global `focusHistory` array (capped at 50 entries) and per-column `history` arrays (capped at 30 entries) in `LayoutStore`.
   * When unpinning or closing a projection, determine fallback focus by consulting the MRU history before selecting arbitrary column fallbacks.
   * Add `schema.onEvict` to `createSutramStore` and defer `sutram-evict-projection` dispatching via `queueMicrotask`.
2. **Singleton `SutramWorkerBroker`**:
   * Introduce a shared `SutramWorker` broker in `sutram/js/utils.js` that multiplexes requests (`BUILD_TREE`, `FUZZY_SEARCH`) via unique request IDs.
   * Provide an automatic synchronous fallback to the main thread should worker initialization fail.
3. **Declarative `content-visibility`**:
   * Apply CSS `content-visibility: auto` and `contain-intrinsic-size` to `<yenvui-card>` and open `<yenvui-collapsible>` containers, forcing `content-visibility: visible` when active, stacked, or during gesture tracking.
4. **Class-Level Error Boundary Migration**:
   * De-escalate `sutram-boot.js` by removing monkey-patched wrappers from `customElements.define`.
   * Enforce prototype-level error boundaries directly inside the `SutramElement` base class.

## Consequences
* Focus state transitions remain deterministic across column layout modifications.
* Background compute overhead is minimized via a single worker thread without unmount leaks.
* DOM rendering and scroll performance for large entity catalogs are substantially improved.
* Bootstrapping is cleaner, and custom element registration preserves standard browser semantics.