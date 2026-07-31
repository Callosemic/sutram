import { LitElement, html, css } from 'lit';

export class YenvuiAsyncBtn extends LitElement {
    static properties = {
        label: { type: String },
        loadingLabel: { type: String },
        successLabel: { type: String },
        errorLabel: { type: String },
        intent: { type: String },
        status: { type: String },
        btntype: { type: String },
        onClick: { type: Object }
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
            font-weight: var(--btn-font-weight, normal);
            border-radius: var(--btn-border-radius, 4px);
            border: none;
            cursor: pointer;
            white-space: nowrap;
            width: 100%;
            min-width: max-content;
            box-sizing: border-box;
            transition: filter 0.2s ease, transform 0.1s ease;
            color: #ffffff;
        }

        button:hover:not(:disabled) {
            filter: brightness(1.1);
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

        /* Semantic Intent Mapping */
        .intent-primary { background: var(--intent-primary, #3b82f6); }
        .intent-success { background: var(--intent-success, #10b981); }
        .intent-danger { background: var(--intent-danger, #ef4444); }
        .intent-warning { background: var(--intent-warning, #f59e0b); color: #000000; } /* Amber needs dark text */
        .intent-highlight { background: var(--intent-highlight, #8b5cf6); }
        .intent-neutral { background: var(--intent-neutral, #64748b); }
    `;
    constructor() {
        super();
        this.label = 'Submit';
        this.loadingLabel = '⏳...';
        this.successLabel = '✅';
        this.errorLabel = '❌';
        this.intent = 'primary';
        this.status = 'idle';
        this.btntype = 'button';
    }

    connectedCallback() {
        super.connectedCallback();
        this._themeObserver = new MutationObserver(() => {
            this.setAttribute('data-theme', document.body.getAttribute('data-theme') || 'dark');
        });
        this._themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
        this.setAttribute('data-theme', document.body.getAttribute('data-theme') || 'dark');
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._themeObserver) this._themeObserver.disconnect();
    }
    async _handleClick(e) {
        if (this.status === 'loading') {
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
                class="intent-${activeIntent}" 
                ?disabled=${this.status === 'loading'}
                @click=${this._handleClick}>
                ${text}
            </button>
        `;
    }
}
customElements.define('yenvui-async-btn', YenvuiAsyncBtn);