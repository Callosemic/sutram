# ADR-0017: Native Top-Layer Popover API Elevation for Context Overlays and Spatial Geometry Design Tokens

* **Status:** Accepted
* **Date:** 2026-10-15
* **Scope:** `yenvui/css/theme-tokens.css`, `yenvui/js/physics.js`, `yenvui/js/dropdown.js`, `yenvui/js/toolbar.js`

## Context
Context menus, action dropdowns, and column filter drawers historically relied on local CSS absolute positioning (`position: absolute; top: calc(100% + 5px)`). As spatial layout density expanded (with multi-column grids, fixed toolbar rows, and nested scroll containers), this model exhibited significant friction:
1. **Stacking Context & Clipping Traps:** Dropdown menus mounted inside containers with `overflow: hidden`, `overflow-x: auto`, or constrained `z-index` were clipped at container edges.
2. **Column Bounding Failures:** Column-level filter drawers required manual JavaScript styling or prototype workarounds to span the exact width of their enclosing spatial track.
3. **Hardcoded Spatial Dimensions:** Spacings, header heights, and rail button dimensions were hardcoded in multiple CSS files, causing subtle alignment divergence across themes.

## Decision
1. **Spatial Grid & Rail Geometry Design Tokens (`theme-tokens.css`)**:
   * Standardize dimensional CSS custom properties on `:root`:
     - `--yv-utility-height: 38px;`
     - `--yv-header-height: 44px;`
     - `--yv-gutter-x: 12px;`
     - `--yv-rail-cell-width: 44px;`
     - `--yv-icon-size: 14px;`
     - `--yv-icon-gap: 8px;`
2. **Top-Layer Coordinate Anchoring Engine (`physics.js`)**:
   * Implement `anchorTopLayerPopover(triggerEl, popoverEl, options)`:
     - `'menu'` mode: Calculates viewport bounding rectangles, checks container right-edge proximity, and flips alignment dynamically (`auto`, `left`, `right`) with an configurable offset.
     - `'column-drawer'` mode: Traverses ancestors to locate the bounding spatial column (`.spatial-col`, `sutram-window`), anchoring the drawer directly beneath the header across the full column width.
   * Implement `syncTopLayerPopover(triggerEl, popoverEl, isOpen, options)`:
     - Leverages browser-native `showPopover()` and `hidePopover()` on elements declared with `popover="manual"`, elevating overlays into the browser's `#top-layer`.
3. **Dropdown & Filter Overlay Elevation (`dropdown.js`)**:
   * Refactor `<yenvui-dropdown>` and `<yenvui-filter-dropdown>` to project menus directly in `#top-layer`.
   * Bind window `resize` and capture-phase `scroll` listeners during open states, ensuring overlays remain anchored to triggers during viewport motion.
   * Enforce automated listener disposal and `syncTopLayerPopover(..., false)` invocation within `disconnectedCallback()`.

## Consequences
* **Positives:**
  * Completely eliminates `z-index` competition and parent container overflow clipping.
  * Preserves native DOM component encapsulation without requiring detached DOM portaling or third-party positioning libraries.
  * Guarantees responsive alignment across desktop, tablet, and mobile viewports.
* **Trade-offs:**
  * Elements using `popover="manual"` require manual coordinate synchronization on window scroll and resize events. Handled deterministically via capture-phase listeners in `YenvuiBase`.