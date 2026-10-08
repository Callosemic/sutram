# ADR-0012: Native `<yv-icon>` Component and Direct Lit Element Node Retention

## Status
Accepted

## Context
Previously, icon rendering relied on third-party Lucide SVG scanning (`window.lucide.createIcons`), which required imperatively searching and manipulating the Shadow DOM inside element `updated()` hooks across all presentation components[cite: 1, 2]. This caused unnecessary DOM traversal thrashing during paint cycles[cite: 1, 2].

Additionally, component layout rendering utilized an imperative caching pool (`SutramDOMPool`) with a fixed 25-node capacity eviction policy[cite: 1, 2]. As spatial layout capacity scaled, the DOM pool introduced friction around component state preservation and lifecycle unmounting[cite: 1, 2].

## Decision
1. **Native `<yv-icon>` Micro-Primitive**: Replace runtime Lucide DOM scanning with `<yv-icon>`, a zero-dependency Web Component registered in `sutram-boot.js` that directly projects SVG paths from `window.INSETU_ICONS`[cite: 2].
2. **Direct Lit Element Node Retention**: Deprecate `SutramDOMPool` in `sutram/js/projection_engine.js` and manage dynamic projections directly via Lit element node maps (`_activeNodes`) in `<sutram-app-shell>`[cite: 1, 2]. Unmounted components fall out of the active node map and are reclaimed by native browser garbage collection[cite: 1, 2].

## Consequences
- **Performance**: Eliminates post-render Shadow DOM query selector loops for icon creation[cite: 1, 2].
- **Simplicity**: Consolidates projection rendering into native Lit DOM reconciliation without manual pool capacity caps[cite: 1, 2].