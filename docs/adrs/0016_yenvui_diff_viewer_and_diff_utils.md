# ADR-0016: Zero-Dependency Kinetic Diff Viewer and Intra-Line LCS Diff Utilities

* **Status:** Accepted
* **Date:** 2026-10-14
* **Scope:** `yenvui/js/diff-utils.js`, `yenvui/js/diff-viewer.js`, `yenvui/js/editor.js`, `yenvui/js/card.js`

## Context
As host workspaces expanded diff review, patch verification, and staging workflows, diff inspection encountered several presentation bottlenecks:
1. Third-party diff packages introduced heavy bundle weight or non-native ESM dependencies, conflicting with the zero-bundler architecture.
2. Large diff files with minified or long lines triggered performance degradation when computing intra-line character changes.
3. Dual-pane diff viewers frequently suffered from desynchronized scrolling and "scroll fight" when both panes handled scroll events simultaneously.
4. Host-scoped event names (`insetu:theme-changed`) leaked into presentation components like `<yenvui-editor>`.

## Decision
1. **Tier 0 Intra-Line LCS Engine (`diff-utils.js`)**:
   * Implement token-level Longest Common Subsequence dynamic programming for intra-line difference detection.
   * Enforce a matrix size guardrail ($m \times n \le 40000$) to gracefully degrade to full-line diffing on pathological minified lines without locking the main thread.
   * Support raw hunks, Python `difflib.ndiff`, and standard unified diff formats natively.
2. **Kinetic Presentation Primitive (`<yenvui-diff-viewer>`)**:
   * Expose declarative modes (`auto`, `split-side`, `split-stacked`, `interleaved`) leveraging CSS Container Queries (`@container`).
   * Manage dual-pane synchronous scrolling via an exclusive source-claiming lock (`_claimScrollSource`) with automatic timeout release.
   * Provide desktop mouse kinetic pan-and-throw momentum scrolling with velocity calculation and exponential decay.
   * Implement cross-pane hover synchronization with animated ghost carets tracking character column indices.
3. **Presentation Chassis Decoupling (`editor.js`, `card.js`)**:
   * Migrate `<yenvui-editor>` from `insetu:theme-changed` to agnostic `yenvui-theme-changed` and bind a fallback `MutationObserver` on `document.body` for `data-theme`.
   * Shield `<yenvui-card>` click dispatches from firing during horizontal panning gestures.

## Consequences
* **Positives:** High-performance, bundleless visual diffing with intra-line highlighting, fluid 60fps pan physics, and full host-agnostic presentation decoupling.
* **Trade-offs:** Token-level LCS computation incurs lightweight main-thread execution on large hunk collections; handled via the $40000$ matrix size safeguard.