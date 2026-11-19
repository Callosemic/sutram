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
*   **Spatial Grid & Rail Geometry:** `--yv-utility-height`, `--yv-header-height`, `--yv-gutter-x`, `--yv-rail-cell-width`, `--yv-icon-size`, `--yv-icon-gap`, `--textarea-min-height`, `--yv-sidebar-width`
*   **Structural Width & Column Capability Tokens:** `--yv-col-xs`, `--yv-col-sm`, `--yv-col-md`, `--yv-col-lg`, `--yv-view-sm`, `--yv-view-md`, `--yv-view-lg`, `--yv-view-xl`, `--yv-modal-sm`, `--yv-modal-md`, `--yv-modal-lg`, `--yv-modal-xl`, `--yv-bubble-max-width`, `--yv-surface-min-h-sm`, `--yv-surface-min-h-md`, `--yv-surface-min-h-lg`

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
*   **`<sutram-entity-actions>`**: Fit-then-overflow entity action row and menu-bar broker supporting variant-set split buttons and sectioned overflow dropdowns.
    *   *Properties:* `.entityType` (String), `.entityData` (Object), `.actionsList` (Array), `.variant` (`'row'`|`'menu-bar'`|`'footer'`), `?compact` (Boolean).
*   **`<sutram-variant-btn>`**: Split button primitive for collapsed variant sets with device-local last-used default resolution and width reservation (`--variant-min-width`).
    *   *Properties:* `.setEntry` (Object), `.entityType` (String), `.entityData` (Object), `?compact` (Boolean), `.executeAction` (Async Function).
*   **`<sutram-subtab-menu>`**: Spatial column view menu (always first on the left of every column header row) aggregating group-scoped bulk selection actions, flattened variant sets, view `menuActions`, and `.extraContentNodes` under section headings. Renders disabled in place when the active view has no menu actions so column tab geometry never shifts.
    *   *Properties:* `.slotConfig` (Object with `bulkActionGroup`, `bulkEntityTypes`, `menuActions`, `menuStores`), `.extraContentNodes` (Array of DOM nodes).
*   **`<sutram-floating-hud>`**: Corner-pinned collapsible status and telemetry HUD drawer.
    *   *Properties:* `.position` (`'top-right'`|`'top-left'`|`'bottom-right'`|`'bottom-left'`), `.icon` (String), `.badgeText` (String), `.titleText` (String), `.intent` (`'primary'`|`'success'`|`'warning'`|`'danger'`|`'highlight'`|`'neutral'`), `.open` (Boolean).
    *   *Events:* `@sutram-hud-toggled`.
    *   *Slots:* `header`, default, `footer`.
*   **`<yenvui-viewport>`**: Tier 0 root viewport wrapper installing the singleton viewport physics guard to defeat iOS Safari edge-swipe back-navigation while preserving vertical momentum scrolling and tap responsiveness.
*   **`<yenvui-view>`**: Primary viewport container.
    *   *Properties:* `.titleText`, `.descriptionText`, `?compact`, `?flush`, `?noScroll`, `?zen`, `.size` (`'compact'`|`'normal'`|`'wide'`|`'full'`).
    *   *Events:* `@yenvui-view-exit-zen`.
    *   *Slots:* `header`, `header-actions`, `toolbar`, `overlay`, default, `footer`.
*   **`<yenvui-stack>`**: Flex and auto-fit CSS Grid layout stack.
    *   *Properties:* `.direction` (`'col'`|`'row'`|`'grid'`), `?compact`, `.columns` (`'compact'`|`'normal'`|`'wide'`), `.gap` (`'none'`|`'compact'`|`'normal'`|`'wide'`), `.align`, `.alignSelf` (`'start'`|`'center'`|`'end'`|`'stretch'`), `.justify`, `.padding` (`'none'`|`'compact'`|`'normal'`|`'wide'`), `.width` (`'auto'`|`'bubble'`|`'full'`), `?grow`, `?wrap`, `?flex`, `?scrollable`, `?spanFull`.
*   **`<yenvui-surface>`**: Semantic surface container.
    *   *Properties:* `.variant` (`'panel'`|`'inset'`|`'tinted'`|`'floating'`|`'ghost'`), `.intent`, `?compact`, `?flush`, `.padding` (`'none'`|`'compact'`|`'normal'`|`'wide'`), `.border` (`'all'`|`'top'`|`'bottom'`|`'left'`|`'none'`), `.radius` (`'none'`|`'compact'`|`'normal'`|`'wide'`), `.gap` (`'none'`|`'compact'`|`'normal'`|`'wide'`), `.align`, `.justify`, `.alignSelf`, `.width` (`'auto'`|`'bubble'`|`'full'`), `.minHeight` (`'compact'`|`'normal'`|`'wide'`), `?flex`, `?interactive`.
*   **`<yenvui-sidebar-layout>`**: Container-query responsive split-pane sidebar rail and stage layout with mobile slide-over drawer collapse (`--yv-sidebar-width`, default `300px`).
    *   *Properties:* `.intent`, `?drawerOpen`, `?collapsed`, `.navTitle`, `.navItems`, `.activeNavId`.
    *   *Events:* `@yenvui-nav-selected`, `@yenvui-drawer-closed`.
    *   *Slots:* `sidebar`, default.
*   **`<yenvui-modal>`**: Native `#top-layer` dialog.
    *   *Properties:* `?open`, `.titleText`, `?compact`, `.size` (`'compact'`|`'normal'`|`'wide'`|`'full'`), `?fullscreen`, `?flush`.
    *   *Methods:* `bringToFront()`.
    *   *Events:* `@yenvui-modal-closed`, `@yenvui-modal-closing`.
    *   *Slots:* `body`, `footer`, default.
*   **`<yenvui-window>`**: Native `<dialog>` grid-constrained spatial window.
    *   *Properties:* `.titleText`, `.anchorCol` (`'left'`|`'center'`|`'right'`), `.span` (1|2|3), `.z`, `.icon`, `.intent`.
    *   *Events:* `@yenvui-window-close`, `@yenvui-window-dock`, `@yenvui-window-focus`, `@yenvui-window-drag-start`.
    *   *Slots:* default.
*   **`<yenvui-card>`**: Polymorphic catalog container with self-measured width tiers (`>= 720px` inline actions vs `< 720px` drawer).
    *   *Properties:* `.filename`, `.titleText`, `.descriptionText`, `.detailText`, `.detailPrefix`, `.detailSuffix`, `.statusText`, `.icon`, `.intent`, `?selected`, `?disableSelection`, `?compact`, `?flush`, `?stale`, `?has-actions`, `?wide-card`, `.actionsOpen` (Boolean getter/setter), `.hasActions` (Boolean getter/setter).
    *   *Host Markers:* `[data-yv-card]`, `[wide-card]`.
    *   *Events:* `@yenvui-card-select-toggled`, `@yenvui-card-clicked`, `@yenvui-card-actions-opened`, `@yenvui-card-tier-changed`, `@yenvui-overlay-opened`.
    *   *Slots:* `header-actions`, `detail`, `inline-actions`, `actions`, default.
*   **`<yenvui-collapsible>`**: Collapsible content section with semantic header styling.
    *   *Properties:* `.titleText`, `?open`, `.intent` (`primary`|`success`|`highlight`|`warning`|`danger`|`neutral`), `?compact`, `?flush`.
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
    *   *Column Properties:* `.titleText`, `.intent` (`'primary'`|`'success'`|`'warning'`|`'danger'`|`'highlight'`|`'neutral'`).
### Interactive Controls
*   **`<yenvui-btn>` & `<yenvui-async-btn>`**: Action buttons (`<yenvui-async-btn>` includes visual state feedback and 900ms confirmation holds).
    *   *Properties:* `.label`, `.icon`, `.loadingLabel`, `.successLabel`, `.errorLabel`, `.intent`, `.variant`, `?compact`, `?emphasis`, `?grow`, `?fullWidth`, `.status` (`idle`|`loading`|`success`|`error`), `?disabled`, `?active`, `.confirmHoldMs` (Number, default `900`), `.jobRoute`, `.jobPayload`, `.onJobComplete`, `.onJobProgress`, `.onJobError`.
    *   *Events:* `@yv-click`, `@yenvui-action-confirmed`.
*   **`<yenvui-editor>`**: CodeMirror 6 text editor.
    *   *Properties:* `.value`, `?readOnly`, `.language`, `?writingMode`, `?enableMarkdownLinks`, `.customExtensions`, `.languageResolver` (Async Function: `lang => null | string | { url, kind: "lezer" | "stream" | "builtin", export, options? }`).
    *   *Static Properties:* `YenvuiEditor.languageResolver` (Global fallback resolver callback returning a module URL string or a language descriptor object; unknown languages fall back to plain text `[]`).
    *   *Methods:* `insertAtCursor(text)`, `getCursor()`, `setCursor(pos)`, `getScrollInfo()`, `setScrollInfo(top)`, `transformContent(transformFn)`.
    *   *Events:* `@yenvui-editor-changed`, `@yenvui-editor-selection`, `@yenvui-editor-scroll`, `@yenvui-editor-link-clicked`.

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
*   **`<sutram-selection-tray>`**: State-bound selection staging chip and modal tray with automatic `[empty]` host collapse and slot-piercing responsive chip labels (`>= 480px` full label vs `< 480px` compact badge).
    *   *Properties:* `.selectedItems` (Map), `.modalOpen` (Boolean), `.trayTitle` (String), `.itemBadge` (String), `.bulkGroup` (String, default `'share'`), `?empty` (Boolean, reflected).
*   **`<yenvui-empty-state>`**: Empty placeholder.
    *   *Properties:* `.icon`, `.text`.
*   **`<yenvui-spinner>`**: Loading indicator.
    *   *Properties:* `.text`.
*   **`<yenvui-diff-viewer>`**: Kinetic visual diff viewer for paired hunks and unified streams.
    *   *Properties:* `.diffText`, `.searchStr`, `.replaceStr`, `.searchLines`, `.replaceLines`, `.leftTitle`, `.rightTitle`, `.mode` (`auto`|`split-side`|`split-stacked`|`interleaved`), `.activeLineIndex`.
    *   *Events:* `@yenvui-diff-line-selected`, `@yenvui-diff-mode-changed`.
*   **Physics & Gesture Utilities (`physics.js`)**:
    *   *Constants:* `COLUMN_UNIT_PX` (`360`), `WIDE_CARD_MIN_PX` (`720`), `PHYSICS` (`COLUMN_UNIT_PX`, `WIDE_CARD_MIN_PX`, `EDGE_START_BEZEL_PX`, `EDGE_MOVE_BEZEL_PX`, `AXIS_LOCK_THRESHOLD_PX`, `TAP_SLOP_PX`, `MIN_THROW_VELOCITY`, `THROW_DECAY`, `POPOVER_ESTIMATED_WIDTH_PX`).
    *   *Functions:* `startKineticThrow(scrollEl, samples, options)`, `acquireBodyScrollLock()`, `releaseBodyScrollLock()`, `getDeepElementFromPoint(x, y, selector)`, `anchorTopLayerPopover(triggerEl, popoverEl, options)`, `syncTopLayerPopover(triggerEl, popoverEl, isOpen, options)`.
### Inputs & Filtering
*   **`<yenvui-input>`**: Single-line text input presentation primitive.
    *   *Properties:* `.label`, `.value`, `.placeholder`, `.type`, `.min`, `.max`, `?disabled`, `?inline`, `?flush`, `?grow`.
    *   *Events:* `@yenvui-input-changed`.
*   **`<yenvui-select>`**: Dropdown select presentation primitive.
    *   *Properties:* `.label`, `.value`, `.options` (Array of `{value, label}`), `?disabled`, `?inline`, `?flush`, `?grow`.
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
    *   *Behavior:* Preserves selected model value when switching endpoints if the model remains valid in the new candidate catalog. Contained child input events do not leak duplicate `@sutram-input-changed` emissions.
    *   *Events:* `@sutram-input-changed`.
*   **`<sutram-composer>`**: Unified prompt and slash-command message composer with internal native `<textarea>` synchronization.
    *   *Properties:* `.value` (String), `.placeholder` (String), `.triggerPrefix` (String, default `'/'`), `.triggers` (Array of command objects `{ id, token, label, icon, badge, description }`), `.activeTrigger` (Object), `.intent` (`'primary'`|`'success'`|`'warning'`|`'danger'`|`'highlight'`), `?disabled` (Boolean).
    *   *Behavior:* Synchronizes text and command tokens directly to the underlying `<textarea>` element value and contains intermediate input bubbling.
    *   *Events:* `@sutram-input-changed`, `@sutram-trigger-changed`, `@sutram-composer-submit`.
    *   *Slots:* `header`, `prefix`, default, `footer`.
*   **`SutramCacheWarmer`**: Low-priority background asset pre-fetcher and warming engine.
    *   *Properties:* `.size` (Number, returns current queue count).
    *   *Methods:* `enqueue(scopeId, urls, fetcher)`, `removeByPrefix(scopeId, urlPrefix)`, `clear()`, `drain(delayMs)`.
*   **`<yenvui-dropdown>`**: Floating action menu utilizing native `#top-layer` Popover API with section-preserving fuzzy search, checkable items, trailing item actions, and 900ms confirmation holds.
    *   *Properties:* `.items` (Array of `{id, label, icon, checkable, checked, badge, description, section, successLabel, confirmHoldMs, onPointerDown, onClick, asyncAction, trailingButton: {icon, title, closeMenu, onClick}, divider, sectionHeading}`), `?open`, `?searchable`, `.searchPlaceholder`, `.confirmHoldMs` (Number, default `900`), `.filterFn` (Function), `.align` (`'auto'`|`'left'`|`'right'`), `.direction` (`'auto'`|`'up'`|`'down'`).
    *   *Events:* `@yenvui-action-confirmed`, `@yenvui-action-error` (dispatched on unhandled action exception).
    *   *Slots:* `trigger`, `header`, `content`.
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
*   **`<yenvui-label>`**: Typography and input label primitive.
    *   *Properties:* `.text`, `.intent` (`'primary'`|`'success'`|`'warning'`|`'danger'`|`'highlight'`|`'neutral'`), `?monospace`, `?truncate`, `?preWrap`, `?strikethrough`.
*   **`<yenvui-toolbar>`**: Sticky header toolbar integrating search and filters.
    *   *Properties:* `.searchQuery`, `.searchPlaceholder`, `?enableFilterDropdown`, `.filterText`, `.activeFilters`, `?hasFiltersOverride`, `?flush`.
*   **`<yenvui-scrub-track>`**: Horizontal touch-scrubbing track.
    *   *Properties:* `?grow`, `?monospace`.

## V. Backend Adapter Contract (`SutramBackendAdapter`)

Host applications mounting Sutram against authenticated or multi-tenant backends register an adapter instance via `registerBackendAdapter(adapter)` (`sutram/js/client.js`).

*   **Required Methods (`REQUIRED_BACKEND_ADAPTER_METHODS`):** `bootstrap`, `fetchRaw`, `request`, `resolveScopedUrl`, `probeHealth`, `getBuildId`, `pollJob`, `connectStream`.
*   **Validation:** `validateBackendAdapter(adapter)` throws `[Sutram Boot Error]` if any required method is missing.
*   **Implementations:** `SutramBackendAdapter` (minimal base adapter) and `AkasaBackendAdapter` (token header injection, single-flight 401 re-authentication, `X-Akasa-Build-ID` / `X-Sutram-Build-ID` passive build sniffing, per-scope `AbortController` signals, `OfflineHttpProvider` delegation, scope-guarded `pollJob`, and `EventSource` `connectStream`).