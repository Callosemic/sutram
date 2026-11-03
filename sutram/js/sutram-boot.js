// sutram-boot.js
// Stage 1 Bootloader: Vendorization & DOM Guardrails

(async function() {
    // =========================================================================
    // 1. DOM Guardrail: Prevent Duplicate Custom Element Collisions
    // =========================================================================
    const originalDefine = customElements.define.bind(customElements);
    customElements.define = function(name, constructor, options) {
        if (customElements.get(name)) {
            console.warn(`[Sutram] Soft-skipping duplicate registration for <${name}>`);
            return;
        }
        return originalDefine(name, constructor, options);
    };
    // =========================================================================
    // 2. Seed Global Icon Registry & Trigger Stage 2
    // =========================================================================
    window.SutramIcons = window.SutramIcons || {};
    if (!window.SutramIcons['construction']) {
        window.SutramIcons['construction'] = '<rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/>';
    }
    // Signal the host OS that it is safe to dynamically import the app modules
    const triggerBoot = () => window.dispatchEvent(new CustomEvent('sutram:boot-ready'));
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', triggerBoot);
    } else {
        triggerBoot();
    }
})();