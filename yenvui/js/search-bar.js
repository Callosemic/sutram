import { LitElement, html, css } from 'lit';

export class YenvuiSearchBar extends LitElement {
    static properties = {
        placeholder: { type: String },
        value: { type: String }
    };

    static styles = css`
        :host { display: block; }
        .fuzzy-search-wrapper {
            display: flex;
            align-items: center;
            background: transparent;
            border: none;
            border-radius: 4px;
            padding: 0;
            width: 100%;
            height: 34px;
            box-sizing: border-box;
        }
        input {
            flex: 1;
            border: none !important;
            background: transparent !important;
            outline: none;
            color: var(--text, #e0e0e0);
            padding: 0;
            margin: 0;
            height: 100%;
            font-size: 0.95rem;
            box-shadow: none !important;
            font-family: inherit;
        }
        input::placeholder {
            color: var(--text-muted, #888);
            opacity: 0.6;
        }
        .fuzzy-search-clear {
            background: var(--intent-neutral, #64748b);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 0.65rem;
            font-weight: bold;
            padding: 2px 8px;
            cursor: pointer;
            margin-left: 8px;
        }
        /* High Contrast Themes */
        :host([data-theme="light"]) .fuzzy-search-wrapper {
            background: transparent;
            border: none;
        }
        :host([data-theme="e-ink"]) .fuzzy-search-wrapper {
            border: none !important;
            border-radius: 0 !important;
            background: transparent !important;
        }
        :host([data-theme="e-ink"]) input {
            border: none !important;
            box-shadow: none !important;
        }
    `;

    constructor() { 
        super(); 
        this.placeholder = 'Search...'; 
        this.value = ''; 
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

    _handleInput(e) {
        this.dispatchEvent(new CustomEvent('yenvui-search-changed', { 
            detail: { value: e.target.value }, 
            bubbles: true, 
            composed: true 
        }));
    }

    _handleClear() {
        this.dispatchEvent(new CustomEvent('yenvui-search-changed', { 
            detail: { value: '' }, 
            bubbles: true, 
            composed: true 
        }));
    }

    render() {
        return html`
            <div class="fuzzy-search-wrapper">
                <input type="text" .placeholder=${this.placeholder} .value=${this.value} @input=${this._handleInput}>
                ${this.value ? html`<button class="fuzzy-search-clear" @click=${this._handleClear}>Clear</button>` : ''}
            </div>
        `;
    }
}
customElements.define('yenvui-search-bar', YenvuiSearchBar);