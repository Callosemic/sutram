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
*   **Spatial Grid & Rail Geometry:** `--yv-utility-height`, `--yv-header-height`, `--yv-gutter-x`, `--yv-rail-cell-width`, `--yv-icon-size`, `--yv-icon-gap`

## III. Component Interface Matrix

Any replacement library must export the following Custom Elements.

### Core Layout & Overlays
*   **`<yenvui-modal>`**: Native `#top-layer` dialog.
    *   *Properties:* `?open`, `.titleText`, `?fullscreen`, `?flush`, `.maxWidth`.
    *   *Events:* `@yenvui-modal-closed`, `@yenvui-modal-closing`.
    *   *Slots:* `body`, `footer`, default.
*   **`<yenvui-card>`**: Polymorphic catalog container.
    *   *Properties:* `.titleText`, `.descriptionText`, `.detailText`, `.detailPrefix`, `.detailSuffix`, `.icon`, `.intentColor`, `?selected`, `?disableSelection`, `?compact`, `?flush`, `?has-actions`.
    *   *Events:* `@yenvui-card-select-toggled`.
    *   *Slots:* `header-tags`, `detail`, `inline-actions`, `actions`, default.
*   **`<yenvui-card-group>`**: Wraps cards with accordion and horizontal swipe physics.
    *   *Properties:* `?enableEdgeSelection`, `?stacked`, `?accordion`.
*   **`<yenvui-tabs>`**: Carousel tab navigation.
    *   *Properties:* `.tabs` (Array of `{id, label}`), `.activeTab`, `.variant` (`primary`|`sub`), `?cacheViews`.
    *   *Events:* `@yenvui-tab-selected`.
*   **`<yenvui-board>` & `<yenvui-column>`**: Multi-column container-query grids.
    *   *Column Properties:* `.titleText`, `.intentColor`.

### Interactive Controls
*   **`<yenvui-async-btn>`**: Action button with visual state feedback.
    *   *Properties:* `.label`, `.loadingLabel`, `.successLabel`, `.errorLabel`, `.intent`, `.status` (`idle`|`loading`|`success`|`error`), `?disabled`, `?active`.
    *   *Events:* `@yv-click`.
*   **`<yenvui-editor>`**: CodeMirror 6 text editor.
    *   *Properties:* `.value`, `?readOnly`, `.language`, `?writingMode`, `.customExtensions`.
    *   *Methods:* `insertAtCursor(text)`.
    *   *Events:* `@yenvui-editor-changed`.

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

### Inputs & Filtering
*   **`<yenvui-dropdown>`**: Floating action menu utilizing native `#top-layer` Popover API.
    *   *Properties:* `.items` (Array of `{id, label, icon, onClick, asyncAction, divider}`), `?open`, `.align` (`'auto'`|`'left'`|`'right'`).
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