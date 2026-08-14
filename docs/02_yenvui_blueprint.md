# yenVUI: Ecosystem Presentation Chassis
**Date:** 2026-07-18
**Context:** Standup & Architectural Blueprint

This document captures the foundational blueprint, philosophy, and execution sequence for building **yenVUI**—the universal, bundleless presentation layer that will power both the Axoneme Console and inSetu OS ecosystems.

---
## 1. The Philosophy of `yenVUI`

**yenVUI** (**Y**our **E**dge-**N**ative **V**isual **U**ser **I**nterface — and from the Vietnamese *yên vui*, meaning peaceful and happy) is the ultimate presentation abstraction. It is designed to bring a sense of serene developer joy by completely separating visual components from business logic.

The goal is to stop writing manual HTML string concatenations, stop debugging layout reflows across different apps, and stop copying and pasting CSS. yenVUI is a strict, "dumb" UI grid that handles structure, theming, and layout natively so the consuming applications can focus solely on API physics and state management.

## 2. Core Architectural Mandates

Because yenVUI operates across multiple applications entirely without a build step (using browser-native import maps), it must adhere to strict architectural laws.
### The State-Presentation Boundary (Declarative Design System)
The architectural boundary strictly preserves Unidirectional Data Flow (UDF) for consuming applications. yenVUI is a **Declarative Design System**, not an imperative orchestrator.
*   **yenVUI Owns Ephemeral UI State & Physics:** yenVUI natively manages transient interface mechanics like CSS Container Queries, `#top-layer` modal stacking, focus trapping, ESC key interception, swipe gestures, and theme token subscriptions. It exposes declarative properties (e.g., `?open`) and emits standard DOM events (e.g., `@yenvui-modal-closed`).
*   **The App Owns Persistent Business State & UDF:** Client-side routing, Zustand state management (e.g., `AppStore`), multi-tenant workspace logic, background polling loops, and backend API orchestration. The app dictates *why* and *when* a UI element appears; yenVUI handles *how* it renders.
### Composition Over Inheritance (The HTML Handshake)
To separate visual paint from multi-tenant state management, applications must use composition. Application components must **never** extend yenVUI classes.
*   **The Paint (`yenVUI`):** Components like `<yenvui-card>` extend `LitElement` locally within the `yenvui` repo. They handle Shadow DOM styling, theme observation, and pure UI physics.
*   **The State (`inSetu` / `Axoneme`):** Components extend `InSetuElement` (for local OS workspace routing) or `AxonemeElement` (for remote `AxonemeAuth` JWT token injection and `brandId` scoping).
*   **The Handshake:** The ecosystems interact strictly through declarative HTML projection. Applications use yenVUI elements exactly like native HTML tags, injecting stateful logic via `<slot>` tags and altering visuals via CSS intent variables.

### The Universal CSS Vacuum
Consuming applications (like inSetu) must strip their global `style.css` down to the absolute minimum boilerplate (e.g., `body` margins, `padding`, and font imports). All heavy CSS lifting—theme definitions (Dark/Light/E-Ink), scrollbars, standard inputs, and semantic intent tokens (`--bg`, `--intent-primary`)—is permanently vacuumed out of the host application and centralized inside yenVUI.
### The "Dumb Component" Rule & Content Projection
Components within yenVUI must never know *why* they are rendering data, nor should they handle data persistence or query application registries. yenVUI is strictly limited to **atomic primitives** (cards, modals, buttons, inputs).
*   **Forbidden:** A card component querying `window.ExtensionRegistry` to determine its own buttons.
*   **Forbidden:** Complex, domain-specific layouts like `<yenvui-kanban-board>` or `<yenvui-git-diff>`. Extensions remain the architects of their own domain layouts.
*   **Mandated:** A polymorphic `<yenvui-card>` that exposes a `<slot name="actions">`. The consuming application iterates over its own registries and declaratively projects standard `<button slot="actions">` elements into the yenVUI layout, which yenVUI styles uniformly. Extensions assemble their views using these atomic "Lego blocks" rather than writing raw HTML and custom CSS.
*   **Primitive Form & Interactive Controls:** Custom Web Component primitives that encapsulate native HTML controls (such as `<button>` or `<input>`) must explicitly pass through structural attributes (e.g., `type="button|submit"`) and emit normalized custom events (`yenvui-` or `yv-`) rather than intercepting business execution flow.
### Bundleless Import Maps & Upstream Delegation
yenVUI components are built to be completely environment-agnostic. To maintain a zero-bundler architecture, components must rely entirely on **bare specifiers** (e.g., `import('lit')` or `import('codemirror-core')`) and must never hardcode external CDN URLs inside their logic.

It is the strict responsibility of the **Host Application** (e.g., inSetu OS, Axoneme Console) to synthesize and inject an HTML5 `<script type="importmap">` during the Stage 1 boot phase. This Inversion of Control allows the host OS to securely manage vendorization, deduplication, and offline air-gapping without `yenVUI` needing a build step.

**Host Application Import Map Example:**
```html
<script type="importmap">
{
    "imports": {
        "lit": "/static/vendor/lit/lit-core.min.js",
        "codemirror-core": "/static/vendor/codemirror/codemirror-core.js",
        "@codemirror/lang-python": "/static/vendor/codemirror/lang-python.js",
        "yenvui/": "/static/vendor/yenvui/js/"
    }
}
</script>
```

## 3. The Component Arsenal (Phase 1 Primitives)

To replace the imperative layout structures of the legacy Axoneme Console, yenVUI will prioritize these three atomic components:

1.  **`<yenvui-tabs>` (The Carousel Header)**
    *   Replaces the legacy vertical sidebar.
    *   Uses `display: flex` and `overflow-x: auto` (with hidden scrollbars) to create a fluid, touch-friendly horizontal swipe carousel.
    *   Supports dynamic layout registration via slots, allowing infinite pluggable navigation items without breaking mobile viewports.
2.  **`<yenvui-card>` (The Polymorphic Grid Node)**
    *   The universal container for catalog items (Knowledge docs, Ingestion Jobs, etc.).
    *   *Properties:* `icon`, `titleText`, `detailText`, `intentColor`.
    *   *Slots:* `slot="actions"` for injecting context-specific buttons (like "Approve" or "Tombstone") into a clean, edge-triggered hover/touch overlay drawer.
3.  **`<yenvui-modal>` (The Workspace Overlay)**
    *   Replaces inline editors and chunky screen sections.
    *   Utilizes the native HTML5 `<dialog>` element to push into the browser's `#top-layer`, permanently escaping `z-index` traps. It intercepts native ESC/cancel events to emit `@yenvui-modal-closed` back to the app's UDF store.
4.  **`<yenvui-toast-container>` (The Non-Blocking Alert)**
    *   Eradicates legacy `window.alert` singletons.
    *   Accepts a declarative array of toast data (`.toasts=${...}`) from the app's Zustand store, enforcing zero-DOM guardrails when empty and emitting `@yenvui-toast-dismissed`.
5.  **`<yenvui-pill>` & `<yenvui-filter-group>` (Filtering Primitives)**
    *   Atomic toggle badges emitting `@yenvui-pill-toggled` and group wrapper managing active filter sets emitting `@yenvui-filter-changed`.
6.  **`<yenvui-dropdown>` & `<yenvui-filter-dropdown>` (Context Overlays)**
    *   Lightweight popover trigger menus with outside-click dismissal.
7.  **`<yenvui-search-bar>` (Filter Input)**
    *   Standardized text search primitive with clear button and `@yenvui-search-changed` emissions.
8.  **`<yenvui-editor>` (CodeMirror 6 Text Editor)**
    *   Encapsulated CodeMirror 6 editor with dynamic ESM language extension loading, compartment state reconfigurations, and `@yenvui-editor-changed` emissions.
9.  **`<yenvui-toolbar>` (Sticky Action Row)**
    *   Sticky header toolbar primitive integrating search and filter controls with `@container` elasticity.
10. **`<yenvui-category-section>` (Semantic List Wrapper)**
    *   Section grouping primitive with sticky headers, action slot projection, and high-contrast E-Ink styling.
11. **`<yenvui-selection-tray>` (Batch Selection Overlay)**
    *   Fixed bottom tray for multi-item batch operations, featuring badge counters, action slot projection, and UDF reset triggers.

## 4. The Execution Order of Operations

We are bypassing the "incubation" phase entirely. Since development happens primarily inside the **inSetu OS**, we will spin up yenVUI as a parallel repository from day one and manage both codebases via inSetu's multi-tenant targets.
### Step 1: Establish the Repositories
1.  Initialize `yenvui` (the standalone presentation framework).
2.  Initialize `axoneme-console-v3` (the clean-slate UI wrapper for the Axoneme backend).
3.  Mount the ecosystem edge apps (`occipitum`, `gear-library-ui`, `glial`) and the new repositories into the inSetu `target_repos` configuration.

### Step 2: Build the yenVUI Core (The Sandbox)
1.  Write `theme-tokens.css` inside `yenvui`. Define the core intent variables (`--bg-deep`, `--intent-success`, etc.) across all three visual themes (Dark, Light, E-Ink).
2.  Code the foundational Lit elements (`card.js`, `modal.js`, `tabs.js`) using strictly declarative templates and CSS variable hooks. No hardcoded hex colors allowed.
3.  Serve the `yenvui` directory on a local static port (e.g., `4444`).

### Step 3: Scaffold the Axoneme Console Rebuild
1.  In `axoneme-console-v3`, build the `index.html` shell.
2.  Inject the browser-native `<script type="importmap">` pointing to `http://localhost:4444/js/`.
3.  Establish the client-side Zustand store (`state.js`) to handle API tokens and tenant scopes statelessly.
### Step 4: The Priority Ingestion & Migration Loop
*Phase 1 focuses strictly on the core gravity wells: inSetu OS and Axoneme Console.*

To avoid catastrophic layout collapses in live applications, all migrations must follow the **DOM-First Vacuum Rule**:
1. **Build the "Dumb" Primitive (The Paint):** Construct the purely presentational Web Component inside `yenvui` (e.g., `<yenvui-tabs>`).
2. **Lobotomize the Host Component (The State):** Strip the internal HTML/CSS of the legacy host component (e.g., `<insetu-modal>`) and convert it into a stateful orchestrator that wraps and projects data into the new yenVUI primitive via `<slot>`s.
3. **Execute the CSS Vacuum (Safely):** *Only after* the host DOM has been fully transitioned to the new `<yenvui-*>` tags, permanently delete the legacy classes (e.g., `.tabs`, `.modal-panel`) from the host application's `style.css`.
**Execution Targets:**
*   **inSetu OS (In-Place):** Sequentially migrate legacy layouts following the 3-step DOM-First Vacuum Rule. The explicit architectural transition map is as follows:
    *   **The Legacy Modal Framework:** Convert `.fullscreen-modal`, `.dynamic-modal`, `.modal-panel`, `.modal-content`, `.modal-header`, `.modal-body`, and `.modal-footer` into `<yenvui-modal>`.
    *   **Navigation Tabs & Screens:** Convert `.tabs`, `.tab`, `.sub-tabs-bar`, `.sub-tabs`, `.sub-tab`, `.screen`, and `.tab-content` into `<yenvui-tabs>`.
    *   **Editor & CodeMirror Overrides:** Convert `.cm-editor`, `.cm-scroller`, `.CodeMirror-dialog`, `.EasyMDEContainer`, and `.cm-header-X` into `<yenvui-editor>`.
    *   **Base Form Controls:** Vacuum `textarea`, `input[type="text"]`, `button`, `pre`, `.btn-sm`, `.system-action-btn`, and `.spinner` styling directly into `theme-tokens.css` or convert to `<yenvui-async-btn>`.
    *   **Task Badges & Typography:** Convert `.task-bug`, `.task-todo`, `.task-queue`, `.task-tag`, `.folder-label`, and `.yaml-frontmatter` into semantic theme tokens or `<yenvui-pill>` elements.
    *   **Application Shell Chrome:** Convert `.top-bar`, `.bottom-bar`, and `#status-box` into `<yenvui-toolbar>` and `<yenvui-status-bar>`.
    *   **Floating Overlays:** Convert `.wiki-link-popup` and custom absolute containers to native `#top-layer` implementations using the popover API.
*   **Axoneme Console (Greenfield):** Scaffold the `console-v3` repository. Establish the `AxonemeElement` base class to handle auth and API routing. Rebuild the Engram, Lore, and Magistrate views from scratch using clean Lit templates and `yenVUI` primitives, abandoning the legacy `console_v2.js` monolith.

*(Note: Edge apps like Occipitum, Gear Library, and Glial are deferred to Phase 2).*

### Step 5: Enforce the Architectural Gatekeepers
1.  Port the `fitness_functions.py` suite into both the `yenvui` and `axoneme-console-v3` repositories.
2.  Implement regex and AST linting gates to forcefully fail commits that violate the ecosystem laws:
    *   **Rule A:** Ban raw layout elements (`div.file-card`). Enforce `<yenvui-card>`.
    *   **Rule B:** Ban components extending raw `LitElement`. Enforce multi-tenant tracking inheritance.
    *   **Rule C:** Ban hardcoded HEX colors (`#ffffff`) or inline styles in component definitions to preserve global theme safety.
    *   **Rule D:** Ban viewport-bound media queries (`@media (max-width)`) for structural component layouts. Enforce CSS Container Queries (`@container`) or `ResizeObserver` patterns so components scale natively based strictly on their parent container's dimensions.
    *   **Rule E:** Enforce native `#top-layer` APIs (`<dialog>`) for modal workspace overlays, and DOM-first empty state guardrails for non-blocking toast containers to guarantee clean layout hierarchy.

---
**Status:** Approved for execution.
