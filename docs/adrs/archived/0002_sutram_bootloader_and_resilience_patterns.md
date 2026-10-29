# 2. Sutram Stage 1 Bootloader, Component Error Boundaries, and Presentation Primitives

* **Status:** Accepted
* **Date:** 2026-07-30
* **Context:** Expanding the Sutram ecosystem requires standardized vendorization, import map synthesis, component error boundaries, and presentation primitives without introducing build bundlers or runtime instability.

## Decision
1. **Stage 1 Bootloader (`sutram-boot.js`):** Intercept `customElements.define` to inject prototype error boundaries, fetch vendor manifests, perform SemVer comparison, and inject synthesized HTML5 import maps prior to firing `sutram:boot-ready`.
2. **Component Error Boundaries (`sdk.js` & `app_shell.js`):** Wrap component `connectedCallback` and `render` lifecycle methods in try-catch boundaries. Intercept unhandled exceptions, log detailed diagnostics, notify `ToastStore`, and render localized fallback UI without interrupting host application execution.
3. **Lazy Store Hydration (`sdk.js`):** Extend `SutramElement.subscribe` to support string store keys, dynamically polling for global store instantiation if components mount before state hydration completes.
4. **Presentation Primitives (`primitives.js`):** Standardize common presentation requirements (`SutramAsyncBtn`, `SutramStatusBar`, `SutramToastContainer`, `SutramSelectionTray`, `SutramCategorizedList`, `SutramFolderBrowser`, `SutramModal`, `SutramGenericSettingsModal`).

## Consequences
* **Positives:** Higher runtime fault tolerance, zero-bundler module dependency resolution via import maps, simplified component subscription lifecycles, and reusable agnostic primitives.
* **Negatives:** Prototype wrapping adds lightweight execution overhead during custom element registration.