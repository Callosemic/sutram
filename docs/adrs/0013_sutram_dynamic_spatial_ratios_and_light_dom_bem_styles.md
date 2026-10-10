# ADR-0013: Dynamic Spatial Column Ratios, Off-Main-Thread Search Workers, and Light-DOM BEM Shared Styles

* **Status:** Accepted
* **Date:** 2026-10-10
* **Scope:** `sutram/js`, `yenvui/js`

## Context
As the `inSetu` Developer OS expanded its spatial window projections and catalog size, three technical bottlenecks emerged:
1. **Rigid Column Math:** Spatial column layouts were locked to equal 33.3% splits, preventing users from expanding focal columns (e.g. editor at 50%, context at 25%, tasks at 25%).
2. **Main-Thread Search Stutter:** Large workspace file trees and prompt/template catalogs caused micro-stutter during fuzzy filtering in `<sutram-selector-modal>` and tree construction in `<sutram-folder-browser>`.
3. **Shadow DOM Style Overhead:** Atomic primitives (`yenvui-btn`, `sutram-input`, etc.) each maintained redundant Shadow DOM CSS blocks and active JS `MutationObserver` subscriptions for theme changes.

## Decision
1. **Dynamic Column Ratios (`LayoutStore.layoutRatios`):**
   - Added `layoutRatios` array (e.g., `[1, 2, 1]`) to `LayoutStore` with full `sessionSync` / `localSync` persistence.
   - Introduced `getSpatialMetrics(capacity, activeViewport, layoutRatios)` in `SutramAppShell` to dynamically calculate column widths, track offsets, and window projection bounds in continuous percentage spaces.
2. **Off-Main-Thread Worker Engine (`search-worker.js`):**
   - Offloaded `fuzzyFilterObjects` and `buildFileTree` execution from the main thread into `sutram/js/workers/search-worker.js`.
   - Web Workers are instantiated on demand and explicitly terminated on `disconnectedCallback()`.
3. **Light-DOM BEM Substrate & Cascading Themes:**
   - Standardized atomic controls onto Light DOM rendering (`createRenderRoot() { return this; }`) using `.yv-*` BEM class names.
   - Extracted master BEM styles into `yenvui/js/shared_styles.js` with auto-injection of `<style id="yenvui-shared-styles">` into `document.head`.
   - Deprecated per-element `MutationObserver` JS subscriptions; theme updates cascade purely via standard CSS variable inheritance from `[data-theme]` on the document body.

## Consequences
* **Positives:**
  - Non-blocking search filtering and file tree construction even on large repositories.
  - Flexible spatial layout proportions across desktop, tablet, and mobile viewports.
  - Reduced memory overhead and DOM tree depth by eliminating redundant Shadow DOM style elements.
* **Trade-offs:**
  - Light-DOM components share the document element class namespace, requiring strict `.yv-*` BEM prefixing to prevent selector collisions.