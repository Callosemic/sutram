# yenVUI Engineering Standards

Baseline rules, anti-patterns, and strict compliance guardrails specific to the yenVUI Edge-Native environment.

## 1. Theme Observation Standard
Web Component host elements requiring theme-aware styling beyond standard CSS variable inheritance must establish a `MutationObserver` targeting `document.body`'s `data-theme` attribute during `connectedCallback()` and clean it up in `disconnectedCallback()`.

```javascript
connectedCallback() {
    super.connectedCallback();
    this._themeObserver = new MutationObserver(() => {
        this.setAttribute('data-theme', document.body.getAttribute('data-theme') || 'dark');
    });
    this._themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    this.setAttribute('data-theme', document.body.getAttribute('data-theme') || 'dark');
}

disconnectedCallback() {
    super.disconnectedCallback();
    if (this._themeObserver) this._themeObserver.disconnect();
}

```
## 2. Native Dialog Visibility & Unmount Teardown Standard

Components wrapping native HTML `<dialog>` elements must maintain `:host { display: contents; }` in shadow DOM CSS to allow proper native centering and overlay behavior in the browser's `#top-layer`. Setting `:host { display: none; }` breaks top-layer placement and causes UI freezing when `showModal()` is invoked. Additionally, dialog components must implement a `disconnectedCallback()` unmount hook that temporarily re-attaches open `<dialog>` elements to `document.body` before calling `dialog.close()` and removing them, ensuring the document-level `inert` attribute is cleanly stripped. Close handlers and property updates must yield execution to macro-task queues (`setTimeout(..., 0)`) to avoid triggering Chromium inert race conditions during Lit DOM reconciliations.
## 3. Custom Event Namespacing

All custom events emitted by yenVUI primitives must be prefixed with `yenvui-` (e.g., `yenvui-search-changed`, `yenvui-tab-selected`) or `yv-` (e.g., `yv-click`) to ensure zero event collisions with standard DOM events or host application handlers.
## 4. Floating Alert & DOM Guardrail Standard

Floating overlay alert containers (such as `<yenvui-toast-container>`) must enforce DOM-first guardrails by returning an empty template (`html```) when active item collections are empty, ensuring a zero-element footprint in the host DOM. Non-blocking alerts utilize fixed overlay positioning with high z-index and `pointer-events: none` on the container root, while interactive modal overlays utilize native `<dialog>` elements in the `#top-layer`.

## 5. Event & Property Hybrid Handshake (The "Pit of Success")

While yenVUI primitives must emit pure DOM events (e.g., `@yv-click`) to remain architecturally decoupled, they must simultaneously anticipate and accommodate legacy state orchestrators. If a component traditionally receives asynchronous execution logic (like a button), it must explicitly declare a property (e.g., `onClick: { type: Object }`) and natively `await` its execution during the event lifecycle. This bridges the gap between pure event emissions and legacy functional properties without requiring host-side rewrites.

## 6. Shadow DOM Slot Permeability

Because legacy applications often project raw HTML without explicit slot names, Web Component containers must be designed as "catch-alls":
*   Containers must explicitly define an unnamed fallback `<slot></slot>` to gracefully accept unstructured projections.
*   Containers must aggressively use the `::slotted(*)` CSS selector alongside inherited CSS variables (e.g., `padding: var(--btn-padding) !important;`) to forcefully normalize the geometry of any element the host application attempts to project into it, preventing layout blowouts.
## 7. The DOM-First Vacuum Rule

To avoid catastrophic layout collapses in live applications during migration, all CSS deprecation must strictly follow this order of operations:
1. **The Paint:** Construct the purely presentational Web Component.
2. **The State:** Strip the internal HTML/CSS of the legacy host component and wrap it around the new yenVUI primitive.
3. **The Vacuum:** *Only after* the host DOM has been fully transitioned to the new tags, permanently delete the legacy classes from the host application's stylesheet.
## 8. Safari Touch-Action Gesture Interception Law

Mobile webview engines (specifically iOS Safari) bypass CSS `overscroll-behavior: contain|none` for extreme edge-swipe gestures (swipe-to-back/forward). Web Components handling custom horizontal gestures must combine `touch-action: pan-y` CSS directives on container hosts with explicit, non-passive `touchmove` listeners (`{ passive: false }`) executing `e.preventDefault()` once horizontal swipe dominance is mathematically established.

## 9. Flexbox & Grid Min-Width Blowout Defense

Shadow DOM containers using flexbox or CSS grid layouts (such as modals, cards, and toolbars) with text content, code blocks, or scrollable body regions must explicitly declare `min-width: 0` and `box-sizing: border-box` on child grid/flex items and headers. This prevents content blowouts caused by unbroken strings or code blocks overriding the default flex/grid minimum content sizing algorithm.
