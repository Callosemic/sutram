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
    window.SutramIcons = window.SutramIcons || {};
    if (!window.SutramIcons['construction']) {
        window.SutramIcons['construction'] = '<rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/>';
    }
    const _iconMaskCache = new Map();

    function getIconMaskUrl(name, strokeWidth) {
        if (!name) return 'none';
        const cacheKey = `${name}:${strokeWidth}`;
        if (_iconMaskCache.has(cacheKey)) {
            return _iconMaskCache.get(cacheKey);
        }
        const rawMarkup = window.SutramIcons ? (window.SutramIcons[name] || '') : '';
        if (!rawMarkup) return 'none';
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${rawMarkup}</svg>`;
        const encoded = svgStr
            .replace(/"/g, "'")
            .replace(/%/g, '%25')
            .replace(/#/g, '%23')
            .replace(/</g, '%3C')
            .replace(/>/g, '%3E');
        const maskUrl = `url("data:image/svg+xml;utf8,${encoded}")`;
        _iconMaskCache.set(cacheKey, maskUrl);
        return maskUrl;
    }
    class YvIcon extends HTMLElement {
        static get observedAttributes() { return ['name', 'stroke-width', 'style']; }
        connectedCallback() {
            this._renderIcon();
        }
        attributeChangedCallback(attrName, oldVal, newVal) {
            if (this._updatingStyle) return;
            if (oldVal !== newVal && this.isConnected) {
                this._renderIcon();
            }
        }
        _renderIcon() {
            this._updatingStyle = true;
            try {
                const name = this.getAttribute('name');
                const strokeWidth = this.getAttribute('stroke-width') || '2';
                const maskUrl = getIconMaskUrl(name, strokeWidth);
                if (!this.style.display) this.style.display = 'inline-block';
                if (!this.style.verticalAlign) this.style.verticalAlign = 'middle';
                if (!this.style.flexShrink) this.style.flexShrink = '0';
                if (!this.style.width && !this.style.height) {
                    this.style.width = '16px';
                    this.style.height = '16px';
                }
                this.style.maskRepeat = 'no-repeat';
                this.style.webkitMaskRepeat = 'no-repeat';
                this.style.maskPosition = 'center';
                this.style.webkitMaskPosition = 'center';
                this.style.maskSize = 'contain';
                this.style.webkitMaskSize = 'contain';
                this.style.maskImage = maskUrl;
                this.style.webkitMaskImage = maskUrl;
                this.style.backgroundColor = maskUrl === 'none' ? 'transparent' : 'currentColor';
            } finally {
                this._updatingStyle = false;
            }
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