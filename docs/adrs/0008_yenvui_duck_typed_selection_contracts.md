# ADR-0008: Duck-Typed Selection Contracts for yenVUI Gestures

## Context
As the yenVUI Edge-Native chassis scales, consumer applications (like inSetu OS) are generating domain-specific Web Components (e.g., `<insetu-card>`, `<axoneme-entity>`) that project into the `<yenvui-card-group>`. Previously, the horizontal swipe logic in `card-group.js` relied on hardcoded explicit `tagName` checks to detect valid selection targets within the Shadow DOM hit-test, causing tight coupling and ecosystem friction.

## Decision
1. **Duck-Typed Boundary Resolution:** The `YenvuiCardGroup._getCardFromPoint` hit detection mechanism now evaluates compliance based strictly on property presence rather than explicitly whitelisted string tag names.
2. **The Contract:** Any Web Component traversing the gesture tree is deemed a valid swipe-selection target if it contains a hyphenated tag name (`el.tagName.includes('-')`) and exposes both `'selected' in el` and `'disableSelection' in el` interface properties.

## Consequences
* **Positives:** Complete detachment from downstream consumer naming conventions. Guarantees that the swipe gesture physics remain purely agnostic and highly portable across different ecosystem wrappers.
* **Negatives:** Requires consumer components to strictly maintain the exposed boolean property signatures to participate in native yenVUI gesture selection.