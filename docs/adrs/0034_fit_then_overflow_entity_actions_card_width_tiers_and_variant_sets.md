# ADR-0034: Fit-Then-Overflow Entity Action Rows, Self-Measured 720px Card Width Tiers, Variant-Set Split Buttons, and 900ms Confirmation Holds

* **Status:** Accepted
* **Date:** 2026-11-19
* **Scope:** `sutram/js/sutram_sdk.js`, `sutram/js/primitives.js`, `sutram/js/app_shell.js`, `yenvui/js/physics.js`, `yenvui/js/yenvui-base.js`, `yenvui/js/card.js`, `yenvui/js/async-btn.js`, `yenvui/js/dropdown.js`, `tests/sutram_consumer_linter.py`

## Context

As extensions registered richer entity actions (such as raw vs. expanded copy, share, download, and publish variants), four interface ergonomics challenges surfaced:
1. **Horizontal Scroll & Modal Tray Friction in Card Actions:** `<sutram-entity-actions>` previously combined a horizontally scrollable button strip with a full-screen `<dialog>` action tray (`⋮`), requiring two interaction models and obscuring card titles on narrow columns even when cards spanned two or three columns (`>= 720px`).
2. **Variant Proliferation Across Action Bars:** Related delivery variations (e.g., `Copy Raw`, `Share Raw`, `Download Raw`, `Share Expanded`) competed for row space as separate buttons rather than collapsing into a single remembers-last-used split control.
3. **Abrupt Overlay Dismissal on Action Completion:** Dropdown menus and narrow card drawers closed immediately on click before users could observe the button's `successLabel` confirmation feedback, while raw `setTimeout` calls in buttons risked mutating state after component teardown.
4. **Unvalidated `entityActions` Schema Keys:** Typos in extension `entityActions` declarations (such as `surface: 1` instead of `surfaced: 1`) were silently ignored at registration time.

## Decision

1. **Spatial Column Unit Constants & Self-Measured 720px Card Width Tiers (`yenvui/js/physics.js`, `yenvui/js/card.js`, `sutram/js/primitives.js`)**:
   - Standardize `COLUMN_UNIT_PX = 360` and `WIDE_CARD_MIN_PX = COLUMN_UNIT_PX * 2` (`720`) in `yenvui/js/physics.js` (and `SUTRAM_COLUMN_UNIT_PX` / `SUTRAM_WIDE_CARD_MIN_PX` in `sutram/js/sutram_sdk.js`).
   - Equip `<yenvui-card>` with a `ResizeObserver` (`_updateCardWidthTier`) that reflects `[wide-card]` when the card's width is `>= 720px` and dispatches `@yenvui-card-tier-changed`.
   - Render `.actions-tray` inline on the right side of `[wide-card]` hosts (hiding `.action-grip-rail` and `.tray-caption`) while preserving the slide-over drawer on `< 720px` cards. `<sutram-card>` mounts `<sutram-entity-actions>` automatically when either `actionsOpen` or `_wideCard` is true.
2. **Variant Sets, Split Buttons (`<sutram-variant-btn>`), & Device-Local Memory (`sutram/js/sutram_sdk.js`, `sutram/js/primitives.js`)**:
   - Introduce `VariantDefaultStore` (`localSync: ['lastUsed'], scope: 'global'`) and `ExtensionRegistry.registerVariantSet`, `registerEntityFamilies`, `resolveEntityFamily`, `resolveDefaultVariant`, `setLastUsedVariant`, and `_collapseVariantSets`.
   - Enforce a strict one-level hierarchy: variant sets hold plain actions only, and attempting to nest a variant set or group inside another `set` logs a warning and is refused.
   - Resolve the active default variant per `(entityType, setId)` by checking `VariantDefaultStore` first (if that variant matches the current entity item), then falling back to the variant set's family preference array (`defaults[family]`), and finally the first available variant.
   - Implement `<sutram-variant-btn>` pairing a width-reserved `<sutram-async-btn>` (`--variant-min-width` derived from `maxLabelChars`) with a sectioned `<sutram-dropdown>` split trigger. Flatten bulk variant sets inside `<sutram-subtab-menu>` into section headings and executable items.
3. **Fit-Then-Overflow Action Broker (`computeFitActionCount` & `<sutram-entity-actions>`)**:
   - Measure `<sutram-entity-actions>` container width via `ResizeObserver` and compute how many surfaced non-destructive row candidates fit alongside the 38px `more-horizontal` trigger (`computeFitActionCount`).
   - Never surface destructive (`intent: 'danger'`) actions into primary action rows (except in `variant="footer"`), and order destructive items at the bottom of their section in the overflow `<sutram-dropdown>`.
4. **Managed Timeouts & Two-Phase 900ms Confirmation Holds (`yenvui/js/yenvui-base.js`, `yenvui/js/async-btn.js`, `yenvui/js/dropdown.js`)**:
   - Add `registerTimeout(callback, delayMs)` and `clearManagedTimeouts()` to `YenvuiBase`, clearing active timers in `disconnectedCallback()`.
   - Hold `<yenvui-async-btn>` and `<yenvui-dropdown>` items in their confirmed `successLabel` state for `confirmHoldMs` (default `900ms`), emitting `@yenvui-action-confirmed` with `phase: 'start'` immediately upon completion and `phase: 'settled'` after the hold elapses before closing the dropdown or narrow card drawer.
5. **Static Linter Schema Enforcement (`tests/sutram_consumer_linter.py`)**:
   - Validate all top-level object keys inside `entityActions: [...]` declarations against `ALLOWED_ENTITY_ACTION_KEYS` (`ENTITY_ACTION_UNKNOWN_KEY`).

## Consequences

### Positive
- Wide cards (`>= 720px`) expose primary actions inline with zero drawer clicks, while narrow cards (`< 720px`) present a clean, non-scrolling fit-then-overflow row inside the drawer.
- Delivery variations collapse into a single `<sutram-variant-btn>` that adapts to the user's last-used variant per entity type without layout shift.
- Users receive clear on-button and in-menu visual confirmation (`Copied`, `Shared`, `Downloaded`) for 900ms before transient menus and drawers dismiss.
- Unknown or misspelled keys in `entityActions` manifests are caught deterministically by the consumer linter.

### Negative / Trade-offs
- Width estimation in `SutramEntityActions._estimateEntryWidth` uses character-count heuristics (`7.5px` per character plus icon/padding allowance) so fit counts can be computed synchronously without forcing a two-pass DOM measurement.
