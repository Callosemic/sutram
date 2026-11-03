# 🧶 Sutram: Web Component chassis with no build step
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**Sutram is a UI component library and front-end runtime that browsers load directly through import maps, with no bundler and no transpiler. It ships two layers: `yenVUI`, stateless presentation components and theme tokens, and `sutram`, an inversion-of-control runtime that wires them to state stores, an extension registry, slots, routing and keyboard shortcuts.**

Sutram is the presentation layer of [inSetu](https://github.com/Callosemic/insetu) and of the Axoneme apps. The name comes from Sanskrit सूत्रम्, "thread" or "formula".

| | |
| :--- | :--- |
| **Status** | `2.x`, developed alongside inSetu; its API follows what its hosts need. |
| **Built with** | [Lit](https://lit.dev) Web Components, [Zustand](https://github.com/pmndrs/zustand) vanilla stores, CodeMirror 6 for the editor; plain ES modules and CSS custom properties |
| **Themes** | Dark, Light and a high-contrast E-Ink theme, switched at runtime |
| **Used by** | [inSetu](https://github.com/Callosemic/insetu), which vendors it and locks it by content hash |

## Engineering highlights

* **No build step.** Components use bare specifiers (`lit`, `sutram-chassis`, `codemirror-core`) that the host resolves with a browser import map. Upgrading a dependency means changing one map entry.
* **Rules enforced by tests.** A fitness suite enforces the three laws below, plus theme-token use, no `innerHTML`, namespaced custom events, cleanup of observers and dialogs, passive touch listeners, and isolation from host domains.
* **Built for phones and tablets.** Components guard against iOS Safari edge-swipe navigation, register touch listeners as passive, and lay out with container queries rather than viewport breakpoints.
* **A host-agnostic editor.** `<yenvui-editor>` wraps CodeMirror 6 and loads extra languages only through a resolver the host supplies, so the chassis never decides where code comes from. Unknown languages fall back to plain text.

---
## 🏗️ Architecture

The repository holds both the presentation chassis (`yenVUI`) and the IoC runtime (`sutram`):

* **`yenVUI` (presentation chassis):** the "dumb" UI layer. Lit Web Components and CSS intent tokens (`theme-tokens.css`) that hold no application state, across Dark, Light and E-Ink themes.
* **`sutram` (IoC runtime and extension registry):** extends `yenVUI` primitives into state-aware components, manages the extension registry (`ExtensionRegistry`), projects extension views into custom element slots (`<sutram-app-shell>`), provides store factories (`createSutramStore`) and routes global keyboard shortcuts.
* **Host application (for example inSetu):** imports `sutram` and `yenVUI` through an HTML import map and wires its backend services (file system, git, LLM context) to `sutram` stores and extension slots.

---

## 📜 The three architectural laws

`sutram` and `yenVUI` follow three laws, enforced by automated fitness tests:

### 1. The "dumb component" rule
`yenVUI` primitives (for example `<yenvui-card>`, `<yenvui-modal>`) keep no internal memory, never query application registries and never manage business state. They rely on top-down property binding and emit normalized, bubbling custom events (`yenvui-*` or `yv-*`).

### 2. Composition over inheritance
Host applications never extend `yenVUI` primitive classes directly. They extend `SutramElement` (or a host base such as `InSetuElement` or `AxonemeElement`) for state, and project their templates into `sutram` containers through native `<slot>` elements.

### 3. The universal CSS vacuum
Host applications do not define raw structural CSS or hex colors. Visual styling lives in `theme-tokens.css` as semantic intent tokens (`var(--bg)`, `var(--pane-bg)`, `var(--intent-primary)`, `var(--border)`), so every view re-skins instantly across Dark, Light and E-Ink modes.

---

## 🛠️ Complete Primitive Reference

### 1. Pure Presentation Chassis Primitives (`yenVUI`)
Atomic, stateless presentation controls delivered by `yenVUI`:
| Primitive Tag | Description | Structural Guardrail |
| :--- | :--- | :--- |
| **`<yenvui-card>`** | Polymorphic catalog card with edge-triggered touch drawer | Emits `yenvui-card-select-toggled`; supports compact, flush, and stale modes. |
| **`<yenvui-card-group>`** | Container with horizontal gesture locking and accordion physics | Supports stacked layouts and iOS Safari edge-swipe navigation protection. |
| **`<yenvui-modal>`** | Accessible top-layer workspace overlay | Native HTML5 `<dialog>` operating in `#top-layer` with `:host { display: contents; }`; supports `transparent` backdrop mode. |
| **`<yenvui-async-btn>`** | Action button with integrated state machine physics | Renders `idle` \| `loading` \| `success` \| `error` states; emits `yv-click`. |
| **`<yenvui-tabs>`** | Carousel tab navigation header with sub-tab variants | View-caching router; emits `yenvui-tab-selected`. |
| **`<yenvui-toolbar>`** | Sticky action toolbar with search and filter dropdown | Container-query responsive layout (`@container`). |
| **`<yenvui-search-bar>`** | Instant text filter input with clear trigger | Emits debounced `yenvui-search-changed` events. |
| **`<yenvui-editor>`** | CodeMirror 6 text editor wrapper | Built-in languages come from `codemirror-core`; others load through the host's `languageResolver`, which returns a module URL or a descriptor (`{url, kind: "lezer" \| "stream" \| "builtin", export, options}`). Each language loads once and is cached; unknown languages fall back to plain text. |
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
| **`<yenvui-input>`**, **`<yenvui-select>`**, **`<yenvui-textarea>`**, **`<yenvui-toggle>`** | Stateless form controls | The presentation layer under the `sutram-*` inputs below. |

---

### 2. IoC Micro-Kernel & Extension Primitives (`sutram`)
State-aware wrappers, IoC brokers and form controls delivered by `sutram`:

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
| **`<sutram-drag-coordinator>`** | Drag-and-drop coordinator | Coordinates drag state and drop zones across the shell, with `<sutram-drop-target>` and `<sutram-drop-overlay>`. |
| **`<sutram-dag-tree>`** | Wavefront and hierarchy tree | Renders staged DAGs (such as routine runs) and nested hierarchies with a host-supplied node renderer. |
| **`<sutram-tabs>`** | Tab header wrapper | Wraps `<yenvui-tabs>`. |
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
| **`<sutram-combobox>`** | Filterable select | Type-to-filter option list with keyboard highlighting; emits `sutram-input-changed`. |
| **`<sutram-target-binding>`** | Endpoint and model picker | Paired endpoint and model selects (for example an LLM endpoint and a model on it), bound to one value object. |

---

## 🚀 Quick start (no build step)

`sutram` needs no bundler, transpiler or build toolchain. Browsers load it directly through a native HTML import map.

### 1. Vendor the Chassis

Copy (or minify) `sutram/js/`, `yenvui/js/`, and `yenvui/css/` into your static directory, keeping them side by side. `sutram` modules import `yenVUI` modules by relative path, so the layout below must be preserved:

```text
static/vendor/
├── sutram/js/     # from sutram/js/
└── yenvui/
    ├── js/        # from yenvui/js/
    └── css/       # from yenvui/css/
```

inSetu does this with [`scripts/vendor_sutram.sh`](https://github.com/Callosemic/insetu/blob/main/scripts/vendor_sutram.sh), which also minifies with `esbuild` when it is installed and records the sutram commit and a content hash in `sutram.lock.json`.

### 2. Configure the Upstream Import Map

Sutram and yenVUI leave dependency resolution to the host. Components use bare specifiers and never hard-code CDN URLs, so the host must provide an import map that resolves these specifiers:

```html
<script type="importmap">
{
  "imports": {
    "lit": "/static/vendor/lit/lit-core.min.js",
    "lit-virtualizer": "/static/vendor/lit/lit-virtualizer.min.js",
    "sutram-chassis": "/static/vendor/yenvui/js/index.js",
    "codemirror-core": "/static/vendor/codemirror/codemirror-core.js",
    "zustand/vanilla": "/static/vendor/zustand/vanilla.js",
    "zustand/middleware": "/static/vendor/zustand/middleware.js"
  }
}
</script>
```

`sutram-chassis` is how `sutram` modules import the `yenVUI` primitives they extend. The `lit-core.min.js` bundle must re-export Lit's decorators and directives, as inSetu's `vendor_lit.sh` does. `codemirror-core` is only needed if you use the editor.

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

The fitness suite enforces the three architectural laws above, among other rules. CI runs it together with the akasa and inSetu suites, and re-vendors every sutram change into inSetu before testing it there.

The [`docs/`](docs/) folder holds the engineering standards, the yenVUI blueprint and contracts, and the architecture decision records.

---

## 📄 License

Licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) and [NOTICE](NOTICE) files for details.

Copyright 2026 Sutram/yenVUI Contributors.
