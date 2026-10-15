# ADR-0019: CodeMirror Tag Completion Defense, Font Ligature Suppression, and Substrate InnerHTML Elimination

* **Status:** Accepted
* **Date:** 2026-10-15
* **Scope:** `yenvui/css/theme-tokens.css`, `yenvui/js/editor.js`, `yenvui/js/card.js`, `yenvui/js/window.js`, `yenvui/tests/fitness_functions.py`

## Context
As the `yenVUI` presentation chassis expanded its monospaced text handling and UI primitives across workspace editors, cards, and windows, several resilience and visual rendering anomalies emerged:
1. **Lezer Markdown Autocomplete Crashes**: When typing raw HTML tags (e.g. `<tag>`) inside Markdown documents, nested CodeMirror 6 HTML language completion extensions attempted to parse unclosed tags and threw unhandled runtime exceptions.
2. **Monospaced Glyphs Merging**: Contextual font ligatures in monospaced fonts (such as JetBrains Mono or Cascadia Code) automatically combined sequences like `//`, `///`, `<!--`, and `===` into single wide glyphs, breaking 1:1 character-column alignment in text editors and diff viewers.
3. **Residual InnerHTML Invocations**: Legacy card icon rendering retained `.innerHTML` evaluation for `<i` prefixed strings, conflicting with the zero-innerHTML substrate security policy.
4. **Window Header Close Ergonomics**: `<yenvui-window>` lacked an explicit, accessible close action, requiring users to rely exclusively on host-level layout coordination to dismiss windows.

## Decision
1. **CodeMirror Markdown Extension Sanitization**: Dynamically filter out `htmlCompletion` and `closeTags` from `cm.markdown().extensions`, preventing unhandled syntax completion crashes during tag input.
2. **Substrate-Wide Ligature Suppression**: Enforce `font-variant-ligatures: none` and `font-feature-settings: "liga" 0, "calt" 0` across global `pre`, `code`, and all CodeMirror scroller and line layers.
3. **Substrate Zero-InnerHTML Enforcement**: Eliminate `.innerHTML` in `YenvuiCard` icon rendering in favor of native `<yv-icon>` and text nodes. Enforce zero `.innerHTML` across all substrate modules via automated fitness testing.
4. **Window Close Action Standard**: Render an explicit `.close-btn` in `<yenvui-window>` that halts pointer propagation and dispatches `yenvui-window-close`.

## Consequences
* **Positives**: Eliminates editor completion crashes, guarantees 1:1 monospaced column tracking, enforces complete DOM rendering safety, and provides explicit window dismissal mechanics.
* **Trade-offs**: Raw HTML completion is disabled while typing inside markdown documents, preventing automated tag closure.