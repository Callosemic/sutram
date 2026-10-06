import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
export class YenvuiBtn extends YenvuiBase {
    static properties = {
        label: { type: String },
        intent: { type: String },
        variant: { type: String },
        size: { type: String },
        emphasis: { type: Boolean },
        btntype: { type: String },
        disabled: { type: Boolean },
        active: { type: Boolean }
    };
    static styles = css`
        :host { 
            display: inline-flex;  
            vertical-align: middle;
            min-width: max-content;
            flex-shrink: 0;
        }
        button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: var(--btn-padding, 8px 14px);
            font-size: var(--btn-font-size, 0.85rem);
            font-family: inherit;
            font-weight: var(--btn-font-weight, bold);
            border-radius: var(--btn-border-radius, 8px);
            border: 1px solid transparent;
            cursor: pointer;
            white-space: nowrap;
            width: 100%;
            min-width: max-content;
            box-sizing: border-box;
            transition: all 0.2s ease;
        }
        button:active:not(:disabled) { transform: scale(0.98); }
        button:disabled { opacity: 0.7; cursor: not-allowed; }

        /* E-Ink High Contrast Overrides */
        :host([data-theme="e-ink"]) button {
            background: #ffffff !important;
            color: #000000 !important;
            font-weight: 900 !important;
            border: 2px solid #ec4899 !important;
            box-shadow: 3px 3px 0 #eab308 !important;
        }
        :host([data-theme="e-ink"]) button:hover:not(:disabled) { background: #f1f5f9 !important; }
        :host([data-theme="e-ink"]) button.active { background: #000000 !important; color: #ffffff !important; }

        /* Base Colors */
        .intent-primary { --btn-color: var(--intent-primary, #3b82f6); }
        .intent-success { --btn-color: var(--intent-success, #10b981); }
        .intent-danger { --btn-color: var(--intent-danger, #ef4444); }
        .intent-warning { --btn-color: var(--intent-warning, #f59e0b); }
        .intent-highlight { --btn-color: var(--intent-highlight, #8b5cf6); }
        .intent-neutral { --btn-color: var(--intent-neutral, #64748b); }

        /* Solid Variant */
        button.variant-solid { background: var(--btn-color); color: #ffffff; }
        button.variant-solid.intent-warning { color: #000000; }
        button.variant-solid:hover:not(:disabled) { filter: brightness(1.1); }
        button.variant-solid.active { box-shadow: inset 0 0 0 2px #ffffff; filter: brightness(1.15); }

        /* Tinted Variant */
        button.variant-tinted {
            background: color-mix(in srgb, var(--btn-color) 15%, transparent);
            color: var(--btn-color);
            border-color: color-mix(in srgb, var(--btn-color) 40%, transparent);
        }
        button.variant-tinted:hover:not(:disabled) { background: color-mix(in srgb, var(--btn-color) 25%, transparent); }
        button.variant-tinted.active { border-color: var(--btn-color); background: color-mix(in srgb, var(--btn-color) 35%, transparent); }
        /* Emphasis Glow */
        button.emphasis { box-shadow: 0 0 14px color-mix(in srgb, var(--btn-color) 50%, transparent); }

        /* Sizing */
        button.size-sm { --btn-padding: 4px 10px; --btn-font-size: 0.75rem; }
    `;

    constructor() {
        super();
        this.label = 'Submit';
        this.intent = 'primary';
        this.variant = 'tinted';
        this.emphasis = false;
        this.btntype = 'button';
        this.disabled = false;
        this.active = false;
    }
    render() {
        return html`
            <button 
                type="${this.btntype}"
                class="intent-${this.intent} variant-${this.variant} size-${this.size || 'md'} ${this.emphasis ? 'emphasis' : ''} ${this.active ? 'active' : ''}" 
                ?disabled=${this.disabled}
                @click=${(e) => {
                    if (!this.disabled) {
                        this.dispatchEvent(new CustomEvent('yv-click', { bubbles: true, composed: true, detail: { originalEvent: e } }));
                    }
                }}>
                <slot>${this.label}</slot>
            </button>
        `;
    }
}
customElements.define('yenvui-btn', YenvuiBtn);

export class YenvuiAsyncBtn extends YenvuiBase {
    static properties = {
        label: { type: String },
        loadingLabel: { type: String },
        successLabel: { type: String },
        errorLabel: { type: String },
        intent: { type: String },
        variant: { type: String },
        size: { type: String },
        emphasis: { type: Boolean },
        status: { type: String },
        btntype: { type: String },
        onClick: { type: Object },
        disabled: { type: Boolean },
        active: { type: Boolean }
    };
    static styles = css`
        :host { 
            display: inline-flex; 
            vertical-align: middle;
            min-width: max-content;
            flex-shrink: 0;
        }
        button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: var(--btn-padding, 8px 14px);
            font-size: var(--btn-font-size, 0.85rem);
            font-family: inherit;
            font-weight: var(--btn-font-weight, bold);
            border-radius: var(--btn-border-radius, 8px);
            border: 1px solid transparent;
            cursor: pointer;
            white-space: nowrap;
            width: 100%;
            min-width: max-content;
            box-sizing: border-box;
            transition: all 0.2s ease;
        }

        button:active:not(:disabled) {
            transform: scale(0.98);
        }
        button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }

        /* E-Ink High Contrast Overrides */
        :host([data-theme="e-ink"]) button {
            background: #ffffff !important;
            color: #000000 !important;
            font-weight: 900 !important;
            border: 2px solid #ec4899 !important;
            box-shadow: 3px 3px 0 #eab308 !important;
        }
        :host([data-theme="e-ink"]) button:hover:not(:disabled) {
            background: #f1f5f9 !important;
        }
        :host([data-theme="e-ink"]) button.active {
            background: #000000 !important;
            color: #ffffff !important;
        }

        /* Base Colors */
        .intent-primary { --btn-color: var(--intent-primary, #3b82f6); }
        .intent-success { --btn-color: var(--intent-success, #10b981); }
        .intent-danger { --btn-color: var(--intent-danger, #ef4444); }
        .intent-warning { --btn-color: var(--intent-warning, #f59e0b); }
        .intent-highlight { --btn-color: var(--intent-highlight, #8b5cf6); }
        .intent-neutral { --btn-color: var(--intent-neutral, #64748b); }

        /* Solid Variant (Default) */
        button.variant-solid {
            background: var(--btn-color);
            color: #ffffff;
        }
        button.variant-solid.intent-warning {
            color: #000000;
        }
        button.variant-solid:hover:not(:disabled) {
            filter: brightness(1.1);
        }
        button.variant-solid.active {
            box-shadow: inset 0 0 0 2px #ffffff;
            filter: brightness(1.15);
        }

        /* Tinted Variant */
        button.variant-tinted {
            background: color-mix(in srgb, var(--btn-color) 15%, transparent);
            color: var(--btn-color);
            border-color: color-mix(in srgb, var(--btn-color) 40%, transparent);
        }
        button.variant-tinted:hover:not(:disabled) {
            background: color-mix(in srgb, var(--btn-color) 25%, transparent);
        }
        button.variant-tinted.active {
            border-color: var(--btn-color);
            background: color-mix(in srgb, var(--btn-color) 35%, transparent);
        }
        /* Emphasis Glow */
        button.emphasis {
            box-shadow: 0 0 14px color-mix(in srgb, var(--btn-color) 50%, transparent);
        }

        /* Sizing */
        button.size-sm { --btn-padding: 4px 10px; --btn-font-size: 0.75rem; }
    `;
    constructor() {
        super();
        this.label = 'Submit';
        this.loadingLabel = '⏳...';
        this.successLabel = '✅';
        this.errorLabel = '❌';
        this.intent = 'primary';
        this.variant = 'tinted';
        this.emphasis = false;
        this.status = 'idle';
        this.btntype = 'button';
        this.disabled = false;
        this.active = false;
    }
    async _handleClick(e) {
        if (this.disabled || this.status === 'loading') {
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }
            return;
        }

        this.dispatchEvent(new CustomEvent('yv-click', {  
            bubbles: true, 
            composed: true, 
            detail: { originalEvent: e } 
        }));

        // Bridge the gap for legacy host components passing functional properties
        if (this.onClick && typeof this.onClick === 'function') {
            try {
                this.status = 'loading';
                await this.onClick(e);
                this.status = 'success';
                setTimeout(() => { this.status = 'idle'; }, 2000);
            } catch (err) {
                this.status = 'error';
                console.error(err);
                setTimeout(() => { this.status = 'idle'; }, 2000);
            }
        }
    }

    render() {
        let text = this.label;
        if (this.status === 'loading') text = this.loadingLabel;
        if (this.status === 'success') text = this.successLabel;
        if (this.status === 'error') text = this.errorLabel;

        // Automatically map the success/error states to visual color feedback
        let activeIntent = this.intent;
        if (this.status === 'success') activeIntent = 'success';
        if (this.status === 'error') activeIntent = 'danger';
        return html`
            <button 
                type="${this.btntype}"
                class="intent-${activeIntent} variant-${this.variant} size-${this.size || 'md'} ${this.emphasis ? 'emphasis' : ''} ${this.active ? 'active' : ''}" 
                ?disabled=${this.disabled || this.status === 'loading'}
                @click=${this._handleClick}>
                ${text}
            </button>
        `;
    }
}
customElements.define('yenvui-async-btn', YenvuiAsyncBtn);