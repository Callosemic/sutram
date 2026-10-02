# ADR-0009: Spatial 3-Column Layout Engine and DOM Projection Pool

* **Status:** Accepted
* **Date:** 2026-10-02
* **Context:** `sutram/js/app_shell.js`, `sutram/js/projection_engine.js`, `sutram/js/sdk.js`, `yenvui/js/physics.js`

## Context

Prior versions of `<sutram-app-shell>` rendered primary navigation tabs as static single-viewport containers (`yenvui-tabs`). As extension density increased in complex workspaces, single-viewport routing caused context switching latency, lost scroll positions during tab switching, and forced full component remounting during layout updates.

## Decision

1. **Spatial 3-Column Layout Topology:** Replace single-viewport tab routing with a 3-column spatial viewport grid (`left`, `center`, `right`). Column capacity dynamically adapts to available screen width (1 column on mobile, 2 on tablet, 3 on desktop).
2. **`LayoutStore` Unidirectional Data Flow:** Centralize spatial state (focused column, pinned sub-tab arrays per column, mobile viewport index) in `LayoutStore` inside `sutram/js/sdk.js`.
3. **Decoupled DOM Projection Pool (`SutramDOMPool`):** Isolate layout slot compilation (`SutramProjectionCompiler`) from DOM node instantiation (`SutramDOMPool`). Components remain cached in the DOM pool and toggle visibility via CSS `display: flex/none` during spatial column switches, preserving internal component state and scroll positions.
4. **Unified Gesture Physics (`YenvuiGestureController`):** Abstract touch and pointer events into a single gesture controller supporting Shadow DOM piercing point resolution (`getDeepElementFromPoint`), horizontal axis locking, and long-press drag initialization.

## Consequences

* **Positive:** Eliminates component remounting penalties when switching spatial views; enables smooth touch-based drag-and-drop tab reordering across columns; preserves battery life on mobile via adaptive column collapse.
* **Negative:** Increased DOM memory retention due to cached nodes; mitigated via explicit event-driven garbage collection (`sutram-evict-projection`).