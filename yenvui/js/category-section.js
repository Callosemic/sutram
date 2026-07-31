import { LitElement, html, css } from 'lit';

export class YenvuiCategorySection extends LitElement {
    static properties = {
        titleText: { type: String }
    };

    static styles = css`
        :host {
            display: block;
        }
        .category-heading {
            margin-top: 25px;
            margin-bottom: 15px;
            font-size: 1.2rem;
            font-weight: bold;
            color: var(--text, #e0e0e0);
            border-bottom: 1px solid var(--border, #444);
            padding-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        :host([data-theme="e-ink"]) .category-heading {
            color: #000000;
            border-bottom: 2px solid #000000;
        }
    `;

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

    render() {
        return html`
            <div class="category-heading">
                <span>${this.titleText}</span>
                <slot name="header-actions"></slot>
            </div>
            <div class="category-content">
                <slot></slot>
            </div>
        `;
    }
}
customElements.define('yenvui-category-section', YenvuiCategorySection);