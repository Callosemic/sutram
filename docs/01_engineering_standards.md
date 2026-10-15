# Sutram & yenVUI Engineering Standards & Guardrails

## 1. Core Architectural Laws

### The "Dumb Component" Rule
`yenVUI` UI primitives (e.g., `<yenvui-card>`, `<yenvui-modal>`) must remain zero-state, presentation-only components. They MUST NOT query application registries, maintain business logic, or trigger side effects. Communication flows strictly via top-down property binding and bottom-up bubbleable custom events (`yenvui-*` or `yv-*`).

### Composition Over Inheritance
Consuming applications and extension modules MUST NOT extend `yenVUI` UI primitive classes directly. Host applications extend `SutramElement` for Unidirectional Data Flow (UDF) state subscriptions and project templates into `sutram` containers using native HTML `<slot>` tags.
### The Universal CSS Vacuum & Strict Shadow DOM Encapsulation
The boundary between Sutram and yenVUI is a strict separation of State/Topology and Aesthetics/Dimensions:
*   **Sutram (The Micro-Kernel):** `shared_styles.js` MUST remain a pure, microscopic structural reset (e.g., `box-sizing: border-box`, `scrollbar-width: thin`). It must never leak component-specific layout classes (like `.sub-tab` or `.spinner`).
*   **yenVUI (The Presentation Chassis):** Host applications are forbidden from defining raw structural CSS or hardcoding hex colors. All visual styling MUST utilize semantic CSS intent variables (`var(--bg)`, `var(--intent-primary)`). Furthermore, component-specific layout rules (padding, margins, transition timings) MUST be strictly encapsulated within the isolated Shadow DOM of the specific component that renders them.

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

### Top-Layer Popover API & Viewport Coordinate Anchoring
Floating menus, dropdowns, and spatial drawers susceptible to CSS `overflow: hidden` or stacking context clipping MUST use the native browser `#top-layer` via HTML5 `popover="manual"`.
* **State Synchronization:** Components must synchronize popover visibility through `syncTopLayerPopover(triggerEl, popoverEl, isOpen, options)` in `updated(changedProperties)` and ensure clean dismissal (`isOpen = false`) in `disconnectedCallback()`.
* **Dynamic Anchoring:** Coordinate calculations must route through `anchorTopLayerPopover(triggerEl, popoverEl, options)` supporting `'menu'` (auto-reversing horizontal positioning) and `'column-drawer'` (spatial column bounding).
* **Viewport Tracking:** When open, components must bind capture-phase listeners (`window.addEventListener('scroll', fn, true)` and `window.addEventListener('resize', fn)`) and unbind them immediately on close or unmount.

---

## 4. Iconography & Graphic Dictionary Standard

### The ExtensionRegistry Icon Contract
All core modules and extension components MUST use standard Lucide string identifiers (e.g., `icon: 'trash-2'`) rather than raw emoji strings across all registry schemas (`layoutSlots`, `entityActions`, `settingsActions`, `batchActions`)[cite: 10].

### Shadow DOM Icon Hydration
Web Components rendering Lucide icons MUST execute `window.lucide.createIcons({ root: this.shadowRoot })` within their `updated(changedProperties)` lifecycle hook to ensure SVGs hydrate cleanly inside isolated Shadow DOM roots[cite: 5, 6, 10].

### Graphic Dictionary
When building new features or declaring actions, semantic concepts MUST map directly to these canonical Lucide tokens[cite: 10]:

| Semantic Concept | Lucide Token (`data-lucide`) |
| --- | --- |
| **Save / Persist / Disk** | `save` |
| **Sync / Patch / Execute** | `zap` |
| **Repository / Archive / Bundle** | `package` |
| **Tools / Settings / Config** | `wrench` / `settings` |
| **Delete / Remove / Clear** | `trash-2` |
| **Edit / Rename / Modify** | `edit-3` |
| **File / Document / Receipt** | `file-text` |
| **Folder / Directory** | `folder` |
| **Copy / Clipboard** | `clipboard` |
| **Download / Pull** | `download` |
| **Share / Upload / Export** | `share` / `upload` |
| **Undo / Revert / Pre-State** | `rewind` |
| **Restore / Target / Post-State** | `target` |
| **Swap / Refresh / Retry** | `refresh-cw` |
| **Warning / Alert / Poison** | `alert-triangle` |
| **Success / Confirm / Check** | `check-circle` |
| **Error / Cancel / Close** | `x-circle` / `x` |
| **Search / Inspect** | `search` |
| **Parts / Chunks / Components** | `puzzle` |
| **Move / Transfer** | `truck` |
| **History / Timeline** | `history` |
| **Terminal / Console / Command** | `terminal` |
| **Prose / Write / Essay** | `pen-tool` |