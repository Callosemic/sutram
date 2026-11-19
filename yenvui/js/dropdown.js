import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
import { syncTopLayerPopover, anchorTopLayerPopover } from './physics.js';
import './search-bar.js';
export class YenvuiDropdown extends YenvuiBase {
    static properties = {
        items: { type: Array },
        open: { type: Boolean, reflect: true },
        align: { type: String },
        direction: { type: String },
        searchable: { type: Boolean },
        searchPlaceholder: { type: String },
        confirmHoldMs: { type: Number },
        filterFn: { attribute: false },
        _searchQuery: { type: String, state: true },
        _hasSlottedContent: { type: Boolean, state: true },
        _loadingItemId: { type: String, state: true },
        _confirmedItemId: { type: String, state: true },
        _confirmedLabel: { type: String, state: true }
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
            border-radius: 0 0 6px 6px;
            padding: 6px;
            min-width: 220px;
            max-height: var(--yv-dropdown-max-height, min(82dvh, 640px));
            overflow-y: auto;
            box-shadow: var(--overlay-shadow);
            z-index: 99999;
            display: none;
            flex-direction: column;
            gap: 2px;
            box-sizing: border-box;
        }
        :host([direction="up"]) .dropdown-menu {
            border-radius: 6px 6px 0 0;
        }
        .dropdown-menu > * {
            flex-shrink: 0;
        }
        .dropdown-menu > ::slotted(*) {
            flex-shrink: 0;
        }
        :host([open]) .dropdown-menu,
        .dropdown-menu:popover-open {
            display: flex;
        }
        .dropdown-search-header {
            position: sticky;
            top: -5px;
            background: var(--pane-bg, #1e1e1e);
            padding: 4px 6px;
            border-bottom: 1px solid var(--border, #444);
            margin-bottom: 4px;
            z-index: 2;
        }
        .divider { height: 1px; background: var(--border, #444); margin: 4px 0; }
        .section-heading {
            font-size: 0.7rem;
            font-weight: 800;
            font-family: var(--font-mono, monospace);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--intent-primary, #8b5cf6);
            padding: 6px 10px 3px 10px;
            margin-top: 2px;
            border-bottom: 1px solid color-mix(in srgb, var(--intent-primary, #8b5cf6) 28%, transparent);
            user-select: none;
        }
        .menu-item.confirmed {
            color: var(--intent-success, #10b981);
            background: color-mix(in srgb, var(--intent-success, #10b981) 14%, transparent);
        }
        .menu-item {
            background: transparent; color: var(--text, #e0e0e0); text-align: left; 
            padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; 
            font-size: 0.9rem; font-weight: bold; margin: 0; display: flex; 
            align-items: center; justify-content: space-between; gap: 8px; width: 100%; box-sizing: border-box;
        }
        .menu-item:hover:not(:disabled) { background: var(--input-bg, #2d2d2d); }
        .menu-item:disabled { opacity: 0.7; cursor: not-allowed; }
        .menu-item-main {
            display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;
        }
        .menu-item-text {
            display: flex; flex-direction: column; min-width: 0; flex: 1;
        }
        .menu-item-desc {
            font-size: 0.72rem; font-weight: normal; color: var(--text-muted, #888);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .menu-item-badge {
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            font-weight: normal;
            color: var(--text-muted, #888);
            background: var(--bg);
            border: 1px solid var(--border, #444);
            padding: 1px 6px;
            border-radius: 4px;
            flex-shrink: 0;
        }
        .menu-item-check {
            width: 14px;
            height: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--intent-primary, #8b5cf6);
            flex-shrink: 0;
        }
        .menu-item-trailing {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 28px;
            min-height: 28px;
            padding: 2px 6px;
            border: 1px solid transparent;
            border-radius: 4px;
            background: transparent;
            color: var(--text-muted, #888);
            cursor: pointer;
            flex-shrink: 0;
        }
        .menu-item-trailing:hover {
            color: var(--intent-danger, #f43f5e);
            background: var(--bg);
            border-color: var(--border, #444);
        }
        .icon { font-size: 1.1rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }

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
        this.direction = 'auto';
        this.searchable = false;
        this.searchPlaceholder = 'Filter actions...';
        this.filterFn = null;
        this._searchQuery = '';
        this._hasSlottedContent = false;
        this._loadingItemId = null;
        this._confirmedItemId = null;
        this._confirmedLabel = '';
        this.confirmHoldMs = 900;
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
                if (menu) anchorTopLayerPopover(this, menu, { mode: 'menu', align: this.align || 'auto', direction: this.direction || 'auto', offset: 0 });
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
        if (changedProperties.has('open') && !this.open && this._searchQuery) {
            this._searchQuery = '';
        }
        if (changedProperties.has('open') || changedProperties.has('items') || changedProperties.has('align') || changedProperties.has('direction') || changedProperties.has('_hasSlottedContent')) {
            const menu = this.shadowRoot?.querySelector('.dropdown-menu');
            if (menu) {
                const hasItems = Boolean(this.open && ((this.items && this.items.length > 0) || this._hasSlottedContent || this.searchable));
                syncTopLayerPopover(this, menu, hasItems, { mode: 'menu', align: this.align || 'auto', direction: this.direction || 'auto', offset: 0 });
            }
        }
    }

    _toggle(e) {
        if (!this._loadingItemId) this.open = !this.open;
    }

    _getFilteredItems() {
        const rawItems = this.items || [];
        const q = (this._searchQuery || '').trim();
        if (!q) return rawItems;

        const matchEntries = (entries) => {
            if (typeof this.filterFn === 'function') {
                return this.filterFn(entries, q);
            }
            const lowerQ = q.toLowerCase();
            return entries.filter(item => {
                const hay = `${item.label || ''} ${item.id || ''} ${item.token || ''} ${item.badge || ''} ${item.description || ''} ${item.section || ''}`.toLowerCase();
                return hay.includes(lowerQ);
            });
        };

        const sections = [];
        let currentSection = { heading: null, entries: [] };
        rawItems.forEach(item => {
            if (!item || item.divider) return;
            if (item.sectionHeading) {
                if (currentSection.heading || currentSection.entries.length > 0) {
                    sections.push(currentSection);
                }
                currentSection = { heading: item, entries: [] };
            } else {
                currentSection.entries.push(item);
            }
        });
        if (currentSection.heading || currentSection.entries.length > 0) {
            sections.push(currentSection);
        }

        const result = [];
        sections.forEach(sec => {
            const matched = matchEntries(sec.entries);
            if (matched.length > 0) {
                if (sec.heading) result.push(sec.heading);
                result.push(...matched);
            }
        });
        return result;
    }
    _notifyError(err) {
        console.error(err);
        this.dispatchEvent(new CustomEvent('yenvui-action-error', {
            detail: { msg: `Action Failed: ${err.message}`, error: err },
            bubbles: true,
            composed: true
        }));
    }
    async _executeItem(item, e) {
        if (this._loadingItemId || this._confirmedItemId) return;
        const itemKey = item.id || item.label;
        const holdMs = Number(item.confirmHoldMs ?? this.confirmHoldMs) >= 0
            ? Number(item.confirmHoldMs ?? this.confirmHoldMs)
            : 900;

        const finishWithConfirmation = async () => {
            if (item.successLabel && holdMs > 0) {
                this._confirmedItemId = itemKey;
                this._confirmedLabel = item.successLabel;
                this.dispatchEvent(new CustomEvent('yenvui-action-confirmed', {
                    bubbles: true,
                    composed: true,
                    detail: { item, status: 'success', phase: 'start', label: item.successLabel, holdMs, keepDrawerOpen: Boolean(item.keepDrawerOpen) }
                }));
                await new Promise(r => this.registerTimeout(r, holdMs));
                this._confirmedItemId = null;
                this._confirmedLabel = '';
            }
            if (!item.keepDrawerOpen) {
                this.open = false;
            }
            this.dispatchEvent(new CustomEvent('yenvui-action-confirmed', {
                bubbles: true,
                composed: true,
                detail: { item, status: 'success', phase: 'settled', label: item.successLabel || 'Done', holdMs, keepDrawerOpen: Boolean(item.keepDrawerOpen) }
            }));
        };

        if (item.asyncAction) {
            this._loadingItemId = itemKey;
            try {
                await item.asyncAction(e);
                this._loadingItemId = null;
                await finishWithConfirmation();
            } catch (err) {
                this._loadingItemId = null;
                this._notifyError(err);
                this.open = false;
            }
        } else {
            if (item.onClick) {
                try {
                    const result = item.onClick(e);
                    if (result && typeof result.then === 'function') {
                        this._loadingItemId = itemKey;
                        await result;
                        this._loadingItemId = null;
                    }
                    await finishWithConfirmation();
                } catch (err) {
                    this._loadingItemId = null;
                    this._notifyError(err);
                    this.open = false;
                }
            } else {
                this.open = false;
            }
        }
    }
    render() {
        const visibleItems = this._getFilteredItems();
        return html`
            <div style="position: relative; display: flex; align-items: stretch; width: 100%; height: 100%;">
                <div @click=${this._toggle} style="display: flex; align-items: stretch; width: 100%; height: 100%;">
                    <slot name="trigger"></slot>
                </div>
                <div class="dropdown-menu" popover="manual" @click=${(e) => e.stopPropagation()}>
                    <slot name="header"></slot>
                    ${this.searchable ? html`
                        <div class="dropdown-search-header">
                            <yenvui-search-bar
                                .placeholder=${this.searchPlaceholder || 'Filter...'}
                                .value=${this._searchQuery}
                                @yenvui-search-changed=${(e) => { this._searchQuery = e.detail.value; }}>
                            </yenvui-search-bar>
                        </div>
                    ` : ''}
                    ${visibleItems.map(item => {
                        if (!item) return '';
                        if (item.divider) return html`<div class="divider"></div>`;
                        if (item.sectionHeading) {
                            return html`<div class="section-heading">${item.sectionHeading}</div>`;
                        }
                        const itemKey = item.id || item.label;
                        const isLoading = this._loadingItemId === itemKey;
                        const isConfirmed = this._confirmedItemId === itemKey;
                        const displayIcon = isConfirmed ? 'check' : item.icon;
                        const displayLabel = isConfirmed
                            ? (this._confirmedLabel || item.successLabel || 'Done')
                            : (isLoading ? 'Processing...' : (item.label || item.id || 'Unknown Action'));
                        const showCheckSlot = Boolean(item.checked || item.checkable);
                        return html`
                            <button
                                class="menu-item ${isConfirmed ? 'confirmed' : ''}"
                                ?disabled=${Boolean(this._loadingItemId || this._confirmedItemId)}
                                @pointerdown=${(e) => { if (typeof item.onPointerDown === 'function') item.onPointerDown(e); }}
                                @click=${(e) => this._executeItem(item, e)}>
                                <span class="menu-item-main">
                                    ${showCheckSlot ? html`
                                        <span class="menu-item-check">
                                            ${item.checked ? html`<yenvui-icon name="check" size="xs"></yenvui-icon>` : ''}
                                        </span>
                                    ` : ''}
                                    <span class="icon">${isLoading ? html`<div class="menu-spinner"></div>` : (displayIcon ? (/^[a-zA-Z0-9-]+$/.test(displayIcon) ? html`<yenvui-icon name="${displayIcon}" size="sm"></yenvui-icon>` : displayIcon) : '')}</span>
                                    <span class="menu-item-text">
                                        <span>${displayLabel}</span>
                                        ${item.description ? html`<span class="menu-item-desc">${item.description}</span>` : ''}
                                    </span>
                                </span>
                                ${item.badge ? html`<span class="menu-item-badge">${item.badge}</span>` : ''}
                                ${item.trailingButton ? html`
                                    <span
                                        role="button"
                                        tabindex="0"
                                        class="menu-item-trailing"
                                        title=${item.trailingButton.title || ''}
                                        @pointerdown=${(e) => e.stopPropagation()}
                                        @click=${(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            if (typeof item.trailingButton.onClick === 'function') {
                                                item.trailingButton.onClick(e);
                                            }
                                            if (item.trailingButton.closeMenu !== false) {
                                                this.open = false;
                                            }
                                        }}>
                                        <yenvui-icon name=${item.trailingButton.icon || 'x'} size="xs"></yenvui-icon>
                                    </span>
                                ` : ''}
                            </button>
                        `;
                    })}
                    <slot name="content" @slotchange=${(e) => {
                        this._hasSlottedContent = e.target.assignedNodes({ flatten: true }).length > 0;
                    }}></slot>
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
            min-width: 240px;
            padding: 12px 16px;
            background: var(--pane-bg, #1e1e1e);
            color: var(--text, #e0e0e0);
            border: 1px solid var(--border, #444);
            border-top: none;
            border-radius: 0 0 6px 6px;
            box-shadow: var(--overlay-shadow);
            max-height: min(80dvh, 640px);
            overflow-y: auto;
            box-sizing: border-box;
        }
        .panel > ::slotted(*) {
            flex-shrink: 0;
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
                    <yenvui-icon name="filter" size="sm"></yenvui-icon>
                </button>
                <div class="panel" popover="manual">
                    <slot></slot>
                </div>
            </div>
        `;
    }
}
customElements.define('yenvui-filter-dropdown', YenvuiFilterDropdown);