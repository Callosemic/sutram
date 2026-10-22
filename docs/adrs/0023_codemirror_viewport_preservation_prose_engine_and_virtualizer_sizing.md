# ADR-0023: CodeMirror Viewport Preservation, Prose Typography Engine, WebKit Text-Size Normalization, and Virtualizer Intrinsic Sizing

* **Status:** Accepted
* **Date:** 2026-10-21
* **Scope:** `yenvui/js/editor.js`, `yenvui/js/card.js`, `yenvui/css/theme-tokens.css`, `yenvui/js/shared_styles.js`, `yenvui/js/collapsible.js`

## Context

As rich text and code editing expanded across mobile and desktop workspaces, three structural bottlenecks emerged:
1. **Editor Cursor and Viewport Thrashing**: When the application store synchronized document updates, `<yenvui-editor>` previously executed full document replacements (`changes: { from: 0, to: length, insert: targetValue }`). This reset the user's cursor position to the top of the file, cleared text selections, and caused scroll position jumps.
2. **Writing Mode Ergonomics**: Prose authors lacked basic text editor conventions, including automatic em-dash conversion with single-step undo and intelligent Markdown list continuation.
3. **WebKit Layout Distortion in Virtual Lists**: On iOS Safari and WebKit viewports, font sizes inflated unpredictably due to lack of text-size adjustments. Concurrently, `<yenvui-card>` containers with `content-visibility: auto` experienced height oscillation and clipping when nested inside virtualized list containers (`sutram-virtual-list`).
4. **Nested Collapsible Event Bleed**: `yenvui-collapsible-toggled` custom events bubbled through the DOM tree, causing outer card and accordion containers to inadvertently trigger their own state handlers.

## Decision

1. **Minimal Diff Reconciliation (`_applyMinimalDiff`)**:
   * Compute character-level prefix and suffix boundaries between the existing document buffer and incoming state updates.
   * Dispatch surgical delta changes (`changes: { from: start, to: oldEnd, insert: insertSlice }`), mapping cursor anchor and head positions to preserve selection states and restoring `scrollTop` on the following animation frame.
   * Route dynamic language loading through `ExtensionRegistry.executeUIHook('sutram:vendorize-language', lang)` before checking legacy bridges.
2. **Prose Typography & List State Machine**:
   * Inspect the syntax tree (`isInCodeContext`) to strictly suppress typography modifications inside code blocks and inline backticks.
   * Implement double-hyphen to em-dash conversion (`--` -> `—`) utilizing `isolateHistory` to preserve single-step backspace undo, and restore triple hyphens (`---`) upon a third consecutive hyphen.
   * Provide `handleProseEnter` with automatic prefix matching and continuation for task lists (`- [ ]`, `- [x]`), bulleted lists (`-`, `*`, `+`), and numbered lists (`1.`, `2)`), clearing list markers automatically on empty items.
3. **Universal WebKit Text-Size Normalization**:
   * Enforce `-webkit-text-size-adjust: 100%` and `text-size-adjust: 100%` across `theme-tokens.css`, `shared_styles.js`, and atomic card host styles.
4. **Virtualizer Double-Virtualization De-Escalation**:
   * Parameterize intrinsic dimensions using `--card-contain-intrinsic-size` (defaulting to `auto 76px`, or `auto 42px` in compact mode).
   * Apply `:host-context(lit-virtualizer)` and `:host-context(sutram-virtual-list)` rules forcing `content-visibility: visible` and `contain-intrinsic-size: none`.
5. **Collapsible Event Isolation**:
   * Configure `yenvui-collapsible-toggled` event dispatching as non-bubbling and non-composed (`bubbles: false, composed: false`).

## Consequences

* **Positives:**
  * External store updates sync cleanly without disrupting active editor focus, selections, or scroll viewports.
  * Fluent prose writing experience with undo-safe typography and automatic list continuations.
  * Deterministic element sizing and zero text inflation on mobile WebKit and virtual list projections.
  * Clean event containment for nested collapsible hierarchies.
* **Trade-offs:**
  * Character-level prefix/suffix matching operates on single contiguous insertions/deletions. Highly fragmented multi-cursor concurrent edits fall back to range bounds.