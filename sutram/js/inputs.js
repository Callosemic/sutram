import { LitElement, html, css } from 'lit';
const inputStyles = css`
    :host { display: block; margin-bottom: 15px; font-family: var(--font-family, inherit); }
    .wrapper { display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); }

    :host([inline]) .wrapper { flex-direction: row; align-items: center; gap: 15px; }
    :host([inline]) label { flex-shrink: 0; margin: 0; white-space: nowrap; }
    :host([inline]) .input-base { flex: 1; min-width: 0; }
    
    .input-base {
        padding: 8px 12px;
        font-size: 0.95rem;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg-input, var(--bg));
        color: var(--text);
        transition: border-color 0.2s, box-shadow 0.2s;
        font-family: inherit;
        box-sizing: border-box;
        width: 100%;
    }
    
    .input-base:focus {
        outline: none;
        border-color: var(--intent-primary);
        box-shadow: 0 0 0 2px rgba(var(--intent-primary-rgb, 0, 123, 255), 0.2);
    }
    
    .input-base:disabled {
        background: var(--bg-hover);
        cursor: not-allowed;
        opacity: 0.7;
    }
`;

// 1. Text / Password / Number Input
export class SutramInput extends LitElement {
    static properties = {
        label: { type: String },
        value: { type: String },
        placeholder: { type: String },
        type: { type: String },
        disabled: { type: Boolean },
        inline: { type: Boolean, reflect: true }
    };
    static styles = [inputStyles];

    constructor() {
        super();
        this.type = 'text';
        this.value = '';
        this.placeholder = '';
        this.disabled = false;
        this.inline = false;
    }

    _onInput(e) {
        this.value = e.target.value;
        this.dispatchEvent(new CustomEvent('sutram-input-changed', { 
            detail: { value: this.value }, bubbles: true, composed: true 
        }));
    }

    render() {
        return html`
            <div class="wrapper">
                ${this.label ? html`<label>${this.label}</label>` : ''}
                <input 
                    class="input-base"
                    type=${this.type}
                    .value=${this.value}
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
        inline: { type: Boolean, reflect: true }
    };
    static styles = [inputStyles, css`
        select.input-base { cursor: pointer; appearance: auto; }
    `];

    constructor() {
        super();
        this.value = '';
        this.options = [];
        this.disabled = false;
        this.inline = false;
    }

    _onChange(e) {
        this.value = e.target.value;
        this.dispatchEvent(new CustomEvent('sutram-input-changed', { 
            detail: { value: this.value }, bubbles: true, composed: true 
        }));
    }

    render() {
        return html`
            <div class="wrapper">
                ${this.label ? html`<label>${this.label}</label>` : ''}
                <select class="input-base" .value=${this.value} ?disabled=${this.disabled} @change=${this._onChange}>
                    ${this.options.map(opt => html`<option value=${opt.value}>${opt.label || opt.value}</option>`)}
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
        inline: { type: Boolean, reflect: true }
    };
    static styles = [inputStyles, css`
        textarea { resize: vertical; min-height: 80px; }
        .monospace { font-family: var(--font-monospace, monospace); font-size: 0.9rem; }

        /* Align textarea labels to the top if inline */
        :host([inline]) .wrapper { align-items: flex-start; }
        :host([inline]) label { padding-top: 8px; }
    `];

    constructor() {
        super();
        this.value = '';
        this.placeholder = '';
        this.rows = 4;
        this.monospace = false;
        this.disabled = false;
        this.inline = false;
    }

    _onInput(e) {
        this.value = e.target.value;
        this.dispatchEvent(new CustomEvent('sutram-input-changed', { 
            detail: { value: this.value }, bubbles: true, composed: true 
        }));
    }

    render() {
        return html`
            <div class="wrapper">
                ${this.label ? html`<label>${this.label}</label>` : ''}
                <textarea 
                    class="input-base ${this.monospace ? 'monospace' : ''}"
                    rows=${this.rows}
                    .value=${this.value}
                    placeholder=${this.placeholder}
                    ?disabled=${this.disabled}
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
        disabled: { type: Boolean }
    };
    static styles = [inputStyles, css`
        .toggle-wrapper { display: flex; align-items: center; gap: 10px; cursor: pointer; margin-top: 4px; }
        .toggle-wrapper.disabled { cursor: not-allowed; opacity: 0.6; }
        .track {
            width: 36px; height: 20px;
            background: var(--border);
            border-radius: 20px;
            position: relative;
            transition: background 0.2s;
        }
        .track.checked { background: var(--intent-primary); }
        .thumb {
            width: 16px; height: 16px;
            background: #fff;
            border-radius: 50%;
            position: absolute;
            top: 2px; left: 2px;
            transition: transform 0.2s;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .track.checked .thumb { transform: translateX(16px); }
        input[type="checkbox"] { display: none; }
    `];
    constructor() {
        super();
        this.checked = false;
        this.disabled = false;
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
        return html`
            <div class="wrapper">
                <label class="toggle-wrapper ${this.disabled ? 'disabled' : ''}" @click=${this._onToggle}>
                    <div class="track ${this.checked ? 'checked' : ''}">
                        <div class="thumb"></div>
                    </div>
                    ${this.label ? html`<span style="font-size: 0.9rem; font-weight: 500; color: var(--text);">${this.label}</span>` : ''}
                    <input type="checkbox" .checked=${this.checked} ?disabled=${this.disabled}>
                </label>
            </div>
        `;
    }
}
customElements.define('sutram-toggle', SutramToggle);