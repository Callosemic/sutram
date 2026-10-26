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

### Substrate Zero-InnerHTML Law
All components across `yenVUI` and `Sutram` are strictly forbidden from assigning `.innerHTML`. All dynamic content rendering MUST utilize declarative Lit templates (`html````), native text nodes, or CSS mask-image primitives (`<yv-icon>`).
### Monospaced Ligature Suppression Standard
All monospaced text rendering surfaces (code editors, diff viewers, `<pre>`, `<code>`) MUST explicitly suppress contextual font ligatures using `font-variant-ligatures: none` and `font-feature-settings: "liga" 0, "calt" 0` to preserve 1:1 physical character-to-glyph column positioning.
### Substrate Input Control Standardization
Presentation components, workspace overlays, and modals MUST NOT render raw, un-encapsulated HTML form controls (`<input>`, `<textarea>`, `<select>`). All user input and parameter entry MUST utilize standardized substrate primitives (`<sutram-input>`, `<sutram-textarea>`, `<sutram-select>`, `<sutram-toggle>`) binding to `@sutram-input-changed` events. This guarantees uniform design token inheritance, focus trapping, and theme-neutral high-contrast compliance.
### Clean Dynamic ESM Specifier Standard
Dynamic module batch loaders (`ExtensionRegistry.loadBatches`) MUST NOT append query parameters (such as `?v=timestamp`) to import URLs. All dynamic module imports must preserve bare specifiers or clean path URLs to ensure deterministic compatibility with browser-native import maps (`<script type="importmap">`) and native module graph deduplication.

### Virtual List Double-Virtualization De-Escalation Standard
Components utilizing CSS `content-visibility: auto` must parameterize intrinsic sizing via CSS custom properties (e.g., `--card-contain-intrinsic-size`) and MUST explicitly de-escalate to `content-visibility: visible; contain-intrinsic-size: none` within virtualized containers (`:host-context(lit-virtualizer)`, `:host-context(sutram-virtual-list)`). This prevents height oscillation, scrolling micro-stutter, and WebKit paint clipping caused by competing virtualization engines.

### Minimal Buffer Reconciliation & Viewport Preservation
Text editing primitives encapsulating CodeMirror or native text areas MUST NOT execute full document replacements (`from: 0, to: length`) during external reactive updates. Components MUST compute minimal character-level prefix and suffix boundaries (`_applyMinimalDiff`), updating only the delta slice and mapping cursor anchor and scroll offsets to guarantee uninterrupted user focus.

### Isolated Child Toggle Event Containment
Collapsible sections, accordions, and disclosure widgets rendered inside composite cards or list items MUST dispatch toggle notifications with `bubbles: false` and `composed: false`. Emitting bubbling toggle events from nested disclosures leads to accidental event interception and state desynchronization in parent container controllers.

---

## 2. Interaction & Gesture Standards

### The Gesture Controller Mandate
All custom drag, swipe, spatial reordering, or long-press interactions MUST utilize `YenvuiGestureController` (`yenvui/js/physics.js`) rather than binding raw `pointerdown` or `touchstart` event listeners. 

* **Hit Detection:** Use `getDeepElementFromPoint(x, y, selector)` to pierce Shadow DOM boundaries when resolving gesture drop targets.
* **Axis Locking:** Explicitly configure `lockAxis` (`'horizontal'`, `'vertical'`, or `'both'`) to prevent interference with native vertical document scrolling.
* **OS Navigation Defeat:** `YenvuiGestureController` automatically intercepts horizontal drag sequences originating near viewport boundaries to defeat mobile browser edge-swipe back-navigation.
* **Automated Cleanup:** Drag handles and gesture listeners attached via `YenvuiGestureController` automatically unbind global `pointermove` and `pointerup` handlers when gestures complete or cancel.

### Root Viewport Physics Guard Standard (`YenvuiViewportGuard` & `<yenvui-viewport>`)
All mobile and edge-native chassis shells MUST wrap their top-level application layout in `<yenvui-viewport>` or initialize `YenvuiViewportGuard.install()`.
* **Hardware Bezel Protection:** On iOS/iPadOS WebKit viewports, `YenvuiViewportGuard` captures touch events within the 20px hardware bezel to prevent `UIScreenEdgePanGestureRecognizer` history traversal.
* **Vertical Scroll Preservation:** Vertical pans within the bezel resolve ancestor scroll containers and update scroll offsets with velocity tracking.
* **Synthetic Tap Replay:** Stationary bezel taps ($\le 6\text{px}$ movement) dispatch synthetic, composed `MouseEvent('click')` events to ensure interactive controls remain responsive.

### Inertial Momentum Throw Standard (`startKineticThrow`)
Custom scroll surfaces and gesture tracks requiring momentum MUST utilize `startKineticThrow(scrollEl, samples, options)`. Custom inertia implementations using `setInterval` or manual physics loops are strictly forbidden.

### Reentrant Body Scroll Lock Standard
Components and overlays MUST NOT write directly to `document.body.style.overflow`. All modal, drawer, and gesture locking MUST use `acquireBodyScrollLock()` and `releaseBodyScrollLock()` from `yenvui/js/physics.js` to prevent lock clobbering during concurrent overlay states.

### Horizontal Overscroll Containment Standard
All horizontally scrollable or swipeable chassis containers MUST declare `touch-action: pan-y;` and `overscroll-behavior-x: none;` to eliminate rubber-banding and maintain touch determinism.

### Multi-Window Popout Lifecycle & Popup Blocker Defense
External window projections (ejected editor surfaces or diagnostic panels) MUST conform to the synchronous allocation protocol:
* **Synchronous WindowProxy Allocation:** `window.open('about:blank', ...)` MUST execute synchronously within the direct user pointer gesture before awaiting any asynchronous pre-save hooks (`sutram:before-popout`). Asynchronous operations must resolve after allocation, redirecting the child window via `childWin.location.replace(targetUrl)`. Calling `window.open` after an `await` boundary is strictly prohibited.
* **Capability Gating:** Popout triggers and HUD drop zones MUST be gated behind `canUseMultiWindowPopout()`, automatically deactivating on standalone PWAs and compact touch-primary viewports (`pointer: coarse` with viewport width < 768px).
* **Double-Click Recall Escape Hatch:** Re-triggering a projection that is already active in a popped-out window twice within 3,500ms MUST close the external window and re-dock the projection locally into the user's active column focus.

---

## 3. DOM & State Management
### Spatial Projection & Generational Mark-and-Sweep Node Pooling
Complex workspace switching and spatial column views MUST route through `SutramProjectionPool` (`sutram/js/projection_engine.js`) and `SutramProjectionCompiler`:

* **Generational Mark-and-Sweep:** Projections must cycle through `beginPass()`, `resolve(componentTag, subId, props)`, and `commitPass()`. Referenced elements are retained across passes while unreferenced nodes are swept to permit native browser garbage collection.
* **Non-Destructive Projection Rekeying:** When identities change (e.g., file renames), projection nodes are re-mapped in place via `pool.rekey(oldId, newId)`, preserving active DOM state, scroll positions, and input buffers.
* **Extension Eviction:** Explicit extension unloading must call `pool.evictExtension(extName)` to remove nodes and destroy associated DOM trees.

### Debounced Store Persistence & Atomic Flush Barriers
Stores declaring local or session synchronization via `createSutramStore` must throttle persistent I/O:
* **Debounced Serialization:** State mutations triggering `localStorage` or `sessionStorage` updates MUST be debounced (250ms) to eliminate main-thread serialization stalls during high-frequency changes.
* **Flush Barriers:** Scope transitions (`StoreRegistry.switchTenantScope`), extension unloading, and document unload (`pagehide`) MUST invoke `store.flushPersistence()` or `StoreRegistry.flushAll()` to guarantee all pending dirty keys commit synchronously before context teardown.

### Non-Blocking Readonly IndexedDB Transactions & Lazy LRU Buffering
Client-side offline storage (`SutramDB`) must eliminate readwrite transaction lock contention:
* **Read-Only Inspection:** Entity reads (`getVFSBlob`) must execute within `readonly` transactions and must not trigger synchronous write locks to update access timestamps.
* **Lazy LRU Buffering:** Access timestamps must be buffered in memory (`_lruBuffer`) and committed asynchronously to `manifest_cache` (`vfs_lru_index`) via `requestIdleCallback`. Cache pruning tasks must flush in-memory buffers prior to calculating eviction thresholds.

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

### Multi-Window BroadcastChannel IPC Synchronization
Cross-window state coordination across detached popout surfaces and the host application shell MUST flow through a singleton `_layoutBus = new BroadcastChannel('sutram_layout_bus')`:
* **Presence Ping/Pong & Self-Healing Docking:** Child windows re-docking into the workbench (`dockInProjection`) must issue a `presence_ping` and await a `presence_pong` (120ms timeout). If the host window is active, the projection emits `dock_projection` and closes the child window. If the host has closed, the child window MUST self-heal by upgrading itself into the full workbench shell (`window.location.href = ...`).
* **Pagehide Disposal Tracking:** External popout windows MUST dispatch `popout_closed` upon `pagehide` to clean up active window handles and focus timestamps in the host `LayoutStore`.
* **Microtask Eviction Deferred Broadcast:** Eviction dispatches (`sutram-evict-projection`) must be scheduled via `queueMicrotask` to ensure synchronous callers finish inspecting buffer and uncommitted form state prior to store teardown.
### Declarative Background Job Execution
Long-running asynchronous actions attached to action buttons (`<sutram-async-btn>`) MUST NOT implement ad-hoc promise loops. Buttons declaring a `jobRoute` attribute must route execution through `ExtensionRegistry.executeJobAction`, delegating `onProgress`, `onComplete`, and `onError` callbacks to manage button state machine transitions (`idle` → `loading` → `success` / `error`) automatically.
### Transactional Scope Transition Lock & Layout Compilation Suppression
When switching tenant or workspace contexts, state hydration and layout compilation must execute atomically:
* **The Transition Lock:** Scope swaps MUST initiate via `StoreRegistry.beginScopeTransition(targetScopeId)` and conclude via `StoreRegistry.endScopeTransition()`.
* **Recompilation Suppression:** While `StoreRegistry.isTransitioning()` is true, calls to `ExtensionRegistry.compileLayout()` and dispatches of `sutram-layout-recompile` MUST be suppressed or canceled, preventing intermediate render cycles against partially hydrated stores. A single compilation pass is automatically dispatched upon `endScopeTransition()`.
* **Scope-Stamped Evictions:** Eviction broadcasts (`sutram-evict-projection`) must carry the originating `scopeId` in `event.detail` to ensure tenant-scoped stores ignore evictions emitted by alternate scopes.

### Epoch-Guarded Asynchronous Store Fetching
All asynchronous network fetch methods declared within `createSutramStore` (conventionally prefixed with `fetch*`):
* **Epoch Tracking:** Methods MUST automatically be wrapped with `_scopeEpoch` validation. If the workspace scope switches or `store.resetMemoryOnly()` executes while a request is in flight, the returned payload must be silently discarded to prevent stale state poisoning.
* **Request Coalescing:** Identical concurrent async requests must be coalesced via `coalescedAsync` to eliminate redundant network traffic.

### Non-Destructive Projection Rekeying Protocol
When a file, document, or projection identity changes:
* **Identity Re-Mapping:** The layout kernel MUST update projection identifiers across pinned columns, history backstacks, and active popout windows via `LayoutStore.rekeyProjection(oldId, newId, newLabel)`.
* **DOM Retention:** Shells and presentation containers MUST NOT unmount or recreate DOM nodes during a rekey. Components must update internal cache keys (`sutram-rekey-projection`) and retain active editor buffers, scroll positions, and DOM instances.
* **Cross-Window IPC:** Rekey events must broadcast across `_layoutBus` (`BroadcastChannel`) to synchronize popout and host window instances simultaneously.

### Causal Monotonicity & The Procedural Timer Ban
State synchronization across stores, projections, and network gateways MUST be strictly event-, revision-, and hash-driven rather than time-bound:
* **The Determinism Law:** Timers (`setTimeout`, `utils.debounce`) are permitted strictly for rate-limiting (slew limiting), network transport timeouts, and visual toast/status decay. Using timers or `Date.now()` timestamp deltas to order state transitions, await DOM/store hydration, or suppress mutation echoes is strictly prohibited.
* **Pre-Broadcast Mutation Settlement:** Network mutation gateways (`executeWorkspaceMutation`) MUST await the caller's `onSuccess` state update callback *before* broadcasting global mutation events, ensuring local stores reflect confirmed revisions and baseline hashes before reactive listeners evaluate the event.
* **Monotonic Revision & Ancestor Guards:** Asynchronous read-reconciliation tasks must snapshot the local buffer/store revision (`docRevision`) and `baseHash` prior to network dispatch, aborting if local state advances while the request is in flight or if the fetched payload matches a known historical ancestor hash (`ancestorHashes`).

---

## 4. Iconography & Graphic Dictionary Standard

### The ExtensionRegistry Icon Contract
All core modules and extension components MUST use standard Lucide string identifiers (e.g., `icon: 'trash-2'`) rather than raw emoji strings across all registry schemas (`layoutSlots`, `entityActions`, `settingsActions`, `batchActions`)[cite: 10].
### CSS Mask Icon Rendering Standard
Web Components rendering icons MUST utilize the native `<yv-icon>` micro-primitive or CSS mask-image styles (`mask-image`, `-webkit-mask-image`) rather than imperative DOM scanning (`window.lucide.createIcons`) or `.innerHTML` parsing. This ensures zero-cost paint updates, immune to DOM traversal churn.

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