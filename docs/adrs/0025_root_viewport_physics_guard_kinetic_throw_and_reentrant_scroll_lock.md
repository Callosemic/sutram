# ADR-0025: Root Viewport Physics Guard, Kinetic Momentum Throw Engine, Reentrant Scroll Locking, and Chassis Overscroll Containment

* **Status:** Accepted
* **Date:** 2026-10-26
* **Scope:** `yenvui/js/physics.js`, `yenvui/js/card.js`, `yenvui/js/card-group.js`, `yenvui/js/scroll-view.js`, `yenvui/js/tabs.js`, `yenvui/js/shared_styles.js`, `yenvui/js/yenvui-base.js`

## Context
As the `yenVUI` presentation chassis expanded across mobile WebKit viewports (iOS and iPadOS Safari) and touch-first devices, several physical gesture constraints emerged:
1. **System Back-Navigation Hijacking**: Mobile WebKit enforces a system-level edge pan gesture (`UIScreenEdgePanGestureRecognizer`) within the 20px hardware bezel of the viewport. Component-level `touch-action` and non-passive listeners inside shadow DOM containers failed to prevent history navigation when touches initiated in gaps, margins, or virtualized boundaries.
2. **Abrupt Scroll Termination in Custom Tracks**: Horizontal scrubbing surfaces (`<yenvui-scrub-track>`) halted abruptly upon pointer release, lacking natural kinetic inertia and momentum decay.
3. **Scroll Lock Clobbering**: Setting `document.body.style.overflow = 'hidden'` directly within individual components caused race conditions where dismissing one modal or gesture prematurely unlocked scrolling while an outer drawer or dialog remained active.
4. **Chassis Overscroll Rubber-Banding**: Inconsistent `overscroll-behavior-x` declarations permitted horizontal rubber-banding across cards, scroll views, and tab bars.

## Decision

1. **Singleton Root Viewport Physics Guard (`YenvuiViewportGuard` & `<yenvui-viewport>`)**:
   * Install capture-phase window listeners (`touchstart`, `touchmove`, `touchend`, `touchcancel`) intercepting touches within the hardware bezel ($\le 20\text{px}$ and $\ge \text{clientWidth} - 20\text{px}$).
   * On iOS WebKit, synchronously cancel `touchstart` (`e.preventDefault()`) when originating in the bezel, defeating `UIScreenEdgePanGestureRecognizer`.
   * Traverse ancestor roots (`findScrollableAncestor`) to identify active scroll containers, manually updating `scrollTop` and collecting velocity samples during vertical pans.
   * On `touchend`, initiate kinetic momentum scrolling if a vertical drag occurred, or synthesize a `MouseEvent('click')` targeting the tapped element if pointer movement remained within tap slop ($\le 6\text{px}$).
   * Expose declarative `<yenvui-viewport>` element (`display: contents`) for chassis initialization.
2. **Inertial Momentum Throw Engine (`startKineticThrow`)**:
   * Implement a 60fps kinetic runner applying exponential decay ($0.94$ friction) to `scrollLeft` or `scrollTop`.
   * Automatically abort execution upon reaching scroll boundaries or receiving new pointer inputs.
3. **Reference-Counted Body Scroll Lock (`acquireBodyScrollLock` / `releaseBodyScrollLock`)**:
   * Manage document overflow locking via `_bodyOverflowLockCount`, restoring `document.body.style.overflow` to its baseline value only when all locks are released.
4. **Chassis Overscroll Standardization**:
   * Enforce `touch-action: pan-y;` and `overscroll-behavior-x: none;` across all horizontal navigation, card, and scroll containers (`shared_styles.js`, `card.js`, `card-group.js`, `scroll-view.js`, `tabs.js`, `yenvui-base.js`).
5. **Dead Style Pruning**:
   * Remove redundant host-level theme selectors in `category-section.js` and `search-bar.js`, relying on cascading design tokens.

## Consequences

* **Positives:**
  * Complete immunity from accidental Safari history traversal across the entire application viewport.
  * Fluid 60fps kinetic throw scrolling across touch surfaces.
  * Elimination of body scroll lock race conditions between overlapping modals, overlays, and gesture drawers.
  * Consistent overscroll physics across all chassis components.
* **Trade-offs:**
  * Synchronously canceling `touchstart` in the hardware bezel requires synthetic click event generation for buttons and inputs located within 20px of the screen edge.