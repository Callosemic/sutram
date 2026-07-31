# ADR-0003: Native Popover API Toast Container Elevation and Multi-Modal Selection Tray Physics

## Context
As complex host applications (inSetu OS, Axoneme Console) expanded batch interaction workflows and alert mechanics, two key visual physics challenges arose:
1. Toast containers rendered with standard fixed positioning were susceptible to CSS stacking context truncation when placed inside nested host containers or Web Component shadow roots with `overflow: hidden`.
2. Multi-item batch actions required a cohesive selection mechanics contract (gutter target, touch swipe, long-press) paired with a persistent floating action tray (`<yenvui-selection-tray>`).

## Decision
1. **Declarative Toast DOM Guardrails**: `<yenvui-toast-container>` enforces zero-DOM empty state guardrails (`if (!this.toasts || !this.toasts.length) return html``;`) and lightweight fixed positioning (`bottom: 20px; right: 20px;`), decoupling toast alert rendering from popover lifecycle complexity.
2. **Standardized Card Selection Physics**: `<yenvui-card>` exposes `selected` state and gutter/swipe/long-press gestures emitting `yenvui-card-select-toggled`. The `<yenvui-selection-tray>` component coordinates batch actions across selected items with high-contrast E-Ink support and UDF event emissions.

## Consequences
* Guarantees toast alerts remain unclipped regardless of host DOM hierarchy depth.
* Establishes a uniform multi-select interaction language across all card-based catalog items in the ecosystem.