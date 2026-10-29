# ADR-0026: Pluggable Chassis Provider Contract, SutramUIAdapter, Input Event Bridging, and Public Kernel Entrypoint

* **Status:** Accepted
* **Date:** 2026-10-28
* **Scope:** `sutram/js/primitives.js`, `sutram/js/inputs.js`, `sutram/js/app_shell.js`, `sutram/js/shared_styles.js`, `sutram/js/sutram_sdk.js`, `sutram/js/drag-coordinator.js`, `sutram/js/utils.js`, `sutram/js/index.js`

## Context

As the Sutram micro-kernel evolved into an independent presentation substrate across multiple host environments, several structural coupling points were identified:
1. **Hardcoded Chassis Import Paths**: Kernel modules imported UI primitives via relative filesystem paths (`../../yenvui/js/*`), preventing the kernel from running in isolated environments where alternative chassis implementations might be provided.
2. **Duplicated Form Component Boilerplate**: `sutram/js/inputs.js` manually reimplemented form controls (`<input>`, `<select>`, `<textarea>`, `<toggle>`) with hundreds of lines of template and auto-height logic, creating maintenance divergence between chassis inputs and kernel inputs.
3. **Missing Public Module Surface**: Consuming applications imported internal files individually, lacking a centralized, stable Layer 2 public module entrypoint.
4. **DAG Tree Visualization Absence**: Workspaces lacked a standard, non-blocking UI component to visualize parallel wavefront stages and hierarchical dependency graphs.

## Decision

1. **Pluggable Chassis Contract (`sutram-chassis`) & `SutramUIAdapter`**:
   * Replace all relative `../../yenvui/js/*` import specifiers with the bare specifier `'sutram-chassis'`.
   * Standardize `REQUIRED_CHASSIS_PRIMITIVES` (28 primitives) and validate implementations via `validateChassisContract(chassisProvider)` at boot.
   * Introduce `SutramUIAdapter` with an immutable `PASSTHROUGH_MAP` and `registerChassis()`, dynamically defining `<sutram-*>` custom element wrappers for standard presentation primitives.
2. **Higher-Order Form Input Event Bridging (`inputs.js`)**:
   * Introduce `bridgeInputEvents(BaseClass)` wrapping chassis `Input`, `Select`, `Textarea`, and `Toggle`.
   * Intercept chassis `yenvui-input-changed` events and dispatch standardized, bubbling `@sutram-input-changed` events.
3. **Universal Wavefront & Hierarchy DAG Tree Component (`<sutram-dag-tree>`)**:
   * Implement `<sutram-dag-tree>` supporting wavefront execution stages (`stages`) and hierarchical tree representations (`rootNode`, `nodes`).
   * Provide `compileDagWavefronts()` in `sutram/js/utils.js` for dependency sorting and stage grouping.
4. **Mustache Template Engine Utilities**:
   * Provide `extractTemplateVariables()` and `interpolateTemplateVariables()` in `sutram/js/utils.js` with macro support and fallback resolution.
5. **Canonical Layer 2 Public Entrypoint (`sutram/js/index.js`)**:
   * Create `sutram/js/index.js` aggregating and exporting all public micro-kernel symbols, state stores, primitives, and utilities.

## Consequences

### Positive
* The Sutram micro-kernel is completely decoupled from filesystem paths, enabling pluggable presentation chassis swapping.
* Form control maintenance overhead is drastically reduced through event bridging.
* Host applications gain a clean, single-import public API.
* Complex DAG pipelines and template interpolation can be rendered natively without external dependencies.

### Negative / Trade-offs
* Host applications must supply an import map entry mapping `'sutram-chassis'` to the active chassis implementation.
