import { LitElement, html } from 'lit';

// Suppress benign Chromium ResizeObserver rendering warnings
if (typeof window !== 'undefined') {
    window.addEventListener('error', e => {
        if (e.message && (e.message.includes('ResizeObserver loop limit exceeded') || e.message.includes('ResizeObserver loop completed with undelivered notifications'))) {
            e.stopImmediatePropagation();
        }
    });
}
export class YenvuiInput extends LitElement {
    static properties = {
        label: { type: String },
        placeholder: { type: String },
        value: { type: String },
        type: { type: String },
        disabled: { type: Boolean },
        inline: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true },
        grow: { type: Boolean, reflect: true }
    };

    createRenderRoot() { return this; }

    constructor() {
        super();
        this.type = 'text';
        this.value = '';
        this.placeholder = '';
        this.disabled = false;
        this.inline = false;
        this.flush = false;
        this.grow = false;
    }
    _onInput(e) {
        this.value = e.target.value;
        this.dispatchEvent(new CustomEvent('yenvui-input-changed', {
            detail: { value: this.value }, bubbles: true, composed: true
        }));
    }

    render() {
        const wrapClass = `yv-form-wrapper ${this.flush ? 'yv-form-wrapper--flush' : ''} ${this.inline ? 'yv-form-wrapper--inline' : ''}`;
        return html`
            <div class="${wrapClass}">
                ${this.label ? html`<yenvui-label .text=${this.label}></yenvui-label>` : ''}
                <input
                    class="yv-input"
                    type=${this.type}
                    .value=${this.value || ''}
                    placeholder=${this.placeholder}
                    ?disabled=${this.disabled}
                    @input=${this._onInput}
                >
            </div>
        `;
    }
}
if (!customElements.get('yenvui-input')) customElements.define('yenvui-input', YenvuiInput);

export class YenvuiSelect extends LitElement {
    static properties = {
        label: { type: String },
        value: { type: String },
        options: { type: Array },
        disabled: { type: Boolean },
        inline: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true },
        grow: { type: Boolean, reflect: true }
    };

    createRenderRoot() { return this; }

    constructor() {
        super();
        this.value = '';
        this.options = [];
        this.disabled = false;
        this.inline = false;
        this.flush = false;
        this.grow = false;
    }
    _onChange(e) {
        this.value = e.target.value;
        this.dispatchEvent(new CustomEvent('yenvui-input-changed', {
            detail: { value: this.value }, bubbles: true, composed: true
        }));
    }

    updated() {
        // Lit applies a <select>'s .value before its <option> children update, so set the value once they have.
        const select = this.querySelector('select.yv-select');
        if (select && select.value !== (this.value || '')) select.value = this.value || '';
    }

    render() {
        const wrapClass = `yv-form-wrapper ${this.flush ? 'yv-form-wrapper--flush' : ''} ${this.inline ? 'yv-form-wrapper--inline' : ''}`;
        return html`
            <div class="${wrapClass}">
                ${this.label ? html`<yenvui-label .text=${this.label}></yenvui-label>` : ''}
                <select class="yv-select" ?disabled=${this.disabled} @change=${this._onChange}>
                    ${(this.options || []).map(opt => html`<option value=${opt.value}>${opt.label || opt.value}</option>`)}
                </select>
            </div>
        `;
    }
}
if (!customElements.get('yenvui-select')) customElements.define('yenvui-select', YenvuiSelect);

const _TEXTAREA_SIZE_PRESETS = Object.freeze({
    compact: { minPx: 38, maxPx: 150 },
    normal: { minPx: 60, maxPx: 380 },
    wide: { minPx: 110, maxPx: 540 },
    full: { minPx: 320, maxPx: 720 }
});

export class YenvuiTextarea extends LitElement {
    static properties = {
        label: { type: String },
        value: { type: String },
        placeholder: { type: String },
        variant: { type: String, reflect: true },
        size: { type: String, reflect: true },
        compact: { type: Boolean, reflect: true },
        monospace: { type: Boolean },
        disabled: { type: Boolean },
        readOnly: { type: Boolean },
        inline: { type: Boolean, reflect: true },
        autoSize: { type: Boolean },
        flush: { type: Boolean, reflect: true }
    };

    createRenderRoot() { return this; }

    constructor() {
        super();
        this.value = '';
        this.placeholder = '';
        this.variant = 'default';
        this.size = 'normal';
        this.compact = false;
        this.monospace = false;
        this.disabled = false;
        this.readOnly = false;
        this.inline = false;
        this.autoSize = true;
        this.flush = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this._boundAdjustHeight = this._adjustHeight.bind(this);
        window.addEventListener('resize', this._boundAdjustHeight);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('resize', this._boundAdjustHeight);
        if (this._visibilityObserver) this._visibilityObserver.disconnect();
    }

    firstUpdated() {
        if (typeof IntersectionObserver !== 'undefined') {
            this._visibilityObserver = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    this._adjustHeight();
                }
            });
            this._visibilityObserver.observe(this);
        }
        this._adjustHeight();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('value') || changedProperties.has('autoSize') || changedProperties.has('variant') || changedProperties.has('size') || changedProperties.has('compact')) {
            this._adjustHeight();
        }
    }

    _adjustHeight() {
        if (this.autoSize === false) return;
        window.requestAnimationFrame(() => {
            const textarea = this.querySelector('textarea');
            if (!textarea) return;
            if (textarea.scrollHeight === 0) return;
            const currentHeight = textarea.style.height;
            textarea.style.height = 'auto';
            const sizeKey = this.compact ? 'compact' : (this.size || 'normal');
            const preset = _TEXTAREA_SIZE_PRESETS[sizeKey] || _TEXTAREA_SIZE_PRESETS.normal;
            const minPx = this.variant === 'ghost' ? 28 : preset.minPx;
            const targetPx = !this.value ? minPx : Math.max(minPx, Math.min(textarea.scrollHeight + 2, preset.maxPx));
            const newHeight = `${targetPx}px`;
            if (currentHeight !== newHeight) {
                textarea.style.height = newHeight;
            } else {
                textarea.style.height = currentHeight;
            }
        });
    }
    _onInput(e) {
        this.value = e.target.value;
        this._adjustHeight();
        this.dispatchEvent(new CustomEvent('yenvui-input-changed', {
            detail: { value: this.value }, bubbles: true, composed: true
        }));
    }

    render() {
        const wrapClass = `yv-form-wrapper ${this.flush ? 'yv-form-wrapper--flush' : ''} ${this.inline ? 'yv-form-wrapper--inline' : ''}`;
        const monoClass = this.monospace ? 'yv-textarea--monospace' : '';
        const ghostClass = this.variant === 'ghost' ? 'yv-textarea--borderless' : '';
        return html`
            <div class="${wrapClass}">
                ${this.label ? html`<yenvui-label .text=${this.label}></yenvui-label>` : ''}
                <textarea
                    class="yv-textarea ${monoClass} ${ghostClass}"
                    rows="1"
                    .value=${this.value || ''}
                    placeholder=${this.placeholder}
                    ?disabled=${this.disabled}
                    ?readonly=${this.readOnly}
                    @input=${this._onInput}
                ></textarea>
            </div>
        `;
    }
}
if (!customElements.get('yenvui-textarea')) customElements.define('yenvui-textarea', YenvuiTextarea);

export class YenvuiToggle extends LitElement {
    static properties = {
        label: { type: String },
        checked: { type: Boolean },
        disabled: { type: Boolean },
        flush: { type: Boolean, reflect: true }
    };

    createRenderRoot() { return this; }

    constructor() {
        super();
        this.checked = false;
        this.disabled = false;
        this.flush = false;
    }
    _onToggle(e) {
        if (this.disabled) return;
        if (e) e.preventDefault();
        this.checked = !this.checked;
        this.dispatchEvent(new CustomEvent('yenvui-input-changed', {
            detail: { value: this.checked }, bubbles: true, composed: true
        }));
    }

    render() {
        const wrapClass = `yv-form-wrapper ${this.flush ? 'yv-form-wrapper--flush' : ''}`;
        return html`
            <div class="${wrapClass}">
                <label class="yv-toggle-wrapper ${this.disabled ? 'disabled' : ''}" @click=${this._onToggle}>
                    <div class="yv-toggle-track ${this.checked ? 'checked' : ''}">
                        <div class="yv-toggle-thumb"></div>
                    </div>
                    ${this.label ? html`<span style="font-size: 0.9rem; font-weight: 500; color: var(--text);">${this.label}</span>` : ''}
                    <input type="checkbox" style="display:none;" .checked=${this.checked} ?disabled=${this.disabled}>
                </label>
            </div>
        `;
    }
}
if (!customElements.get('yenvui-toggle')) customElements.define('yenvui-toggle', YenvuiToggle);
