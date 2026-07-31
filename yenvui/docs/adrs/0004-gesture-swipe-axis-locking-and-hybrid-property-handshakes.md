# ADR-0004: Gesture Swipe Axis Locking, Safari Back-Navigation Interception, and Hybrid Event/Property Handshakes

## Context
As touch ergonomics and card-based catalog interactions advanced, two core interface friction points emerged:
1. Mobile webview engines (specifically iOS Safari) ignore CSS `overscroll-behavior: contain|none` during extreme left-edge swipe gestures, triggering unintended system back-navigation ("Swipe-to-Back") while users interact with horizontal card trays or edge-selection gutters.
2. Migrating legacy host application components (such as buttons wrapped inside orchestrators expecting function properties like `onClick`) to decoupled DOM-event primitives created integration friction, requiring host components to rewrite state handlers.

## Decision
1. **Mathematical Gesture Axis Locking & Edge Defeater:** Web Component containers managing horizontal gestures (`<yenvui-card>`, `<yenvui-card-group>`) enforce explicit `touch-action: pan-y` CSS. They attach non-passive `touchmove` listeners (`{ passive: false }`) that calculate the dominant axis within the first 5px of movement, invoking `e.preventDefault()` exclusively when horizontal swipe intent is established to halt Safari back-navigation and prevent parent rubber-banding.
2. **Hybrid Event/Property Handshake Standard:** Primitives like `<yenvui-async-btn>` emit normalized custom DOM events (`yv-click`) while simultaneously declaring property bindings (`onClick: { type: Object }`). If a functional callback is passed, the component natively awaits its execution during the event lifecycle, providing instant feedback state machine transitions without breaking legacy state contracts.

## Consequences
* Eliminates accidental browser back-navigation during touch swipe card selections and drawer opens.
* Streamlines host component migration via a backward-compatible "Pit of Success" handshake.