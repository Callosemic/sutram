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
    // 2. Define yv-icon Micro-Primitive (SVG Sprite Renderer)
    // =========================================================================
    class YvIcon extends HTMLElement {
        connectedCallback() {
            this.style.display = 'inline-flex';
            this.style.alignItems = 'center';
            this.style.justifyContent = 'center';
            this.style.flexShrink = '0';
            if (!this.style.width && !this.style.height) {
                this.style.width = '16px';
                this.style.height = '16px';
            }
            const name = this.getAttribute('name');
            const paths = window.SutramIcons ? (window.SutramIcons[name] || '') : '';
            this.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%; display: block;">' + paths + '</svg>';
        }
}
customElements.define('yv-icon', YvIcon);

    // =========================================================================
    // 3. Trigger Stage 2
    // =========================================================================
    // Signal the host OS that it is safe to dynamically import the app modules
    const triggerBoot = () => window.dispatchEvent(new CustomEvent('sutram:boot-ready'));
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', triggerBoot);
    } else {
        triggerBoot();
    }
})();