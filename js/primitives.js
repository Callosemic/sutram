// sutram/js/primitives.js
// Pure Agnostic Presentation Primitives

import { LitElement, html, css } from 'lit';
import { SutramElement, SelectionStore, ToastStore } from './sdk.js';
import { sharedStyles } from './shared_styles.js';
import { buildFileTree } from './utils.js';

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
        :host { display: inline-block; }
        yenvui-async-btn { display: block; width: 100%; height: 100%; }
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
        isError: { type: Boolean }
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
        this._statusListener = this._handleStatusUpdate.bind(this);
    }
    connectedCallback() {
        super.connectedCallback();
        this.registerGlobalListener('sutram-status-update', window, this._statusListener);
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
            return html`<yenvui-status-bar .text=${this.tempMessage} ?isError=${this.isError}></yenvui-status-bar>`;
        }
        let text = this.baseTitle;
        if (this.statusString) {
            text = `${text} | ${this.statusString}`;
        }
        return html`<yenvui-status-bar .text=${text} ?isError=${false}></yenvui-status-bar>`;
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
        fullscreen: { type: Boolean },
        maxWidth: { type: String }
    };

    static styles = [sharedStyles, css`
        dialog {
            padding: 0;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--bg);
            color: var(--text);
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            width: 100%;
            max-width: var(--modal-max-width, 600px);
            max-height: 90dvh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        dialog::backdrop {
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(3px);
        }
        :host([fullscreen]) dialog {
            max-width: 95vw;
            height: 95dvh;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 1px solid var(--border);
            background: var(--input-bg);
            flex-shrink: 0;
        }
        .body {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        .footer {
            padding: 15px 20px;
            border-top: 1px solid var(--border);
            background: var(--input-bg);
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            flex-shrink: 0;
        }
        .footer:empty {
            display: none;
        }
        ::slotted(button[slot="footer"]),
        ::slotted(sutram-async-btn[slot="footer"]) {
            flex: 1;
            margin: 0 !important;
        }
    `];

    constructor() {
        super();
        this.open = false;
    }

    updated(changedProperties) {
        if (changedProperties.has('open')) {
            const dialog = this.shadowRoot.querySelector('dialog');
            if (this.open && !dialog.open) {
                dialog.showModal();
                document.body.style.overflow = 'hidden';
            } else if (!this.open && dialog.open) {
                dialog.close();
                document.body.style.overflow = '';
            }
        }
    }

    _close() {
        this.open = false;
        document.body.style.overflow = '';
        this.dispatchEvent(new CustomEvent('sutram-modal-closed', { bubbles: true, composed: true }));
    }

    render() {
        return html`
            <dialog 
                style="--modal-max-width: ${this.maxWidth || '600px'};"
                @cancel=${(e) => { e.preventDefault(); this._close(); }}
                @click=${(e) => { if(e.target === e.currentTarget) this._close(); }}>
                <div class="header">
                    <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">${this.titleText}</h3>
                    <button class="system-action-btn" @click=${this._close} style="width: 28px; height: 28px; font-size: 1rem; border: none;">✕</button>
                </div>
                <div class="body">
                    <slot name="body"></slot>
                    <slot></slot>
                </div>
                <div class="footer">
                    <slot name="footer"></slot>
                </div>
            </dialog>
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