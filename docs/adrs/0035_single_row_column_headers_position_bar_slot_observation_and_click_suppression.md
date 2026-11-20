# ADR-0035: Single-Row Column Headers, Viewport Position Bar, Slot-Piercing Container Observation, and Post-Drag Click Suppression

* **Status:** Accepted
* **Date:** 2026-11-19
* **Scope:** `sutram/js/app_shell.js`, `sutram/js/primitives.js`, `sutram/js/sutram_sdk.js`, `yenvui/js/dropdown.js`, `yenvui/js/physics.js`, `tests/fitness/rules_sutram.py`

## Context

As spatial columns accommodated denser view toolbars, selection trays, and inline action rows on compact mobile and tablet viewports, four structural issues surfaced:
1. **Vertical Chrome Overhead & Layout Shift:** `<sutram-app-shell>` rendered a dedicated 38px top global launcher row above the 44px column headers plus floating viewport dot pills, consuming vertical viewport height, while `<sutram-subtab-menu>` unmounted completely when empty and shifted tab horizontal alignment across views.
2. **Heuristic Width Estimation Drift:** Character-count width estimation in `<sutram-entity-actions>` and inline column tab bars occasionally underestimated rendered glyph widths, clipping the rightmost button or tab.
3. **Shadow-Boundary Container Measurement Blindness:** Light-DOM widgets slotted into Shadow-DOM spatial columns (such as `<sutram-selection-tray>` inside `.spatial-col`) could not observe enclosing column widths via CSS `@container` queries or `parentElement.clientWidth`.
4. **Post-Drag Synthetic Click Double-Firing & Lazy Store Timer Polling:** Dragging interactive buttons or tabs via `YenvuiGestureController` emitted a trailing synthetic `click` on pointer release, while lazy `SutramContextMixin.subscribe` relied on a 20ms `setInterval` loop.

## Decision

1. **Unified Single-Row Column Headers & 4px Top Position Bar (`sutram/js/app_shell.js`, `sutram/js/primitives.js`, `yenvui/js/dropdown.js`):**
   - Remove the 38px `.top-utility-row` and floating viewport dots pill in favor of a 4px proportional `.position-bar` at the top of `.spatial-viewport` (shown when `capacity < layoutRatios.length`) and a single 44px `.col-header` per column.
   - The whole `.col-header` row is a pan surface, controls included: a horizontal swipe that starts on a tab or button pans between columns, and a tap still reaches the control (post-drag click suppression only swallows the click after a pan). The 4px bar alone is too small to reach on a phone. Touches inside an open menu never pan (`_isHeaderBarSurfaceEvent`).
   - Pin `<sutram-subtab-menu>` first on the left of every column header (hosting the 4-part column-jump and active-tab refresh quick bar in `slot="header"`, bulk selection actions, `menuActions`, and `extraContentNodes` view controls), followed by a searchable `?chipRows` active-tab switcher and category launcher `<sutram-dropdown>` (`Open in this column` pinned above search + `Add a tab · <Category>` chip rows with `[data-compact-slugs]` icon-rail collapse below `520px`), fitted inline open tabs, and `.col-globals-rail` on the last visible column.
2. **Post-Render Overflow Clamping (`sutram/js/primitives.js`, `sutram/js/app_shell.js`):**
   - Inspect `rowEl.scrollWidth > rowEl.clientWidth + 1` in `updated()` on `<sutram-entity-actions>` and `<sutram-app-shell>` `.col-tabs-area`, stepping down `_overflowClampCount` / `_inlineTabClampCounts` when rendered items overflow and resetting when container widths or label lengths change.
3. **Shadow-Boundary Container Observation (`sutram/js/sutram_sdk.js`, `sutram/js/primitives.js`):**
   - Add `SutramContextMixin.resolveAssignedSpatialContainer` and `observeAssignedContainer` to traverse `assignedSlot`, `parentElement`, and `getRootNode().host` with `ResizeObserver` cleanup in `disconnectedCallback()`.
   - Reflect `[empty]` on `<sutram-selection-tray>` to collapse empty hosts and switch between full (`>= 480px`) and compact badge (`< 480px`) chip labels via `renderAdaptiveLabel`.
4. **Synchronous Store Waiters, Pre-Collapse Action Filters, & Post-Drag Click Suppression (`sutram/js/sutram_sdk.js`, `yenvui/js/physics.js`):**
   - Replace `setInterval` polling in lazy `SutramContextMixin.subscribe` with `StoreRegistry.onRegister` waiters and add `this.unsubscribe(unsubFn)`.
   - Add `ExtensionRegistry.setActionFilter` (evaluated prior to variant-set collapse across single and every-item bulk paths) and `resolveSelectionEntityType` for homogeneous multi-item variant defaults.
   - Intercept trailing synthetic `click` events in the capture phase inside `YenvuiGestureController` whenever a pan or long-press drag occurred, clearing any lingering suppressor when a stationary tap starts on any controller instance.

## Consequences

### Positive
- Reclaims 38px of vertical workspace height while keeping tab launching, view menus, and global actions accessible in every spatial column.
- Eliminates horizontal clipping of action buttons and inline tabs without two-pass layout thrashing.
- Enables slotted Light-DOM widgets to react deterministically to Shadow-DOM spatial column widths.
- Eliminates the last `setInterval` outside `registerInterval` and prevents double-activation after pointer drags.

### Negative / Trade-offs
- Post-render overflow clamping triggers one additional Lit microtask update on initial mount when a heuristic width estimate overflows.
