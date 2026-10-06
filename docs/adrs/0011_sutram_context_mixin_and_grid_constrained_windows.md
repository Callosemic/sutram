# ADR-0011: SutramContextMixin Composition, Direct Primitive Inheritance, and Grid-Constrained Spatial Window Projections

* **Status**: Accepted
* **Date**: 2026-10-05
* **Author**: Sutram Architectural Board

## Context & Problem Statement

Previously, `sutram` presentation primitives in `sutram/js/primitives.js` wrapped `yenVUI` UI primitives inside intermediate Lit templates. This created duplicate Shadow DOM boundaries, added unnecessary DOM node overhead, and complicated event bubbling and CSS token inheritance.

Additionally, floating windows (`<yenvui-window>`) relied on absolute screen pixel coordinates (`x, y`), which led to positioning drift on viewport resizes and broken layouts in multi-column spatial tracks.

## Decision Drivers

1. **DOM Tree Efficiency**: Eliminate wrapper component DOM nesting while preserving UDF state binding and lifecycle safety.
2. **Spatial Viewport Alignment**: Ensure windowed projections integrate natively into spatial column capacity calculations (1, 2, or 3 columns).
3. **Composition Flexibility**: Enable any component class to acquire Sutram state subscriptions and lifecycle management without requiring single inheritance from `SutramElement`.

## Proposed Architecture

1. **`SutramContextMixin`**: Extract subscription management (`subscribe`), interval registration (`registerInterval`), and global listener tracking (`registerGlobalListener`) into a reusable mixin: `SutramContextMixin(SuperClass)`.
2. **Direct Class Extension**: Refactor `sutram/js/primitives.js` so that state-aware components extend their corresponding `Yenvui*` base classes directly (e.g., `class SutramCard extends SutramContextMixin(YenvuiCard)`).
3. **Grid-Constrained Window Projections**: Refactor `<yenvui-window>` and `<sutram-window>` to use `anchorCol` ('left' | 'center' | 'right') and `span` (1, 2, or 3 columns) instead of absolute pixel coordinates. `LayoutStore` enforces window bounds during viewport capacity transitions.

## Consequences

* **Positive**:
  * Eliminates nested shadow root overhead across presentation primitives.
  * Windows automatically adapt to split-screen and mobile viewport capacity changes without clipping off-screen.
  * `SutramContextMixin` can be applied broadly across third-party ecosystem components.
* **Refinements**:
  * Supersedes the absolute positioning model described in ADR-0010.