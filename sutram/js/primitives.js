// sutram/js/primitives.js
// Pure Agnostic Presentation Primitives

import { LitElement, html, css } from 'lit';
import { SutramElement, SelectionStore, ToastStore } from './sdk.js';
import { sharedStyles } from './shared_styles.js';
import { buildFileTree } from './utils.js';

import '../../yenvui/js/async-btn.js';
import '../../yenvui/js/status-bar.js';
import '../../yenvui/js/toast.js';
import '../../yenvui/js/modal.js';
import '../../yenvui/js/category-section.js';
import '../../yenvui/js/card.js';
import '../../yenvui/js/card-group.js';
import '../../yenvui/js/editor.js';
import '../../yenvui/js/toolbar.js';
import '../../yenvui/js/collapsible.js';
import '../../yenvui/js/dropdown.js';
import '../../yenvui/js/pill.js';
import '../../yenvui/js/filter-group.js';
import '../../yenvui/js/selection-tray.js';
import '../../yenvui/js/search-bar.js';

// 1. Async Action Button
export class SutramAsyncBtn extends LitElement {
    static properties = {
        label: { type: String },
        loadingLabel: { type: String },
        successLabel: { type: String },
        errorLabel: { type: String },
        intent: { type: String },
        onClick: { type: Object },
        _status: { type: String }
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
        this._status = 'idle';
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
        if (this._status === 'loading' || !this.onClick) return;
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
        return html`
            <yenvui-async-btn
                .label=${this.label}
                .loadingLabel=${this.loadingLabel}
                .successLabel=${this.successLabel}
                .errorLabel=${this.errorLabel}
                .intent=${this.intent}
                .status=${this._status}
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
            background: var(--intent-highlight);
            color: white;
            border: none;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            font-size: 0.85rem;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            transition: transform 0.2s;
            padding: 0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .cart-btn:hover {
            transform: scale(1.1);
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

    render() {
        const count = this.selectedItems.size;
        const itemsArray = Array.from(this.selectedItems.values());

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
                <button class="cart-btn" title="View Selected Items" @click=${() => this.modalOpen = true}>${count}</button>
            ` : ''}
            <yenvui-modal ?open=${this.modalOpen} ?fullscreen=${true} titleText="Selected Items (${count})" @yenvui-modal-closed=${() => this.modalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; overflow-y: auto;">
                    ${itemsArray.map(item => html`
                        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--input-bg); padding: 10px 15px; border: 1px solid var(--border); border-radius: 4px;">
                            <span style="font-family: monospace; font-size: 0.85rem; color: var(--text); word-break: break-all;">${item.data?.filepath || item.data?.folderpath || item.data?.id || 'Unknown Item'}</span>
                            <button class="btn-sm" style="background: transparent; color: var(--intent-danger); border: none; padding: 4px 8px; font-size: 1rem; cursor: pointer; margin: 0;" @click=${() => {
                                const id = item.data?.filepath || item.data?.folderpath || item.data?.id;
                                if (id) SelectionStore.getState().toggleSelection(id, item.entityType, item.data);
                            }}>✕</button>
                        </div>
                    `)}
                </div>
                <sutram-async-btn 
                    slot="footer" 
                    label="🗑️ Clear" 
                    intent="danger" 
                    .onClick=${() => SelectionStore.getState().clearSelection()}>
                </sutram-async-btn>
                ${batchActions.map(act => html`
                    <sutram-async-btn   
                        slot="footer"
                        label="${act.icon} ${act.label}" 
                        intent="${act.intent || 'primary'}" 
                        .onClick=${async (e) => {
                            await act.asyncAction(itemsArray, e);
                        }}>
                    </sutram-async-btn>
                `)}
            </yenvui-modal>
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
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
                <button class="btn-sm" style="background: var(--intent-neutral);" ?disabled=${this.currentPath.length === 0} @click=${() => this._setPath(this.currentPath.slice(0, -1))}>⬆️ Up</button>
                <span style="font-family: monospace; color: var(--text); opacity: 0.7; word-break: break-all; font-size: 0.9rem;">/${this.currentPath.join('/')}</span>
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

// 8. Generic Settings Engine
export class SutramGenericSettingsModal extends SutramElement {
    static properties = {
        open: { type: Boolean, reflect: true },
        extName: { type: String },
        schema: { type: Array },
        formData: { type: Object }
    };
    static styles = [sharedStyles, css`:host { display: contents; }`];

    constructor() {
        super();
        this.open = false;
        this.extName = '';
        this.schema = [];
        this.formData = {};
    }

    openModal(extName, schema, formData) {
        this.extName = extName;
        this.schema = schema || [];
        this.formData = formData || {};
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
        const title = (registry?._manifests?.get(this.extName)?.name || this.extName) + ' Settings';

        return html`
            <yenvui-modal  
                ?open=${this.open} 
                titleText=${title} 
                ?fullscreen=${true} 
                @yenvui-modal-closed=${() => this.open = false}>

                <div slot="body" style="display: flex; flex-direction: column; gap: 15px; flex: 1; min-height: 0; overflow-y: auto;">
                    ${this.schema.map(field => {
                        const val = this.formData[field.id] !== undefined ? this.formData[field.id] : field.default;
                        let inputHtml = '';
                        if (field.type === 'boolean') {
                            inputHtml = html`<input type="checkbox" style="transform: scale(1.2); cursor: pointer;" .checked=${!!val} @change=${e => { this.formData = {...this.formData, [field.id]: e.target.checked}; this.requestUpdate(); }}>`;
                        } else if (field.type === 'select') {
                            inputHtml = html`
                                <select style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);"
                                    .value=${val} @change=${e => { this.formData = {...this.formData, [field.id]: e.target.value}; this.requestUpdate(); }}>
                                    ${(field.options || []).map(opt => html`<option value="${opt.value !== undefined ? opt.value : opt}">${opt.label || opt.title || opt.value || opt}</option>`)}
                                </select>
                            `;
                        } else if (field.type === 'number') {
                            inputHtml = html`<input type="number" .value=${val} style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); box-sizing: border-box;" @input=${e => { this.formData = {...this.formData, [field.id]: parseFloat(e.target.value)}; this.requestUpdate(); }}>`;
                        } else if (field.type === 'object' || field.type === 'json' || (typeof val === 'object' && val !== null)) {
                            const strVal = typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : val;
                            inputHtml = html`<textarea style="width: 100%; height: 120px; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); box-sizing: border-box; font-family: monospace;" @input=${e => {
                                try {
                                    this.formData = {...this.formData, [field.id]: JSON.parse(e.target.value)};
                                    e.target.style.borderColor = 'var(--border)';
                                } catch(err) {
                                    e.target.style.borderColor = 'var(--intent-danger)';
                                }
                                this.requestUpdate();
                            }}>${strVal}</textarea>`;
                        } else {
                            const inputType = field.type === 'password' ? 'password' : 'text';
                            inputHtml = html`<input type="${inputType}" .value=${val} style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); box-sizing: border-box;" @input=${e => { this.formData = {...this.formData, [field.id]: e.target.value}; this.requestUpdate(); }}>`;
                        }

                        const displayLabel = field.title || field.label || field.id;
                        return html`
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px;">
                                ${field.type === 'boolean' 
                                    ? html`<label style="font-size: 0.95rem; color: var(--text); cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: bold;">${inputHtml} ${displayLabel}</label>` 
                                    : html`<label style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">${displayLabel}</label>${inputHtml}`}
                                ${field.description || field.desc ? html`<div style="font-size: 0.75rem; color: var(--text-muted);">${field.description || field.desc}</div>` : ''}
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
        entityData: { type: Object }
    };
    static styles = css`:host { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }`;

    render() {
        if (!this.entityType || !window.ExtensionRegistry?.getEntityActions) return '';
        const actions = window.ExtensionRegistry.getEntityActions(this.entityType, this.entityData || {});

        return actions.map(act => {
            if (act.component) {
                return html`<div style="display: contents; order: ${act.order || 99};">${act.component(this.entityData)}</div>`;
            }

            const label = typeof act.label === 'function' ? act.label(this.entityData) : act.label;
            const icon = typeof act.icon === 'function' ? act.icon(this.entityData) : (act.icon || '');
            const intent = typeof act.intent === 'function' ? act.intent(this.entityData) : (act.intent || 'primary');

            let clickHandler;
            if (act.asyncAction) {
                clickHandler = (e) => act.asyncAction(this.entityData, e);
            } else {
                clickHandler = async (e) => {
                    if (e) e.stopPropagation();
                    if (act.emitEvent) {
                        const payload = act.emitEvent(this.entityData);
                        window.dispatchEvent(new CustomEvent(payload.name, { detail: payload.detail, bubbles: true, composed: true }));
                    } else if (act.onClick) {
                        act.onClick(this.entityData, e);
                    }
                };
            }

            return html`
                <sutram-async-btn 
                    style="margin: 0; order: ${act.order || 99};" 
                    label="${icon} ${label}" 
                    intent="${intent}" 
                    .onClick=${clickHandler}>
                </sutram-async-btn>
            `;
        });
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
        icon: { type: String },
        intentColor: { type: String },
        entityType: { type: String },
        entityData: { type: Object },
        selected: { type: Boolean, reflect: true },
        disableSelection: { type: Boolean },
        selectionStoreKey: { type: String },
        compact: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true }
    };

    static styles = [sharedStyles, css`
        :host { display: block; }
    `];
    constructor() {
        super();
        this.filename = '';
        this.titleText = '';
        this.descriptionText = '';
        this.detailText = '';
        this.icon = '📄';
        this.intentColor = '';
        this.entityType = '';
        this.entityData = {};
        this.selected = false;
        this.disableSelection = false;
        this.selectionStoreKey = 'Selection';
        this.compact = false;
        this.flush = false;
    }

    _getId() {
        return this.entityData?.filepath || this.entityData?.id || this.filename;
    }

    _getStore() {
        if (this.selectionStoreKey === 'Selection') return SelectionStore;
        return window.inSetu?.stores?.[this.selectionStoreKey] || window.Sutram?.stores?.[this.selectionStoreKey];
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
    render() {
        return html`
            <yenvui-card
                .titleText=${this.titleText}
                .descriptionText=${this.descriptionText}
                .detailText=${this.detailText}
                .icon=${this.icon}
                .intentColor=${this.intentColor}
                ?selected=${this.selected}
                ?disableSelection=${this.disableSelection}
                ?compact=${this.compact}
                ?flush=${this.flush}
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
                @click=${(e) => {
                    this.dispatchEvent(new CustomEvent('card-clicked', {
                        detail: { filename: this.filename, isSource: true },
                        bubbles: true,
                        composed: true
                    }));
                }}>

                <slot name="header-tags" slot="header-tags"></slot>
                <slot name="inline-actions" slot="inline-actions"></slot>
                <slot></slot>
                <div slot="actions" style="display: contents;" @click=${e => e.stopPropagation()}>
                    <sutram-entity-actions .entityType=${this.entityType} .entityData=${this.entityData}></sutram-entity-actions>
                    <slot name="actions"></slot>
                </div>
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
                @search-changed=${e => this.dispatchEvent(new CustomEvent('search-changed', { detail: e.detail, bubbles: true, composed: true }))}>
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

export class SutramFilterDropdown extends LitElement {
    static properties = { 
        filterText: { type: String }, 
        open: { type: Boolean, reflect: true }, 
        hasFilters: { type: Boolean } 
    };
    static styles = [sharedStyles];

    render() {
        return html`
            <yenvui-filter-dropdown .filterText=${this.filterText || 'Filters'} ?open=${this.open} .hasFilters=${this.hasFilters}>
                <slot></slot>
            </yenvui-filter-dropdown>
        `;
    }
}
customElements.define('sutram-filter-dropdown', SutramFilterDropdown);

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
                @yenvui-collapsible-toggled=${e => this.dispatchEvent(new CustomEvent('sutram-collapsible-toggled', { detail: e.detail, bubbles: true, composed: true }))}>
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
export class SutramEditor extends SutramElement {
    static properties = { value: { type: String }, readOnly: { type: Boolean }, language: { type: String }, customExtensions: { type: Array } };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%; }
        yenvui-editor { flex: 1; min-height: 0; height: 100%; }
    `];

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
                .customExtensions=${this.customExtensions || []}
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
                            const displayText = typeof item === 'string' && item.startsWith('prompts/') ? item.substring(8) : (item.label || item);
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