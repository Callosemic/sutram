# ADR-0018: Spatial Drag HUD Coordinator, CSS Mask-Image Icon Primitive, and Offline Cache Write-Through

## Status
Accepted

## Context
As the workspace expanded to support multi-column spatial windowing, ephemeral popout projections, and zero-connectivity offline editing, three friction points emerged:
1. Icon rendering via `<yv-icon>` relied on dynamic `.innerHTML` SVG string injection, creating unnecessary DOM parsing overhead, memory allocation churn, and static analysis security flags.
2. Drag-and-drop spatial reordering used simple drop targets that could not accommodate multi-column window spanning presets or ejecting tabs into ephemeral popout windows.
3. Offline VFS mutations suffered from cache-key divergence (timestamp query params and protocol prefix differences), and saving files while offline did not immediately update the local read cache until an outbox drain occurred.

## Decision Drivers
* Eliminate all remaining `.innerHTML` usage in presentation components and bootloaders.
* Provide an ergonomic Head-Up Display (HUD) for spatial drag operations supporting tab docking, window spanning, and popout ejection.
* Maintain absolute host application decoupling across the core kernel and extension registries.
* Guarantee optimistic read-your-own-writes consistency in offline mode.

## Decision Outcome
* Replaced SVG innerHTML injection in `yv-icon` with native CSS `mask-image` and `-webkit-mask-image` using cached SVG Data URIs (`_iconMaskCache`).
* Redesigned `<sutram-drag-coordinator>` into a dual-mode workspace HUD (`mode-tab` vs `mode-window`) with column targets, span capacity presets (`span-1`, `span-2`, `span-3`), reorder slots, and popout triggers.
* Introduced `ExtensionRegistry.resolveCustomEditor(filepath)` to decouple file-type editor routing from hardcoded host tags.
* Normalized IndexedDB cache keys in `SutramDB` and added optimistic write-through caching on `/fs/save` POST requests in `OfflineHttpProvider`.

## Consequences
* **Positive**: Zero innerHTML in component lifecycles; 60fps GPU-accelerated HUD drag physics; instant offline file inspection without waiting for server sync; clean host domain decoupling.
* **Neutral**: Icons require SVG paths to be registered in `window.SutramIcons` before use.