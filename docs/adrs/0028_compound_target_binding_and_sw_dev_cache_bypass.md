# ADR-0028: Compound Target Binding Controls, Dynamic Schema Option Sources, and Development Service Worker Cache Bypass

* **Status:** Accepted
* **Date:** 2026-10-29
* **Scope:** `sutram/js/inputs.js`, `sutram/js/primitives.js`, `sutram/js/shared_styles.js`, `sutram/js/index.js`, `sutram/js/sw-core.js`

## Context

As extension settings forms and workspace tooling expanded, three interface requirements emerged:
1. **Compound Compute Target Configurations**: Extensions managing LLM backends or remote execution required paired endpoint-and-model bindings. Prior implementations forced separate form inputs without inter-field synchronization, leading to invalid combinations and duplicated UI logic.
2. **Dependent Form Schema Options**: Settings fields often depend dynamically on configuration collections defined elsewhere in the form (e.g., selecting an endpoint from a list of user-defined compute endpoints, or dynamically querying models for a chosen endpoint).
3. **Local Development Service Worker Lock-in**: The aggressive cache-first strategy implemented in `sw-core.js` for offline PWA durability served cached responses immediately on `localhost` and `127.0.0.1`, forcing developers to manually unregister workers or hard-refresh during active development sessions.

## Decision

1. **SutramCombobox Searchable Input (`inputs.js`)**:
   * Implement `<sutram-combobox>` supporting arbitrary string input or list selection with active search filtering.
   * Standardize options shape to `{ value, label, badge }` with keyboard navigation and outside-click dismissal via `this.registerOutsideClick`.
2. **SutramTargetBinding Compound Control (`inputs.js`)**:
   * Implement `<sutram-target-binding>` integrating `<sutram-select>` (endpoints) and `<sutram-combobox>` (models) within a responsive 2-column grid.
   * Support normalized string representations (`endpoint::model`) and structured object values (`{ endpoint, model }`).
   * Support functional model candidate resolution (`models: (endpointId) => [...]`).
3. **Settings Form Dynamic Option Sourcing (`primitives.js`)**:
   * Support `type: 'target_binding'` in `<sutram-settings-form>`.
   * Add `options_from` resolution to `type: 'select'` fields, automatically parsing collections from form data with custom `value_key` and `label_key` fields.
   * Provide `optionResolver` delegation for runtime model catalog queries.
4. **Service Worker Local Development Bypass (`sw-core.js`)**:
   * Inspect request URL hostname: if `localhost` or `127.0.0.1`, bypass cache-first serving and prioritize fresh network responses, while falling back to cached responses if offline or network fetch fails.

## Consequences

### Positive
* Standardized, declarative representation of complex compound targets across extension settings.
* Dynamic dependencies between form fields handled declaratively via schema definitions without bespoke component code.
* Fluid local developer workflow with immediate reload reflection, preserving full air-gapped offline support.

### Negative / Trade-offs
* Combobox filtering on very large option catalogs (> 1,000 items) is truncated to the first 60 matches for rendering performance.
