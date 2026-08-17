import { LitElement, html, css } from 'lit';

export class YenvuiLabel extends LitElement {
    static properties = {
        text: { type: String }
    };

    static styles = css`
        :host { display: inline-block; margin-bottom: 4px; }
        label {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-muted, #888);
            font-family: var(--font-family, inherit);
            user-select: none;
        }
        :host([data-theme="e-ink"]) label {
            color: #000 !important;
            font-weight: 900 !important;
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
        return html`<label>${this.text}<slot></slot></label>`;
    }
}
customElements.define('yenvui-label', YenvuiLabel);