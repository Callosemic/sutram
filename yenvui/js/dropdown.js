import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
export class YenvuiDropdown extends YenvuiBase {
    static properties = {
        items: { type: Array },
        open: { type: Boolean, reflect: true },
        align: { type: String },
        _loadingItemId: { type: String, state: true }
    };
    static styles = css`
        :host { display: block; height: 100%; }
        .dropdown-menu {
            position: absolute;
            top: calc(100% + 5px);
            background: var(--pane-bg, #1e1e1e);
            border: 1px solid var(--border, #444);
            border-radius: 6px;
            padding: 5px;
            min-width: 220px;
            box-shadow: var(--overlay-shadow);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        :host([align="left"]) .dropdown-menu { left: 0; right: auto; }
        :host([align="right"]) .dropdown-menu { right: 0; left: auto; }
        :host(:not([align])) .dropdown-menu { right: 0; left: auto; }

        .divider { height: 1px; background: var(--border, #444); margin: 4px 0; }
        .menu-item {
            background: transparent; color: var(--text, #e0e0e0); text-align: left; 
            padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; 
            font-size: 0.9rem; font-weight: bold; margin: 0; display: flex; 
            align-items: center; gap: 8px; width: 100%; box-sizing: border-box;
        }
        .menu-item:hover:not(:disabled) { background: var(--input-bg, #2d2d2d); }
        .menu-item:disabled { opacity: 0.7; cursor: not-allowed; }
        .icon { font-size: 1.1rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; }

        .menu-spinner {
            width: 14px; height: 14px;
            border: 2px solid var(--border, #444);
            border-top: 2px solid var(--intent-primary, #3b82f6);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    constructor() {
        super();
        this.items = [];
        this.open = false;
        this.align = 'right';
        this._loadingItemId = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.registerOutsideClick) {
            this.registerOutsideClick(() => {
                if (this.open) this.open = false;
            });
        }
    }
    _toggle(e) {
        if (!this._loadingItemId) this.open = !this.open;
    }

    async _executeItem(item, e) {
        if (this._loadingItemId) return;

        if (item.asyncAction) {
            this._loadingItemId = item.id || item.label;
            try {
                await item.asyncAction(e);
            } catch (err) {
                console.error(err);
            } finally {
                this._loadingItemId = null;
                this.open = false;
            }
        } else {
            this.open = false;
            if (item.onClick) item.onClick(e);
        }
    }
    render() {
        return html`
            <div style="position: relative; display: flex; align-items: stretch; width: 100%; height: 100%;">
                <div @click=${this._toggle} style="display: flex; align-items: stretch; width: 100%; height: 100%;">
                    <slot name="trigger"></slot>
                </div>
                ${this.open && this.items && this.items.length > 0 ? html`
                    <div class="dropdown-menu">
                        ${this.items.map(item => {
                            if (item.divider) return html`<div class="divider"></div>`;
                            const isLoading = this._loadingItemId === (item.id || item.label);
                            return html`
                                <button class="menu-item" ?disabled=${!!this._loadingItemId} @click=${(e) => this._executeItem(item, e)}>
                                    <span class="icon">${isLoading ? html`<div class="menu-spinner"></div>` : (item.icon || '')}</span>
                                    <span>${isLoading ? 'Processing...' : item.label}</span>
                                </button>
                            `;
                        })}
                    </div>
                ` : ''}
            </div>
        `;
    }
}
customElements.define('yenvui-dropdown', YenvuiDropdown);
export class YenvuiFilterDropdown extends YenvuiBase {
    static properties = {
        filterText: { type: String },
        open: { type: Boolean, reflect: true },
        hasFilters: { type: Boolean }
    };
    static styles = css`
        :host { display: block; position: static; height: 100%; }
        .container { display: flex; align-items: stretch; height: 100%; }
        .panel {
            display: none; position: absolute; top: 100%; left: 0; right: 0;
            z-index: 2000; padding: 15px 20px; background: var(--pane-bg, #1e1e1e); border-bottom: 1px solid var(--border, #444);
            box-shadow: var(--overlay-shadow);
            max-height: 50vh; overflow-y: auto;
        }
        :host([open]) .panel { display: flex; flex-direction: column; }

        .system-action-btn { 
            background: var(--rail-bg, transparent); color: var(--text-muted, #888); border: none;
            border-left: 1px solid var(--border, #444); 
            border-radius: 0; border-top-right-radius: inherit; border-bottom-right-radius: inherit;
            cursor: pointer; font-weight: bold; width: 44px; height: 100%; 
            display: flex; align-items: center; justify-content: center; padding: 0; 
            font-size: 1.1rem; transition: background 0.2s, color 0.2s; margin: 0; box-sizing: border-box;
        }
        .system-action-btn:hover { background: var(--rail-hover, var(--input-bg, #2d2d2d)); color: var(--text); }
        
        .btn {
            padding: 4px 8px; margin: 0; font-size: 0.85rem; white-space: nowrap;
            max-width: 250px; overflow: hidden; text-overflow: ellipsis;
            background: transparent; border: 1px solid transparent; color: var(--text, #e0e0e0);
        }
        :host([open]) .btn { background: var(--input-bg, #2d2d2d); border-color: var(--border, #444); }
    `;
    constructor() {
        super();
        this.open = false;
        this.filterText = 'Filters';
        this.hasFilters = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this.registerOutsideClick(() => {
            if (this.open) this.open = false;
        });
    }
    render() {
        return html`
            <div class="container">
                <button class="system-action-btn" title=${this.filterText} @click=${() => this.open = !this.open} style="opacity: ${this.hasFilters ? '1' : '0.5'};">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                </button>
                <div class="panel">
                    <slot></slot>
                </div>
            </div>
        `;
    }
}
customElements.define('yenvui-filter-dropdown', YenvuiFilterDropdown);