# ADR-0015: Decoupled Host Domain Contracts, Popout Shell Projections, and Aggregated Action Staging

## Status
Accepted

## Date
2026-10-14

## Context
As the `sutram` presentation micro-kernel matured, multiple domain-specific abstractions from the consuming host OS (`inSetu`) leaked into core components:
1. `sutram/js/app_shell.js` directly inspected `window.inSetu.stores.Fs` to evaluate buffer dirty states during tab closure, and computed route URLs using host-specific workspace stores.
2. Selection staging and tray actions were tied to rigid single-entity action definitions, preventing unified bulk execution across heterogeneous entity collections.
3. Component subscriptions in `SutramContextMixin` lacked shallow equality gates on selectors, triggering re-renders even when selected subtrees were structurally unchanged.
4. Window popping lacked a lightweight, isolated shell mode that bypassed full 3-column spatial docking.

## Decision
1. **Decoupled UI Hooks**: Replace all direct checks of host domain stores with standardized `ExtensionRegistry` UI hooks:
   - `sutram:is-projection-dirty`: Queries the active extension to determine whether unsaved changes exist prior to projection eviction.
   - `sutram:resolve-route-hash`: Delegates route hash string formatting to host extensions with a standardized fallback.
   - `sutram:resolve-item-size`: Resolves entity byte footprint dynamically for the selection staging tray.
2. **Aggregated Multi-Entity Action Staging**: Introduce `ExtensionRegistry.getAggregatableActions` to analyze heterogeneous item selections, match candidate actions against compound entity types, and execute unified batch actions.
3. **Selector Equality Memoization**: Implement native `shallowEqual` in `sutram/js/utils.js` and bind it as the default equality function in `SutramContextMixin.subscribe`.
4. **Popout Projection Shell**: Introduce `variant="popout"` on `<sutram-app-shell>`, isolating the route-targeted projection within a single viewport while preserving top-layer overlays.

## Consequences
### Positive
* The kernel runtime is fully decoupled from host domain models, enabling portability to any web application.
* Redundant LitElement renders are prevented via shallow equality gating in store subscriptions.
* Multi-item operations across mixed entity types execute seamlessly through aggregated action contracts.

### Negative / Trade-offs
* Extensions must explicitly register UI hooks for dirty checking and route formatting.
* Legacy tab IDs require migration mapping during layout compilation.