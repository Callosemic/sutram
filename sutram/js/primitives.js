// sutram/js/primitives.js
// Pure Agnostic Presentation Primitives
import { LitElement, html, css } from 'lit';
import { SutramElement, SutramContextMixin, SelectionStore, ToastStore, EnvironmentStore } from './sutram_sdk.js';
import { YenvuiBtn, YenvuiAsyncBtn } from '../../yenvui/js/async-btn.js';
import { YenvuiStatusBar } from '../../yenvui/js/status-bar.js';
import { YenvuiToastContainer } from '../../yenvui/js/toast.js';
import { YenvuiModal } from '../../yenvui/js/modal.js';
import { YenvuiWindow } from '../../yenvui/js/window.js';
import { YenvuiCategorySection } from '../../yenvui/js/category-section.js';
import { YenvuiCard } from '../../yenvui/js/card.js';
import { YenvuiCardGroup } from '../../yenvui/js/card-group.js';
import { YenvuiEditor } from '../../yenvui/js/editor.js';
import { YenvuiToolbar } from '../../yenvui/js/toolbar.js';
import { YenvuiCollapsible } from '../../yenvui/js/collapsible.js';
import { YenvuiPill } from '../../yenvui/js/pill.js';
import { YenvuiFilterGroup } from '../../yenvui/js/filter-group.js';
import { YenvuiSelectionTray } from '../../yenvui/js/selection-tray.js';
import { YenvuiSearchBar } from '../../yenvui/js/search-bar.js';
import { YenvuiSpinner } from '../../yenvui/js/spinner.js';
import { YenvuiEmptyState } from '../../yenvui/js/empty-state.js';
import { YenvuiBoard, YenvuiColumn } from '../../yenvui/js/board.js';
import { YenvuiTag } from '../../yenvui/js/tag.js';
import { YenvuiLabel } from '../../yenvui/js/label.js';
import { YenvuiDropdown, YenvuiFilterDropdown } from '../../yenvui/js/dropdown.js';
import { YenvuiScrubTrack } from '../../yenvui/js/yenvui-base.js';
import { YenvuiScrollView } from '../../yenvui/js/scroll-view.js';
import { YenvuiDiffViewer } from '../../yenvui/js/diff-viewer.js';
import { sharedStyles } from './shared_styles.js';
import { buildFileTree, resolveDirectoryState, SutramWorker } from './utils.js';
import 'lit-virtualizer';
// 0. Universal Virtualized List
export class SutramVirtualList extends LitElement {
    static properties = {
        items: { type: Array },
        renderItem: { type: Object },
        keyFunction: { type: Object }
    };
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            flex: 1;
            min-width: 0;
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
            --card-content-visibility: visible;
            --card-contain-intrinsic-size: none;
        }
        lit-virtualizer {
            width: 100%;
            flex: 1;
            min-width: 0;
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
            --card-content-visibility: visible;
            --card-contain-intrinsic-size: none;
        }
        lit-virtualizer sutram-card,
        lit-virtualizer yenvui-card {
            content-visibility: visible !important;
            contain-intrinsic-size: none !important;
            --card-content-visibility: visible;
            --card-contain-intrinsic-size: none;
        }
    `;

    constructor() {
        super();
        this.items = [];
        this.renderItem = null;
        this.keyFunction = (item, idx) => {
            if (!item) return idx;
            if (typeof item === 'string') return item;
            const kind = item.type || item.entityType || 'item';
            const uri = item.canonicalUri || item.fullPath || item.filepath || item.id || item.name || idx;
            return `${kind}::${uri}`;
        };
    }

    render() {
        if (!this.items || this.items.length === 0) return html``;
        return html`
            <lit-virtualizer
                scroller
                .items=${this.items}
                .keyFunction=${this.keyFunction}
                .renderItem=${this.renderItem}>
            </lit-virtualizer>
        `;
    }
}
customElements.define('sutram-virtual-list', SutramVirtualList);

// 1. Synchronous Action Button
export class SutramBtn extends YenvuiBtn {}
customElements.define('sutram-btn', SutramBtn);
// 1.25 Multi-Window Pop-Out / Dock-In Control Button
export class SutramProjectionWindowControls extends SutramElement {
    static properties = {
        filepath: { type: String },
        projectionId: { type: String },
        beforeAction: { attribute: false }
    };
    static styles = [sharedStyles, css`:host { display: inline-flex; align-items: center; }`];

    _getTargetId() {
        return this.projectionId || this.filepath || '';
    }

    render() {
        const targetId = this._getTargetId();
        if (!targetId) return html``;
        const isPopout = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('popout') === 'true';
        const layout = window.Sutram?.stores?.Layout?.getState?.();
        if (isPopout) {
            return html`
                <sutram-btn
                    intent="highlight"
                    variant="tinted"
                    icon="minimize-2"
                    label="Dock In"
                    title="Return projection to main workbench window"
                    style="--btn-padding: 4px 10px; --btn-font-size: 0.8rem; margin: 0;"
                    @click=${async () => {
                        if (typeof this.beforeAction === 'function') await this.beforeAction();
                        if (layout && typeof layout.dockInProjection === 'function') {
                            await layout.dockInProjection(targetId);
                        }
                    }}>
                </sutram-btn>
            `;
        }
        const canPop = layout && typeof layout.canPopout === 'function' ? layout.canPopout() : true;
        if (canPop) {
            return html`
                <sutram-btn
                    intent="neutral"
                    variant="tinted"
                    icon="external-link"
                    label="Pop Out"
                    title="Open in dedicated pop-out window"
                    style="--btn-padding: 4px 10px; --btn-font-size: 0.8rem; margin: 0;"
                    @click=${async () => {
                        if (typeof this.beforeAction === 'function') await this.beforeAction();
                        if (layout && typeof layout.popoutProjection === 'function') {
                            await layout.popoutProjection(targetId);
                        }
                    }}>
                </sutram-btn>
            `;
        }
        return html``;
    }
}
if (!customElements.get('sutram-projection-window-controls')) {
    customElements.define('sutram-projection-window-controls', SutramProjectionWindowControls);
}

// 1.5 Async Action Button
export class SutramAsyncBtn extends SutramContextMixin(YenvuiAsyncBtn) {
    static properties = {
        ...YenvuiAsyncBtn.properties,
        _isOfflineReadOnly: { type: Boolean },
        _originalLabel: { type: String }
    };

    constructor() {
        super();
        this._isOfflineReadOnly = false;
        this._originalLabel = '';
    }

    connectedCallback() {
        super.connectedCallback();
        this._originalLabel = this.label;
        this.subscribe(EnvironmentStore, state => {
            if (state.isOffline) {
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
            this._updateState();
        });
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('label') && this.label !== 'Offline' && !this._isOfflineReadOnly) {
            this._originalLabel = this.label;
        }
        if (changedProperties.has('icon') && this.icon !== 'wifi-off' && !this._isOfflineReadOnly) {
            this._originalIcon = this.icon;
        }
    }
    _updateState() {
        if (this._isOfflineReadOnly) {
            if (this.label !== 'Offline') this._originalLabel = this.label;
            if (this.icon !== 'wifi-off') this._originalIcon = this.icon;
            this.label = 'Offline';
            this.icon = 'wifi-off';
            this.disabled = true;
        } else {
            this.label = this._originalLabel || this.label;
            if (this._originalIcon !== undefined) this.icon = this._originalIcon;
            this.disabled = false;
        }
    }

    async _handleClick(e) {
        if (this.disabled || this.status === 'loading') {
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }
            return;
        }

        // Declarative Background Job Execution via domain-agnostic ExtensionRegistry bridge
        if (this.jobRoute && typeof window.ExtensionRegistry?.executeJobAction === 'function') {
            this.status = 'loading';
            try {
                const payload = typeof this.jobPayload === 'function' ? await this.jobPayload(e) : (this.jobPayload || {});
                const jobRunner = window.ExtensionRegistry.executeJobAction(this.jobRoute, payload, {
                    onProgress: (msg, jobObj) => {
                        if (this.onJobProgress) this.onJobProgress(msg, jobObj);
                    },
                    onComplete: (data) => {
                        this.status = 'success';
                        if (this.onJobComplete) this.onJobComplete(data);
                        setTimeout(() => { this.status = 'idle'; }, 2000);
                    },
                    onError: (err) => {
                        this.status = 'error';
                        if (this.onJobError) this.onJobError(err);
                        setTimeout(() => { this.status = 'idle'; }, 2000);
                    }
                });
                await jobRunner(e);
                return;
            } catch (err) {
                this.status = 'error';
                if (typeof this.onJobError === 'function') {
                    try { this.onJobError(err); } catch (_) {}
                }
                console.error('[SutramAsyncBtn] Job dispatch error:', err);
                setTimeout(() => { this.status = 'idle'; }, 2000);
                return;
            }
        }

        return super._handleClick(e);
    }
}
customElements.define('sutram-async-btn', SutramAsyncBtn);
// 2. Status Bar Component
export class SutramStatusBar extends SutramContextMixin(YenvuiStatusBar) {
    static properties = {
        ...YenvuiStatusBar.properties,
        baseTitle: { type: String },
        statusString: { type: String },
        tempMessage: { type: String }
    };

    constructor() {
        super();
        this.baseTitle = 'System Online';
        this.statusString = '';
        this.tempMessage = '';
        this._statusListener = this._handleStatusUpdate.bind(this);
        this._syncListener = (e) => { this.syncState = e.detail.state; };
    }
    connectedCallback() {
        super.connectedCallback();
        this.registerGlobalListener('sutram-status-update', window, this._statusListener);
        this.registerGlobalListener('sutram-sync-status', window, this._syncListener);
        this._updateDisplayedText();
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('baseTitle') || changedProperties.has('statusString') || changedProperties.has('tempMessage')) {
            this._updateDisplayedText();
        }
    }
    _handleStatusUpdate(e) {
        this.tempMessage = e.detail.msg;
        this.isError = e.detail.isError;
        if (this._timeout) clearTimeout(this._timeout);
        if (e.detail.timeout) {
            this._timeout = setTimeout(() => {
                this.tempMessage = '';
                this.isError = false;
                this._updateDisplayedText();
            }, e.detail.timeout);
        }
        this._updateDisplayedText();
    }
    _updateDisplayedText() {
        if (this.tempMessage) {
            this.text = this.tempMessage;
        } else {
            this.text = this.statusString ? `${this.baseTitle} | ${this.statusString}` : this.baseTitle;
        }
    }
}
customElements.define('sutram-status-bar', SutramStatusBar);

// 3. Toast Notification Container
export class SutramToastContainer extends SutramContextMixin(YenvuiToastContainer) {
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(ToastStore, state => {
            this.toasts = state.toasts;
        });
        this.addEventListener('yenvui-toast-dismissed', (e) => {
            ToastStore.getState().removeToast(e.detail.id);
        });
    }
}
customElements.define('sutram-toast-container', SutramToastContainer);

// 4. Selection Store & Tray
export class SutramSelectionTray extends SutramElement {
    static properties = { 
        selectedItems: { type: Object },
        modalOpen: { type: Boolean }
    };

    static styles = [sharedStyles, css`
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
            color: var(--bg-deep, #000000);
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
        }
        @container (max-width: 480px) {
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
            background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.5); z-index: 3000; display: flex; flex-direction: column;
            transform: translateY(-20px); opacity: 0; pointer-events: none; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            max-height: calc(100dvh - 80px);
        }
        .tray-panel.open { transform: translateY(0); opacity: 1; pointer-events: auto; }

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
            display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--border); background: var(--bg-deep); border-radius: 0 0 12px 12px; width: 100%; box-sizing: border-box; overflow: hidden;
        }
    `];

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
        let totalSize = 0;
        let hasUnknown = false;
        const registry = window.ExtensionRegistry;
        itemsArray.forEach(item => {
            const resolvedBytes = item.data?.size_bytes || (registry?.executeUIHook ? registry.executeUIHook('sutram:resolve-item-size', item.data) : null);
            if (resolvedBytes) {
                totalSize += resolvedBytes;
            } else {
                hasUnknown = true;
            }
        });

        let sizeDisplay = '';
        if (totalSize > 0) {
            sizeDisplay = `~${Math.round(totalSize / 1024)} kb${hasUnknown ? '+' : ''}`;
        } else if (hasUnknown) {
            sizeDisplay = 'Calculated on compile';
        }
        let batchActions = [];
        if (registry) {
            if (typeof registry.getAggregatableActions === 'function') {
                batchActions = registry.getAggregatableActions(itemsArray, { group: 'share' });
            }
            // Backward-compatibility fallback for extensions still using legacy batchActions
            if (registry._manifests) {
                registry._manifests.forEach(config => {
                    if (config.batchActions) {
                        config.batchActions.forEach(act => {
                            if (!batchActions.some(b => b.id === act.id) && act.match(itemsArray)) {
                                batchActions.push({
                                    ...act,
                                    onClick: act.onClick ? (e) => act.onClick(itemsArray, e) : null,
                                    asyncAction: act.asyncAction ? (e) => act.asyncAction(itemsArray, e) : null
                                });
                            }
                        });
                    }
                });
            }
        }
        batchActions.sort((a, b) => (a.order || 99) - (b.order || 99));

        return html`
            ${count > 0 ? html`
                <button class="cart-btn" @click=${() => this.modalOpen = true}>
                    <yv-icon name="zap" style="width: 14px; height: 14px;"></yv-icon>
                    <span class="cart-text">${count} items</span>
                    <span class="cart-badge mobile-only">${count}</span>
                </button>
            ` : ''}

            <div class="tray-overlay ${this.modalOpen ? 'open' : ''}" @click=${() => this.modalOpen = false}></div>
            <div class="tray-panel ${this.modalOpen ? 'open' : ''}">
                <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start; border-radius: 12px 12px 0 0;">
                    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: bold;">SELECTION STAGING</span>
                        <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center;">Quickpack Deck <span class="cart-badge" style="display: inline-flex; margin-left: 8px;">${count}</span></span>${sizeDisplay ? html`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sizeDisplay}</span>` : ''}
                    </div>
                    <button class="sync-btn" @click=${() => this.modalOpen = false} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                </div>
                <div class="tray-items">
                    ${itemsArray.map(item => {
                        const rawPath = item.data?.filepath || item.data?.folderpath || item.data?.id || '';
                        const cleanPath = String(rawPath).replace(/\/+$/, '');
                        const name = item.data?.titleText || cleanPath.split('/').pop() || 'Unknown Item';
                        const toggleKey = item.key || rawPath;
                        const sizeBytes = item.data?.size_bytes || (registry?.executeUIHook ? registry.executeUIHook('sutram:resolve-item-size', item.data) : null);
                        const sizeText = sizeBytes ? `${Math.round(sizeBytes / 1024)} kb` : '';
                        return html`
                        <div class="tray-item">
                            <div class="tray-item-info">
                                <div class="tray-item-title">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="pack-tag">PACK</span> ${name}</div>${sizeText ? html`<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem; font-family: monospace;">${sizeText}</span>` : ''}
                                </div>
                                <div class="tray-item-path">${rawPath}</div>
                            </div>
                            <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;" @click=${() => SelectionStore.getState().toggleSelection(toggleKey, item.entityType, item.data)}>✕</button>
                        </div>
                    `})}
                </div>
                <div class="tray-footer">
                    <sutram-async-btn label="Clear" intent="danger" .onClick=${() => { SelectionStore.getState().clearSelection(); this.modalOpen = false; }} style="flex-shrink: 0; margin: 0;"></sutram-async-btn>
                    <sutram-scrub-track style="flex: 1; min-width: 0;">
                        <div style="display: flex; gap: 8px; align-items: center; width: max-content; margin-left: auto;">
                            ${batchActions.map(act => html`
                                <sutram-async-btn  
                                    style="margin: 0; flex-shrink: 0;"
                                    .label=${act.label}
                                    .icon=${act.icon}
                                    intent="${act.intent || 'primary'}" 
                                    variant="${act.variant || 'tinted'}"
                                    ?emphasis=${act.emphasis}
                                    .onClick=${async (e) => {
                                        if (act.asyncAction) await act.asyncAction(e);
                                        else if (act.onClick) act.onClick(e);
                                    }}>
                                </sutram-async-btn>
                            `)}
                        </div>
                    </sutram-scrub-track>
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
        currentPath: { type: Array },
        _treeData: { type: Object, state: true }
    };
    constructor() {
        super();
        this.files = [];
        this.currentPath = [];
        this._treeData = {};
        this._lastReqId = 0;
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('files')) {
            const reqId = ++this._lastReqId;
            SutramWorker.dispatch('BUILD_TREE', { items: this.files || [] }).then(({ tree }) => {
                if (reqId === this._lastReqId) {
                    this._treeData = tree || {};
                }
            });
        }
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
        const { validPath, entries } = resolveDirectoryState(this._treeData, this.currentPath, { hideFiles: true });
        if (validPath.length !== (this.currentPath || []).length) {
            this.currentPath = validPath;
        }

        return html`
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; overflow: hidden;">
                <sutram-btn intent="neutral" icon="corner-left-up" label="Up" ?disabled=${validPath.length === 0} @click=${() => this._setPath(validPath.slice(0, -1))}></sutram-btn>
                <yenvui-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.9rem;">
                    /${validPath.join('/')}
                </yenvui-scrub-track>
            </div>
            <div style="flex: 1; overflow-y: auto;">
                ${entries.length === 0 ? html`<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem; margin-top: 10px;">No sub-folders available.</div>` : entries.map(node => html`
                    <div class="yv-interactive-row" style="padding: 8px 10px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; margin-bottom: 4px;" 
                        @click=${() => this._setPath([...validPath, node.name])}>
                        <yv-icon name="folder" style="width: 16px; height: 16px; color: var(--intent-warning); margin-right: 8px;"></yv-icon>
                        <span style="color: var(--text); font-size: 0.9rem; font-weight: bold;">${node.name}</span>
                    </div>
                `)}
            </div>
        `;
    }
}
customElements.define('sutram-folder-browser', SutramFolderBrowser);
// 7. Native Dialog Modal
export class SutramModal extends SutramContextMixin(YenvuiModal) {
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('yenvui-modal-closed', e => {
            this.dispatchEvent(new CustomEvent('sutram-modal-closed', { bubbles: true, composed: true }));
        });
    }
}
customElements.define('sutram-modal', SutramModal);
export class SutramWindow extends SutramContextMixin(YenvuiWindow) {
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('yenvui-window-close', e => this.dispatchEvent(new CustomEvent('sutram-window-closed', { bubbles: true, composed: true })));
        this.addEventListener('yenvui-window-span', e => this.dispatchEvent(new CustomEvent('sutram-window-span', { detail: e.detail, bubbles: true, composed: true })));
        this.addEventListener('yenvui-window-focused', e => this.dispatchEvent(new CustomEvent('sutram-window-focused', { bubbles: true, composed: true })));
        this.addEventListener('yenvui-window-drag-start', e => this.dispatchEvent(new CustomEvent('sutram-window-drag-start', { detail: e.detail, bubbles: true, composed: true })));
        this.addEventListener('yenvui-window-dock', e => this.dispatchEvent(new CustomEvent('sutram-window-dock', { bubbles: true, composed: true })));
    }
}
customElements.define('sutram-window', SutramWindow);
// 8. Generic Field Card, Settings Form & Modal Engine
export class SutramFieldCard extends SutramElement {
    static properties = {
        label: { type: String },
        description: { type: String },
        scope: { type: String },
        secure: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 14px 16px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            box-sizing: border-box;
        }
        .field-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .field-title {
            font-size: 0.9rem;
            color: var(--text);
            font-weight: bold;
            margin: 0;
        }
        .field-desc {
            font-size: 0.78rem;
            color: var(--text-muted);
            line-height: 1.4;
        }
    `];

    constructor() {
        super();
        this.label = '';
        this.description = '';
        this.scope = 'workspace';
        this.secure = false;
    }

    _renderBadges() {
        const badges = [];
        if (this.secure) {
            badges.push(html`<sutram-tag text="secure" intent="warning"></sutram-tag>`);
        }
        const scope = this.scope || 'workspace';
        if (scope === 'daemon') {
            badges.push(html`<sutram-tag text="daemon" intent="neutral"></sutram-tag>`);
        } else if (scope === 'repo') {
            badges.push(html`<sutram-tag text="repo" intent="highlight"></sutram-tag>`);
        } else if (scope !== 'none') {
            badges.push(html`<sutram-tag text="workspace" intent="primary"></sutram-tag>`);
        }
        return html`<div style="display: inline-flex; gap: 6px; align-items: center;"><slot name="header-actions"></slot>${badges}</div>`;
    }

    render() {
        return html`
            <div class="field-header">
                <span class="field-title">${this.label}</span>${this._renderBadges()}
            </div>
            <slot></slot>
            ${this.description ? html`<div class="field-desc">${this.description}</div>` : ''}
        `;
    }
}
if (!customElements.get('sutram-field-card')) {
    customElements.define('sutram-field-card', SutramFieldCard);
}

export class SutramSettingsForm extends SutramElement {
    static properties = {
        extName: { type: String },
        schema: { type: Array },
        formData: { type: Object },
        repos: { type: Array },
        selectedRepo: { type: String },
        filterQuery: { type: String },
        hideSaveButton: { type: Boolean },
        _jsonBuffers: { type: Object }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; gap: 14px; width: 100%; box-sizing: border-box; }
        .field-card {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 14px 16px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
        }
        .field-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .intent-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 10px;
            margin-top: 4px;
        }
        .intent-row {
            display: flex;
            flex-direction: column;
            gap: 4px;
            background: var(--bg);
            padding: 8px 10px;
            border-radius: 6px;
            border: 1px solid var(--border);
        }
    `];

    constructor() {
        super();
        this.extName = '';
        this.schema = [];
        this.formData = {};
        this.repos = [];
        this.selectedRepo = '';
        this.filterQuery = '';
        this.hideSaveButton = false;
        this._jsonBuffers = {};
    }

    willUpdate(changedProperties) {
        if (changedProperties.has('extName') || changedProperties.has('selectedRepo')) {
            this._jsonBuffers = {};
        }
    }

    _emitFormMutation(nextForm) {
        this.formData = nextForm;
        this.dispatchEvent(new CustomEvent('sutram-settings-form-changed', {
            detail: { extName: this.extName, formData: this.formData, repo: this.selectedRepo },
            bubbles: true,
            composed: true
        }));
        this.requestUpdate();
    }
    async triggerSave(e) {
        const hasRepoScope = (this.schema || []).some(f => f && f.type !== 'hidden' && f.scope === 'repo');
        const targetRepo = hasRepoScope ? (this.selectedRepo || (this.repos && this.repos[0]) || '') : '';
        const cleanedData = { ...(this.formData || {}) };
        (this.schema || []).forEach(f => {
            if (!f || f.type === 'hidden' || f.type === 'action') return;
            const v = cleanedData[f.id];
            if (f.type === 'number') {
                cleanedData[f.id] = (v === '' || v === null || v === undefined || Number.isNaN(Number(v))) ? (f.default ?? 0) : Number(v);
            } else if (f.type === 'string_list') {
                if (typeof v === 'string') {
                    cleanedData[f.id] = v.split(',').map(s => s.trim()).filter(Boolean);
                } else if (!Array.isArray(v)) {
                    cleanedData[f.id] = Array.isArray(f.default) ? f.default : [];
                }
            } else if (f.type === 'intent_map') {
                if (!v || typeof v !== 'object' || Array.isArray(v)) {
                    cleanedData[f.id] = (f.default && typeof f.default === 'object') ? f.default : {};
                }
            }
        });
        this.formData = cleanedData;
        return new Promise((resolve, reject) => {
            this.dispatchEvent(new CustomEvent('sutram-settings-save', {
                detail: {
                    extName: this.extName,
                    schema: this.schema,
                    formData: cleanedData,
                    repo: targetRepo,
                    resolve,
                    reject,
                    originalEvent: e
                },
                bubbles: true,
                composed: true
            }));
        });
    }
    _renderScopeBadge(field) {
        const badges = [];
        if (field.secure) {
            badges.push(html`<sutram-tag text="secure" intent="warning"></sutram-tag>`);
        }
        const scope = field.scope || 'workspace';
        if (scope === 'daemon') {
            badges.push(html`<sutram-tag text="daemon" intent="neutral"></sutram-tag>`);
        } else if (scope === 'repo') {
            badges.push(html`<sutram-tag text="repo" intent="highlight"></sutram-tag>`);
        } else {
            badges.push(html`<sutram-tag text="workspace" intent="primary"></sutram-tag>`);
        }
        return html`<div style="display: inline-flex; gap: 6px; align-items: center;">${badges}</div>`;
    }

    render() {
        const registry = window.ExtensionRegistry;
        const manifest = registry?._manifests?.get(this.extName);
        const settingsActions = (manifest?.settingsActions || []).filter(act => !act.id.endsWith('_generic_settings'));
        const q = (this.filterQuery || '').trim().toLowerCase();

        const visibleSchema = (this.schema || []).filter(field => {
            if (!field || field.type === 'hidden') return false;
            if (!q) return true;
            const hay = [field.label, field.title, field.id, field.description, field.desc].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        });

        const hasRepoFields = (this.schema || []).some(f => f && f.type !== 'hidden' && f.scope === 'repo');
        const activeRepo = this.selectedRepo || (this.repos && this.repos[0]) || '';
        const repoMissing = hasRepoFields && (!this.repos || this.repos.length === 0);

        return html`
            ${hasRepoFields ? html`
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: color-mix(in srgb, var(--intent-highlight) 10%, var(--input-bg)); border: 1px solid color-mix(in srgb, var(--intent-highlight) 35%, var(--border)); border-radius: 8px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: bold; color: var(--text);">
                        <yv-icon name="package" style="width: 16px; height: 16px; color: var(--intent-highlight);"></yv-icon>
                        <span>Target Repository Scope</span>
                    </div>
                    ${repoMissing ? html`
                        <span style="font-size: 0.8rem; color: var(--intent-warning); font-style: italic;">
                            Add a repository in Workspace Manager to configure repository-scoped settings.
                        </span>
                    ` : html`
                        <sutram-select
                            .value=${activeRepo}
                            .options=${(this.repos || []).map(r => ({ value: r, label: r }))}
                            ?flush=${true}
                            style="min-width: 200px; margin: 0;"
                            @sutram-input-changed=${(e) => {
                                this.selectedRepo = e.detail.value;
                                this.dispatchEvent(new CustomEvent('sutram-settings-repo-changed', {
                                    detail: { extName: this.extName, repo: e.detail.value },
                                    bubbles: true,
                                    composed: true
                                }));
                            }}>
                        </sutram-select>
                    `}
                </div>
            ` : ''}

            ${!q ? settingsActions.map(act => html`
                <div class="field-card">
                    <div class="field-header">
                        <span style="font-size: 0.95rem; color: var(--text); font-weight: bold; display: flex; align-items: center; gap: 8px;">
                            ${act.icon ? (/^[a-zA-Z0-9-]+$/.test(act.icon) ? html`<yv-icon name="${act.icon}" style="width: 15px; height: 15px; color: var(--intent-primary);"></yv-icon>` : act.icon) : ''}
                            <span>${act.label}</span>
                        </span>
                        <sutram-async-btn label="Open Panel" icon="external-link" intent="primary" size="sm" .onClick=${async (e) => {
                            this.dispatchEvent(new CustomEvent('sutram-settings-custom-action', { detail: { action: act, originalEvent: e }, bubbles: true, composed: true }));
                            if (act.onClick) await act.onClick(e);
                        }}></sutram-async-btn>
                    </div>
                </div>
            `) : ''}

            ${visibleSchema.map(field => {
                const isRepoFieldDisabled = field.scope === 'repo' && repoMissing;
                const val = this.formData && this.formData[field.id] !== undefined ? this.formData[field.id] : field.default;
                const displayLabel = field.title || field.label || field.id;
                let inputHtml = '';

                if (field.type === 'action') {
                    inputHtml = html`
                        <sutram-async-btn
                            label=${field.button_label || field.label || 'Execute Action'}
                            intent=${field.intent || 'primary'}
                            ?disabled=${isRepoFieldDisabled}
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
                    inputHtml = html`
                        <sutram-toggle
                            .checked=${!!val}
                            ?disabled=${isRepoFieldDisabled}
                            ?flush=${true}
                            @sutram-input-changed=${e => this._emitFormMutation({ ...this.formData, [field.id]: e.detail.value })}>
                        </sutram-toggle>
                    `;
                } else if (field.type === 'select') {
                    const options = (field.options || []).map(opt => ({
                        value: opt.value !== undefined ? opt.value : opt,
                        label: opt.label || opt.title || opt.value || opt
                    }));
                    inputHtml = html`
                        <sutram-select
                            .value=${val ?? ''}
                            .options=${options}
                            ?disabled=${isRepoFieldDisabled}
                            ?flush=${true}
                            @sutram-input-changed=${e => this._emitFormMutation({ ...this.formData, [field.id]: e.detail.value })}>
                        </sutram-select>
                    `;
                } else if (field.type === 'number') {
                    inputHtml = html`
                        <sutram-input
                            type="number"
                            .value=${val !== undefined && val !== null && !Number.isNaN(val) ? String(val) : ''}
                            ?disabled=${isRepoFieldDisabled}
                            ?flush=${true}
                            @sutram-input-changed=${e => {
                                const raw = e.detail.value;
                                const parsed = raw === '' ? '' : Number(raw);
                                this._emitFormMutation({ ...this.formData, [field.id]: Number.isNaN(parsed) ? (field.default ?? 0) : parsed });
                            }}>
                        </sutram-input>
                    `;
                } else if (field.type === 'intent_map') {
                    const intents = Array.isArray(field.intent_legend) && field.intent_legend.length > 0
                        ? field.intent_legend
                        : ['primary', 'success', 'warning', 'danger', 'highlight', 'neutral'];
                    const mapObj = (typeof val === 'object' && val !== null) ? val : (field.default || {});
                    inputHtml = html`
                        <div class="intent-grid">
                            ${intents.map(intentKey => {
                                const arr = Array.isArray(mapObj[intentKey]) ? mapObj[intentKey] : [];
                                return html`
                                    <div class="intent-row">
                                        <span style="font-family: var(--font-mono); font-size: 0.75rem; font-weight: bold; color: var(--intent-${intentKey}); display: flex; align-items: center; gap: 6px;">
                                            ● ${intentKey.toUpperCase()}
                                        </span>
                                        <sutram-input
                                            .value=${arr.join(', ')}
                                            placeholder="Comma-separated keywords..."
                                            ?disabled=${isRepoFieldDisabled}
                                            ?flush=${true}
                                            @sutram-input-changed=${e => {
                                                const nextList = e.detail.value.split(',').map(s => s.trim()).filter(Boolean);
                                                const nextMap = { ...mapObj, [intentKey]: nextList };
                                                this._emitFormMutation({ ...this.formData, [field.id]: nextMap });
                                            }}>
                                        </sutram-input>
                                    </div>
                                `;
                            })}
                        </div>
                    `;
                } else if (field.type === 'string_list') {
                    const listVal = Array.isArray(val) ? val.join(', ') : (val || '');
                    inputHtml = html`
                        <sutram-input
                            .value=${listVal}
                            placeholder=${field.placeholder || 'Comma-separated values...'}
                            ?disabled=${isRepoFieldDisabled}
                            ?flush=${true}
                            @sutram-input-changed=${e => {
                                const arr = e.detail.value.split(',').map(s => s.trim()).filter(Boolean);
                                this._emitFormMutation({ ...this.formData, [field.id]: arr });
                            }}>
                        </sutram-input>
                    `;
                } else if (field.type === 'object' || field.type === 'json' || (typeof val === 'object' && val !== null)) {
                    const strVal = this._jsonBuffers[field.id] !== undefined
                        ? this._jsonBuffers[field.id]
                        : (typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : (val || ''));
                    inputHtml = html`
                        <sutram-textarea
                            .value=${strVal}
                            .monospace=${true}
                            .minRows=${4}
                            ?disabled=${isRepoFieldDisabled}
                            ?flush=${true}
                            @sutram-input-changed=${e => {
                                this._jsonBuffers = { ...this._jsonBuffers, [field.id]: e.detail.value };
                                try {
                                    const parsed = JSON.parse(e.detail.value);
                                    this._emitFormMutation({ ...this.formData, [field.id]: parsed });
                                } catch (err) {
                                    this.requestUpdate();
                                }
                            }}>
                        </sutram-textarea>
                    `;
                } else {
                    const isMaskedSecret = field.secure && val === '••••••••';
                    const inputType = field.type === 'password' || field.secure ? 'password' : 'text';
                    inputHtml = html`
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <sutram-input
                                type="${inputType}"
                                style="flex: 1; margin: 0;"
                                .value=${val ?? ''}
                                placeholder=${field.secure ? 'Enter secret key...' : (field.placeholder || '')}
                                ?disabled=${isRepoFieldDisabled}
                                ?flush=${true}
                                @sutram-input-changed=${e => this._emitFormMutation({ ...this.formData, [field.id]: e.detail.value })}>
                            </sutram-input>
                            ${isMaskedSecret ? html`
                                <sutram-tag text="✓ Configured" intent="success"></sutram-tag>
                                <sutram-btn
                                    size="sm"
                                    intent="danger"
                                    label="Clear"
                                    style="margin: 0;"
                                    @click=${() => this._emitFormMutation({ ...this.formData, [field.id]: '' })}>
                                </sutram-btn>
                            ` : ''}
                        </div>
                    `;
                }
                return html`
                    <sutram-field-card
                        .label=${displayLabel}
                        .description=${field.description || field.desc || ''}
                        .scope=${field.scope || 'workspace'}
                        ?secure=${!!field.secure}>${inputHtml}
                    </sutram-field-card>
                `;
            })}

            ${!this.hideSaveButton && visibleSchema.some(f => f.type !== 'action') ? html`
                <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                    <sutram-async-btn
                        label="Save ${manifest?.name || this.extName} Settings"
                        icon="save"
                        intent="primary"
                        style="width: 100%;"
                        .onClick=${(e) => this.triggerSave(e)}>
                    </sutram-async-btn>
                </div>
            ` : ''}
        `;
    }
}
customElements.define('sutram-settings-form', SutramSettingsForm);

export class SutramGenericSettingsModal extends SutramElement {
    static properties = {
        open: { type: Boolean, reflect: true },
        extName: { type: String },
        schema: { type: Array },
        formData: { type: Object },
        repos: { type: Array },
        selectedRepo: { type: String }
    };
    static styles = [sharedStyles, css`:host { display: contents; }`];

    constructor() {
        super();
        this.open = false;
        this.extName = '';
        this.schema = [];
        this.formData = {};
        this.repos = [];
        this.selectedRepo = '';
    }

    openModal(extName, schema, formData, repos = [], selectedRepo = '') {
        this.extName = extName;
        this.schema = schema || [];
        this.formData = formData || {};
        this.repos = repos || [];
        this.selectedRepo = selectedRepo || (this.repos[0] || '');
        this.open = true;
        this.requestUpdate();
    }

    render() {
        if (!this.open) return html``;
        const registry = window.ExtensionRegistry;
        const manifest = registry?._manifests?.get(this.extName);
        const title = (manifest?.name || this.extName) + ' Settings';

        return html`
            <yenvui-modal
                ?open=${true}
                titleText=${title}
                ?fullscreen=${true}
                @yenvui-modal-closed=${(e) => { if (e.target === e.currentTarget) this.open = false; }}>
                <div slot="body">
                    <sutram-settings-form
                        .extName=${this.extName}
                        .schema=${this.schema}
                        .formData=${this.formData}
                        .repos=${this.repos}
                        .selectedRepo=${this.selectedRepo}
                        ?hideSaveButton=${true}
                        @sutram-settings-form-changed=${(e) => { this.formData = e.detail.formData; }}>
                    </sutram-settings-form>
                </div>
                <sutram-async-btn
                    slot="footer"
                    label="Save Settings"
                    icon="save"
                    intent="primary"
                    .onClick=${async (e) => {
                        const formEl = this.shadowRoot.querySelector('sutram-settings-form');
                        if (formEl) await formEl.triggerSave(e);
                        this.open = false;
                    }}>
                </sutram-async-btn>
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
    static styles = [sharedStyles, css`
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
            border: 2px solid var(--border, #000000);
            border-top: none;
            box-shadow: 4px 4px 0 var(--intent-primary, #8b5cf6);
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
            background: var(--bg, #ffffff) !important;
            color: var(--text, #000000) !important;
            font-weight: 900 !important;
            border: 2px solid var(--intent-danger, #ec4899) !important;
            box-shadow: 3px 3px 0 var(--intent-warning, #eab308) !important;
        }
        :host([data-theme="e-ink"]) .sync-btn:hover { background: var(--bg-hover, #f1f5f9) !important; }
        :host([data-theme="e-ink"]) .sync-btn.active { background: var(--text, #000000) !important; color: var(--bg, #ffffff) !important; }
    `];
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
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        const dialog = this.shadowRoot?.querySelector('.action-tray-dialog');
        if (dialog && dialog.open) {
            document.body.appendChild(dialog);
            dialog.close();
            dialog.remove();
        }
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
            const groupIcons = { file: 'file-text', edit: 'edit-3', share: 'share-2', tools: 'wrench' };

            const checkDropdownAlign = (e) => {
                const dd = e.currentTarget;
                if (!dd) return;
                const rect = dd.getBoundingClientRect();
                const container = dd.closest('.spatial-col, sutram-app-shell, .editor-header') || document.body;
                const containerRight = container.getBoundingClientRect ? container.getBoundingClientRect().right : window.innerWidth;
                const maxRight = Math.min(window.innerWidth, containerRight);
                const estimatedWidth = 220;
                if (rect.left + estimatedWidth > maxRight - 10) {
                    dd.setAttribute('align', 'right');
                    dd.align = 'right';
                } else {
                    dd.setAttribute('align', 'left');
                    dd.align = 'left';
                }
            };

            return html`
                <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                    ${Object.keys(groups).map(g => {
                        if (groups[g].length === 0) return '';
                        return html`
                            <sutram-dropdown 
                                .items=${groups[g]} 
                                align="left"
                                @pointerdown=${checkDropdownAlign}
                                @click=${checkDropdownAlign}>
                                <button slot="trigger" class="sync-btn" style="background: transparent; color: var(--text); border: 1px solid var(--border); padding: 6px 10px;">
                                    <yv-icon name="${groupIcons[g]}" style="width: 14px; height: 14px; margin-right: 4px;"></yv-icon> <span>${groupLabels[g]}</span>
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
            const rawIcon = typeof act.icon === 'function' ? act.icon(this.entityData) : (act.icon || '');
            const intent = typeof act.intent === 'function' ? act.intent(this.entityData) : (act.intent || 'primary');
            const isActive = typeof act.isActive === 'function' ? act.isActive(this.entityData) : !!act.isActive;

            if (act.asyncAction || (window.ExtensionRegistry.executeEntityAction && act.vfsBound)) {
                return html`
                    <sutram-async-btn 
                        style="margin: 0; order: ${act.order || 99};" 
                        .label=${label}
                        .icon=${rawIcon}
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
                    .label=${label}
                    .icon=${rawIcon}
                    @click=${clickHandler}>
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
            const groupIcons = { file: 'file-text', edit: 'edit-3', share: 'share-2', tools: 'wrench' };
            const handleTrayAction = async (act, e) => {
                await executeAction(act, e);
                if (!act.keepDrawerOpen) {
                    this._trayOpen = false;
                }
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
                                    <div class="tray-group-header">
                                        <yv-icon name="${groupIcons[g]}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>${groupLabels[g]}
                                    </div>
                                    <div class="tray-group-grid">
                                        ${groups[g].map(act => {
                                            const label = typeof act.label === 'function' ? act.label(this.entityData) : act.label;
                                            const rawIcon = typeof act.icon === 'function' ? act.icon(this.entityData) : (act.icon || '');
                                            const intent = typeof act.intent === 'function' ? act.intent(this.entityData) : (act.intent || 'primary');
                                            const isActive = typeof act.isActive === 'function' ? act.isActive(this.entityData) : !!act.isActive;

                                            const renderIcon = (iconStr) => {
                                                if (!iconStr) return '';
                                                if (typeof iconStr === 'object') return iconStr;
                                                if (iconStr.includes('<')) return html`<span style="display: inline-flex; align-items: center; margin-right: 6px;">${iconStr}</span>`;
                                                if (/^[a-zA-Z0-9-]+$/.test(iconStr)) {
                                                    return html`<yv-icon name="${iconStr}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>`;
                                                }
                                                return html`<span style="margin-right: 6px;">${iconStr}</span>`;
                                            };
                                            if (act.asyncAction || (window.ExtensionRegistry.executeEntityAction && act.vfsBound)) {
                                                return html`
                                                    <sutram-async-btn 
                                                        style="margin: 0; width: 100%; justify-content: flex-start; --btn-padding: 10px 12px; font-size: 0.9rem;" 
                                                        .label=${label}
                                                        .icon=${rawIcon}
                                                        intent="${intent}" 
                                                        ?active=${isActive}
                                                        .onClick=${(e) => handleTrayAction(act, e)}>
                                                    </sutram-async-btn>
                                                `;
                                            }
                                            return html`
                                                <button 
                                                    class="sync-btn ${isActive ? 'active' : ''}" 
                                                    style="width: 100%; justify-content: flex-start; padding: 10px 12px; font-size: 0.9rem; background: color-mix(in srgb, var(--intent-${intent}) 15%, transparent); color: var(--intent-${intent}); border: 1px solid color-mix(in srgb, var(--intent-${intent}) 40%, transparent);" 
                                                    @click=${(e) => handleTrayAction(act, e)}>
                                                    ${renderIcon(rawIcon)}${label}
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
                <sutram-btn intent="neutral" style="order: -1; margin-right: 4px;"
                    label="⋮"
                    @click=${(e) => { e.stopPropagation(); this._trayOpen = true; }}>
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
            ${this._trayOpen ? renderTray() : ''}
        `;
    }
}
customElements.define('sutram-entity-actions', SutramEntityActions);
// 9. Polymorphic Card Primitive (IoC Action Broker & Selection Binding)
export class SutramCard extends SutramContextMixin(YenvuiCard) {
    static properties = {
        ...YenvuiCard.properties,
        entityType: { type: String },
        entityData: { type: Object },
        selectionStoreKey: { type: String }
    };

    constructor() {
        super();
        this.entityType = '';
        this.entityData = {};
        this.selectionStoreKey = 'Selection';
    }
    _getId() {
        return this.entityData?.filepath || this.entityData?.folderpath || this.entityData?.id || this.filename;
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
        this.addEventListener('yenvui-card-select-toggled', (e) => {
            e.stopPropagation();
            const id = this._getId();
            if (id && this.selectionStoreKey && this.selectionStoreKey !== 'none') {
                const store = this._getStore();
                if (store && store.getState().toggleSelection) {
                    store.getState().toggleSelection(id, this.entityType, this.entityData);
                }
            }
            this.dispatchEvent(new CustomEvent('sutram-card-select-toggled', {
                detail: { id, selected: this.selected, entityType: this.entityType, entityData: this.entityData },
                bubbles: true,
                composed: true
            }));
        });

        this.addEventListener('yenvui-card-clicked', (e) => {
            this.dispatchEvent(new CustomEvent('card-clicked', {
                detail: { filename: this.filename, isSource: true },
                bubbles: true,
                composed: true
            }));
        });
    }
    updated(changedProperties) {
        if (changedProperties.has('icon') || changedProperties.has('entityData')) {
            const isDirtyCard = Boolean(
                this.entityData?.needs_recompile ||
                this.entityData?.is_dirty ||
                this.entityData?.outdated
            );
            if (isDirtyCard && (!this.icon || this.icon === 'alert-triangle' || this.icon === 'package')) {
                this.icon = 'construction';
            }
        }
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

        // Keep the dynamic actions injection in sync
        if (changedProperties.has('entityType') || changedProperties.has('entityData') || changedProperties.has('_overlayActive')) {
            this._injectEntityActions();
        }
    }

    firstUpdated() {
        if (super.firstUpdated) super.firstUpdated();
        this._injectEntityActions();
    }

    _injectEntityActions() {
        if (!this.entityType || !window.ExtensionRegistry?.getEntityActions) return;
        const actions = window.ExtensionRegistry.getEntityActions(this.entityType, this.entityData || {});
        if (actions.length > 0) {
            if (!this._hasActions) this._hasActions = true;

            // LAZY-LOAD: Only physically build and inject the DOM nodes when the user opens the tray
            if (!this._overlayActive) return;

            let actionsContainer = this.querySelector('.sutram-injected-actions');
            if (!actionsContainer) {
                actionsContainer = document.createElement('div');
                actionsContainer.className = 'sutram-injected-actions';
                actionsContainer.slot = 'actions';
                actionsContainer.style.display = 'flex';
                actionsContainer.style.flexWrap = 'nowrap';
                actionsContainer.style.gap = '8px';
                actionsContainer.style.alignItems = 'center';
                actionsContainer.style.width = 'max-content';

                // We must stop propagation so clicking actions doesn't trigger card click
                actionsContainer.addEventListener('click', e => e.stopPropagation());
                const actionsNode = document.createElement('sutram-entity-actions');
                actionsNode.entityType = this.entityType;
                actionsNode.entityData = this.entityData;
                actionsNode.scrollable = true;
                actionsContainer.appendChild(actionsNode);
                this.appendChild(actionsContainer);
                this._hasActions = true;
            } else {
                const actionsNode = actionsContainer.querySelector('sutram-entity-actions');
                if (actionsNode) {
                    actionsNode.entityType = this.entityType;
                    actionsNode.entityData = this.entityData;
                }
            }
        }
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
}
customElements.define('sutram-card', SutramCard);
// 10. Card Group Container
export class SutramCardGroup extends YenvuiCardGroup {}
customElements.define('sutram-card-group', SutramCardGroup);

// 11. Search Bar & Toolbar
export class SutramSearchBar extends YenvuiSearchBar {
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('yenvui-search-changed', e => {
            this.dispatchEvent(new CustomEvent('search-changed', { detail: e.detail, bubbles: true, composed: true }));
        });
    }
}
customElements.define('sutram-search-bar', SutramSearchBar);

export class SutramSpinner extends YenvuiSpinner {}
customElements.define('sutram-spinner', SutramSpinner);

export class SutramEmptyState extends YenvuiEmptyState {}
customElements.define('sutram-empty-state', SutramEmptyState);

export class SutramBoard extends YenvuiBoard {}
customElements.define('sutram-board', SutramBoard);

export class SutramColumn extends YenvuiColumn {}
customElements.define('sutram-column', SutramColumn);

export class SutramTag extends YenvuiTag {}
customElements.define('sutram-tag', SutramTag);

export class SutramLabel extends YenvuiLabel {}
customElements.define('sutram-label', SutramLabel);
export class SutramScrubTrack extends YenvuiScrubTrack {}
customElements.define('sutram-scrub-track', SutramScrubTrack);

export class SutramScrollView extends YenvuiScrollView {}
customElements.define('sutram-scroll-view', SutramScrollView);
export class SutramToolbar extends YenvuiToolbar {
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('yenvui-search-changed', e => {
            this.dispatchEvent(new CustomEvent('search-changed', { detail: e.detail, bubbles: true, composed: true }));
        });
    }
}
customElements.define('sutram-toolbar', SutramToolbar);

// 12. Dropdown & Collapsible
export class SutramDropdown extends YenvuiDropdown {}
customElements.define('sutram-dropdown', SutramDropdown);

export class SutramFilterDropdown extends YenvuiFilterDropdown {}
if (!customElements.get('sutram-filter-dropdown')) {
    customElements.define('sutram-filter-dropdown', SutramFilterDropdown);
}
export class SutramCollapsible extends YenvuiCollapsible {
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('yenvui-collapsible-toggled', e => {
            e.stopPropagation();
            if (e.target !== this) return;
            this.dispatchEvent(new CustomEvent('sutram-collapsible-toggled', { detail: e.detail, bubbles: false, composed: false }));
        });
    }
}
customElements.define('sutram-collapsible', SutramCollapsible);

export class SutramCategorySection extends YenvuiCategorySection {}
customElements.define('sutram-category-section', SutramCategorySection);

// 13. Pills & Filter Groups
export class SutramPill extends YenvuiPill {
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('yenvui-pill-toggled', e => {
            this.dispatchEvent(new CustomEvent('sutram-pill-toggled', { detail: e.detail, bubbles: true, composed: true }));
        });
    }
}
customElements.define('sutram-pill', SutramPill);

export class SutramFilterGroup extends YenvuiFilterGroup {
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('yenvui-filter-changed', e => {
            this.dispatchEvent(new CustomEvent('sutram-filter-changed', { detail: e.detail, bubbles: true, composed: true }));
        });
    }
}
customElements.define('sutram-filter-group', SutramFilterGroup);

// 14. Code & Text Editor Primitive
import { wordCountPlugin } from './wordcount.js';

const _EMPTY_EXTENSIONS = [];
export class SutramEditor extends SutramContextMixin(YenvuiEditor) {
    static properties = { 
        ...YenvuiEditor.properties,
        enableWordcount: { type: Boolean },
    };

    constructor() {
        super();
        this.enableWordcount = true;
    }

    willUpdate(changedProperties) {
        super.willUpdate(changedProperties);
        if (changedProperties.has('customExtensions') || changedProperties.has('enableWordcount')) {
            const baseExts = Array.isArray(this.customExtensions) 
                ? this.customExtensions.filter(ext => ext !== wordCountPlugin) 
                : [];
                
            if (this.enableWordcount) {
                baseExts.push(wordCountPlugin);
            }
            this.customExtensions = baseExts; // Inject directly into base property
        }
    }
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('yenvui-editor-changed', e => {
            this.dispatchEvent(new CustomEvent('editor-changed', { detail: e.detail, bubbles: true, composed: true }));
            this.dispatchEvent(new CustomEvent('content-changed', { detail: e.detail, bubbles: true, composed: true }));
            this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        });
        this.addEventListener('yenvui-editor-selection', e => {
            this.dispatchEvent(new CustomEvent('editor-selection', { detail: e.detail, bubbles: true, composed: true }));
        });
        this.addEventListener('yenvui-editor-scroll', e => {
            this.dispatchEvent(new CustomEvent('editor-scroll', { detail: e.detail, bubbles: true, composed: true }));
        });
    }
}
customElements.define('sutram-editor', SutramEditor);

// 15. Selector Modal
export class SutramSelectorModal extends SutramElement {
    static properties = { 
        open: { type: Boolean, reflect: true }, 
        titleText: { type: String }, 
        items: { type: Array }, 
        _searchQuery: { type: String },
        _filteredItems: { type: Array, state: true }
    };
    static styles = [sharedStyles, css`:host { display: contents; }`];
    constructor() {
        super();
        this.open = false;
        this.titleText = "Select Item";
        this.items = [];
        this._searchQuery = '';
        this._filteredItems = [];
        this._lastSearchReq = 0;
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('items') || changedProperties.has('_searchQuery')) {
            if (!this._searchQuery) {
                this._filteredItems = (this.items || []).slice(0, 50);
            } else {
                const reqId = ++this._lastSearchReq;
                SutramWorker.dispatch('FUZZY_SEARCH', {
                    items: this.items || [],
                    query: this._searchQuery
                }).then(({ results }) => {
                    if (reqId === this._lastSearchReq) {
                        this._filteredItems = (results || []).slice(0, 50);
                    }
                });
            }
        }
    }

    render() {
        if (!this.open) return html``;

        const filtered = this._filteredItems || [];
        return html`
            <sutram-modal ?open=${true} titleText=${this.titleText} @sutram-modal-closed=${() => { this.open = false; this.dispatchEvent(new CustomEvent('selector-closed')); }}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 300px;">
                    <sutram-input placeholder="Search..." ?flush=${true} .value=${this._searchQuery} @sutram-input-changed=${e => this._searchQuery = e.detail.value} style="width: 100%; margin-bottom: 10px; flex-shrink: 0;"></sutram-input>
                    <div style="display: flex; flex-direction: column; gap: 5px; flex: 1; overflow-y: auto; padding-bottom: 15px;">
                        ${filtered.length === 0 ? html`<span style="color: var(--text-muted); font-style: italic;">No matches found.</span>` : filtered.map(item => {
                            const displayText = typeof item === 'string' ? item : (item.label || item);
                            return html`
                                <button class="btn-sm yv-interactive-row" style="background: var(--bg); border: 1px solid var(--border); color: var(--text); text-align: left; padding: 12px 15px; font-size: 1.05rem; font-family: monospace; font-weight: bold; margin: 0; cursor: pointer; border-radius: 4px;"
                                    @click=${() => {
                                        this.open = false;
                                        this.dispatchEvent(new CustomEvent('item-selected', { detail: { item }, bubbles: true, composed: true }));
                                    }}>
                                    <yv-icon name="file" style="width: 14px; height: 14px; margin-right: 6px;"></yv-icon> ${displayText}
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

// 16. Universal Spatial Report Projection (Dry-runs, Diffs, and Logs)
export class SutramReportProjection extends SutramElement {
    static properties = {
        caption: { type: String },
        content: { type: String },
        tabs: { type: Array },
        activeTab: { type: String },
        actions: { type: Array },
        extraContent: { type: Object },
        suggestedFilename: { type: String },
        windowId: { type: String }
    };
    static styles = [sharedStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            overflow: hidden;
            background: var(--bg);
            box-sizing: border-box;
        }
        .output-box {
            font-family: var(--font-mono);
            background: var(--input-bg);
            border: 1px solid var(--border);
            padding: 12px;
            border-radius: 4px;
            font-size: 0.85rem;
            color: var(--text);
            white-space: pre-wrap;
            overflow-y: auto;
            flex: 1;
            min-height: 150px;
        }
    `];

    constructor() {
        super();
        this.caption = '';
        this.content = '';
        this.tabs = [];
        this.activeTab = '';
        this.actions = [];
        this.extraContent = null;
        this.suggestedFilename = '';
        this.windowId = '';
    }

    _getActiveContent() {
        if (this.tabs && this.tabs.length > 0) {
            const currentTabId = this.activeTab || this.tabs[0].id;
            const tab = this.tabs.find(t => t.id === currentTabId) || this.tabs[0];
            return tab ? (tab.content || '') : '';
        }
        return this.content || '';
    }

    render() {
        const activeContent = this._getActiveContent();
        const hasTabs = this.tabs && this.tabs.length > 1;
        const currentTabId = this.activeTab || (this.tabs && this.tabs[0]?.id) || '';
        const filename = this.suggestedFilename || `report_${Date.now()}.txt`;

        return html`
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 15px; gap: 10px;">
                ${this.caption ? html`<p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${this.caption}</p>` : ''}
                ${hasTabs ? html`
                    <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                        ${this.tabs.map(tab => html`
                            <sutram-btn
                                size="sm"
                                .icon=${tab.icon || 'file-text'}
                                .label=${tab.label}
                                intent="${currentTabId === tab.id ? 'primary' : 'neutral'}"
                                ?active=${currentTabId === tab.id}
                                @click=${() => { this.activeTab = tab.id; this.requestUpdate(); }}>
                            </sutram-btn>
                        `)}
                    </div>
                ` : ''}
                <div class="output-box">${activeContent || 'No output.'}</div>
                ${this.extraContent ? html`<div style="flex-shrink: 0;">${this.extraContent}</div>` : ''}
                <div style="padding: 6px 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end;">
                    <sutram-entity-actions
                        ?scrollable=${true}
                        style="justify-content: flex-end;"
                        .entityType=${'text_blob'}
                        .entityData=${{
                            textContent: activeContent,
                            suggestedFilename: filename
                        }}>
                    </sutram-entity-actions>
                </div>
            </div>
            ${this.actions && this.actions.length > 0 ? html`
                <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; width: 100%; gap: 10px; flex-shrink: 0; box-sizing: border-box;">
                    ${this.actions.map(act => {
                        const btnStyle = act.style || (act.primary ? 'flex: 2; margin: 0;' : 'flex: 1; margin: 0;');
                        if (act.asyncAction) {
                            return html`
                                <sutram-async-btn
                                    .icon=${act.icon}
                                    .label=${act.label}
                                    intent="${act.intent || 'primary'}"
                                    style="${btnStyle}"
                                    ?disabled=${act.disabled}
                                    .onClick=${act.asyncAction}>
                                </sutram-async-btn>
                            `;
                        }
                        return html`
                            <sutram-btn
                                .icon=${act.icon}
                                .label=${act.label}
                                intent="${act.intent || 'neutral'}"
                                style="${btnStyle}"
                                ?disabled=${act.disabled}
                                @click=${act.onClick}>
                            </sutram-btn>
                        `;
                    })}
                </div>
            ` : ''}
        `;
    }
}
customElements.define('sutram-report-projection', SutramReportProjection);
// 17. Synchronized Dual-Box & Interleaved Diff Viewer
export class SutramDiffViewer extends SutramContextMixin(YenvuiDiffViewer) {}
customElements.define('sutram-diff-viewer', SutramDiffViewer);

// 18. Declarative Sub-Tab Action & Bulk Selection Menu
export class SutramSubtabMenu extends SutramElement {
    static properties = {
        slotConfig: { type: Object },
        _menuItems: { type: Array, state: true },
        _selectedCount: { type: Number, state: true }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; align-items: stretch; height: 100%; }
        .subtab-menu-trigger {
            background: transparent;
            color: var(--text);
            border: none;
            border-left: 1px solid var(--border);
            border-radius: 0;
            cursor: pointer;
            font-weight: bold;
            height: 100%;
            width: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            position: relative;
            padding: 0;
            margin: 0;
            transition: background 0.15s ease;
        }
        .subtab-menu-trigger:hover {
            background: var(--input-bg);
        }
        .subtab-badge {
            position: absolute;
            top: 4px;
            right: 4px;
            background: var(--intent-warning);
            color: var(--bg-deep, #000000);
            border-radius: 50%;
            width: 14px;
            height: 14px;
            font-size: 9px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
        }
    `];

    constructor() {
        super();
        this.slotConfig = null;
        this._menuItems = [];
        this._selectedCount = 0;
        this._selectedItems = new Map();
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            SelectionStore,
            state => state.selectedItems || new Map(),
            (selectedItems) => {
                this._selectedItems = selectedItems;
                this._rebuildMenu();
            }
        );
        this.subscribe(
            EnvironmentStore,
            state => state.isOffline,
            () => {
                this._rebuildMenu();
            }
        );
        this.registerGlobalListener('sutram-subtab-menu-refresh', window, () => {
            this._rebuildMenu();
        });
        this._selectedItems = SelectionStore.getState()?.selectedItems || new Map();
        this._rebuildMenu();
    }
    _bindSlotMenuStores() {
        if (this._slotStoreUnsubs) {
            this._slotStoreUnsubs.forEach(u => u());
        }
        this._slotStoreUnsubs = [];
        const stores = this.slotConfig?.menuStores || [];
        stores.forEach(storeName => {
            const unsub = this.subscribe(storeName, () => {
                this._rebuildMenu();
            });
            this._slotStoreUnsubs.push(unsub);
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this._slotStoreUnsubs = [];
    }

    willUpdate(changedProperties) {
        super.willUpdate(changedProperties);
        if (changedProperties.has('slotConfig')) {
            this._bindSlotMenuStores();
            this._rebuildMenu();
        }
    }

    _rebuildMenu() {
        const cfg = this.slotConfig || {};
        const selectedMap = this._selectedItems || new Map();
        const allSelected = Array.from(selectedMap.values());
        const allowedTypes = Array.isArray(cfg.bulkEntityTypes) && cfg.bulkEntityTypes.length > 0
            ? cfg.bulkEntityTypes
            : null;

        const scopedSelected = allowedTypes
            ? allSelected.filter(item => {
                const types = String(item?.entityType || '').split(':');
                return types.some(t => allowedTypes.includes(t));
            })
            : allSelected;

        this._selectedCount = cfg.bulkActionGroup ? scopedSelected.length : 0;
        const items = [];

        if (cfg.bulkActionGroup && scopedSelected.length > 0) {
            const bulkActions = window.ExtensionRegistry?.getAggregatableActions
                ? window.ExtensionRegistry.getAggregatableActions(scopedSelected, { group: cfg.bulkActionGroup })
                : [];
            if (bulkActions.length > 0) {
                bulkActions.forEach(act => items.push(act));
                items.push({ divider: true });
            }
            items.push({
                label: `Clear Selection (${scopedSelected.length})`,
                icon: 'x',
                onClick: () => SelectionStore.getState().clearSelection()
            });
            items.push({ divider: true });
        }

        const customMenu = typeof cfg.menuActions === 'function'
            ? cfg.menuActions(cfg)
            : (Array.isArray(cfg.menuActions) ? cfg.menuActions : []);

        customMenu.forEach(entry => {
            if (!entry) return;
            if (entry.divider) {
                items.push({ divider: true });
                return;
            }
            items.push({
                ...entry,
                onClick: entry.onClick || (entry.emitEvent ? () => {
                    const evtSpec = typeof entry.emitEvent === 'function' ? entry.emitEvent(cfg) : entry.emitEvent;
                    if (typeof evtSpec === 'string') {
                        window.dispatchEvent(new CustomEvent(evtSpec, { bubbles: true, composed: true }));
                    } else if (evtSpec && evtSpec.name) {
                        window.dispatchEvent(new CustomEvent(evtSpec.name, { detail: evtSpec.detail, bubbles: true, composed: true }));
                    }
                } : null)
            });
        });

        while (items.length > 0 && items[items.length - 1].divider) {
            items.pop();
        }
        this._menuItems = items;
    }
    render() {
        if (!this._menuItems || this._menuItems.length === 0) return html``;
        const count = this._selectedCount || 0;
        return html`
            <sutram-dropdown align="right" .items=${this._menuItems} style="height: 100%; display: flex; align-items: stretch;">
                <button slot="trigger" class="subtab-menu-trigger" @pointerdown=${() => this._rebuildMenu()} title="${count > 0 ? `Bulk Actions (${count} selected)` : 'Actions'}">
                    ${count > 0 ? html`
                        <yv-icon name="layers" style="width: 15px; height: 15px; color: var(--intent-warning);"></yv-icon>
                        <span class="subtab-badge">${count > 9 ? '9+' : count}</span>
                    ` : html`
                        <yv-icon name="menu" style="width: 14px; height: 14px;"></yv-icon>
                    `}
                </button>
            </sutram-dropdown>
        `;
    }
}
if (!customElements.get('sutram-subtab-menu')) {
    customElements.define('sutram-subtab-menu', SutramSubtabMenu);
}