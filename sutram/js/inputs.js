import { LitElement, html, css } from 'lit';

// Suppress benign Chromium ResizeObserver rendering warnings
window.addEventListener('error', e => {
    if (e.message && (e.message.includes('ResizeObserver loop limit exceeded') || e.message.includes('ResizeObserver loop completed with undelivered notifications'))) {
        e.stopImmediatePropagation();
    }
});
// 1. Text / Password / Number Input
export class SutramInput extends LitElement {
    static properties = {
        label: { type: String },
        value: { type: String },
        placeholder: { type: String },
        type: { type: String },
        disabled: { type: Boolean },
        inline: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true }
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
    }

    _onInput(e) {
        this.value = e.target.value;
        this.dispatchEvent(new CustomEvent('sutram-input-changed', { 
            detail: { value: this.value }, bubbles: true, composed: true 
        }));
    }
    render() {
        const wrapClass = `yv-form-wrapper ${this.flush ? 'yv-form-wrapper--flush' : ''} ${this.inline ? 'yv-form-wrapper--inline' : ''}`;
        return html`
            <div class="${wrapClass}">
                ${this.label ? html`<sutram-label .text=${this.label}></sutram-label>` : ''}
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
customElements.define('sutram-input', SutramInput);

// 2. Select Dropdown
export class SutramSelect extends LitElement {
    static properties = {
        label: { type: String },
        value: { type: String },
        options: { type: Array },
        disabled: { type: Boolean },
        inline: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true }
    };

    createRenderRoot() { return this; }

    constructor() {
        super();
        this.value = '';
        this.options = [];
        this.disabled = false;
        this.inline = false;
        this.flush = false;
    }

    _onChange(e) {
        this.value = e.target.value;
        this.dispatchEvent(new CustomEvent('sutram-input-changed', { 
            detail: { value: this.value }, bubbles: true, composed: true 
        }));
    }
    render() {
        const wrapClass = `yv-form-wrapper ${this.flush ? 'yv-form-wrapper--flush' : ''} ${this.inline ? 'yv-form-wrapper--inline' : ''}`;
        return html`
            <div class="${wrapClass}">
                ${this.label ? html`<sutram-label .text=${this.label}></sutram-label>` : ''}
                <select class="yv-select" .value=${this.value || ''} ?disabled=${this.disabled} @change=${this._onChange}>
                    ${this.options.map(opt => html`<option value=${opt.value} ?selected=${this.value === opt.value}>${opt.label || opt.value}</option>`)}
                </select>
            </div>
        `;
    }
}
customElements.define('sutram-select', SutramSelect);

// 3. Textarea
export class SutramTextarea extends LitElement {
    static properties = {
        label: { type: String },
        value: { type: String },
        placeholder: { type: String },
        rows: { type: Number },
        monospace: { type: Boolean },
        disabled: { type: Boolean },
        readOnly: { type: Boolean },
        inline: { type: Boolean, reflect: true },
        autoSize: { type: Boolean },
        maxHeight: { type: Number },
        minRows: { type: Number },
        borderless: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true }
    };

    createRenderRoot() { return this; }

    constructor() {
        super();
        this.value = '';
        this.placeholder = '';
        this.rows = 1;
        this.monospace = false;
        this.disabled = false;
        this.readOnly = false;
        this.inline = false;
        this.autoSize = true;
        this.maxHeight = 500;
        this.minRows = 1;
        this.borderless = false;
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
        this._visibilityObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                this._adjustHeight();
            }
        });
        this._visibilityObserver.observe(this);
        this._adjustHeight();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('value') || changedProperties.has('autoSize') || changedProperties.has('borderless')) {
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
            const newHeight = `${Math.min(textarea.scrollHeight + 2, this.maxHeight || 500)}px`;

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
        this.dispatchEvent(new CustomEvent('sutram-input-changed', { 
            detail: { value: this.value }, bubbles: true, composed: true 
        }));
    }
    render() {
        const wrapClass = `yv-form-wrapper ${this.flush ? 'yv-form-wrapper--flush' : ''} ${this.inline ? 'yv-form-wrapper--inline' : ''}`;
        const monoClass = this.monospace ? 'yv-textarea--monospace' : '';
        const borderlessClass = this.borderless ? 'yv-textarea--borderless' : '';
        return html`
            <div class="${wrapClass}">
                ${this.label ? html`<sutram-label .text=${this.label}></sutram-label>` : ''}
                <textarea 
                    class="yv-textarea ${monoClass} ${borderlessClass}"
                    rows=${this.rows}
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
customElements.define('sutram-textarea', SutramTextarea);

// 4. Boolean Toggle
export class SutramToggle extends LitElement {
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
        if (e) e.preventDefault(); // Stop the native label double-fire
        this.checked = !this.checked;
        this.dispatchEvent(new CustomEvent('sutram-input-changed', { 
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
customElements.define('sutram-toggle', SutramToggle);