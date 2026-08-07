# Sutram & yenVUI Engineering Standards

Baseline rules, anti-patterns, and strict compliance guardrails specific to the unified Sutram micro-kernel and yenVUI Edge-Native environment.

## I. Micro-Kernel Guardrails (Sutram)

### 1. Component Error Boundaries
To maintain system resilience, components must wrap `connectedCallback` and `render` lifecycle methods in try-catch boundaries. Unhandled exceptions should log detailed diagnostics and render localized fallback UI without interrupting the host application execution.

### 2. Automated Resource Teardown
Components extending `SutramElement` must utilize managed arrays for store subscriptions (`subscribe`), intervals (`registerInterval`), and DOM listeners (`registerGlobalListener`). Manual teardown logic is an anti-pattern; rely on the base class `disconnectedCallback()` to guarantee memory safety.
### 3. Lazy Store Hydration
Components must anticipate mounting before state hydration completes. Use string store keys in `SutramElement.subscribe` to dynamically poll for global store instantiation, preventing race conditions during Stage 1 boot.
### 4. Session-Pinned Dynamic Module Imports
Dynamic imports in batch loaders (e.g., `ExtensionRegistry.loadBatches`) must pin version query parameters to a stable session boot timestamp (`window.SUTRAM_BOOT_TS`) rather than using per-call timestamps like `Date.now()`. This ensures consistent module caching throughout an active session while maintaining cache-busting upon session restarts.

### 5. Decoupled Measurement & Height Resizing
Any Web Component performing dynamic DOM measurements or height recalculations based on content changes must schedule measurements asynchronously via `requestAnimationFrame` or `IntersectionObserver`. Direct synchronous DOM measurement during `updated()` or render cycles is prohibited to prevent `ResizeObserver` loop limit warnings and layout thrashing.

## II. Presentation Chassis Guardrails (yenVUI)

### 1. Theme Observation Standard
Web Component host elements requiring theme-aware styling must establish a `MutationObserver` targeting `document.body`'s `data-theme` attribute during `connectedCallback()` and clean it up in `disconnectedCallback()`.

### 2. Native Dialog Visibility & Unmount Teardown
Components wrapping native HTML `<dialog>` elements must maintain `:host { display: contents; }` in shadow DOM CSS to allow proper native centering in the browser's `#top-layer`. Furthermore, dialog components must implement a `disconnectedCallback()` unmount hook that temporarily re-attaches open `<dialog>` elements to `document.body` before calling `dialog.close()` to cleanly strip the document-level `inert` attribute.

### 3. Custom Event Namespacing
All custom events emitted by yenVUI primitives must be prefixed with `yenvui-` or `yv-` to ensure zero event collisions with standard DOM events or host application handlers.

### 4. Event & Property Hybrid Handshake (The "Pit of Success")
While yenVUI primitives must emit pure DOM events (e.g., `@yv-click`) to remain decoupled, they must also accommodate legacy state orchestrators. If a component receives asynchronous execution logic, it must explicitly declare a property (e.g., `onClick: { type: Object }`) and natively `await` its execution during the event lifecycle.

### 5. Shadow DOM Slot Permeability
Web Component containers must explicitly define an unnamed fallback `<slot></slot>` to gracefully accept unstructured projections. Use the `::slotted(*)` CSS selector to forcefully normalize the geometry of any element the host application attempts to project.

### 6. Safari Touch-Action Gesture Interception
Web Components handling custom horizontal gestures must combine `touch-action: pan-y` CSS directives on container hosts with explicit, non-passive `touchmove` listeners (`{ passive: false }`) executing `e.preventDefault()` once horizontal swipe dominance is established, preventing Safari's back-navigation.

### 7. Flexbox & Grid Min-Width Blowout Defense
Shadow DOM containers using flexbox or CSS grid layouts with text content, code blocks, or scrollable body regions must explicitly declare `min-width: 0` and `box-sizing: border-box` on child items to prevent content blowouts.
### 8. The DOM-First Vacuum Rule
CSS deprecation must strictly follow: 1) Construct the presentational component (The Paint). 2) Wrap legacy logic into the new primitive (The State). 3) Delete legacy classes from the host application only after the transition is complete (The Vacuum).

### 9. Decoupled Measurement & Height Resizing Standard
Any Web Component performing dynamic DOM measurements or height recalculations based on content changes must schedule measurements asynchronously via `requestAnimationFrame` or `IntersectionObserver`. Direct synchronous DOM measurement during `updated()` or render cycles is prohibited to prevent `ResizeObserver` loop limit warnings and layout thrashing.

## III. Ecosystem Compliance

### 1. Sub-Module Test Isolation
While housed in a unified repository, the `sutram/` and `yenvui/` sub-directories must maintain their own dedicated `tests/` folders. This isolates boundary checks, ensuring visual UI fitness functions do not unnecessarily entangle with functional micro-kernel constraints.