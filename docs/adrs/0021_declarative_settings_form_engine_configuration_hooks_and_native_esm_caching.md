# ADR-0021: Declarative Settings Form Engine, Configuration Registry Hooks, and Native ESM Caching

## Status
Accepted

## Date
2026-10-19

## Context
As the workspace and extension ecosystem expanded, three distinct architectural challenges emerged:
1. **Coupled Settings Dialogs**: Configuration forms were tightly coupled to modal dialog wrappers (`SutramGenericSettingsModal`), preventing extensions from embedding settings forms directly within spatial tabs, sidebars, or drawer panels. Additionally, forms lacked support for multi-tenant repository targeting, scope visualization (`daemon`, `repo`, `workspace`, `secure`), and complex structured types (`intent_map`, `string_list`).
2. **Missing Configuration Discovery Contracts**: Host applications lacked standardized registry methods to discover and render repository-scoped and bucket-scoped configuration panels contributed by extensions.
3. **Cache-Busting Specifier Corruption**: Dynamic module batch loading in `ExtensionRegistry.loadBatches` appended query parameters (`?v=${bootTs}`) to module URLs. This bypassed browser-native import maps and created duplicate module graph allocations.
4. **Static `<yv-icon>` Styling**: The `<yv-icon>` Web Component observed only `name` and `stroke-width`, preventing elements from responding to dynamic inline `style` changes (such as custom color or dimensions).

## Decision
1. **Decoupled Settings Form Engine (`<sutram-settings-form>`)**:
   * Extract configuration schema parsing and input generation into an independent Lit component (`SutramSettingsForm`).
   * Support multi-tier scope indicators (`workspace`, `repo`, `daemon`, `secure`) and dynamic repository target switching.
   * Standardize typed input fields for `intent_map`, `string_list`, `action`, and JSON buffer editing.
   * Provide password masking (`••••••••`) with clear actions and verified badges.
   * Retain `SutramGenericSettingsModal` solely as a top-layer `<yenvui-modal>` wrapper.
2. **Registry Configuration Option Hooks**:
   * Add `ExtensionRegistry.getRepoConfigOptions()` and `ExtensionRegistry.getBucketConfigOptions()` to collect and sort configuration contributions across all registered extensions.
3. **Clean Native ESM Batch Loading**:
   * Eliminate cache-busting query parameters from dynamic imports in `ExtensionRegistry.loadBatches()`. Rely strictly on native browser import map resolution and standard HTTP caching.
4. **Reactive Style Observation on `<yv-icon>`**:
   * Add `style` to `YvIcon.observedAttributes` and guard `_renderIcon()` with an `_updatingStyle` flag to prevent re-entrant attribute cycles.

## Consequences
### Positive
* Configuration forms can now be projected anywhere within the layout grid without modal dependencies.
* Repository- and bucket-level configurations follow declarative, consistent schemas.
* Dynamic module imports preserve standard import map resolution.
* `<yv-icon>` elements adapt cleanly to dynamic CSS property updates.

### Negative / Trade-offs
* Extension authors must explicitly declare schema types (`intent_map`, `string_list`, etc.) to take advantage of specialized input controls.