import { LitElement, html, css } from 'lit';

export class YenvuiCollapsible extends LitElement {
    static properties = {
        titleText: { type: String },
        open: { type: Boolean, reflect: true },
        intent: { type: String },
        flush: { type: Boolean, reflect: true }
    };

    static styles = css`
        :host {
            display: block;
            border-bottom: 1px solid var(--border, #444);
            border-top: 1px solid var(--border, #444);
        }
        
        /* Prevent double borders when components are stacked adjacently */
        :host + :host {
            border-top: none;
        }

        .header {
            background: var(--input-bg, #2d2d2d);
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
            transition: background 0.2s;
        }
        .header:hover {
            background: var(--bg-hover, var(--input-bg));
        }

        :host([open]) .header {
            border-bottom: 1px solid var(--border, #444);
        }

        .title {
            font-weight: var(--title-weight, bold);
            font-size: var(--title-size, 1rem);
            color: var(--text, #e0e0e0);
        }
        
        /* Semantic Intents */
        .intent-primary { color: var(--intent-primary, #3b82f6); }
        .intent-success { color: var(--intent-success, #10b981); }
        .intent-highlight { color: var(--intent-highlight, #8b5cf6); }
        .intent-warning { color: var(--intent-warning, #f59e0b); }
        .intent-danger { color: var(--intent-danger, #ef4444); }
        .intent-neutral { color: var(--text, #e0e0e0); }

        .chevron {
            font-size: 0.8rem;
            color: var(--text-muted, #888);
            transition: transform 0.2s ease;
        }

        :host([open]) .chevron {
            transform: rotate(90deg);
        }

        .content {
            display: none;
            padding: 20px;
            background: var(--bg, #121212);
        }

        :host([open]) .content {
            display: flex;
            flex-direction: column;
        }
        
        :host([flush]) .content {
            padding: 0;
        }
        
        /* High Contrast Theme Hooks */
        :host([data-theme="e-ink"]) {
            border-color: #000000;
        }
        :host([data-theme="e-ink"]) .header {
            background: var(--pane-bg);
        }
        :host([data-theme="e-ink"][open]) .header {
            border-bottom: 2px dashed #000000;
        }
        :host([data-theme="e-ink"]) .content {
            background: var(--pane-bg);
        }
    `;

    constructor() {
        super();
        this.open = true;
        this.intent = 'neutral';
        this.flush = false;
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

    render() {
        return html`
            <div class="header" @click=${() => {
                this.open = !this.open;
                this.dispatchEvent(new CustomEvent('yenvui-collapsible-toggled', {
                    detail: { open: this.open },
                    bubbles: true,
                    composed: true
                }));
            }}>
                <span class="title intent-${this.intent}">${this.titleText}</span>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <slot name="actions" @click=${e => e.stopPropagation()}></slot>
                    <span class="chevron">▶</span>
                </div>
            </div>
            <div class="content">
                <slot></slot>
            </div>
        `;
    }
}
customElements.define('yenvui-collapsible', YenvuiCollapsible);