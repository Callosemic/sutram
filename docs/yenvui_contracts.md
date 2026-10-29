# yenVUI Interface Contracts (The Presentation Chassis)

This document defines the strict, state-agnostic API contract that the `yenVUI` presentation layer guarantees to its consumers (like the `Sutram` micro-kernel). Any UI library that perfectly implements these Web Component tags, properties, events, and CSS tokens can act as a 1:1 drop-in replacement for the default yenVUI chassis.

## I. The "Dumb Component" Law

A compliant presentation chassis must not contain business logic.
*   **No Store Access:** Components must not read from or write to Zustand, Redux, or local storage.
*   **No External Polling:** Components must not query APIs or Extension Registries.
*   **Pure DOM Emissions:** All user interactions must result in isolated, bubbling `CustomEvent` emissions (prefixed with `yenvui-` or `yv-`).
## II. The Strict Encapsulation Contract

A compliant chassis must isolate aesthetic details from the micro-kernel. The kernel's `shared_styles.js` provides only basic structural resets (e.g., `box-sizing: border-box`). The chassis must completely encapsulate its own component-specific layout rules (padding, margins, transition timings) inside its isolated Shadow DOM CSS.

### CSS Intent Tokens
A compliant chassis must consume and respect the following CSS custom properties to maintain structural parity with the host application's color logic:

*   **Backgrounds:** `--bg`, `--bg-deep`, `--pane-bg`, `--input-bg`, `--bg-hover`
*   **Borders:** `--border`, `--border-dim`
*   **Typography:** `--text`, `--text-muted`, `--font-mono`
*   **Semantics:** `--intent-primary`, `--intent-success`, `--intent-danger`, `--intent-warning`, `--intent-highlight`, `--intent-neutral`
*   **Spatial Grid & Rail Geometry:** `--yv-utility-height`, `--yv-header-height`, `--yv-gutter-x`, `--yv-rail-cell-width`, `--yv-icon-size`, `--yv-icon-gap`, `--textarea-min-height`

### Layout Markers & Environmental Boundary Contracts
To prevent upward coupling to host containers, the chassis standardizes on duck-typed layout markers:
*   `[data-spatial-boundary]`: Applied to enclosing spatial track containers (windows, shells) to delimit column boundaries for top-layer popover anchoring (`mode: 'column-drawer'`).
*   `[data-virtual-list]`: Applied to virtualized lists to automatically de-escalate nested card `content-visibility: visible; contain-intrinsic-size: none` and avoid double-virtualization artifacts on iOS WebKit.
*   `[data-yv-card]`: Stamped on card component hosts to identify selectable targets across shadow DOM hit tests.

## III. Chassis Provider Contract (`sutram-chassis`)

Any chassis implementation mounted into Sutram must expose the 28 primitives defined in `REQUIRED_CHASSIS_PRIMITIVES`:
*   `Btn`, `AsyncBtn`, `Card`, `CardGroup`, `CategorySection`, `Modal`, `Window`, `Tabs`, `Toolbar`, `SearchBar`, `Dropdown`, `FilterDropdown`, `Collapsible`, `Pill`, `FilterGroup`, `Tag`, `Label`, `Spinner`, `EmptyState`, `Board`, `Column`, `ScrubTrack`, `ScrollView`, `DiffViewer`, `Editor`, `Input`, `Select`, `Textarea`, `Toggle`
*   Validation: `validateChassisContract(chassisProvider)` throws a descriptive error if any primitive is missing.
*   Registration: `SutramUIAdapter.registerChassis(chassisProvider)` automatically binds pass-through custom element tags (`<sutram-btn>`, `<sutram-card-group>`, etc.).

## IV. Component Interface Matrix

Any replacement library must export the following Custom Elements.
### Core Layout & Overlays
*   **`<sutram-dag-tree>`**: Universal wavefront & hierarchy DAG tree visualization primitive.
    *   *Properties:* `.stages` (Array of wavefront stages), `.rootNode` (Object), `.nodes` (Array), `.renderNode` (Function), `?compact` (Boolean).
    *   *Events:* `@sutram-dag-node-clicked`.
*   **`<sutram-virtual-list>`**: High-performance virtualized list with double-virtualization protection.
    *   *Properties:* `.items` (Array), `.renderItem` (Function), `.keyFunction` (Function: `(item, idx) => string`).
*   **`<sutram-projection-window-controls>`**: Multi-window popout and dock-in control button.
    *   *Properties:* `.filepath` (String), `.projectionId` (String), `.beforeAction` (Async Function).
*   **`<sutram-field-card>`**: Modular settings field card container with scope badges.
    *   *Properties:* `.label` (String), `.description` (String), `.scope` (`'workspace'`|`'repo'`|`'daemon'`|`'none'`), `?secure` (Boolean).
    *   *Slots:* `header-actions`, default.
*   **`<sutram-subtab-menu>`**: Spatial column sub-tab header action and bulk selection menu.
    *   *Properties:* `.slotConfig` (Object with `bulkActionGroup`, `bulkEntityTypes`, `menuActions`, `menuStores`).
*   **`<yenvui-viewport>`**: Tier 0 root viewport wrapper installing the singleton viewport physics guard to defeat iOS Safari edge-swipe back-navigation while preserving vertical momentum scrolling and tap responsiveness.
*   **`<yenvui-modal>`**: Native `#top-layer` dialog.
    *   *Properties:* `?open`, `.titleText`, `?fullscreen`, `?flush`, `?transparent`, `.maxWidth`.
    *   *Methods:* `bringToFront()`.
    *   *Events:* `@yenvui-modal-closed`, `@yenvui-modal-closing`.
    *   *Slots:* `body`, `footer`, default.
*   **`<yenvui-window>`**: Native `<dialog>` grid-constrained spatial window.
    *   *Properties:* `.titleText`, `.anchorCol` (`'left'`|`'center'`|`'right'`), `.span` (1|2|3), `.z`, `.icon`, `.intent`.
    *   *Events:* `@yenvui-window-close`, `@yenvui-window-dock`, `@yenvui-window-focus`, `@yenvui-window-drag-start`.
    *   *Slots:* default.
*   **`<yenvui-card>`**: Polymorphic catalog container.
    *   *Properties:* `.titleText`, `.descriptionText`, `.detailText`, `.detailPrefix`, `.detailSuffix`, `.statusText`, `.icon`, `.intent`, `.intentColor`, `?selected`, `?disableSelection`, `?compact`, `?flush`, `?stale`, `?has-actions`, `.actionsOpen` (Boolean getter/setter), `.hasActions` (Boolean getter/setter).
    *   *Host Markers:* `[data-yv-card]`.
    *   *Events:* `@yenvui-card-select-toggled`, `@yenvui-card-clicked`, `@yenvui-card-actions-opened`, `@yenvui-overlay-opened`.
    *   *Slots:* `header-actions`, `detail`, `inline-actions`, `actions`, default.
*   **`<yenvui-collapsible>`**: Collapsible content section with semantic header styling.
    *   *Properties:* `.titleText`, `?open`, `.intent` (`primary`|`success`|`highlight`|`warning`|`danger`|`neutral`), `?flush`.
    *   *Events:* `@yenvui-collapsible-toggled` (isolated, non-bubbling).
    *   *Slots:* `actions`, default.
*   **`<yenvui-drop-overlay>` & `<yenvui-drop-target>`**: Top-layer drag-and-drop backdrop and target zones.
    *   *Overlay Properties:* `?active`.
    *   *Target Properties:* `?hovered`, `.intent` (`primary`|`danger`), `.zone`.
    *   *Slots:* default.
*   **`<yenvui-card-group>`**: Wraps cards with accordion and horizontal swipe physics.
    *   *Properties:* `?enableEdgeSelection`, `?stacked`, `?accordion`.
*   **`<yenvui-tabs>`**: Carousel tab navigation.
    *   *Properties:* `.tabs` (Array of `{id, label}`), `.activeTab`, `.variant` (`primary`|`sub`), `?cacheViews`.
    *   *Events:* `@yenvui-tab-selected`.
*   **`<yenvui-board>` & `<yenvui-column>`**: Multi-column container-query grids.
    *   *Column Properties:* `.titleText`, `.intentColor`.
### Interactive Controls
*   **`<yenvui-async-btn>`**: Action button with visual state feedback.
    *   *Properties:* `.label`, `.loadingLabel`, `.successLabel`, `.errorLabel`, `.intent`, `.variant`, `.size`, `?emphasis`, `.status` (`idle`|`loading`|`success`|`error`), `?disabled`, `?active`, `.jobRoute`, `.jobPayload`, `.onJobComplete`, `.onJobProgress`, `.onJobError`.
    *   *Events:* `@yv-click`.
*   **`<yenvui-editor>`**: CodeMirror 6 text editor.
    *   *Properties:* `.value`, `?readOnly`, `.language`, `?writingMode`, `.customExtensions`, `.languageResolver` (Async Function: `lang => string | { url }`).
    *   *Static Properties:* `YenvuiEditor.languageResolver` (Global fallback resolver callback).
    *   *Methods:* `insertAtCursor(text)`, `getCursor()`, `setCursor(pos)`, `getScrollInfo()`, `setScrollInfo(top)`, `transformContent(transformFn)`.
    *   *Events:* `@yenvui-editor-changed`, `@yenvui-editor-selection`, `@yenvui-editor-scroll`.

### Utilities & Feedback
*   **`<yenvui-toast-container>`**: Fixed notification stack.
    *   *Properties:* `.toasts` (Array of `{id, message, intent}`).
    *   *Events:* `@yenvui-toast-dismissed`.
*   **`<yenvui-status-bar>`**: Bottom system status ticker.
    *   *Properties:* `.text`, `?isError`, `.syncState` (`synced`|`pending`|`syncing`).
*   **`<yenvui-selection-tray>`**: Floating batch-action tray.
    *   *Properties:* `.count`, `?open`.
    *   *Events:* `@yenvui-clear-selection`.
    *   *Slots:* `batch-actions`.
*   **`<yenvui-empty-state>`**: Empty placeholder.
    *   *Properties:* `.icon`, `.text`.
*   **`<yenvui-spinner>`**: Loading indicator.
    *   *Properties:* `.text`.
*   **`<yenvui-diff-viewer>`**: Kinetic visual diff viewer for paired hunks and unified streams.
    *   *Properties:* `.diffText`, `.searchStr`, `.replaceStr`, `.searchLines`, `.replaceLines`, `.leftTitle`, `.rightTitle`, `.mode` (`auto`|`split-side`|`split-stacked`|`interleaved`), `.activeLineIndex`.
    *   *Events:* `@yenvui-diff-line-selected`, `@yenvui-diff-mode-changed`.
*   **Physics & Gesture Utilities (`physics.js`)**:
    *   *Constants:* `PHYSICS` (`EDGE_START_BEZEL_PX`, `EDGE_MOVE_BEZEL_PX`, `AXIS_LOCK_THRESHOLD_PX`, `TAP_SLOP_PX`, `MIN_THROW_VELOCITY`, `THROW_DECAY`, `POPOVER_ESTIMATED_WIDTH_PX`).
    *   *Functions:* `startKineticThrow(scrollEl, samples, options)`, `acquireBodyScrollLock()`, `releaseBodyScrollLock()`, `getDeepElementFromPoint(x, y, selector)`, `anchorTopLayerPopover(triggerEl, popoverEl, options)`, `syncTopLayerPopover(triggerEl, popoverEl, isOpen, options)`.
### Inputs & Filtering
*   **`<yenvui-input>`**: Single-line text input presentation primitive.
    *   *Properties:* `.label`, `.value`, `.placeholder`, `.type`, `?disabled`, `?inline`, `?flush`.
    *   *Events:* `@yenvui-input-changed`.
*   **`<yenvui-select>`**: Dropdown select presentation primitive.
    *   *Properties:* `.label`, `.value`, `.options` (Array of `{value, label}`), `?disabled`, `?inline`, `?flush`.
    *   *Events:* `@yenvui-input-changed`.
*   **`<yenvui-textarea>`**: Multiline auto-sizing textarea presentation primitive.
    *   *Properties:* `.label`, `.value`, `.placeholder`, `.rows`, `?monospace`, `?disabled`, `?readOnly`, `?inline`, `?autoSize`, `.maxHeight`, `.minRows`, `?borderless`, `?flush`.
    *   *Events:* `@yenvui-input-changed`.
*   **`<yenvui-toggle>`**: Boolean toggle switch presentation primitive.
    *   *Properties:* `.label`, `?checked`, `?disabled`, `?flush`.
    *   *Events:* `@yenvui-input-changed`.
*   **`<sutram-textarea>`**: Higher-order bridged textarea bound to `@sutram-input-changed`.
*   **`<sutram-input>`**: Higher-order bridged input bound to `@sutram-input-changed`.
*   **`<sutram-select>`**: Higher-order bridged select bound to `@sutram-input-changed`.
*   **`<sutram-toggle>`**: Higher-order bridged toggle bound to `@sutram-input-changed`.
*   **`<sutram-combobox>`**: Searchable and filterable text combobox with dropdown option list and keyboard navigation.
    *   *Properties:* `.label`, `.value`, `.placeholder`, `.options` (Array of strings or `{value, label, badge}`), `?disabled`, `?flush`, `?inline`.
    *   *Events:* `@sutram-input-changed`.
*   **`<sutram-target-binding>`**: Compound endpoint and model selector pairing `<sutram-select>` with `<sutram-combobox>`.
    *   *Properties:* `.label`, `.value` (String `endpoint::model` or Object `{endpoint, model}`), `.endpoints` (Array), `.models` (Array or Function `endpointId => Array`), `.endpointKey`, `.modelKey`, `.endpointPlaceholder`, `.modelPlaceholder`, `?allowEmptyEndpoint`, `?disabled`, `?flush`.
    *   *Events:* `@sutram-input-changed`.
*   **`<yenvui-dropdown>`**: Floating action menu utilizing native `#top-layer` Popover API.
    *   *Properties:* `.items` (Array of `{id, label, icon, onClick, asyncAction, divider}`), `?open`, `.align` (`'auto'`|`'left'`|`'right'`), `.direction` (`'auto'`|`'up'`|`'down'`).
    *   *Events:* `@yenvui-action-error` (dispatched on unhandled action exception).
    *   *Slots:* `trigger`.
*   **`<yenvui-filter-dropdown>`**: Column-anchored filter panel utilizing native `#top-layer` Popover API.
    *   *Properties:* `.filterText`, `?open`, `?hasFilters`.
    *   *Slots:* default (filter panel content).
*   **`<yenvui-search-bar>`**: Filter input.
    *   *Properties:* `.placeholder`, `.value`.
    *   *Events:* `@yenvui-search-changed`.
*   **`<yenvui-filter-group>`**: Array of toggle pills.
    *   *Properties:* `.label`, `.items`, `.activeItems`, `?allowAll`.
    *   *Events:* `@yenvui-filter-changed`.
*   **`<yenvui-pill>`**: Toggle badge.
    *   *Properties:* `.pillId`, `.labelText`, `?active`, `?small`, `.variant`.
    *   *Events:* `@yenvui-pill-toggled`.
*   **`<yenvui-tag>`**: Static colored label.
    *   *Properties:* `.text`, `.intent`.
*   **`<yenvui-label>`**: Input label primitive.
    *   *Properties:* `.text`.