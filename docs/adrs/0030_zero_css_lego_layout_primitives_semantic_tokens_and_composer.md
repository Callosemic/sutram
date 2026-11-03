# ADR-0030: Zero-CSS Lego Layout Primitives, Semantic Token Parameterization, SutramComposer, and Floating HUD

* **Status:** Accepted
* **Date:** 2026-11-03
* **Scope:** `yenvui/js/layout.js`, `yenvui/js/icon.js`, `sutram/js/primitives.js`, `sutram/js/inputs.js`, `yenvui/css/theme-tokens.css`, `tests/fitness/rules_yenvui.py`, `tests/sutram_consumer_linter.py`

## Context

As the Sutram micro-kernel and yenVUI presentation chassis scaled across desktop, tablet, and mobile form factors, three architectural challenges emerged:
1. **Ad-Hoc CSS Layout Duplication:** Consuming applications and composite primitives frequently constructed layouts using bespoke `div` containers and arbitrary inline flexbox styles. This led to fragmented padding, non-standard gap scales, and fragile media queries.
2. **Presentational Property Bloat:** Primitives accumulated arbitrary style properties (e.g., `intentColor`, `maxWidth`, `minRows`, `maxHeight`, `bottomBorder`, `size="sm"`), violating the separation between State/Topology and Aesthetics/Dimensions.
3. **Legacy Bootloader Icon Coupling:** Icon rendering relied on the legacy `<yv-icon>` component defined inside `sutram-boot.js`, creating an upward coupling from bootloader to chassis and bypassing standard Layer 1 export contracts.
4. **Command Runner & Status Telemetry Gaps:** Workspaces lacked a standardized slash-command composer capable of absorbing command tokens into chips and a non-invasive corner-pinned telemetry HUD.

## Decision

1. **Zero-CSS Lego Layout Primitives (`yenvui/js/layout.js`, `sutram/js/primitives.js`)**:
   - Introduce Layer 1 structural components: `<yenvui-view>`, `<yenvui-stack>`, `<yenvui-surface>`, `<yenvui-action-bar>`, and `<yenvui-sidebar-layout>`.
   - Register pass-through custom element wrappers via `SutramUIAdapter`: `<sutram-view>`, `<sutram-stack>`, `<sutram-surface>`, `<sutram-action-bar>`, and `<sutram-sidebar-layout>`.
   - Implement dynamic action bar collapse measurement in `YenvuiActionBar` via `ResizeObserver`, automatically switching button labels to icon-only displays (`data-overflow`) when horizontal width is constrained.
   - Refactor composite primitives (`SutramCategorizedList`, `SutramFolderBrowser`, `SutramSelectorModal`, `SutramSettingsForm`, `SutramReportProjection`) to assemble layouts exclusively using Lego bricks.
2. **Chassis-Native Icon Component (`yenvui/js/icon.js`, `sutram/js/primitives.js`)**:
   - Implement `<yenvui-icon>` in Layer 1 and `<sutram-icon>` in Layer 2 supporting standardized `size` (`xs`, `sm`, `md`, `lg`, `xl`) and `intent` tokens with CSS mask-image Data URI caching.
   - Deprecate and remove `<yv-icon>` from `sutram-boot.js`. Ban direct `<yv-icon>` consumption via `BANNED_YV_ICON_TAG_BAN`.
3. **Semantic-First Token Parameterization Mandate**:
   - Deprecate raw dimension and styling properties (`intentColor`, `maxWidth`, `minRows`, `maxHeight`, `borderless`, `bottomBorder`, `size="sm"`, `style="..."`).
   - Standardize on semantic tokens: `intent`, `size="compact|normal|wide|full"`, `columns="compact|normal|wide"`, `padding="none|xs|sm|md|lg"`, `?compact`, `?grow`, `?fullWidth`, `?flush`.
   - Enforce compliance via static linters (`YENVUI_SEMANTIC_PROPERTY_MANDATE`, `SUTRAM_INLINE_STYLE_BAN`, `SUTRAM_SEMANTIC_PROP_MANDATE`, `UNIFIED_SCALE_TOKEN_MANDATE`).
4. **SutramComposer & Floating HUD Primitives (`inputs.js`, `primitives.js`)**:
   - Implement `<sutram-composer>` supporting leading command prefix absorption (`/command`), typeahead search filtering, active trigger pills, Backspace token clearing, and `@sutram-composer-submit` routing.
   - Implement `<sutram-floating-hud>` providing an ergonomic corner-pinned status and telemetry drawer with outside-click dismissal.

## Consequences

### Positive
- Host applications and extensions construct rich, responsive interfaces using standard Lego primitives without writing custom CSS.
- Icon rendering is decoupled from the bootloader and elevated to a formal chassis primitive.
- Strict linter enforcement eliminates styling drift and preserves universal theme compatibility.
- Unified prompt/command input ergonomics across generative AI and terminal workflows.

### Negative / Trade-offs
- Components require refactoring away from legacy presentational attributes to semantic tokens.
