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

        if (constructor && constructor.prototype) {
            // Intercept connectedCallback before customElements.define captures the prototype
            if (constructor.prototype.connectedCallback && !constructor.prototype._isSafeConnected) {
                const origConnected = constructor.prototype.connectedCallback;
                constructor.prototype.connectedCallback = function(...args) {
                    try {
                        origConnected.apply(this, args);
                    } catch (e) {
                        console.error(`⚠️ [Isolated Component Error] <${name}> failed in connectedCallback:`, e);
                        const toastStore = window.Sutram?.stores?.Toast;
                        if (toastStore && typeof toastStore.getState === 'function') {
                            toastStore.getState().addToast(
                                `Extension <${name}> error: ${e.message}`,
                                'danger'
                            );
                        }
                    }
                };
                constructor.prototype._isSafeConnected = true;
            }
            // Intercept render before customElements.define captures the prototype
            if (constructor.prototype.render && !constructor.prototype._isSafeRender) {
                const origRender = constructor.prototype.render;
                constructor.prototype.render = function(...args) {
                    try {
                        return origRender.apply(this, args);
                    } catch (e) {
                        console.error(`⚠️ [Isolated Component Error] <${name}> failed in render:`, e);
                        return `⚠️ Element <${name}> render error: ${e.message}`;
                    }
                };
                constructor.prototype._isSafeRender = true;
            }
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