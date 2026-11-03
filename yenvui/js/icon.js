const _ICON_MASK_CACHE = new Map();

const _SIZE_PRESETS = Object.freeze({
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '20px',
    xl: '28px'
});

const _INTENT_COLORS = Object.freeze({
    primary: 'var(--intent-primary)',
    success: 'var(--intent-success)',
    warning: 'var(--intent-warning)',
    danger: 'var(--intent-danger)',
    highlight: 'var(--intent-highlight)',
    neutral: 'var(--intent-neutral)',
    muted: 'var(--text-muted)'
});

export function getIconMaskUrl(name, strokeWidth = '2') {
    if (!name) return 'none';
    const cacheKey = `${name}:${strokeWidth}`;
    if (_ICON_MASK_CACHE.has(cacheKey)) {
        return _ICON_MASK_CACHE.get(cacheKey);
    }
    const registry = (typeof window !== 'undefined' && window.SutramIcons) ? window.SutramIcons : {};
    if (!registry.construction) {
        registry.construction = '<rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/>';
    }
    const rawMarkup = registry[name] || '';
    if (!rawMarkup) return 'none';
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${rawMarkup}</svg>`;
    const encoded = svgStr
        .replace(/"/g, "'")
        .replace(/%/g, '%25')
        .replace(/#/g, '%23')
        .replace(/</g, '%3C')
        .replace(/>/g, '%3E');
    const maskUrl = `url("data:image/svg+xml;utf8,${encoded}")`;
    _ICON_MASK_CACHE.set(cacheKey, maskUrl);
    return maskUrl;
}

export class YenvuiIcon extends HTMLElement {
    static get observedAttributes() {
        return ['name', 'size', 'intent', 'stroke-width', 'style'];
    }

    _getAttr(attr, fallback = '') {
        if (typeof this.getAttribute === 'function') {
            return this.getAttribute(attr) || this[`_${attr}`] || fallback;
        }
        return this[`_${attr}`] || fallback;
    }

    _setAttr(attr, val) {
        this[`_${attr}`] = val ? String(val) : '';
        if (typeof this.setAttribute === 'function' && typeof this.removeAttribute === 'function') {
            if (val) this.setAttribute(attr, String(val));
            else this.removeAttribute(attr);
        }
    }

    get name() { return this._getAttr('name', ''); }
    set name(val) { this._setAttr('name', val); }

    get size() { return this._getAttr('size', 'md'); }
    set size(val) { this._setAttr('size', val); }

    get intent() { return this._getAttr('intent', 'current'); }
    set intent(val) { this._setAttr('intent', val); }

    get strokeWidth() { return this._getAttr('stroke-width', '2'); }
    set strokeWidth(val) { this._setAttr('stroke-width', val); }

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
            const sizeAttr = this.getAttribute('size') || '';
            const intentAttr = this.getAttribute('intent') || '';
            const maskUrl = getIconMaskUrl(name, strokeWidth);

            if (!this.style.display) this.style.display = 'inline-block';
            if (!this.style.verticalAlign) this.style.verticalAlign = 'middle';
            if (!this.style.flexShrink) this.style.flexShrink = '0';

            if (sizeAttr) {
                const resolvedDim = _SIZE_PRESETS[sizeAttr] || sizeAttr;
                this.style.width = resolvedDim;
                this.style.height = resolvedDim;
            } else if (!this.style.width && !this.style.height) {
                this.style.width = '16px';
                this.style.height = '16px';
            }

            if (intentAttr && _INTENT_COLORS[intentAttr]) {
                this.style.color = _INTENT_COLORS[intentAttr];
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

if (typeof customElements !== 'undefined') {
    if (!customElements.get('yenvui-icon')) customElements.define('yenvui-icon', YenvuiIcon);
}
