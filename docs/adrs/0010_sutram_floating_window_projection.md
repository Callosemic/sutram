# ADR-0010: Floating Window Projection Layer and Z-Index Management

**Date:** 2026-10-04
**Status:** Accepted

## Context
The Sutram UI chassis previously relied strictly on a 3-column spatial layout (`left`, `center`, `right`) with mobile viewport collapsing. Consumer applications identified a structural requirement for floating, resizable workspaces that exist above the constrained spatial columns without destroying the user's context in the background.

## Decision
We are implementing a discrete **Floating Window Projection Layer** powered by the `<yenvui-window>` and `<sutram-window>` primitives.
1. **HTML5 Dialog Substrate:** The floating layer utilizes native `<dialog>` elements to harness standard browser composition boundaries, avoiding `z-index` warfare.
2. **UDF Layout Store Integration:** Floating window objects are tracked centrally in the `LayoutStore` via the `windows` array, maintaining coordinates (`x`, `y`), elevation (`z`), and structural identity.
3. **Spatial Bridge:** The `SutramDragCoordinator` establishes bidirectional routing, allowing users to explicitly dock floating windows back into the spatial column grid or drag pinned tabs into a detached floating state.

## Consequences
* **Positive:** Preserves the underlying spatial grid geometry while enabling advanced multitasking. Reuses the `SutramDOMPool` for non-destructive DOM recycling when toggling between tabbed and floating states.
* **Negative:** Introduces a secondary elevation plane that requires careful pointer capture management via the `YenvuiGestureController` to prevent event bleeding into the spatial tracks beneath.