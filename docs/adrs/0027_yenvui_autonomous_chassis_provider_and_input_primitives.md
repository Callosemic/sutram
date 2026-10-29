# ADR-0027: yenVUI Autonomous Chassis Provider Implementation, Input Primitives Extraction, and Upward Kernel Decoupling

* **Status:** Accepted
* **Date:** 2026-10-28
* **Scope:** `yenvui/js/index.js`, `yenvui/js/inputs.js`, `yenvui/js/card.js`, `yenvui/js/card-group.js`, `yenvui/js/dropdown.js`, `yenvui/js/editor.js`, `yenvui/js/modal.js`, `yenvui/js/physics.js`, `yenvui/js/shared_styles.js`

## Context

While ADR-0026 established the pluggable chassis provider contract (`REQUIRED_CHASSIS_PRIMITIVES`) and `SutramUIAdapter` inside the Sutram micro-kernel, the underlying `yenVUI` repository retained several structural couplings to Layer 2:
1. **Upward Dependency Leaks**: `yenvui` components hardcoded selectors and tag name checks for `sutram-*` (`sutram-card`, `sutram-btn`, `sutram-async-btn`, `sutram-virtual-list`, `sutram-status-update`), violating Layer 1 presentation autonomy.
2. **Missing Barrel Export**: `yenvui` lacked a unified barrel export (`yenvui/js/index.js`) providing `CHASSIS_PROVIDER_META` and the 28 required primitives.
3. **Form Controls Location**: Form control primitives (`input`, `select`, `textarea`, `toggle`) were implemented only inside `sutram/js/inputs.js`, preventing alternate hosts from utilizing standard yenVUI inputs directly.
4. **Hardcoded Language Vendorization**: `<yenvui-editor>` directly referenced `window.ExtensionRegistry` and `window.Sutram.vendorizeLanguage(lang)` to load language extensions on-the-fly.

## Decision

1. **Autonomous Chassis Barrel Export (`index.js`)**:
   * Create `yenvui/js/index.js` declaring frozen `CHASSIS_PROVIDER_META` (`{ name: 'yenvui', version: '2.0.0' }`).
   * Export all 28 primitives defined in `REQUIRED_CHASSIS_PRIMITIVES`, alongside `sharedStyles` and `physics`.
2. **Extraction of Pure Form Input Controls (`inputs.js`)**:
   * Implement `YenvuiInput`, `YenvuiSelect`, `YenvuiTextarea`, and `YenvuiToggle` in `yenvui/js/inputs.js`.
   * Standardize on Light DOM rendering (`createRenderRoot() { return this; }`) for unified `.yv-form-wrapper` styling and CSS variable inheritance.
   * Encapsulate auto-sizing text height calculations, `IntersectionObserver` visibility tracking, and benign Chromium `ResizeObserver` loop suppression inside `YenvuiTextarea`.
   * Dispatch isolated `yenvui-input-changed` custom events.
3. **Upward Reference Eradication & Duck-Typed Boundaries**:
   * **Attribute Markers**: Replace hardcoded parent tag checks with generic markers: `[data-spatial-boundary]` for spatial column tracking and `[data-virtual-list]` for virtualizer double-virtualization de-escalation.
   * **Selection Tagging**: Stamp `[data-yv-card]` on card hosts for decoupled hit-testing in gesture controllers.
   * **Custom Event Encapsulation**: Replace `sutram-status-update` in `dropdown.js` with composed `yenvui-action-error` events.
   * **Language Resolver Inversion**: Replace hardcoded `ExtensionRegistry` hooks in `editor.js` with a configurable `languageResolver` property and static `YenvuiEditor.languageResolver` fallback callback.
   * **Shared Styles Reset**: Purge all `sutram-*` rules from `yenvui/js/shared_styles.js`.

## Consequences

### Positive
* `yenVUI` functions as a completely autonomous, standalone presentation library with zero awareness of `Sutram`.
* All 28 required chassis primitives validate cleanly against `validateChassisContract(chassisProvider)` at boot.
* Form inputs are reusable across any host application without requiring the Sutram micro-kernel.
* Zero violations emitted under `CHASSIS_PROVIDER_ISOLATION` in static fitness tests.

### Negative / Trade-offs
* Host applications wishing to provide on-demand language vendorization to `<yenvui-editor>` must inject `YenvuiEditor.languageResolver = async (lang) => ...` during Stage 1 boot.
