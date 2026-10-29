# 🧶 Sutram: Presentation Micro-Kernel & yenVUI Chassis

**Sutram** (from Sanskrit सूत्रम्, meaning "thread" or "formula") is the zero-bundler, import-map-distributed Web Component micro-kernel and presentation chassis for the Axoneme ecosystem and `inSetu` Developer OS.

It provides an Inversion of Control (IoC) frontend substrate—managing component slot brokers, Zustand Unidirectional Data Flow (UDF) state subscriptions, URL hash routing, and native CSS intent tokens across Dark, Light, and brutalist E-Ink themes.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

---
## 🏗️ Architecture & Ecosystem Topology

The repository houses both the Inversion of Control (IoC) micro-kernel (`sutram`) and the presentation chassis (`yenVUI`). Together, they provide the presentation layer for host applications like `inSetu` OS:

* **`yenVUI` (Edge-Native Presentation Chassis):** The "dumb" UI grid. A collection of zero-dependency Lit Web Components and CSS intent tokens (`theme-tokens.css`) providing atomic visual primitives across Dark, Light, and brutalist E-Ink themes.
* **`sutram` (IoC Micro-Kernel & Extension Runtime):** The application substrate. Extends `yenVUI` primitives into state-aware IoC components, manages extension registries (`ExtensionRegistry`), handles custom element slot projection (`<sutram-app-shell>`), exposes state store factories (`createSutramStore`), and routes global keyboard shortcuts.
* **Host Application (`inSetu` OS):** The consuming desktop/web OS. Imports `sutram` and `yenVUI` via browser-native HTML import maps, wiring backend Python services (VFS transactions, git, local RAG) to `sutram` state stores and extension slots.

---

## 📜 The Three Architectural Laws

`sutram` and `yenVUI` are governed by three non-negotiable architectural laws enforced via automated fitness tests:

### 1. The "Dumb Component" Rule
`yenVUI` UI primitives (e.g., `<yenvui-card>`, `<yenvui-modal>`) have zero internal memory, never query application registries, and never manage business state. They rely entirely on top-down property binding and emit normalized, bubbleable custom events (`yenvui-*` or `yv-*`).

### 2. Composition Over Inheritance
Consuming applications must *never* extend `yenVUI` UI primitive classes directly. Instead, host applications extend `SutramElement`, `InSetuElement`, or `AxonemeElement` for state management, and project their templates into `sutram` containers using native HTML `<slot>` tags.

### 3. The Universal CSS Vacuum
Host applications are forbidden from defining raw structural CSS or hex colors. All visual styling is vacuumed into `theme-tokens.css` using semantic CSS intent tokens (`var(--bg)`, `var(--pane-bg)`, `var(--intent-primary)`, `var(--border)`), guaranteeing instant re-skinning across Dark, Light, and E-Ink modes via `MutationObserver`.

---

## 🛠️ Complete Primitive Reference

### 1. Pure Presentation Chassis Primitives (`yenVUI`)
Atomic, zero-state presentation controls delivered via `yenVUI`:
| Primitive Tag | Description | Structural Guardrail |
| :--- | :--- | :--- |
| **`<yenvui-card>`** | Polymorphic catalog card with edge-triggered touch drawer | Emits `yenvui-card-select-toggled`; supports compact, flush, and stale modes. |
| **`<yenvui-card-group>`** | Container with horizontal gesture locking and accordion physics | Supports stacked layouts and iOS Safari edge-swipe navigation protection. |
| **`<yenvui-modal>`** | Accessible top-layer workspace overlay | Native HTML5 `<dialog>` operating in `#top-layer` with `:host { display: contents; }`; supports `transparent` backdrop mode. |
| **`<yenvui-async-btn>`** | Action button with integrated state machine physics | Renders `idle` \| `loading` \| `success` \| `error` states; emits `yv-click`. |
| **`<yenvui-tabs>`** | Carousel tab navigation header with sub-tab variants | View-caching router; emits `yenvui-tab-selected`. |
| **`<yenvui-toolbar>`** | Sticky action toolbar with search and filter dropdown | Container-query responsive layout (`@container`). |
| **`<yenvui-search-bar>`** | Instant text filter input with clear trigger | Emits debounced `yenvui-search-changed` events. |
| **`<yenvui-editor>`** | CodeMirror 6 text editor wrapper | Encapsulates dynamic ESM language loading and compartment state reconfigurations. |
| **`<yenvui-collapsible>`** | Expandable accordion container with intent styling | Emits `yenvui-collapsible-toggled`. |
| **`<yenvui-category-section>`** | Categorized list section wrapper with header action slot | Sticky header sectioning. |
| **`<yenvui-dropdown>`** | Context popover trigger menu | Auto-dismisses on outside clicks. |
| **`<yenvui-filter-dropdown>`** | Sticky header filter overlay panel | Relative popover positioning. |
| **`<yenvui-pill>`** | Toggle tag badge supporting standard and text variants | Emits `yenvui-pill-toggled`. |
| **`<yenvui-filter-group>`** | Array of interactive toggle pills | Emits `yenvui-filter-changed`. |
| **`<yenvui-selection-tray>`** | Floating action tray for batch selection operations | Fixed-position selection counter and clear trigger. |
| **`<yenvui-status-bar>`** | Bottom system status bar with sync indicators | Text truncation and error state highlighting. |
| **`<yenvui-toast-container>`** | Alert notification stack | Non-blocking fixed overlay emitting `yenvui-toast-dismissed`. |
| **`<yenvui-spinner>`** | CSS loading spinner indicator | Text slot fallback. |
| **`<yenvui-empty-state>`** | Empty list feedback container | Centered layout with icon and message slots. |
| **`<yenvui-board>` & `<yenvui-column>`** | Multi-column flexible layout grid | Responsive container queries for layout collapse. |
| **`<yenvui-btn>`** | Synchronous action button | `label`, `icon`, `intent`, `variant`, and `size` properties; the base for `<yenvui-async-btn>`. |
| **`<yenvui-tag>`** & **`<yenvui-label>`** | Inline status tag and text label | Intent-colored, light-DOM rendering. |
| **`<yenvui-scroll-view>`** | Padded scroll container | Flex column layout with configurable padding. |
| **`<yenvui-scrub-track>`** | Horizontal scrub track | Touch pan locking (`touch-action: pan-y`) without horizontal overscroll. |
| **`<yenvui-window>`** | Spatial workspace window | `titleText`, anchor column, span, and z-order for multi-window layouts. |
| **`<yenvui-diff-viewer>`** | Search/replace diff viewer | Side-by-side and interleaved views of a patch or `SEARCH`/`REPLACE` pair. |
| **`<yenvui-drop-target>`** & **`<yenvui-drop-overlay>`** | Drag-and-drop zones | Full-viewport drop overlay and inline drop targets. |
| **`<yenvui-viewport>`** | Root viewport physics guard | Prevents iOS Safari edge-swipe history navigation while preserving vertical scroll and taps. |

---

### 2. IoC Micro-Kernel & Extension Primitives (`sutram`)
State-aware wrappers, IoC brokers, and form controls delivered via `sutram`:

| Primitive Tag | Description | Operational Purpose |
| :--- | :--- | :--- |
| **`<sutram-app-shell>`** | Top-level declarative tab layout shell | Queries `ExtensionRegistry` layout slots to construct primary and sub-tab hierarchies. |
| **`<sutram-entity-actions>`** | Standalone IoC action broker | Resolves and renders dynamic entity actions registered by extensions via `ExtensionRegistry`; supports `scrollable` mode. |
| **`<sutram-card>`** | IoC-bound card container | Binds `yenVUI` card selection state to `SelectionStore` and injects `<sutram-entity-actions>`. |
| **`<sutram-card-group>`** | IoC card group wrapper | Wraps `<yenvui-card-group>` for extension slot projection. |
| **`<sutram-modal>`** | IoC modal dialog wrapper | Binds `<yenvui-modal>` closing events to `SutramElement` dispatch. |
| **`<sutram-async-btn>`** | Async button wrapper | Accepts `onClick` async handlers and manages feedback state machine execution. |
| **`<sutram-field-card>`** | Standardized setting field card | Renders title, scope/security badges, header actions slot, and description caption. |
| **`<sutram-subtab-menu>`** | Declarative sub-tab action & bulk menu | Aggregates scoped bulk selection actions and dynamic `menuActions` in column headers. |
| **`<sutram-generic-settings>`** | Dynamic extension settings modal | Generates form controls automatically from extension schema definitions. |
| **`<sutram-selector-modal>`** | Fuzzy-searchable item picker modal | Fuzzy-filters object arrays for prompt/template pickers. |
| **`<sutram-folder-browser>`** | Workspace directory tree browser | Interactive path navigation breadcrumbs. |
| **`<sutram-categorized-list>`** | Categorized card list renderer | Groups items by category key and renders categorized `yenVUI` card groups. |
| **`<sutram-selection-tray>`** | Multi-item batch action tray | Reads `SelectionStore` and executes registered extension `batchActions`. |
| **`<sutram-status-bar>`** | System status bar wrapper | Listens for global `sutram-status-update` and `sutram-sync-status` events. |
| **`<sutram-toast-container>`** | Toast notification wrapper | Subscribes to `ToastStore` and renders active alerts. |
| **`<sutram-editor>`** | Editor wrapper | Wraps `<yenvui-editor>` and exposes `insertAtCursor(text)`. |
| **`<sutram-toolbar>`** | Sticky toolbar wrapper | Wraps `<yenvui-toolbar>` for search event routing. |
| **`<sutram-search-bar>`** | Search input wrapper | Wraps `<yenvui-search-bar>`. |
| **`<sutram-dropdown>`** | Dropdown wrapper | Wraps `<yenvui-dropdown>`. |
| **`<sutram-filter-dropdown>`** | Filter dropdown wrapper | Wraps `<yenvui-filter-dropdown>`. |
| **`<sutram-collapsible>`** | Collapsible section wrapper | Wraps `<yenvui-collapsible>`. |
| **`<sutram-category-section>`**| Category section wrapper | Wraps `<yenvui-category-section>`. |
| **`<sutram-pill>`** | Pill badge wrapper | Wraps `<yenvui-pill>`. |
| **`<sutram-filter-group>`** | Filter group wrapper | Wraps `<yenvui-filter-group>`. |
| **`<sutram-spinner>`** | Loading indicator wrapper | Wraps `<yenvui-spinner>`. |
| **`<sutram-empty-state>`** | Empty state wrapper | Wraps `<yenvui-empty-state>`. |
| **`<sutram-board>` & `<sutram-column>`** | Board layout wrappers | Wraps `<yenvui-board>` and `<yenvui-column>`. |
| **`<sutram-report-projection>`** | Spatial report projection primitive | Multi-tab dry-run and diff inspector with integrated text-blob action staging and async controls. |
| **`<sutram-btn>`** | Synchronous button wrapper | Wraps `<yenvui-btn>`; buttons declare their label as a property (`SUTRAM_BUTTON_DECLARATIVE_LABEL_MANDATE`). |
| **`<sutram-virtual-list>`** | Universal virtualized list | Renders large card collections through `lit-virtualizer`. |
| **`<sutram-settings-form>`** | Schema-driven settings form | Renders an extension's settings schema, including per-repository scopes. |
| **`<sutram-window>`** & **`<sutram-projection-window-controls>`** | Multi-window projection | Pop-out and dock-in controls for projecting views into spatial windows. |
| **`<sutram-diff-viewer>`** | Synchronized diff viewer | Wraps `<yenvui-diff-viewer>` with dual-box and interleaved modes. |
| **`<sutram-drag-coordinator>`** | Drag-and-drop coordinator | Coordinates drag state and drop zones across the shell. |
| **`<sutram-scroll-view>`**, **`<sutram-scrub-track>`**, **`<sutram-tag>`**, **`<sutram-label>`** | Layout and text wrappers | Wrap their `yenVUI` counterparts. |
| **`<yv-icon>`** | Icon micro-primitive | Defined by `sutram-boot.js`; renders icons from the `window.SutramIcons` dictionary as CSS masks. |

---

### 3. Declarative Form Inputs (`sutram/inputs.js`)
UDF-compliant form controls providing standard state bindings:

| Primitive Tag | Description | Key Features |
| :--- | :--- | :--- |
| **`<sutram-input>`** | Single-line text/password/number input | Supports `type`, `placeholder`, `disabled`, and `inline` layout modes; emits `sutram-input-changed`. |
| **`<sutram-select>`** | Custom select dropdown | Accepts `options` array (`[{value, label}]`); emits `sutram-input-changed`. |
| **`<sutram-textarea>`** | Auto-resizing multi-line text area | Supports `autoSize`, `maxHeight`, `monospace`, and `borderless` modes; auto-calculates height on input. |
| **`<sutram-toggle>`** | Boolean toggle switch | Custom track/thumb toggle; emits `sutram-input-changed`. |

---

## 🚀 Quick Start (Zero Build Step)

`sutram` requires zero bundlers, zero transpilation steps, and zero build toolchains. It is delivered directly to the browser via native HTML import maps.

### 1. Vendor the Chassis

Copy (or minify) `sutram/js/`, `yenvui/js/`, and `yenvui/css/` into your static directory, keeping them side by side. `sutram` modules import `yenVUI` modules by relative path, so the layout below must be preserved:

```text
static/vendor/
├── sutram/js/     # from sutram/js/
└── yenvui/
    ├── js/        # from yenvui/js/
    └── css/       # from yenvui/css/
```

inSetu does this with [`scripts/vendor_sutram.sh`](https://github.com/Callosemic/insetu/blob/main/scripts/vendor_sutram.sh), which also minifies with `esbuild` when it is installed.

### 2. Configure the Upstream Import Map

Sutram and yenVUI operate entirely via **Inversion of Control for Dependency Resolution**. Components rely on bare specifiers and never hardcode CDN URLs. The host application MUST provide an HTML5 import map that resolves these specifiers:

```html
<script type="importmap">
{
  "imports": {
    "lit": "/static/vendor/lit/lit-core.min.js",
    "lit-virtualizer": "/static/vendor/lit/lit-virtualizer.min.js",
    "codemirror-core": "/static/vendor/codemirror/codemirror-core.js",
    "zustand/vanilla": "/static/vendor/zustand/vanilla.js",
    "zustand/middleware": "/static/vendor/zustand/middleware.js"
  }
}
</script>
```

The `lit-core.min.js` bundle must re-export Lit's decorators and directives, as inSetu's `vendor_lit.sh` does.

### 3. Load the Bootloader & Render

`sutram-boot.js` is a classic script. It installs the duplicate-registration guard and `<yv-icon>`, then fires `sutram:boot-ready`, after which the host imports the component modules:

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <!-- import map from step 2 goes here -->
  <link rel="stylesheet" href="/static/vendor/yenvui/css/theme-tokens.css">
  <link rel="stylesheet" href="/static/vendor/yenvui/css/yenvui-primitives.css">
  <script src="/static/vendor/sutram/js/sutram-boot.js"></script>
</head>
<body>

  <!-- Dumb Component Projection -->
  <sutram-card titleText="My System File" descriptionText="v1.0.0">
    <div slot="actions">
      <sutram-async-btn label="Save Changes" intent="primary"></sutram-async-btn>
    </div>
  </sutram-card>

  <script>
    window.addEventListener('sutram:boot-ready', () => {
      import('/static/vendor/sutram/js/primitives.js');
    });
  </script>
</body>
</html>
```

---

## 🧪 Development & Testing

```bash
python tests/run_unit_tests.py      # unit suite (store and registry tests run in Node when it is installed)
python tests/fitness_functions.py   # presentation and IoC fitness rules
```

The fitness suite enforces the three architectural laws above. CI runs it together with the akasa and inSetu suites, and re-vendors every sutram change into inSetu before testing it there.

---

## 📄 License

Licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) and [NOTICE](NOTICE) files for details.

Copyright 2026 Sutram/yenVUI Contributors.
