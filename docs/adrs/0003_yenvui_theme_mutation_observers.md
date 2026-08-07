# ADR-0001: Dynamic Theme Mutation Observer Pattern and Native Dialog Host Visibility Standard

## Context
As yenVUI primitives expanded to support E-Ink brutalist themes and `#top-layer` native modal dialogs, two subtle friction points emerged:
1. CSS custom properties inherit naturally through shadow DOM roots, but high-contrast themes (e.g., E-Ink) require conditional `:host([data-theme="e-ink"])` selectors to override borders and hard shadows on shadow containers. Relying solely on manual host class updates caused theme desynchronization when the document theme toggled dynamically.
2. Wrapping native `<dialog>` elements inside Web Components with `:host { display: none; }` broke browser top-layer centering logic and created scenarios where calling `showModal()` on a hidden host trapped the modal render tree.

## Decision
1. **Theme Mutation Observer Standard:** All Web Components declaring host-level theme selectors must observe `document.body`'s `data-theme` attribute via a `MutationObserver` initialized in `connectedCallback()` and disconnected in `disconnectedCallback()`.
2. **Native Dialog Host Visibility Law:** Web Components wrapping native `<dialog>` elements must retain `:host { display: contents; }` in shadow DOM CSS, allowing the native dialog to manage its own top-layer layout without host container constraints.

## Consequences
* Guarantees instantaneous high-contrast visual re-skinning across all custom Web Component primitives when the user switches themes.
* Prevents layout collapse and modal freeze bugs when dialogs are pushed into the top-layer stack.