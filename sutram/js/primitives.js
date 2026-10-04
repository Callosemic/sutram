// sutram/js/primitives.js
// Pure Agnostic Presentation Primitives
import { LitElement, html, css } from 'lit';
import { SutramElement, SelectionStore, ToastStore, EnvironmentStore } from './sdk.js';
import { sharedStyles } from './shared_styles.js';
import { buildFileTree } from './utils.js';

import '../../yenvui/js/async-btn.js';
import '../../yenvui/js/status-bar.js';
import '../../yenvui/js/toast.js';
import '../../yenvui/js/modal.js';
import '../../yenvui/js/window.js';
import '../../yenvui/js/category-section.js';
import '../../yenvui/js/card.js';
import '../../yenvui/js/card-group.js';
import '../../yenvui/js/editor.js';
import '../../yenvui/js/toolbar.js';
import '../../yenvui/js/collapsible.js';
import { YenvuiFilterDropdown } from '../../yenvui/js/dropdown.js';
import '../../yenvui/js/pill.js';
import '../../yenvui/js/filter-group.js';
import '../../yenvui/js/selection-tray.js';
import '../../yenvui/js/search-bar.js';
import '../../yenvui/js/spinner.js';
import '../../yenvui/js/empty-state.js';
import '../../yenvui/js/board.js';
import '../../yenvui/js/tag.js';
import '../../yenvui/js/label.js';
// 1. Synchronous Action Button
export class SutramBtn extends SutramElement {
    static properties = {
        label: { type: String },
        intent: { type: String },
        variant: { type: String },
        emphasis: { type: Boolean },
        disabled: { type: Boolean },
        active: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host { display: inline-flex; flex-shrink: 0; vertical-align: middle; min-width: max-content; }
        yenvui-btn { display: inline-flex; width: 100%; min-width: max-content; }
    `];
    constructor() {
        super();
        this.label = 'Submit';
        this.intent = 'primary';
        this.variant = 'tinted';
        this.emphasis = false;
        this.disabled = false;
        this.active = false;
    }
    render() {
        return html`
            <yenvui-btn
                .label=${this.label}
                .intent=${this.intent}
                .variant=${this.variant}
                ?emphasis=${this.emphasis}
                ?disabled=${this.disabled}
                ?active=${this.active}>
                <slot></slot>
            </yenvui-btn>
        `;
    }
}
customElements.define('sutram-btn', SutramBtn);

// 1.5 Async Action Button
export class SutramAsyncBtn extends SutramElement {
    static properties = {
        label: { type: String },
        loadingLabel: { type: String },
        successLabel: { type: String },
        errorLabel: { type: String },
        intent: { type: String },
        variant: { type: String },
        emphasis: { type: Boolean },
        onClick: { type: Object },
        disabled: { type: Boolean },
        active: { type: Boolean },
        _status: { type: String },
        _isOfflineReadOnly: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host { display: inline-flex; flex-shrink: 0; vertical-align: middle; min-width: max-content; }
        yenvui-async-btn { display: inline-flex; width: 100%; min-width: max-content; }
    `];
    constructor() {
        super();
        this.label = 'Submit';
        this.loadingLabel = '⏳...';
        this.successLabel = '✅';
        this.errorLabel = '❌';
        this.intent = 'primary';
        this.variant = 'tinted';
        this.emphasis = false;
        this.disabled = false;
        this.active = false;
        this._status = 'idle';
        this._isOfflineReadOnly = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(EnvironmentStore, state => {
            if (state.isOffline) {
                // Pierce Shadow DOM boundaries to securely resolve the host extension
                let current = this;
                let extName = null;
                while (current) {
                    if (current.dataset && current.dataset.ext) {
                        extName = current.dataset.ext;
                        break;
                    }
                    current = current.getRootNode().host || current.parentElement;
                }
                const mode = extName && window.ExtensionRegistry?.getExtension(extName)?.offline_mode;
                this._isOfflineReadOnly = (mode === 'read_only' || mode === 'none' || !mode);
            } else {
                this._isOfflineReadOnly = false;
            }
        });
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        // Self-Healing Wrapper: Reset success/error states if Lit recycles the DOM node for a new action/identity
        if (changedProperties.has('onClick') || changedProperties.has('label')) {
            if (this._status !== 'loading' && this._status !== 'idle') {
                this._status = 'idle';
            }
        }
    }
    async _handleClick(e) {
        if (e) e.stopPropagation();
        if (this.disabled || this._status === 'loading' || !this.onClick) return;
        this._status = 'loading';
        try {
            await this.onClick(e?.detail?.originalEvent || e);
            this._status = 'success';
        } catch (err) {
            console.error(err);
            this._status = 'error';
        } finally {
            setTimeout(() => { if (this._status !== 'loading') this._status = 'idle'; }, 2000);
        }
    }
    render() {
        const isDisabled = this.disabled || this._isOfflineReadOnly;
        const displayLabel = this._isOfflineReadOnly ? '🚫 Offline' : this.label;
        return html`
            <yenvui-async-btn
                .label=${displayLabel}
                .loadingLabel=${this.loadingLabel}
                .successLabel=${this.successLabel}
                .errorLabel=${this.errorLabel}
                .intent=${this.intent}
                .variant=${this.variant}
                ?emphasis=${this.emphasis}
                .status=${this._status}
                ?disabled=${isDisabled}
                ?active=${this.active}
                @yv-click=${this._handleClick}>
            </yenvui-async-btn>
        `;
    }
}
customElements.define('sutram-async-btn', SutramAsyncBtn);

// 2. Status Bar Component
export class SutramStatusBar extends SutramElement {
    static properties = {
        baseTitle: { type: String },
        statusString: { type: String },
        tempMessage: { type: String },
        isError: { type: Boolean },
        syncState: { type: String }
    };
    static styles = css`
        :host { display: block; width: 100%; flex-shrink: 0; z-index: 1000; }
    `;
    constructor() {
        super();
        this.baseTitle = 'System Online';
        this.statusString = '';
        this.tempMessage = '';
        this.isError = false;
        this.syncState = 'synced';
        this._statusListener = this._handleStatusUpdate.bind(this);
        this._syncListener = (e) => { this.syncState = e.detail.state; };
    }
    connectedCallback() {
        super.connectedCallback();
        this.registerGlobalListener('sutram-status-update', window, this._statusListener);
        this.registerGlobalListener('sutram-sync-status', window, this._syncListener);
    }
    _handleStatusUpdate(e) {
        this.tempMessage = e.detail.msg;
        this.isError = e.detail.isError;
        if (this._timeout) clearTimeout(this._timeout);
        if (e.detail.timeout) {
            this._timeout = setTimeout(() => {
                this.tempMessage = '';
                this.isError = false;
            }, e.detail.timeout);
        }
    }
    render() {
        if (this.tempMessage) {
            return html`<yenvui-status-bar .text=${this.tempMessage} ?isError=${this.isError} .syncState=${this.syncState}></yenvui-status-bar>`;
        }
        let text = this.baseTitle;
        if (this.statusString) {
            text = `${text} | ${this.statusString}`;
        }
        return html`<yenvui-status-bar .text=${text} ?isError=${false} .syncState=${this.syncState}></yenvui-status-bar>`;
    }
}
customElements.define('sutram-status-bar', SutramStatusBar);

// 3. Toast Notification Container
export class SutramToastContainer extends SutramElement {
    static properties = { toasts: { type: Array } };
    static styles = css`:host { display: contents; pointer-events: none; }`;

    constructor() {
        super();
        this.toasts = [];
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(ToastStore, state => {
            this.toasts = state.toasts;
        });
    }
    render() {
        return html`
            <yenvui-toast-container 
                .toasts=${this.toasts} 
                @yenvui-toast-dismissed=${(e) => {
                    ToastStore.getState().removeToast(e.detail.id);
                }}>
            </yenvui-toast-container>
        `;
    }
}
customElements.define('sutram-toast-container', SutramToastContainer);

// 4. Selection Store & Tray
export class SutramSelectionTray extends SutramElement {
    static properties = { 
        selectedItems: { type: Object },
        modalOpen: { type: Boolean }
    };

    static styles = css`
        .cart-btn {
            background: color-mix(in srgb, var(--intent-warning) 15%, transparent);
            color: var(--intent-warning);
            border: 1px solid color-mix(in srgb, var(--intent-warning) 40%, transparent);
            border-radius: 20px;
            height: 32px;
            padding: 0 12px;
            font-size: 0.85rem;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
            margin-right: 12px;
        }
        .cart-btn:hover {
            background: color-mix(in srgb, var(--intent-warning) 25%, transparent);
        }
        .cart-badge.mobile-only { display: none; }
        .cart-badge {
            background: var(--intent-warning);
            color: #000;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
        }
        @media (max-width: 768px) {
            .cart-text { display: none; }
            .cart-badge.mobile-only { display: flex; }
            .cart-btn { padding: 0 8px; }
        }

        .tray-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2999;
            opacity: 0; pointer-events: none; transition: opacity 0.2s;
        }
        .tray-overlay.open { opacity: 1; pointer-events: auto; }

        .tray-panel {
            position: fixed; top: 60px; right: 20px; width: 450px; max-width: calc(100vw - 40px);
            background: var(--pane-bg); border: 1px solid var(--border); border-radius: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.5); z-index: 3000; display: flex; flex-direction: column;
            transform: translateY(-20px); opacity: 0; pointer-events: none; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            max-height: calc(100dvh - 80px);
        }
        .tray-panel.open { transform: translateY(0); opacity: 1; pointer-events: auto; }

        .tray-header {
            display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 20px 15px 20px;
        }
        .tray-header h3 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 1.1rem; color: var(--text); }
        .tray-header p { margin: 4px 0 0 0; color: var(--text-muted); font-size: 0.85rem; font-family: var(--font-mono); }
        .tray-header button { background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem; }
        .tray-header button:hover { color: var(--text); }

        .tray-subheader {
            padding: 0 20px 15px 20px; border-bottom: 1px solid var(--border);
            display: flex; justify-content: space-between; align-items: center;
            font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);
        }

        .tray-items {
            flex: 1; overflow-y: auto; padding: 15px 20px; display: flex; flex-direction: column; gap: 10px;
        }
        .tray-item {
            display: flex; align-items: center; justify-content: space-between;
            background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px;
            padding: 12px; border-left: 4px solid var(--intent-warning); gap: 12px;
        }
        .tray-item-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
        .tray-item-title { font-weight: bold; color: var(--text); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 8px; justify-content: space-between; }
        .tray-item-path { font-family: monospace; font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pack-tag { background: color-mix(in srgb, var(--intent-warning) 20%, transparent); color: var(--intent-warning); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; }

        .tray-footer {
            display: flex; gap: 10px; padding: 15px 20px; border-top: 1px solid var(--border); background: var(--bg-deep); border-radius: 0 0 12px 12px;
        }
    `;

    constructor() {
        super();
        this.selectedItems = new Map();
        this.modalOpen = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(SelectionStore, state => {
            this.selectedItems = state.selectedItems;
            if (this.selectedItems.size === 0) this.modalOpen = false;
            this.requestUpdate();
        });
        this.selectedItems = SelectionStore.getState().selectedItems;
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: this.shadowRoot });
        }
    }

    render() {
        const count = this.selectedItems.size;
        const itemsArray = Array.from(this.selectedItems.values());

        let totalSize = 0;
        itemsArray.forEach(item => {
            if (item.data?.size_bytes) totalSize += item.data.size_bytes;
            else totalSize += 4096; // Fallback estimate
        });

        let batchActions = [];
        const registry = window.ExtensionRegistry;
        if (registry && registry._manifests) {
            registry._manifests.forEach(config => {
                if (config.batchActions) {
                    config.batchActions.forEach(act => {
                        if (act.match(itemsArray)) batchActions.push(act);
                    });
                }
            });
        }
        batchActions.sort((a, b) => (a.order || 99) - (b.order || 99));

        return html`
            ${count > 0 ? html`
                <button class="cart-btn" @click=${() => this.modalOpen = true}>
                    <i data-lucide="zap" style="width: 14px; height: 14px;"></i>
                    <span class="cart-text">${count} items</span>
                    <span class="cart-badge mobile-only">${count}</span>
                </button>
            ` : ''}

            <div class="tray-overlay ${this.modalOpen ? 'open' : ''}" @click=${() => this.modalOpen = false}></div>
            <div class="tray-panel ${this.modalOpen ? 'open' : ''}">
                <div class="tray-header">
                    <div style="display: flex; gap: 12px;">
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: color-mix(in srgb, var(--intent-warning) 15%, transparent); border: 1px solid color-mix(in srgb, var(--intent-warning) 40%, transparent); display: flex; align-items: center; justify-content: center; color: var(--intent-warning);">
                            <i data-lucide="zap" style="width: 18px; height: 18px;"></i>
                        </div>
                        <div>
                            <h3>Quickpack Staging Deck <span class="cart-badge" style="margin-left: 8px;">${count}</span></h3>
                            <p>Compiled payload bundle staging</p>
                        </div>
                    </div>
                    <button @click=${() => this.modalOpen = false}>✕</button>
                </div>
                <div class="tray-subheader">
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="layers" style="width: 14px; height: 14px;"></i> ${count} items</span>
                        <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="database" style="width: 14px; height: 14px;"></i> ~${Math.round(totalSize / 1024)} kb</span>
                    </div>
                </div>
                <div class="tray-items">
                    ${itemsArray.map(item => {
                        const name = item.data?.titleText || item.data?.filepath?.split('/').pop() || 'Unknown Item';
                        const path = item.data?.filepath || item.data?.folderpath || item.data?.id || '';
                        const sizeText = item.data?.size_bytes ? `${Math.round(item.data.size_bytes / 1024)} kb` : '';
                        return html`
                        <div class="tray-item">
                            <div class="tray-item-info">
                                <div class="tray-item-title">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="pack-tag">PACK</span> ${name}</div>${sizeText ? html`<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem; font-family: monospace;">${sizeText}</span>` : ''}
                                </div>
                                <div class="tray-item-path">${path}</div>
                            </div>
                            <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;" @click=${() => SelectionStore.getState().toggleSelection(path, item.entityType, item.data)}>✕</button>
                        </div>
                    `})}
                </div>
                <div class="tray-footer">
                    <sutram-async-btn label="🗑️ Clear" intent="danger" variant="tinted" .onClick=${() => { SelectionStore.getState().clearSelection(); this.modalOpen = false; }} style="margin-right: auto;"></sutram-async-btn>
                    ${batchActions.map(act => html`
                        <sutram-async-btn 
                            label="${act.icon}${act.label}" 
                            intent="${act.intent || 'primary'}" 
                            variant="${act.variant || 'solid'}"
                            ?emphasis=${act.emphasis}
                            .onClick=${async (e) => {
                                if (act.asyncAction) await act.asyncAction(itemsArray, e);
                                else if (act.onClick) act.onClick(itemsArray, e);
                            }}>
                        </sutram-async-btn>
                    `)}
                </div>
            </div>
        `;
    }
}
customElements.define('sutram-selection-tray', SutramSelectionTray);

// 5. Categorized List Container
export class SutramCategorizedList extends LitElement {
    static properties = {
        items: { type: Array },
        categoryKey: { type: String },
        categoryOrder: { type: Array },
        renderItem: { type: Object },
        renderCategoryHeader: { type: Object }
    };
    static styles = [sharedStyles];

    render() {
        if (!this.items || this.items.length === 0) return html``;
        const categories = {};
        this.items.forEach(item => {
            const cat = item[this.categoryKey] || 'Uncategorized';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(item);
        });

        const sortedCats = Object.keys(categories).sort((a, b) => {
            const orderArr = this.categoryOrder || [];
            let iA = orderArr.indexOf(a);
            let iB = orderArr.indexOf(b);
            if (iA === -1) iA = 999;
            if (iB === -1) iB = 999;
            if (iA !== iB) return iA - iB;
            return a.localeCompare(b);
        });
        return html`
            <div style="display: flex; flex-direction: column;">
                ${sortedCats.map(cat => html`
                    <yenvui-category-section titleText=${cat}>
                        ${this.renderCategoryHeader ? this.renderCategoryHeader(cat) : ''}
                        <yenvui-card-group>
                            ${categories[cat].map(item => this.renderItem(item))}
                        </yenvui-card-group>
                    </yenvui-category-section>
                `)}
            </div>
        `;
    }
}
customElements.define('sutram-categorized-list', SutramCategorizedList);

// 6. Folder Browser
export class SutramFolderBrowser extends LitElement {
    static properties = {
        files: { type: Array },
        currentPath: { type: Array }
    };

    constructor() {
        super();
        this.files = [];
        this.currentPath = [];
    }

    createRenderRoot() {
        return this; // Render in Light DOM to inherit OS CSS
    }

    _setPath(newPath) {
        this.currentPath = newPath;
        this.dispatchEvent(new CustomEvent('path-changed', {
            detail: { path: newPath.join('/') },
            bubbles: true,
            composed: true
        }));
    }

    render() {
        const tree = buildFileTree(this.files);
        let current = tree;
        for (const p of this.currentPath) {
            if (current[p]) {
                current = current[p];
            } else {
                current = tree;
                this.currentPath = [];
                break;
            }
        }

        const keys = Object.keys(current).filter(k => k !== '_isFile' && !current[k]._isFile).sort((a, b) => a.localeCompare(b));
        return html`
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; overflow: hidden;">
                <sutram-btn intent="neutral" ?disabled=${this.currentPath.length === 0} @click=${() => this._setPath(this.currentPath.slice(0, -1))}>⬆️ Up</sutram-btn>
                <yenvui-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.9rem;">
                    /${this.currentPath.join('/')}
                </yenvui-scrub-track>
            </div>
            <div style="flex: 1; overflow-y: auto;">
                ${keys.length === 0 ? html`<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem; margin-top: 10px;">No sub-folders available.</div>` : keys.map(key => html`
                    <div style="padding: 8px 10px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; transition: background 0.2s; margin-bottom: 4px;" 
                        onmouseover="this.style.background='var(--input-bg)'" 
                        onmouseout="this.style.background='transparent'"
                        @click=${() => this._setPath([...this.currentPath, key])}>
                        <span style="font-family: monospace; font-weight: bold; color: var(--intent-warning); margin-right: 8px;">📁</span>
                        <span style="color: var(--text); font-size: 0.9rem; font-weight: bold;">${key}</span>
                    </div>
                `)}
            </div>
        `;
    }
}
customElements.define('sutram-folder-browser', SutramFolderBrowser);
// 7. Native Dialog Modal
export class SutramModal extends SutramElement {
    static properties = {
        open: { type: Boolean, reflect: true },
        titleText: { type: String },
        fullscreen: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true },
        maxWidth: { type: String }
    };

    static styles = [sharedStyles, css`
        :host { display: contents; }
    `];

    constructor() {
        super();
        this.open = false;
        this.titleText = '';
        this.maxWidth = '';
        this.fullscreen = false;
        this.flush = false;
    }

    _handleClose(e) {
        this.open = false;
        this.dispatchEvent(new CustomEvent('sutram-modal-closed', { bubbles: true, composed: true }));
    }

    render() {
        return html`
            <yenvui-modal 
                ?open=${this.open}
                .titleText=${this.titleText}
                .maxWidth=${this.maxWidth}
                ?fullscreen=${this.fullscreen}
                ?flush=${this.flush}
                @yenvui-modal-closed=${this._handleClose}>
                <slot name="body" slot="body"></slot>
                <slot></slot>
                <slot name="footer" slot="footer"></slot>
            </yenvui-modal>
        `;
    }
}
customElements.define('sutram-modal', SutramModal);

export class SutramWindow extends SutramElement {
    static properties = {
        titleText: { type: String },
        x: { type: Number },
        y: { type: Number },
        z: { type: Number },
        icon: { type: String },
        intent: { type: String }
    };
    static styles = css`:host { display: contents; }`;
    render() {
        return html`
            <yenvui-window .titleText=${this.titleText} .x=${this.x} .y=${this.y} .z=${this.z} .icon=${this.icon} .intent=${this.intent}
                @yenvui-window-close=${() => this.dispatchEvent(new CustomEvent('sutram-window-closed', { bubbles: true, composed: true }))}
                @yenvui-window-move=${(e) => this.dispatchEvent(new CustomEvent('sutram-window-moved', { detail: e.detail, bubbles: true, composed: true }))}
                @yenvui-window-focus=${() => this.dispatchEvent(new CustomEvent('sutram-window-focused', { bubbles: true, composed: true }))}
                @yenvui-window-drag-start=${(e) => this.dispatchEvent(new CustomEvent('sutram-window-drag-start', { detail: e.detail, bubbles: true, composed: true }))}
                @yenvui-window-dock=${() => this.dispatchEvent(new CustomEvent('sutram-window-dock', { bubbles: true, composed: true }))}>
                <slot></slot>
            </yenvui-window>
        `;
    }
}
customElements.define('sutram-window', SutramWindow);

// 8. Generic Settings Engine
export class SutramGenericSettingsModal extends SutramElement {
    static properties = {
        open: { type: Boolean, reflect: true },
        extName: { type: String },
        schema: { type: Array },
        formData: { type: Object },
        _jsonBuffers: { type: Object }
    };
    static styles = [sharedStyles, css`:host { display: contents; }`];

    constructor() {
        super();
        this.open = false;
        this.extName = '';
        this.schema = [];
        this.formData = {};
        this._jsonBuffers = {};
    }

    openModal(extName, schema, formData) {
        this.extName = extName;
        this.schema = schema || [];
        this.formData = formData || {};
        this._jsonBuffers = {};
        this.open = true;
        this.requestUpdate();
    }

    saveSettings(e) {
        const btn = e.target;
        const orig = btn.innerText;
        btn.innerText = '⏳ Saving...';

        this.dispatchEvent(new CustomEvent('sutram-settings-save', {
            detail: { extName: this.extName, formData: this.formData, btn, origText: orig },
            bubbles: true,
            composed: true
        }));
    }
    render() {
        const registry = window.ExtensionRegistry;
        const manifest = registry?._manifests?.get(this.extName);
        const title = (manifest?.name || this.extName) + ' Settings';
        const settingsActions = manifest?.settingsActions || [];

        return html`
            <yenvui-modal  
                ?open=${this.open} 
                titleText=${title} 
                ?fullscreen=${true} 
                ?transparent=${true}
                style="--modal-backdrop: transparent; --modal-backdrop-filter: none;"
                @yenvui-modal-closed=${() => this.open = false}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 15px; flex: 1; min-height: 0; overflow-y: auto;">
                    ${settingsActions.filter(act => !act.id.endsWith('_generic_settings')).map(act => html`
                        <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; padding: 15px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px;">
                            <label style="font-size: 0.95rem; color: var(--text); font-weight: bold;">${act.icon || ''} ${act.label}</label>
                            <span style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">Click to open the dedicated configuration panel.</span>
                            <sutram-async-btn label="Open Editor" intent="primary" .onClick=${async (e) => {
                                this.open = false;
                                if (act.onClick) await act.onClick(e);
                            }}></sutram-async-btn>
                        </div>
                    `)}

                    ${this.schema.map(field => {
                        if (field.type === 'hidden') return '';

                        const val = this.formData[field.id] !== undefined ? this.formData[field.id] : field.default;
                        let inputHtml = '';
                        if (field.type === 'action') {
                            inputHtml = html`
                                <sutram-async-btn
                                    label=${field.button_label || field.label || 'Execute Action'}
                                    intent=${field.intent || 'primary'}
                                    .onClick=${async (e) => {
                                        return new Promise((resolve, reject) => {
                                            this.dispatchEvent(new CustomEvent('sutram-settings-action', {
                                                detail: { extName: this.extName, field, resolve, reject, originalEvent: e },
                                                bubbles: true,
                                                composed: true
                                            }));
                                        });
                                    }}>
                                </sutram-async-btn>
                            `;
                        } else if (field.type === 'boolean') {
                            inputHtml = html`<sutram-toggle .checked=${!!val} @sutram-input-changed=${e => { this.formData = {...this.formData, [field.id]: e.detail.value}; this.requestUpdate(); }} ?flush=${true} style="margin-top: 4px;"></sutram-toggle>`;
                        } else if (field.type === 'select') {
                            const options = (field.options || []).map(opt => ({ value: opt.value !== undefined ? opt.value : opt, label: opt.label || opt.title || opt.value || opt }));
                            inputHtml = html`<sutram-select .value=${val} .options=${options} @sutram-input-changed=${e => { this.formData = {...this.formData, [field.id]: e.detail.value}; this.requestUpdate(); }} ?flush=${true}></sutram-select>`;
                        } else if (field.type === 'number') {
                            inputHtml = html`<sutram-input type="number" .value=${val} @sutram-input-changed=${e => { this.formData = {...this.formData, [field.id]: parseFloat(e.detail.value)}; this.requestUpdate(); }} ?flush=${true}></sutram-input>`;
                        } else if (field.type === 'object' || field.type === 'json' || (typeof val === 'object' && val !== null)) {
                            const strVal = this._jsonBuffers[field.id] !== undefined ? this._jsonBuffers[field.id] : (typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : val);
                            inputHtml = html`<sutram-textarea .value=${strVal} .monospace=${true} .minRows=${4} @sutram-input-changed=${e => {
                                this._jsonBuffers = { ...this._jsonBuffers, [field.id]: e.detail.value };
                                try {
                                    this.formData = {...this.formData, [field.id]: JSON.parse(e.detail.value)};
                                } catch(err) {}
                                this.requestUpdate();
                            }} ?flush=${true}></sutram-textarea>`;
                        } else {
                            const inputType = field.type === 'password' ? 'password' : 'text';
                            inputHtml = html`<sutram-input type="${inputType}" .value=${val} @sutram-input-changed=${e => { this.formData = {...this.formData, [field.id]: e.detail.value}; this.requestUpdate(); }} ?flush=${true}></sutram-input>`;
                        }
                        const displayLabel = field.title || field.label || field.id;
                        return html`
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px;">
                                ${field.type === 'boolean' 
                                    ? html`<div style="display: flex; align-items: center; gap: 10px;"><label style="font-size: 0.95rem; color: var(--text); font-weight: bold; margin: 0; cursor: pointer;">${displayLabel}</label>${inputHtml}</div>` 
                                    : html`<label style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">${displayLabel}</label>${inputHtml}`}
                                ${field.html_desc ? html`<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: -2px;" .innerHTML=${field.html_desc}></div>` : (field.description || field.desc ? html`<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: -2px;">${field.description || field.desc}</div>` : '')}
                            </div>
                        `;
                    })}
                </div>
                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${this.saveSettings}>
                    💾 Save Settings
                </button>
            </yenvui-modal>
        `;
    }
}
customElements.define('sutram-generic-settings', SutramGenericSettingsModal);
// 8.5. Standalone IoC Action Broker
export class SutramEntityActions extends SutramElement {
    static properties = {
        entityType: { type: String },
        entityData: { type: Object },
        scrollable: { type: Boolean, reflect: true },
        variant: { type: String },
        _trayOpen: { type: Boolean, state: true }
    };
    static styles = css`
        :host { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        :host([scrollable]) {
            flex-wrap: nowrap;
            width: 100%;
            display: block;
        }
        .action-tray-dialog {
            background: transparent;
            border: none;
            padding: 0;
            margin: 0;
            max-width: 100vw;
            width: 100%;
            max-height: 100dvh;
            height: 100%;
            overflow: hidden;
            pointer-events: auto !important;
        }
        .action-tray-dialog::backdrop {
            background: var(--modal-backdrop, rgba(0,0,0,0.6));
            backdrop-filter: var(--modal-backdrop-filter, blur(3px));
            pointer-events: auto !important;
        }
        .action-tray-dialog[open] {
            display: flex;
            align-items: flex-start;
            justify-content: center;
        }
        .action-tray-panel {
            background: var(--pane-bg);
            border-bottom: 1px solid var(--border);
            border-bottom-left-radius: 12px;
            border-bottom-right-radius: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 800px;
            max-height: 85dvh;
            overflow: hidden;
            margin: 0 auto;
            animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideDown {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
        }
        :host([data-theme="e-ink"]) .action-tray-panel {
            border: 2px solid #000;
            border-top: none;
            box-shadow: 4px 4px 0 #8b5cf6;
        }
        .tray-group-header {
            font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
            color: var(--intent-primary); border-bottom: 1px solid color-mix(in srgb, var(--intent-primary) 30%, transparent);
            padding: 0 4px 4px 4px; margin: 15px 15px 10px 15px;
        }
        .tray-group-grid {
            display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; padding: 0 15px;
        }
        .sync-btn {
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
            box-sizing: border-box;
            transition: filter 0.2s ease, transform 0.1s ease;
            color: #ffffff;
        }
        .sync-btn:hover { filter: brightness(1.1); }
        .sync-btn:active { transform: scale(0.98); }
        .sync-btn.active {
            box-shadow: inset 0 0 0 2px var(--text, #ffffff);
            filter: brightness(1.15);
        }
        :host([data-theme="e-ink"]) .sync-btn {
            background: #ffffff !important;
            color: #000000 !important;
            font-weight: 900 !important;
            border: 2px solid #ec4899 !important;
            box-shadow: 3px 3px 0 #eab308 !important;
        }
        :host([data-theme="e-ink"]) .sync-btn:hover { background: #f1f5f9 !important; }
        :host([data-theme="e-ink"]) .sync-btn.active { background: #000000 !important; color: #ffffff !important; }
    `;
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('_trayOpen')) {
            const dialog = this.shadowRoot.querySelector('.action-tray-dialog');
            if (dialog) {
                if (this._trayOpen && !dialog.open) {
                    dialog.showModal();
                } else if (!this._trayOpen && dialog.open) {
                    dialog.close();
                }
            }
        }
    }
    connectedCallback() {
        super.connectedCallback();
        this.observeTheme();
    }
    render() {
        if (!this.entityType || !window.ExtensionRegistry?.getEntityActions) return '';
        const actions = window.ExtensionRegistry.getEntityActions(this.entityType, this.entityData || {});

        if (actions.length === 0) return '';

        const executeAction = async (act, e) => {
            if (window.ExtensionRegistry.executeEntityAction) {
                return await window.ExtensionRegistry.executeEntityAction(act, this.entityData, e);
            }
            if (act.asyncAction) return await act.asyncAction(this.entityData, e);
            if (act.onClick) return act.onClick(this.entityData, e);
        };

        if (this.variant === 'menu-bar') {
            const groups = { file: [], edit: [], share: [], tools: [] };
            actions.forEach(act => {
                const g = act.group && groups[act.group] ? act.group : 'tools';
                groups[g].push({
                    ...act,
                    label: typeof act.label === 'function' ? act.label(this.entityData) : act.label,
                    icon: typeof act.icon === 'function' ? act.icon(this.entityData) : (act.icon || ''),
                    asyncAction: act.asyncAction ? (e) => executeAction(act, e) : null,
                    onClick: (!act.asyncAction && act.onClick) ? (e) => executeAction(act, e) : null
                });
            });

            const groupLabels = { file: 'File', edit: 'Edit', share: 'Share', tools: 'Tools' };
            const groupIcons = { file: '📄', edit: '✏️', share: '📤', tools: '🔧' };

            return html`
                <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                    ${Object.keys(groups).map(g => {
                        if (groups[g].length === 0) return '';
                        return html`
                            <sutram-dropdown .items=${groups[g]} align="left">
                                <button slot="trigger" class="sync-btn" style="background: transparent; color: var(--text); border: 1px solid var(--border); padding: 6px 10px;">
                                    ${groupIcons[g]} <span style="margin-left: 4px;">${groupLabels[g]}</span>
                                </button>
                            </sutram-dropdown>
                        `;
                    })}
                </div>
            `;
        }

        const primaryActions = [];
        const secondaryActions = [];

        actions.forEach(act => {
            if ((act.order || 99) < 20) primaryActions.push(act);
            else secondaryActions.push(act);
        });

        const renderDirectAction = (act) => {
            if (act.component) {
                return html`<div style="display: contents; order: ${act.order || 99};">${act.component(this.entityData)}</div>`;
            }
            const label = typeof act.label === 'function' ? act.label(this.entityData) : act.label;
            const icon = typeof act.icon === 'function' ? act.icon(this.entityData) : (act.icon || '');
            const intent = typeof act.intent === 'function' ? act.intent(this.entityData) : (act.intent || 'primary');
            const isActive = typeof act.isActive === 'function' ? act.isActive(this.entityData) : !!act.isActive;

            if (act.asyncAction || (window.ExtensionRegistry.executeEntityAction && act.vfsBound)) {
                return html`
                    <sutram-async-btn 
                        style="margin: 0; order: ${act.order || 99};" 
                        label="${icon} ${label}" 
                        intent="${intent}" 
                        ?active=${isActive}
                        .onClick=${(e) => executeAction(act, e)}>
                    </sutram-async-btn>
                `;
            }
            const clickHandler = (e) => {
                if (e) e.stopPropagation();
                if (act.emitEvent) {
                    const payload = act.emitEvent(this.entityData);
                    window.dispatchEvent(new CustomEvent(payload.name, { detail: payload.detail, bubbles: true, composed: true }));
                } else {
                    executeAction(act, e);
                }
            };

            return html`
                <sutram-btn 
                    intent=${intent} 
                    ?active=${isActive}
                    style="order: ${act.order || 99}; gap: 4px;" 
                    @click=${clickHandler}>
                    ${icon} ${label}
                </sutram-btn>
            `;
        };
        const renderTray = () => {
            const groups = { file: [], edit: [], share: [], tools: [] };
            actions.forEach(act => {
                const g = act.group && groups[act.group] ? act.group : 'tools';
                groups[g].push(act);
            });

            const groupLabels = { file: 'File', edit: 'Edit', share: 'Share', tools: 'Tools' };
            const groupIcons = { file: '📄', edit: '✏', share: '📤', tools: '🔧' };

            const handleTrayAction = async (act, e) => {
                this._trayOpen = false;
                await executeAction(act, e);
            };

            const title = this.entityData?.titleText || this.entityData?.filepath?.split('/').pop() || this.entityData?.id || 'Actions';
            const subtitle = this.entityData?.filepath || this.entityData?.folderpath || this.entityData?.repoDir || '';

            return html`
                <dialog class="action-tray-dialog" @cancel=${(e) => { e.preventDefault(); this._trayOpen = false; }} @click=${(e) => { if (e.target.tagName === 'DIALOG') this._trayOpen = false; }}>
                    <div class="action-tray-panel">
                        <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: bold;">${this.entityType.replace(':', ' / ')}</span>
                                <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
                                ${subtitle ? html`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${subtitle}</span>` : ''}
                            </div>
                            <button class="sync-btn" @click=${() => this._trayOpen = false} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                        </div>
                        <div style="flex: 1; overflow-y: auto; padding-bottom: 20px;">
                            ${Object.keys(groups).map(g => {
                                if (groups[g].length === 0) return '';
                                return html`
                                    <div class="tray-group-header">${groupIcons[g]}${groupLabels[g]}</div>
                                    <div class="tray-group-grid">
                                        ${groups[g].map(act => {
                                            const label = typeof act.label === 'function' ? act.label(this.entityData) : act.label;
                                            const icon = typeof act.icon === 'function' ? act.icon(this.entityData) : (act.icon || '');
                                            const intent = typeof act.intent === 'function' ? act.intent(this.entityData) : (act.intent || 'primary');
                                            const isActive = typeof act.isActive === 'function' ? act.isActive(this.entityData) : !!act.isActive;

                                            if (act.asyncAction || (window.ExtensionRegistry.executeEntityAction && act.vfsBound)) {
                                                return html`
                                                    <sutram-async-btn 
                                                        style="margin: 0; width: 100%; justify-content: flex-start; --btn-padding: 10px 12px; font-size: 0.9rem;" 
                                                        label="${icon} ${label}" 
                                                        intent="${intent}" 
                                                        ?active=${isActive}
                                                        .onClick=${(e) => handleTrayAction(act, e)}>
                                                    </sutram-async-btn>
                                                `;
                                            }

                                            return html`
                                                <button 
                                                    class="sync-btn ${isActive ? 'active' : ''}" 
                                                    style="width: 100%; justify-content: flex-start; padding: 10px 12px; font-size: 0.9rem; background: var(--intent-${intent}); color: ${intent === 'warning' ? '#000' : '#fff'};" 
                                                    @click=${(e) => handleTrayAction(act, e)}>
                                                    ${icon} ${label}
                                                </button>
                                            `;
                                        })}
                                    </div>
                                `;
                            })}
                        </div>
                    </div>
                </dialog>
            `;
        };
        const content = html`
            ${actions.length > 0 ? html`
                <sutram-btn intent="neutral" style="padding: 4px 12px; font-size: 1.1rem; line-height: 1; order: -1; margin-right: 4px;"
                    @click=${(e) => { e.stopPropagation(); this._trayOpen = true; }}>
                    ⋮
                </sutram-btn>
            ` : ''}
            ${primaryActions.map(renderDirectAction)}
        `;

        return html`
            ${this.scrollable ? html`
                <sutram-scrub-track>
                    <div style="display: flex; gap: 8px; align-items: center; width: max-content;">
                        ${content}
                    </div>
                </sutram-scrub-track>
            ` : content}
            ${renderTray()}
        `;
    }
}
customElements.define('sutram-entity-actions', SutramEntityActions);
// 9. Polymorphic Card Primitive (IoC Action Broker & Selection Binding)
export class SutramCard extends SutramElement {
    static properties = {
        filename: { type: String },
        titleText: { type: String },
        descriptionText: { type: String },
        detailText: { type: String },
        detailPrefix: { type: String },
        detailSuffix: { type: String },
        icon: { type: String },
        intentColor: { type: String },
        entityType: { type: String },
        entityData: { type: Object },
        selected: { type: Boolean, reflect: true },
        disableSelection: { type: Boolean },
        selectionStoreKey: { type: String },
        compact: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true },
        stale: { type: Boolean, reflect: true },
        hasActions: { type: Boolean, attribute: 'has-actions' }
    };
    static styles = [sharedStyles, css`
        :host { display: block; }
        ::slotted(p), ::slotted(h1), ::slotted(h2), ::slotted(h3), ::slotted(h4), ::slotted(h5), ::slotted(h6) {
            margin-block-start: 0;
            margin-block-end: 0;
        }
    `];
    constructor() {
        super();
        this.filename = '';
        this.titleText = '';
        this.descriptionText = '';
        this.detailText = '';
        this.icon = '<i data-lucide="file-text" style="width: 16px; height: 16px;"></i>';
        this.intentColor = '';
        this.entityType = '';
        this.entityData = {};
        this.selected = false;
        this.disableSelection = false;
        this.selectionStoreKey = 'Selection';
        this.compact = false;
        this.flush = false;
        this.stale = false;
        this.hasActions = false;
    }

    _isStale() {
        return (
            this.stale ||
            !!this.entityData?.stale ||
            !!this.entityData?.needs_recompile ||
            !!this.entityData?.is_dirty ||
            !!this.entityData?.outdated
        );
    }

    _hasResolvedActions() {
        if (this.hasActions) return true;
        if (this.entityType && window.ExtensionRegistry?.getEntityActions) {
            const actions = window.ExtensionRegistry.getEntityActions(this.entityType, this.entityData || {});
            if (actions && actions.length > 0) return true;
        }
        const slot = this.shadowRoot?.querySelector('slot[name="actions"]');
        if (slot && slot.assignedElements({ flatten: true }).length > 0) return true;
        if (this.querySelector('[slot="actions"]')) return true;
        return false;
    }

    _getId() {
        return this.entityData?.filepath || this.entityData?.id || this.filename;
    }
    _getStore() {
        if (this.selectionStoreKey === 'Selection') return SelectionStore;
        return window.Sutram?.stores?.[this.selectionStoreKey];
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.selectionStoreKey && this.selectionStoreKey !== 'none') {
            this.subscribe(this.selectionStoreKey, state => {
                const id = this._getId();
                if (id && state.selectedItems) {
                    this.selected = state.selectedItems.has(id);
                }
            });
            const id = this._getId();
            const store = this._getStore();
            if (id && store && store.getState().selectedItems) {
                this.selected = store.getState().selectedItems.has(id);
            }
        }
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('entityData') || changedProperties.has('filename')) {
            if (this.selectionStoreKey && this.selectionStoreKey !== 'none') {
                const id = this._getId();
                const store = this._getStore();
                if (id && store && store.getState().selectedItems) {
                    this.selected = store.getState().selectedItems.has(id);
                }
            }
        }
    }

    _handleOverlayOpened(e) {
        if (!this.entityType || !this.entityData) return;
        const actions = window.ExtensionRegistry?.getEntityActions?.(this.entityType, this.entityData) || [];
        actions.forEach(act => {
            if (typeof act.onReveal === 'function') {
                act.onReveal(this.entityData);
            }
        });
    }

    render() {
        return html`
            <yenvui-card
                @yenvui-overlay-opened=${this._handleOverlayOpened}
                .filename=${this.filename}
                .titleText=${this.titleText}
                .descriptionText=${this.descriptionText}
                .detailText=${this.detailText}
                .detailPrefix=${this.detailPrefix}
                .detailSuffix=${this.detailSuffix}
                .icon=${this.icon}
                .intentColor=${this.intentColor}
                ?selected=${this.selected}
                ?disableSelection=${this.disableSelection}
                ?compact=${this.compact}
                ?flush=${this.flush}
                ?stale=${this._isStale()}
                @yenvui-card-select-toggled=${(e) => {
                    e.stopPropagation();
                    const id = this._getId();
                    if (id && this.selectionStoreKey && this.selectionStoreKey !== 'none') {
                        const store = this._getStore();
                        if (store && store.getState().toggleSelection) {
                            store.getState().toggleSelection(id, this.entityType, this.entityData);
                        }
                    }
                    // Emitting a custom event so host components can react when bypassing the global store
                    this.dispatchEvent(new CustomEvent('sutram-card-select-toggled', {
                        detail: { id, selected: this.selected, entityType: this.entityType, entityData: this.entityData },
                        bubbles: true,
                        composed: true
                    }));
                }}
                @yenvui-card-clicked=${(e) => {
                    this.dispatchEvent(new CustomEvent('card-clicked', {
                        detail: { filename: this.filename, isSource: true },
                        bubbles: true,
                        composed: true
                    }));
                }}>
                <slot name="header-actions" slot="header-actions"></slot>
                <slot name="header-tags" slot="header-tags"></slot>
                <slot name="detail" slot="detail"></slot>
                <slot name="inline-actions" slot="inline-actions"></slot>
                <slot></slot>
                ${this._hasResolvedActions() ? html`
                    <div slot="actions" style="display: flex; flex-wrap: nowrap; gap: 8px; align-items: center; width: max-content;" @click=${e => e.stopPropagation()}>
                        <sutram-entity-actions .entityType=${this.entityType} .entityData=${this.entityData} style="flex-wrap: nowrap;"></sutram-entity-actions>
                        <slot name="actions" @slotchange=${() => this.requestUpdate()}></slot>
                    </div>
                ` : html`
                    <slot name="actions" slot="actions" @slotchange=${() => this.requestUpdate()}></slot>
                `}
            </yenvui-card>
        `;
    }
}
customElements.define('sutram-card', SutramCard);
// 10. Card Group Container
export class SutramCardGroup extends LitElement {
    static properties = {
        enableEdgeSelection: { type: Boolean },
        stacked: { type: Boolean, reflect: true },
        accordion: { type: Boolean, reflect: true }
    };

    constructor() {
        super();
        this.enableEdgeSelection = true;
        this.stacked = false;
        this.accordion = false;
    }

    render() {
        return html`
            <yenvui-card-group ?enableEdgeSelection=${this.enableEdgeSelection} ?stacked=${this.stacked} ?accordion=${this.accordion}>
                <slot></slot>
            </yenvui-card-group>
        `;
    }
}
customElements.define('sutram-card-group', SutramCardGroup);

// 11. Search Bar & Toolbar
export class SutramSearchBar extends LitElement {
    static properties = { placeholder: { type: String }, value: { type: String } };
    static styles = [sharedStyles];
    render() {
        return html`
            <yenvui-search-bar 
                .placeholder=${this.placeholder || 'Search...'} 
                .value=${this.value || ''} 
                @yenvui-search-changed=${e => this.dispatchEvent(new CustomEvent('search-changed', { detail: e.detail, bubbles: true, composed: true }))}>
            </yenvui-search-bar>
        `;
    }
}
customElements.define('sutram-search-bar', SutramSearchBar);
export class SutramSpinner extends LitElement {
    static properties = { text: { type: String } };
    render() { return html`<yenvui-spinner .text=${this.text}><slot></slot></yenvui-spinner>`; }
}
customElements.define('sutram-spinner', SutramSpinner);
export class SutramEmptyState extends LitElement {
    static properties = { icon: { type: String }, text: { type: String } };
    render() { return html`<yenvui-empty-state .icon=${this.icon} .text=${this.text}><slot></slot></yenvui-empty-state>`; }
}
customElements.define('sutram-empty-state', SutramEmptyState);

export class SutramBoard extends LitElement {
    static styles = [css`:host { display: contents; }`];
    render() { return html`<yenvui-board><slot></slot></yenvui-board>`; }
}
customElements.define('sutram-board', SutramBoard);
export class SutramColumn extends LitElement {
    static properties = { titleText: { type: String }, intentColor: { type: String } };
    static styles = [css`:host { display: contents; }`];
    render() { return html`<yenvui-column .titleText=${this.titleText} .intentColor=${this.intentColor}><slot></slot></yenvui-column>`; }
}
customElements.define('sutram-column', SutramColumn);

export class SutramTag extends LitElement {
    static properties = { text: { type: String }, intent: { type: String } };
    static styles = [css`:host { display: contents; }`];
    render() { return html`<yenvui-tag .text=${this.text} .intent=${this.intent}><slot></slot></yenvui-tag>`; }
}
customElements.define('sutram-tag', SutramTag);
export class SutramLabel extends LitElement {
    static properties = { text: { type: String } };
    static styles = [css`:host { display: contents; }`];
    render() { return html`<yenvui-label .text=${this.text}><slot></slot></yenvui-label>`; }
}
customElements.define('sutram-label', SutramLabel);

export class SutramScrubTrack extends LitElement {
    static styles = [css`:host { display: block; width: 100%; overflow: hidden; }`];
    render() { return html`<yenvui-scrub-track><slot></slot></yenvui-scrub-track>`; }
}
customElements.define('sutram-scrub-track', SutramScrubTrack);

export class SutramToolbar extends LitElement {
    static properties = {
        searchQuery: { type: String },
        searchPlaceholder: { type: String },
        enableFilterDropdown: { type: Boolean },
        filterText: { type: String },
        activeFilters: { type: Array },
        hasFiltersOverride: { type: Boolean },
        bottomBorder: { type: Boolean }
    };
    static styles = [sharedStyles];
    render() {
        return html`
            <yenvui-toolbar
                .searchQuery=${this.searchQuery || ''}
                .searchPlaceholder=${this.searchPlaceholder || 'Search...'}
                ?enableFilterDropdown=${this.enableFilterDropdown}
                .filterText=${this.filterText || ''}
                .activeFilters=${this.activeFilters || []}
                ?hasFiltersOverride=${this.hasFiltersOverride}
                ?bottomBorder=${this.bottomBorder}
                @yenvui-search-changed=${e => this.dispatchEvent(new CustomEvent('search-changed', { detail: e.detail, bubbles: true, composed: true }))}>
                <slot name="filters" slot="filters"></slot>
                <slot name="bottom-row" slot="bottom-row"></slot>
            </yenvui-toolbar>
        `;
    }
}
customElements.define('sutram-toolbar', SutramToolbar);

// 12. Dropdown & Collapsible
export class SutramDropdown extends LitElement {
    static properties = { items: { type: Array }, open: { type: Boolean, reflect: true }, align: { type: String } };
    static styles = [sharedStyles];
    render() {
        return html`
            <yenvui-dropdown .items=${this.items || []} ?open=${this.open} align=${this.align || 'right'}>
                <slot name="trigger" slot="trigger"></slot>
            </yenvui-dropdown>
        `;
    }
}
customElements.define('sutram-dropdown', SutramDropdown);
export class SutramFilterDropdown extends YenvuiFilterDropdown {}
if (!customElements.get('sutram-filter-dropdown')) {
    customElements.define('sutram-filter-dropdown', SutramFilterDropdown);
}
export class SutramCollapsible extends LitElement {
    static properties = { titleText: { type: String }, open: { type: Boolean, reflect: true }, intent: { type: String }, flush: { type: Boolean, reflect: true } };
    static styles = [sharedStyles];
    render() {
        return html`
            <yenvui-collapsible 
                .titleText=${this.titleText} 
                ?open=${this.open} 
                intent=${this.intent || 'neutral'} 
                ?flush=${this.flush}
                @yenvui-collapsible-toggled=${e => {
                    if (e.target !== e.currentTarget) return;
                    this.dispatchEvent(new CustomEvent('sutram-collapsible-toggled', { detail: e.detail, bubbles: true, composed: true }));
                }}>
                <slot name="actions" slot="actions"></slot>
                <slot></slot>
            </yenvui-collapsible>
        `;
    }
}
customElements.define('sutram-collapsible', SutramCollapsible);

export class SutramCategorySection extends LitElement {
    static properties = { titleText: { type: String } };
    static styles = [sharedStyles];
    render() {
        return html`
            <yenvui-category-section .titleText=${this.titleText || ''}>
                <slot name="header-actions" slot="header-actions"></slot>
                <slot></slot>
            </yenvui-category-section>
        `;
    }
}
customElements.define('sutram-category-section', SutramCategorySection);

// 13. Pills & Filter Groups
export class SutramPill extends LitElement {
    static properties = { pillId: { type: String }, labelText: { type: String }, active: { type: Boolean }, small: { type: Boolean }, variant: { type: String } };
    static styles = [sharedStyles];
    render() {
        return html`
            <yenvui-pill 
                .pillId=${this.pillId} 
                .labelText=${this.labelText} 
                ?active=${this.active} 
                ?small=${this.small} 
                .variant=${this.variant || 'standard'}
                @yenvui-pill-toggled=${e => this.dispatchEvent(new CustomEvent('sutram-pill-toggled', { detail: e.detail, bubbles: true, composed: true }))}>
            </yenvui-pill>
        `;
    }
}
customElements.define('sutram-pill', SutramPill);

export class SutramFilterGroup extends LitElement {
    static properties = { label: { type: String }, items: { type: Array }, activeItems: { type: Array }, allowAll: { type: Boolean } };
    static styles = [sharedStyles];
    render() {
        return html`
            <yenvui-filter-group 
                .label=${this.label || ''} 
                .items=${this.items || []} 
                .activeItems=${this.activeItems || []} 
                ?allowAll=${this.allowAll}
                @yenvui-filter-changed=${e => this.dispatchEvent(new CustomEvent('sutram-filter-changed', { detail: e.detail, bubbles: true, composed: true }))}>
            </yenvui-filter-group>
        `;
    }
}
customElements.define('sutram-filter-group', SutramFilterGroup);
// 14. Code & Text Editor Primitive
import { wordCountPlugin } from './wordcount.js';

const _EMPTY_EXTENSIONS = [];
export class SutramEditor extends SutramElement {
    static properties = { 
        value: { type: String }, 
        readOnly: { type: Boolean }, 
        language: { type: String }, 
        writingMode: { type: Boolean }, 
        customExtensions: { type: Array },
        enableWordcount: { type: Boolean },
        _memoizedExtensions: { type: Array, state: true }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%; }
        yenvui-editor { flex: 1; min-height: 0; height: 100%; }
    `];

    constructor() {
        super();
        this.enableWordcount = true;
        this._memoizedExtensions = _EMPTY_EXTENSIONS;
    }

    willUpdate(changedProperties) {
        if (changedProperties.has('customExtensions') || changedProperties.has('enableWordcount')) {
            const extensions = [...(this.customExtensions || _EMPTY_EXTENSIONS)];
            if (this.enableWordcount) {
                extensions.push(wordCountPlugin);
            }
            this._memoizedExtensions = extensions;
        }
    }

    insertAtCursor(text) {
        const editor = this.shadowRoot.querySelector('yenvui-editor');
        if (editor && editor.insertAtCursor) editor.insertAtCursor(text);
    }
    render() {
        return html`
            <yenvui-editor
                .value=${this.value || ''}
                .language=${this.language || 'markdown'}
                ?readOnly=${this.readOnly}
                ?writingMode=${this.writingMode}
                .customExtensions=${this._memoizedExtensions}
                @yenvui-editor-changed=${e => this.dispatchEvent(new CustomEvent('editor-changed', { detail: e.detail, bubbles: true, composed: true }))}>
            </yenvui-editor>
        `;
    }
}
customElements.define('sutram-editor', SutramEditor);

// 15. Selector Modal
export class SutramSelectorModal extends SutramElement {
    static properties = { open: { type: Boolean, reflect: true }, titleText: { type: String }, items: { type: Array }, _searchQuery: { type: String } };
    static styles = [sharedStyles, css`:host { display: contents; }`];

    constructor() {
        super();
        this.open = false;
        this.titleText = "Select Item";
        this.items = [];
        this._searchQuery = '';
    }

    render() {
        const filtered = this._searchQuery 
            ? this.utils.fuzzyFilterObjects(this.items, this._searchQuery).slice(0, 50) 
            : this.items.slice(0, 50);

        return html`
            <sutram-modal ?open=${this.open} titleText=${this.titleText} @sutram-modal-closed=${() => { this.open = false; this.dispatchEvent(new CustomEvent('selector-closed')); }}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 300px;">
                    <input type="text" placeholder="Search..." .value=${this._searchQuery} @input=${e => this._searchQuery = e.target.value} style="width: 100%; padding: 10px; font-weight: bold; box-sizing: border-box; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 10px; flex-shrink: 0;">
                    <div style="display: flex; flex-direction: column; gap: 5px; flex: 1; overflow-y: auto; padding-bottom: 15px;">
                        ${filtered.length === 0 ? html`<span style="color: var(--text-muted); font-style: italic;">No matches found.</span>` : filtered.map(item => {
                            const displayText = typeof item === 'string' ? item : (item.label || item);
                            return html`
                                <button class="btn-sm" style="background: var(--bg); border: 1px solid var(--border); color: var(--text); text-align: left; padding: 12px 15px; font-size: 1.05rem; font-family: monospace; font-weight: bold; margin: 0; cursor: pointer; border-radius: 4px; transition: background 0.2s;"
                                    onmouseover="this.style.background='var(--input-bg)'"
                                    onmouseout="this.style.background='var(--bg)'"
                                    @click=${() => {
                                        this.open = false;
                                        this.dispatchEvent(new CustomEvent('item-selected', { detail: { item }, bubbles: true, composed: true }));
                                    }}>
                                    📄 ${displayText}
                                </button>
                            `;
                        })}
                    </div>
                </div>
            </sutram-modal>
        `;
    }
}
customElements.define('sutram-selector-modal', SutramSelectorModal);