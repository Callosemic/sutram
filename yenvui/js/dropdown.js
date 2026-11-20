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
        chipRows: { type: Boolean, reflect: true },
        confirmHoldMs: { type: Number },
        filterFn: { attribute: false },
        _searchQuery: { type: String, state: true },
        _hasSlottedHeader: { type: Boolean, state: true },
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
            touch-action: pan-y;
            user-select: auto;
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
        :host([chipRows]) .dropdown-menu,
        :host([chip-rows]) .dropdown-menu {
            min-width: min(92vw, 320px);
            max-width: min(94vw, 540px);
            width: max-content;
            padding: 10px;
            gap: 0;
        }
        .chip-section {
            display: grid;
            grid-template-columns: 92px minmax(0, 1fr);
            align-items: start;
            column-gap: 10px;
            padding: 4px 2px 14px 2px;
            width: 100%;
            box-sizing: border-box;
        }
        .chip-section.no-slug {
            grid-template-columns: minmax(0, 1fr);
        }
        .chip-section:last-of-type {
            padding-bottom: 4px;
        }
        .chip-section.has-divider-after {
            border-bottom: 1px solid var(--border, #444);
            margin-bottom: 8px;
            padding-bottom: 14px;
        }
        .chip-section-slug {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 30px;
            padding: 0 8px;
            border-radius: 6px;
            background: var(--text, #e0e0e0);
            color: var(--bg-deep, #121212);
            font-size: 0.75rem;
            font-weight: 800;
            letter-spacing: 0.02em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            user-select: none;
            box-sizing: border-box;
        }
        .chip-section-slug .slug-icon {
            display: none;
        }
        .chip-section-slug .slug-label {
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .dropdown-menu[data-compact-slugs] .chip-section.has-section-icon {
            grid-template-columns: 30px minmax(0, 1fr);
            column-gap: 8px;
        }
        .dropdown-menu[data-compact-slugs] .chip-section-slug.has-icon {
            width: 30px;
            padding: 0;
        }
        .dropdown-menu[data-compact-slugs] .chip-section-slug.has-icon .slug-icon {
            display: inline-flex;
        }
        .dropdown-menu[data-compact-slugs] .chip-section-slug.has-icon .slug-label {
            display: none;
        }
        .chip-section-items {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }
        .chip-section-slug.is-active-slug,
        .chip-section-slug.has-intent {
            background: var(--slug-intent, var(--intent-primary, #8b5cf6));
            color: var(--bg-deep, #000000);
        }
        .chip-item {
            touch-action: none;
            user-select: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 30px;
            padding: 0 10px;
            margin: 0;
            border-radius: 6px;
            border: 1px solid var(--border, #444);
            border-bottom: 2px solid var(--border, #444);
            background: var(--input-bg, #262626);
            color: var(--text, #e0e0e0);
            font-size: 0.82rem;
            font-weight: 600;
            white-space: nowrap;
            cursor: pointer;
            flex-shrink: 0;
            box-sizing: border-box;
            transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .chip-item:hover:not(:disabled) {
            background: color-mix(in srgb, var(--chip-intent, var(--intent-primary, #8b5cf6)) 14%, var(--bg-hover, #333));
            border-color: var(--chip-intent, var(--intent-primary, #8b5cf6));
        }
        .chip-item.is-checked {
            border-color: color-mix(in srgb, var(--chip-intent, var(--intent-primary, #8b5cf6)) 65%, var(--border, #444));
            border-bottom: 2px solid var(--chip-intent, var(--intent-primary, #8b5cf6));
            background: color-mix(in srgb, var(--chip-intent, var(--intent-primary, #8b5cf6)) 24%, var(--input-bg, #262626));
            color: var(--text, #ffffff);
        }
        .chip-item.confirmed {
            color: var(--intent-success, #10b981);
            border-color: var(--intent-success, #10b981);
            background: color-mix(in srgb, var(--intent-success, #10b981) 14%, transparent);
        }
        .chip-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-mono, monospace);
            font-size: 0.74rem;
            font-weight: 700;
            color: var(--text-muted, #94a3b8);
        }
        .chip-trailing {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            margin-left: 2px;
            margin-right: -4px;
            border-radius: 4px;
            color: var(--text-muted, #94a3b8);
            cursor: pointer;
        }
        .chip-trailing:hover {
            color: var(--intent-danger, #f43f5e);
            background: var(--bg, #121212);
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
        this.chipRows = false;
        this.filterFn = null;
        this._searchQuery = '';
        this._hasSlottedHeader = false;
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
        if (
            changedProperties.has('open') ||
            changedProperties.has('items') ||
            changedProperties.has('align') ||
            changedProperties.has('direction') ||
            changedProperties.has('chipRows') ||
            changedProperties.has('_searchQuery') ||
            changedProperties.has('_hasSlottedHeader') ||
            changedProperties.has('_hasSlottedContent')
        ) {
            const menu = this.shadowRoot?.querySelector('.dropdown-menu');
            if (menu) {
                const hasItems = Boolean(this.open && ((this.items && this.items.length > 0) || this._hasSlottedHeader || this._hasSlottedContent || this.searchable));
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
            const keepOpen = Boolean(item.keepDrawerOpen);
            const keepSel = Boolean(item.keepSelection);
            if (item.successLabel && holdMs > 0) {
                this._confirmedItemId = itemKey;
                this._confirmedLabel = item.successLabel;
                this.dispatchEvent(new CustomEvent('yenvui-action-confirmed', {
                    bubbles: true,
                    composed: true,
                    detail: { item, action: item, status: 'success', phase: 'start', label: item.successLabel, holdMs, keepDrawerOpen: keepOpen, keepSelection: keepSel }
                }));
                await new Promise(r => this.registerTimeout(r, holdMs));
                this._confirmedItemId = null;
                this._confirmedLabel = '';
            }
            if (!keepOpen) {
                this.open = false;
            }
            this.dispatchEvent(new CustomEvent('yenvui-action-confirmed', {
                bubbles: true,
                composed: true,
                detail: { item, action: item, status: 'success', phase: 'settled', label: item.successLabel || 'Done', holdMs, keepDrawerOpen: keepOpen, keepSelection: keepSel }
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
    _getChipRowSections(visibleItems) {
        const sections = [];
        let current = null;
        (visibleItems || []).forEach(item => {
            if (!item) return;
            if (item.divider) {
                if (current) current.dividerAfter = true;
                return;
            }
            if (item.sectionHeading) {
                if (current && (current.heading || current.entries.length > 0)) {
                    sections.push(current);
                }
                current = { heading: item, entries: [], dividerAfter: Boolean(item.dividerAfter) };
            } else {
                if (!current) {
                    current = { heading: null, entries: [], dividerAfter: false };
                }
                current.entries.push(item);
            }
        });
        if (current && (current.heading || current.entries.length > 0)) {
            sections.push(current);
        }
        return sections;
    }

    _renderChipItem(item) {
        const itemKey = item.id || item.label;
        const isLoading = this._loadingItemId === itemKey;
        const isConfirmed = this._confirmedItemId === itemKey;
        const displayIcon = isConfirmed ? 'check' : item.icon;
        const itemIntent = item.intent || 'primary';
        const iconIntent = isConfirmed ? 'success' : (item.intent || 'current');
        const displayLabel = isConfirmed
            ? (this._confirmedLabel || item.successLabel || 'Done')
            : (isLoading ? 'Processing...' : (item.label || item.id || 'Action'));
        return html`
            <button
                type="button"
                class="chip-item ${item.checked ? 'is-checked' : ''} ${isConfirmed ? 'confirmed' : ''}"
                style="--chip-intent: var(--intent-${itemIntent}, var(--intent-primary));"
                ?disabled=${Boolean(this._loadingItemId || this._confirmedItemId)}
                @pointerdown=${(e) => { if (typeof item.onPointerDown === 'function') item.onPointerDown(e); }}
                @click=${(e) => this._executeItem(item, e)}>
                ${isLoading
                    ? html`<div class="menu-spinner"></div>`
                    : (displayIcon ? (/^[a-zA-Z0-9-]+$/.test(displayIcon) ? html`<yenvui-icon name="${displayIcon}" size="xs" intent="${iconIntent}"></yenvui-icon>` : html`<span>${displayIcon}</span>`) : '')}
                <span>${displayLabel}</span>
                ${item.badgeIcon ? html`<span class="chip-badge" title=${item.badgeTitle || ''}><yenvui-icon name=${item.badgeIcon} size="xs"></yenvui-icon></span>` : (item.badge ? html`<span class="chip-badge">${item.badge}</span>` : '')}
                ${item.trailingButton ? html`
                    <span
                        role="button"
                        tabindex="0"
                        class="chip-trailing"
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
    }

    _renderChipSection(sec) {
        const hasExplicitEmptySlug = sec.heading && Object.prototype.hasOwnProperty.call(sec.heading, 'sectionSlug') && !sec.heading.sectionSlug;
        const slugText = hasExplicitEmptySlug ? '' : (sec.heading?.sectionSlug || sec.heading?.sectionHeading || '');
        const slugIcon = slugText ? (sec.heading?.sectionIcon || '') : '';
        const secIntent = sec.heading?.sectionIntent || '';
        const isActiveSlug = Boolean(sec.heading?.sectionVariant === 'active');
        return html`
            <div class="chip-section ${slugText ? '' : 'no-slug'} ${slugIcon ? 'has-section-icon' : ''} ${sec.dividerAfter ? 'has-divider-after' : ''}">
                ${slugText ? html`
                    <span
                        class="chip-section-slug ${isActiveSlug ? 'is-active-slug' : ''} ${secIntent ? 'has-intent' : ''} ${slugIcon ? 'has-icon' : ''}"
                        style="${secIntent ? `--slug-intent: var(--intent-${secIntent}, var(--intent-primary));` : ''}"
                        title=${slugText}>
                        ${slugIcon ? html`<yenvui-icon class="slug-icon" name=${slugIcon} size="sm"></yenvui-icon>` : ''}
                        <span class="slug-label">${slugText}</span>
                    </span>
                ` : ''}
                <div class="chip-section-items">
                    ${sec.entries.map(item => this._renderChipItem(item))}
                </div>
            </div>
        `;
    }

    render() {
        const visibleItems = this._getFilteredItems();
        const allChipSections = this.chipRows ? this._getChipRowSections(this.items || []) : null;
        const filteredChipSections = this.chipRows ? this._getChipRowSections(visibleItems) : null;
        const topChipSections = (this.chipRows && allChipSections)
            ? allChipSections.filter(sec => Boolean(sec.heading?.pinnedTop))
            : [];
        const bodyChipSections = (this.chipRows && filteredChipSections)
            ? filteredChipSections.filter(sec => !sec.heading?.pinnedTop)
            : [];
        return html`
            <div style="position: relative; display: flex; align-items: stretch; width: 100%; height: 100%;">
                <div @click=${this._toggle} style="display: flex; align-items: stretch; width: 100%; height: 100%;">
                    <slot name="trigger"></slot>
                </div>
                <div class="dropdown-menu" popover="manual" @click=${(e) => e.stopPropagation()}>
                    <slot name="header" @slotchange=${(e) => {
                        this._hasSlottedHeader = e.target.assignedNodes({ flatten: true }).length > 0;
                    }}></slot>
                    ${topChipSections.map(sec => this._renderChipSection(sec))}
                    ${this.searchable ? html`
                        <div class="dropdown-search-header">
                            <yenvui-search-bar
                                .placeholder=${this.searchPlaceholder || 'Filter...'}
                                .value=${this._searchQuery}
                                @yenvui-search-changed=${(e) => { this._searchQuery = e.detail.value; }}>
                            </yenvui-search-bar>
                        </div>
                    ` : ''}
                    ${this.chipRows && filteredChipSections ? bodyChipSections.map(sec => this._renderChipSection(sec)) : visibleItems.map(item => {
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
                                ${item.badgeIcon ? html`<span class="menu-item-badge" title=${item.badgeTitle || ''}><yenvui-icon name=${item.badgeIcon} size="xs"></yenvui-icon></span>` : (item.badge ? html`<span class="menu-item-badge">${item.badge}</span>` : '')}
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