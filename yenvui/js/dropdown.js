import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
import { syncTopLayerPopover, anchorTopLayerPopover } from './physics.js';
export class YenvuiDropdown extends YenvuiBase {
    static properties = {
        items: { type: Array },
        open: { type: Boolean, reflect: true },
        align: { type: String },
        _loadingItemId: { type: String, state: true }
    };
    static styles = css`
        :host { display: inline-flex; align-items: stretch; height: 100%; }
        .dropdown-menu {
            position: fixed;
            margin: 0;
            inset: auto;
            background: var(--pane-bg, #1e1e1e);
            color: var(--text, #e0e0e0);
            border: 1px solid var(--border, #444);
            border-radius: 6px;
            padding: 5px;
            min-width: 220px;
            box-shadow: var(--overlay-shadow);
            z-index: 99999;
            display: none;
            flex-direction: column;
            gap: 2px;
            box-sizing: border-box;
        }
        :host([open]) .dropdown-menu,
        .dropdown-menu:popover-open {
            display: flex;
        }

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
        this.align = 'auto';
        this._loadingItemId = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.registerOutsideClick) {
            this.registerOutsideClick(() => {
                if (this.open) this.open = false;
            });
        }
        this._boundReposition = () => {
            if (this.open) {
                const menu = this.shadowRoot?.querySelector('.dropdown-menu');
                if (menu) anchorTopLayerPopover(this, menu, { mode: 'menu', align: this.align || 'auto', offset: 5 });
            }
        };
        window.addEventListener('resize', this._boundReposition);
        window.addEventListener('scroll', this._boundReposition, true);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._boundReposition) {
            window.removeEventListener('resize', this._boundReposition);
            window.removeEventListener('scroll', this._boundReposition, true);
        }
        const menu = this.shadowRoot?.querySelector('.dropdown-menu');
        if (menu) syncTopLayerPopover(this, menu, false);
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('open') || changedProperties.has('items') || changedProperties.has('align')) {
            const menu = this.shadowRoot?.querySelector('.dropdown-menu');
            if (menu) {
                const hasItems = Boolean(this.open && this.items && this.items.length > 0);
                syncTopLayerPopover(this, menu, hasItems, { mode: 'menu', align: this.align || 'auto', offset: 5 });
            }
        }
    }

    _toggle(e) {
        if (!this._loadingItemId) this.open = !this.open;
    }
    _notifyError(err) {
        console.error(err);
        window.dispatchEvent(new CustomEvent('sutram-status-update', {
            detail: { msg: `Action Failed: ${err.message}`, timeout: 4000, isError: true }
        }));
    }
    async _executeItem(item, e) {
        if (this._loadingItemId) return;

        if (item.asyncAction) {
            this._loadingItemId = item.id || item.label;
            try {
                await item.asyncAction(e);
            } catch (err) {
                this._notifyError(err);
            } finally {
                this._loadingItemId = null;
                this.open = false;
            }
        } else {
            this.open = false;
            if (item.onClick) {
                try {
                    const result = item.onClick(e);
                    if (result && typeof result.catch === 'function') {
                        result.catch(err => this._notifyError(err));
                    }
                } catch (err) {
                    this._notifyError(err);
                }
            }
        }
    }
    render() {
        return html`
            <div style="position: relative; display: flex; align-items: stretch; width: 100%; height: 100%;">
                <div @click=${this._toggle} style="display: flex; align-items: stretch; width: 100%; height: 100%;">
                    <slot name="trigger"></slot>
                </div>
                <div class="dropdown-menu" popover="manual">
                    ${(this.items || []).map(item => {
                        if (item.divider) return html`<div class="divider"></div>`;
                        const isLoading = this._loadingItemId === (item.id || item.label);
                        return html`
                            <button class="menu-item" ?disabled=${!!this._loadingItemId} @click=${(e) => this._executeItem(item, e)}>
                                <span class="icon">${isLoading ? html`<div class="menu-spinner"></div>` : (item.icon ? (/^[a-zA-Z0-9-]+$/.test(item.icon) ? html`<yv-icon name="${item.icon}" style="width: 14px; height: 14px;"></yv-icon>` : item.icon) : '')}</span>
                                <span>${isLoading ? 'Processing...' : (item.label || item.id || 'Unknown Action')}</span>
                            </button>
                        `;
                    })}
                </div>
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
        :host { display: flex; position: static; height: 100%; align-items: stretch; }
        .container { display: flex; align-items: stretch; height: 100%; }
        .panel {
            display: none;
            position: fixed;
            margin: 0;
            inset: auto;
            z-index: 99999;
            padding: 15px 20px;
            background: var(--pane-bg, #1e1e1e);
            color: var(--text, #e0e0e0);
            border: 1px solid var(--border, #444);
            border-top: none;
            box-shadow: var(--overlay-shadow);
            max-height: 50vh;
            overflow-y: auto;
            box-sizing: border-box;
        }
        :host([open]) .panel,
        .panel:popover-open {
            display: flex;
            flex-direction: column;
        }

        .system-action-btn { 
            background: var(--rail-bg, transparent); color: var(--text-muted, #888); border: none;
            border-left: 1px solid var(--border, #444); 
            border-radius: 0; border-top-right-radius: inherit; border-bottom-right-radius: inherit;
            cursor: pointer; font-weight: bold; width: var(--yv-rail-cell-width, 44px); height: 100%; 
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
        this._boundSyncBounds = () => {
            if (this.open) {
                const panel = this.shadowRoot?.querySelector('.panel');
                if (panel) anchorTopLayerPopover(this, panel, { mode: 'column-drawer' });
            }
        };
        window.addEventListener('resize', this._boundSyncBounds);
        window.addEventListener('scroll', this._boundSyncBounds, true);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._boundSyncBounds) {
            window.removeEventListener('resize', this._boundSyncBounds);
            window.removeEventListener('scroll', this._boundSyncBounds, true);
        }
        const panel = this.shadowRoot?.querySelector('.panel');
        if (panel) syncTopLayerPopover(this, panel, false);
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('open')) {
            const panel = this.shadowRoot?.querySelector('.panel');
            if (panel) syncTopLayerPopover(this, panel, this.open, { mode: 'column-drawer' });
        }
    }
    _toggleOpen(e) {
        e.stopPropagation();
        this.open = !this.open;
    }
    render() {
        return html`
            <div class="container">
                <button class="system-action-btn" title=${this.filterText} @click=${this._toggleOpen} style="opacity: ${this.hasFilters ? '1' : '0.5'};">
                    <yv-icon name="filter" style="width: var(--yv-icon-size, 14px); height: var(--yv-icon-size, 14px);"></yv-icon>
                </button>
                <div class="panel" popover="manual">
                    <slot></slot>
                </div>
            </div>
        `;
    }
}
customElements.define('yenvui-filter-dropdown', YenvuiFilterDropdown);