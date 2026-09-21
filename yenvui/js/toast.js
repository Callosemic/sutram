import { LitElement, html, css } from 'lit';

export class YenvuiToastContainer extends LitElement {
    static properties = {
        toasts: { type: Array }
    };
    static styles = css`
        :host {
            position: fixed !important;
            inset: auto 20px 20px auto !important;
            margin: 0 !important;
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            overflow: visible !important;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none !important;
            max-width: 400px;
            width: 100%;
        }

        :host::backdrop {
            display: none !important;
            background: transparent !important;
        }

        .toast {
            background: var(--pane-bg, #1e1e1e);
            color: var(--text, #e0e0e0);
            border: 1px solid var(--border, #444);
            border-left: 4px solid var(--toast-intent, var(--intent-primary, #3b82f6));
            padding: 12px 16px;
            border-radius: 6px;
            font-family: var(--font-mono, monospace);
            font-size: 0.85rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            pointer-events: auto;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .toast.intent-primary { --toast-intent: var(--intent-primary, #3b82f6); }
        .toast.intent-success { --toast-intent: var(--intent-success, #10b981); }
        .toast.intent-danger { --toast-intent: var(--intent-danger, #ef4444); }
        .toast.intent-warning { --toast-intent: var(--intent-warning, #f59e0b); }
        .toast.intent-highlight { --toast-intent: var(--intent-highlight, #8b5cf6); }

        .dismiss-btn {
            background: transparent;
            border: none;
            color: var(--text-muted, #888);
            cursor: pointer;
            font-size: 1rem;
            padding: 0;
            line-height: 1;
        }

        .dismiss-btn:hover {
            color: var(--text, #ffffff);
        }
    `;
    constructor() {
        super();
        this.toasts = [];
    }
    connectedCallback() {
        super.connectedCallback();
        if (typeof this.showPopover === 'function') {
            this.setAttribute('popover', 'manual');
            try {
                this.showPopover();
            } catch (e) {}
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        // Re-promote the container to the top of the #top-layer whenever new toasts arrive
        if (changedProperties.has('toasts') && this.toasts && this.toasts.length > 0) {
            if (typeof this.showPopover === 'function') {
                try {
                    this.hidePopover();
                    this.showPopover();
                } catch (e) {}
            }
        }
    }

    _dismiss(id) {
        this.dispatchEvent(new CustomEvent('yenvui-toast-dismissed', {
            detail: { id },
            bubbles: true,
            composed: true
        }));
    }

    render() {
        if (!this.toasts || this.toasts.length === 0) return html``;
        return html`
            ${this.toasts.map(toast => html`
                <div 
                    class="toast intent-${toast.intent || 'primary'}"
                    @click=${() => this._dismiss(toast.id)}>
                    <span>${toast.message}</span>
                    <button class="dismiss-btn" aria-label="Dismiss toast">✕</button>
                </div>
            `)}
        `;
    }
}
customElements.define('yenvui-toast-container', YenvuiToastContainer);