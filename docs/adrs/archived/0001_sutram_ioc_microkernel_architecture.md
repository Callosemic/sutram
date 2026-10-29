# 1. Sutram IoC Micro-Kernel & Declarative UI Routing Architecture

* **Status:** Accepted
* **Date:** 2026-07-28
* **Context:** Sutram requires a zero-bundler, framework-agnostic frontend micro-kernel capable of dynamic UI extension without hardcoded layouts or manual component wiring.

## Decision
1. **IoC Micro-Kernel (`sdk.js`):** Implement `ExtensionRegistry` as a global event and slot broker. Extensions register layout slots, UI hooks, entity actions, settings actions, and shortcuts.
2. **Automated Teardown Base Class (`SutramElement`):** Base web component wrapping `LitElement` with managed arrays for store subscriptions (`subscribe`), intervals (`registerInterval`), and DOM listeners (`registerGlobalListener`). All resources are automatically cleaned up in `disconnectedCallback()`.
3. **Declarative Layout Engine (`app_shell.js`):** `SutramAppShell` dynamically queries layout slots from `ExtensionRegistry`, builds tab hierarchies with deduplication and target-parent inference, and caches created custom elements to preserve DOM state across tab switches.
4. **Scoped State Stores (`createSutramStore`):** Zustand vanilla stores wrapped with devtools, subscribeWithSelector, and optional key-level `localStorage` persistence scoped by workspace identifier.

## Consequences
* **Positives:** Modular architectural symmetry, clean lifecycle memory safety, loose coupling between host application shell and extensions, and zero build-step reliance.
* **Negatives:** Requires extension developers to register components via exact custom element tag names and maintain slot schema discipline.