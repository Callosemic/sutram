# Sutram & yenVUI Engineering Standards & Guardrails

## 1. Core Architectural Laws

### The "Dumb Component" Rule
`yenVUI` UI primitives (e.g., `<yenvui-card>`, `<yenvui-modal>`) must remain zero-state, presentation-only components. They MUST NOT query application registries, maintain business logic, or trigger side effects. Communication flows strictly via top-down property binding and bottom-up bubbleable custom events (`yenvui-*` or `yv-*`).

### Composition Over Inheritance
Consuming applications and extension modules MUST NOT extend `yenVUI` UI primitive classes directly. Host applications extend `SutramElement` for Unidirectional Data Flow (UDF) state subscriptions and project templates into `sutram` containers using native HTML `<slot>` tags.

### The Universal CSS Vacuum
Host applications are forbidden from defining raw structural CSS or hardcoding hex colors in component templates. All visual styling MUST utilize semantic CSS intent variables (`var(--bg)`, `var(--pane-bg)`, `var(--intent-primary)`, `var(--border)`, `var(--rail-bg)`), ensuring instant theme re-skinning across Dark, Light, and E-Ink brutalist modes.

---

## 2. Interaction & Gesture Standards

### The Gesture Controller Mandate
All custom drag, swipe, spatial reordering, or long-press interactions MUST utilize `YenvuiGestureController` (`yenvui/js/physics.js`) rather than binding raw `pointerdown` or `touchstart` event listeners. 

* **Hit Detection:** Use `getDeepElementFromPoint(x, y, selector)` to pierce Shadow DOM boundaries when resolving gesture drop targets.
* **Axis Locking:** Explicitly configure `lockAxis` (`'horizontal'`, `'vertical'`, or `'both'`) to prevent interference with native vertical document scrolling.
* **OS Navigation Defeat:** `YenvuiGestureController` automatically intercepts horizontal drag sequences originating near viewport boundaries to defeat mobile browser edge-swipe back-navigation.
* **Automated Cleanup:** Drag handles and gesture listeners attached via `YenvuiGestureController` automatically unbind global `pointermove` and `pointerup` handlers when gestures complete or cancel.

---

## 3. DOM & State Management

### Spatial Projection & Non-Destructive DOM Caching
Complex workspace switching and spatial column views MUST route through `SutramDOMPool` (`sutram/js/projection_engine.js`) and `SutramProjectionCompiler`:

* **Node Recycling:** Component instances MUST be cached in `SutramDOMPool` and toggled via CSS (`display: flex` / `display: none`) during spatial column swaps.
* **State Preservation:** Never destroy `.innerHTML` or unmount active extension views during routing. Non-destructive caching preserves active buffer states, scroll positions, and uncommitted form inputs.
* **Garbage Collection:** Eviction of cached DOM nodes MUST occur exclusively through the global `sutram-evict-projection` custom event.

### Consolidated Theme Observer Pattern
Components requiring dynamic theme adaptation MUST NOT instantiate individual `MutationObserver` instances on `document.body`. Components MUST extend `YenvuiBase` (which auto-subscribes via `subscribeToTheme`) or call `this.observeTheme()` in `SutramElement` to utilize the shared, Set-based theme subscriber registry.

### Automated Lifecycle Teardowns
To prevent ghost memory leaks and dangling subscriptions, components extending `SutramElement` MUST register listeners and subscriptions via lifecycle helpers:

* **Zustand Subscriptions:** Use `this.subscribe(store, selector, listener)`.
* **Timers & Metronomes:** Use `this.registerInterval(callback, delayMs)` or `ExtensionRegistry.registerTick()` instead of raw `setInterval`.
* **Global DOM Listeners:** Use `this.registerGlobalListener(eventType, targetNode, callback)` and `this.registerOutsideClick(callback)`.
* **Automatic Disconnection:** All registered subscriptions, intervals, and listeners are automatically torn down within `SutramElement.disconnectedCallback()`.