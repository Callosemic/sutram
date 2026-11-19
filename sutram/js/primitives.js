// sutram/js/primitives.js
// Pure Agnostic Presentation Primitives
import { LitElement, html, css } from 'lit';
import { SutramElement, SutramContextMixin, SelectionStore, ToastStore, EnvironmentStore, VariantDefaultStore, ExtensionRegistry, resolveSelectionEntityType } from './sutram_sdk.js';
import * as Chassis from 'sutram-chassis';
import { sharedStyles } from './shared_styles.js';
import { buildFileTree, resolveDirectoryState, fuzzyFilterObjects, SutramWorker } from './utils.js';
import './inputs.js';
import 'lit-virtualizer';

import { SutramDagTree, SutramFloatingHud } from './chassis_adapter.js';
export { SutramDagTree, SutramFloatingHud };

export const REQUIRED_CHASSIS_PRIMITIVES = [
    'Icon', 'View', 'Stack', 'Surface', 'ActionBar', 'SidebarLayout',
    'Btn', 'AsyncBtn', 'Card', 'CardGroup', 'CategorySection',
    'Modal', 'Window', 'Tabs', 'Toolbar', 'SearchBar',
    'Dropdown', 'FilterDropdown', 'Collapsible', 'Pill', 'FilterGroup',
    'Tag', 'Label', 'Spinner', 'EmptyState', 'Board', 'Column',
    'ScrubTrack', 'ScrollView', 'DiffViewer', 'Editor',
    'Input', 'Select', 'Textarea', 'Toggle'
];
export function validateChassisContract(chassisProvider) {
    if (!chassisProvider || typeof chassisProvider !== 'object') {
        throw new Error('[Sutram Boot Error] Invalid or missing chassis provider object.');
    }
    const missing = REQUIRED_CHASSIS_PRIMITIVES.filter(p => typeof chassisProvider[p] !== 'function');
    if (missing.length > 0) {
        throw new Error(
            `[Sutram Boot Error] Chassis '${chassisProvider.CHASSIS_PROVIDER_META?.name || 'Custom'}' fails contract. Missing primitives: ${missing.join(', ')}`
        );
    }
    return true;
}

export class SutramUIAdapter {
    static PASSTHROUGH_MAP = Object.freeze({
        'sutram-icon': 'Icon',
        'sutram-view': 'View',
        'sutram-stack': 'Stack',
        'sutram-surface': 'Surface',
        'sutram-action-bar': 'ActionBar',
        'sutram-btn': 'Btn',
        'sutram-card-group': 'CardGroup',
        'sutram-category-section': 'CategorySection',
        'sutram-spinner': 'Spinner',
        'sutram-empty-state': 'EmptyState',
        'sutram-board': 'Board',
        'sutram-column': 'Column',
        'sutram-tag': 'Tag',
        'sutram-label': 'Label',
        'sutram-scrub-track': 'ScrubTrack',
        'sutram-scroll-view': 'ScrollView',
        'sutram-filter-dropdown': 'FilterDropdown',
        'sutram-tabs': 'Tabs',
        'sutram-input': 'Input',
        'sutram-select': 'Select',
        'sutram-textarea': 'Textarea',
        'sutram-toggle': 'Toggle',
        'sutram-drop-overlay': 'DropOverlay',
        'sutram-drop-target': 'DropTarget'
    });

    static registerChassis(chassisProvider) {
        validateChassisContract(chassisProvider);
        Object.entries(this.PASSTHROUGH_MAP).forEach(([tag, exportKey]) => {
            const BaseClass = chassisProvider[exportKey];
            if (typeof BaseClass === 'function' && !customElements.get(tag)) {
                customElements.define(tag, class extends BaseClass {});
            }
        });
    }
}

SutramUIAdapter.registerChassis(Chassis);

const {
    Icon: YenvuiIcon,
    View: YenvuiView,
    Stack: YenvuiStack,
    Surface: YenvuiSurface,
    ActionBar: YenvuiActionBar,
    SidebarLayout: YenvuiSidebarLayout,
    Btn: YenvuiBtn,
    AsyncBtn: YenvuiAsyncBtn,
    StatusBar: YenvuiStatusBar,
    ToastContainer: YenvuiToastContainer,
    Modal: YenvuiModal,
    Window: YenvuiWindow,
    CategorySection: YenvuiCategorySection,
    Card: YenvuiCard,
    CardGroup: YenvuiCardGroup,
    Editor: YenvuiEditor,
    Toolbar: YenvuiToolbar,
    Collapsible: YenvuiCollapsible,
    Pill: YenvuiPill,
    FilterGroup: YenvuiFilterGroup,
    SelectionTray: YenvuiSelectionTray,
    SearchBar: YenvuiSearchBar,
    Spinner: YenvuiSpinner,
    EmptyState: YenvuiEmptyState,
    Board: YenvuiBoard,
    Column: YenvuiColumn,
    Tag: YenvuiTag,
    Label: YenvuiLabel,
    Dropdown: YenvuiDropdown,
    FilterDropdown: YenvuiFilterDropdown,
    ScrubTrack: YenvuiScrubTrack,
    ScrollView: YenvuiScrollView,
    DiffViewer: YenvuiDiffViewer,
    Tabs: YenvuiTabs
} = Chassis;

if (YenvuiEditor) {
    YenvuiEditor.languageResolver = async (lang) => {
        if (window.ExtensionRegistry && typeof window.ExtensionRegistry.executeUIHook === 'function') {
            return await window.ExtensionRegistry.executeUIHook('sutram:vendorize-language', lang);
        }
        if (window.Sutram && typeof window.Sutram.vendorizeLanguage === 'function') {
            return await window.Sutram.vendorizeLanguage(lang);
        }
        return null;
    };
}
// 0. Universal Virtualized List
export class SutramVirtualList extends LitElement {
    static properties = {
        items: { type: Array },
        renderItem: { type: Object },
        keyFunction: { type: Object },
        flush: { type: Boolean, reflect: true }
    };
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            flex: 1 1 0%;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
            overscroll-behavior-x: none;
            touch-action: pan-y;
            container-type: inline-size;
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
            --card-content-visibility: visible;
            --card-contain-intrinsic-size: none;
        }
        lit-virtualizer {
            width: 100%;
            height: 100%;
            flex: 1 1 0%;
            min-height: 0;
            min-width: 0;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-x: none;
            touch-action: pan-y;
            padding: 8px 0;
            box-sizing: border-box;
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
            --card-content-visibility: visible;
            --card-contain-intrinsic-size: none;
        }
        :host([flush]) lit-virtualizer {
            padding: 0;
        }
        @container (max-width: 480px) {
            lit-virtualizer {
                padding: 0;
            }
        }
        lit-virtualizer > * {
            width: calc(100% - 24px) !important;
            max-width: calc(100% - 24px) !important;
            margin-left: 12px !important;
            margin-right: 12px !important;
            box-sizing: border-box;
        }
        :host([flush]) lit-virtualizer > * {
            width: 100% !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
        }
        lit-virtualizer sutram-card,
        lit-virtualizer yenvui-card {
            margin-bottom: 8px;
            content-visibility: visible !important;
            contain-intrinsic-size: none !important;
            --card-content-visibility: visible;
            --card-contain-intrinsic-size: none;
        }
        @container (max-width: 480px) {
            lit-virtualizer > * {
                width: 100% !important;
                max-width: 100% !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
            }
            lit-virtualizer sutram-card,
            lit-virtualizer yenvui-card {
                margin-bottom: 0;
            }
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
    connectedCallback() {
        super.connectedCallback();
        this.setAttribute('data-virtual-list', '');
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

// 0.4 Width-Dependent Adaptive Label Helper
export function renderAdaptiveLabel({ icon = '', label = '', badge = null, showLabel = true, iconSize = 'sm', intent = null } = {}) {
    return html`
        ${icon ? html`<sutram-icon name=${icon} size=${iconSize} intent=${intent || 'current'}></sutram-icon>` : ''}
        ${showLabel && label ? html`<span class="adaptive-label-text">${label}</span>` : ''}
        ${!showLabel && badge !== null && badge !== undefined && badge !== '' ? html`<span class="adaptive-label-badge">${badge}</span>` : ''}
    `;
}

// 0.5 Semantic Icon & Layout Bricks
export class SutramIcon extends YenvuiIcon {}
if (!customElements.get('sutram-icon')) customElements.define('sutram-icon', SutramIcon);

export class SutramView extends YenvuiView {
    connectedCallback() {
        super.connectedCallback();
        if (!this._zenBridged) {
            this._zenBridged = true;
            this.addEventListener('yenvui-view-exit-zen', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('sutram-view-exit-zen', {
                    bubbles: true,
                    composed: true
                }));
            });
        }
    }
}
if (!customElements.get('sutram-view')) customElements.define('sutram-view', SutramView);

export class SutramStack extends YenvuiStack {}
if (!customElements.get('sutram-stack')) customElements.define('sutram-stack', SutramStack);

export class SutramSurface extends YenvuiSurface {}
if (!customElements.get('sutram-surface')) customElements.define('sutram-surface', SutramSurface);

export class SutramActionBar extends YenvuiActionBar {}
if (!customElements.get('sutram-action-bar')) customElements.define('sutram-action-bar', SutramActionBar);

export class SutramSidebarLayout extends YenvuiSidebarLayout {
    connectedCallback() {
        super.connectedCallback();
        if (!this._sidebarBridged) {
            this._sidebarBridged = true;
            this.addEventListener('yenvui-nav-selected', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('sutram-nav-selected', {
                    detail: e.detail,
                    bubbles: true,
                    composed: true
                }));
            });
            this.addEventListener('yenvui-drawer-closed', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('sutram-drawer-closed', {
                    bubbles: true,
                    composed: true
                }));
            });
        }
    }
}
if (!customElements.get('sutram-sidebar-layout')) customElements.define('sutram-sidebar-layout', SutramSidebarLayout);

// 1. Synchronous Action Button
export class SutramBtn extends YenvuiBtn {}
if (!customElements.get('sutram-btn')) customElements.define('sutram-btn', SutramBtn);
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
                    ?compact=${true}
                    intent="highlight"
                    variant="tinted"
                    icon="minimize-2"
                    label="Dock In"
                    title="Return projection to main workbench window"
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
                    ?compact=${true}
                    intent="neutral"
                    variant="tinted"
                    icon="external-link"
                    label="Pop Out"
                    title="Open in dedicated pop-out window"
                    @click=${async () => {
                        if (typeof this.beforeAction === 'function') await this.beforeAction();
                        if (layout && typeof layout.dockInProjection === 'function') {
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
                        if (this.onJobComplete) this.onJobComplete(data);
                        this._completeWithConfirmation();
                    },
                    onError: (err) => {
                        this.status = 'error';
                        if (this.onJobError) this.onJobError(err);
                        this.registerTimeout(() => { this.status = 'idle'; }, 2000);
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
                this.registerTimeout(() => { this.status = 'idle'; }, 2000);
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
        modalOpen: { type: Boolean },
        trayTitle: { type: String },
        itemBadge: { type: String },
        bulkGroup: { type: String },
        empty: { type: Boolean, reflect: true },
        _compactChip: { type: Boolean, state: true }
    };

    static styles = [sharedStyles, css`
        :host {
            display: inline-flex;
            align-items: center;
            height: 100%;
            flex-shrink: 0;
        }
        :host([empty]) {
            display: none !important;
        }
        .cart-btn {
            background: color-mix(in srgb, var(--intent-warning) 15%, transparent);
            color: var(--intent-warning);
            border: 1px solid color-mix(in srgb, var(--intent-warning) 40%, transparent);
            border-radius: 20px;
            min-height: 44px;
            min-width: 44px;
            padding: 0 12px;
            font-size: 0.85rem;
            font-weight: bold;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.2s;
            margin: 0 6px;
            box-sizing: border-box;
            white-space: nowrap;
        }
        .cart-btn:hover {
            background: color-mix(in srgb, var(--intent-warning) 25%, transparent);
        }
        .adaptive-label-badge,
        .cart-badge {
            background: var(--intent-warning);
            color: var(--bg-deep, #000000);
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: bold;
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
        this.trayTitle = 'Selection Tray';
        this.itemBadge = 'ITEM';
        this.bulkGroup = 'share';
        this.empty = true;
        this._compactChip = false;
    }

    _syncChipMode(explicitWidth = null) {
        let colW = explicitWidth;
        if (colW === null || colW === undefined) {
            const hostCol = this.resolveAssignedSpatialContainer('.spatial-col, [data-spatial-boundary]');
            colW = hostCol?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1024);
        }
        this._compactChip = colW > 0 && colW < 480;
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(SelectionStore, state => {
            this.selectedItems = state.selectedItems;
            if (this.selectedItems.size === 0) this.modalOpen = false;
            this.empty = this.selectedItems.size === 0 && !this.modalOpen;
        });
        this.selectedItems = SelectionStore.getState().selectedItems;
        this.empty = this.selectedItems.size === 0 && !this.modalOpen;
        this.observeAssignedContainer((width) => this._syncChipMode(width), '.spatial-col, [data-spatial-boundary]');
    }

    willUpdate(changedProperties) {
        super.willUpdate(changedProperties);
        if (changedProperties.has('selectedItems') || changedProperties.has('modalOpen')) {
            const sz = this.selectedItems?.size || 0;
            this.empty = sz === 0 && !this.modalOpen;
        }
    }

    render() {
        const count = this.selectedItems.size;
        if (count === 0 && !this.modalOpen) return html``;
        const itemsArray = Array.from(this.selectedItems.values());
        const bulkEntityType = resolveSelectionEntityType(itemsArray);
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
        if (registry && typeof registry.getAggregatableActions === 'function') {
            batchActions = registry.getAggregatableActions(itemsArray, { group: this.bulkGroup || 'share' });
        }

        return html`
            ${count > 0 ? html`
                <button class="cart-btn" title="${count} selected" @click=${() => { this.modalOpen = true; this.empty = false; }}>
                    ${renderAdaptiveLabel({
                        icon: 'layers',
                        label: `${count} selected`,
                        badge: String(count),
                        showLabel: !this._compactChip,
                        iconSize: 'sm'
                    })}
                </button>
            ` : ''}

            <div class="tray-overlay ${this.modalOpen ? 'open' : ''}" @click=${() => this.modalOpen = false}></div>
            <div class="tray-panel ${this.modalOpen ? 'open' : ''}">
                <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start; border-radius: 12px 12px 0 0;">
                    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: bold;">SELECTION STAGING</span>
                        <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center;">${this.trayTitle || 'Selection Tray'} <span class="cart-badge" style="display: inline-flex; margin-left: 8px;">${count}</span></span>${sizeDisplay ? html`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sizeDisplay}</span>` : ''}
                    </div>
                    <button type="button" @click=${() => this.modalOpen = false} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 1.1rem; line-height: 1;">✕</button>
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
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="pack-tag">${this.itemBadge || 'ITEM'}</span> ${name}</div>${sizeText ? html`<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem; font-family: monospace;">${sizeText}</span>` : ''}
                                </div>
                                <div class="tray-item-path">${rawPath}</div>
                            </div>
                            <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;" @click=${() => SelectionStore.getState().toggleSelection(toggleKey, item.entityType, item.data)}>✕</button>
                        </div>
                    `})}
                </div>
                <div class="tray-footer">
                    <sutram-async-btn label="Clear" intent="danger" .onClick=${() => { SelectionStore.getState().clearSelection(); this.modalOpen = false; }}></sutram-async-btn>
                    <div style="flex: 1 1 0%; min-width: 0; display: flex; justify-content: flex-end;">
                        <sutram-entity-actions
                            .actionsList=${batchActions}
                            .entityType=${bulkEntityType}
                            .entityData=${itemsArray}>
                        </sutram-entity-actions>
                    </div>
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
            <sutram-stack direction="col" gap="none">
                ${sortedCats.map(cat => html`
                    <sutram-category-section titleText=${cat}>
                        ${this.renderCategoryHeader ? this.renderCategoryHeader(cat) : ''}
                        <sutram-card-group>
                            ${categories[cat].map(item => this.renderItem(item))}
                        </sutram-card-group>
                    </sutram-category-section>
                `)}
            </sutram-stack>
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
            <sutram-surface variant="ghost" border="bottom" padding="xs">
                <sutram-stack direction="row" align="center" gap="sm">
                    <sutram-btn intent="neutral" ?compact=${true} icon="corner-left-up" label="Up" ?disabled=${validPath.length === 0} @click=${() => this._setPath(validPath.slice(0, -1))}></sutram-btn>
                    <sutram-scrub-track ?grow=${true} ?monospace=${true}>
                        /${validPath.join('/')}
                    </sutram-scrub-track>
                </sutram-stack>
            </sutram-surface>
            <sutram-stack direction="col" gap="xs" ?flex=${true} ?scrollable=${true}>
                ${entries.length === 0 ? html`<sutram-empty-state text="No sub-folders available."></sutram-empty-state>` : entries.map(node => html`
                    <sutram-surface variant="inset" padding="xs" ?interactive=${true}
                        @click=${() => this._setPath([...validPath, node.name])}>
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-icon name="folder" size="md" intent="warning"></sutram-icon>
                            <strong>${node.name}</strong>
                        </sutram-stack>
                    </sutram-surface>
                `)}
            </sutram-stack>
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
        this.setAttribute('data-spatial-boundary', '');
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
        .scope-badge {
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 2px 8px;
            border-radius: 4px;
            line-height: 1.4;
            white-space: nowrap;
        }
        .scope-badge.primary {
            background: color-mix(in srgb, var(--intent-primary) 18%, transparent);
            color: var(--intent-primary);
            border: 1px solid color-mix(in srgb, var(--intent-primary) 40%, transparent);
        }
        .scope-badge.neutral {
            background: var(--bg);
            color: var(--text-muted);
            border: 1px solid var(--border);
        }
        .scope-badge.highlight {
            background: color-mix(in srgb, var(--intent-highlight) 18%, transparent);
            color: var(--intent-highlight);
            border: 1px solid color-mix(in srgb, var(--intent-highlight) 40%, transparent);
        }
        .scope-badge.warning {
            background: color-mix(in srgb, var(--intent-warning) 18%, transparent);
            color: var(--intent-warning);
            border: 1px solid color-mix(in srgb, var(--intent-warning) 40%, transparent);
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
            badges.push(html`<span class="scope-badge warning">secure</span>`);
        }
        const scope = this.scope || 'workspace';
        if (scope === 'daemon') {
            badges.push(html`<span class="scope-badge neutral">daemon</span>`);
        } else if (scope === 'repo') {
            badges.push(html`<span class="scope-badge highlight">repo</span>`);
        } else if (scope !== 'none') {
            badges.push(html`<span class="scope-badge primary">workspace</span>`);
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
        optionResolver: { attribute: false },
        formData: { type: Object },
        repos: { type: Array },
        selectedRepo: { type: String },
        filterQuery: { type: String },
        hideSaveButton: { type: Boolean },
        _jsonBuffers: { type: Object }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; gap: 14px; width: 100%; box-sizing: border-box; }
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
        this.optionResolver = null;
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
                <sutram-surface variant="tinted" intent="highlight" padding="sm">
                    <sutram-stack direction="row" justify="between" align="center" gap="md" ?wrap=${true}>
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-icon name="package" size="md" intent="highlight"></sutram-icon>
                            <strong>Target Repository Scope</strong>
                        </sutram-stack>
                        ${repoMissing ? html`
                            <sutram-label text="Add a repository in Workspace Manager to configure repository-scoped settings."></sutram-label>
                        ` : html`
                            <sutram-select
                                .value=${activeRepo}
                                .options=${(this.repos || []).map(r => ({ value: r, label: r }))}
                                ?flush=${true}
                                ?grow=${true}
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
                    </sutram-stack>
                </sutram-surface>
            ` : ''}

            ${!q ? settingsActions.map(act => html`
                <sutram-field-card .label=${act.label} scope="workspace">
                    <sutram-async-btn slot="header-actions" label="Open Panel" icon="external-link" intent="primary" ?compact=${true} .onClick=${async (e) => {
                        this.dispatchEvent(new CustomEvent('sutram-settings-custom-action', { detail: { action: { ...act, extName: act.extName || this.extName }, extName: this.extName, originalEvent: e }, bubbles: true, composed: true }));
                        if (act.onClick) await act.onClick(e);
                    }}></sutram-async-btn>
                </sutram-field-card>
            `) : ''}

            ${visibleSchema.map(field => {
                const isRepoFieldDisabled = field.scope === 'repo' && repoMissing;
                const val = this.formData && this.formData[field.id] !== undefined ? this.formData[field.id] : field.default;
                const displayLabel = field.title || field.label || field.id;
                let inputHtml = '';
                if (field.type === 'action') {
                    inputHtml = html`
                        <sutram-async-btn
                            ?fullWidth=${true}
                            label=${field.button_label || field.action_label || field.label || 'Execute Action'}
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
                    let rawOptions = field.options || [];
                    if (field.options_from && typeof field.options_from === 'object') {
                        const srcField = field.options_from.field;
                        const valKey = field.options_from.value_key || 'id';
                        const lblKey = field.options_from.label_key || 'title';
                        const srcArr = Array.isArray(this.formData?.[srcField]) ? this.formData[srcField] : [];
                        rawOptions = srcArr
                            .filter(item => item && typeof item === 'object' && (item[valKey] || item[lblKey]))
                            .map(item => ({
                                value: String(item[valKey] || item[lblKey]),
                                label: String(item[lblKey] || item[valKey])
                            }));
                    }
                    const options = rawOptions.map(opt => ({
                        value: opt.value !== undefined ? opt.value : opt,
                        label: opt.label || opt.title || opt.value || opt
                    }));
                    const effectiveVal = (val !== undefined && val !== '' && options.some(o => o.value === val))
                        ? val
                        : (options[0]?.value ?? val ?? '');
                    inputHtml = html`
                        <sutram-select
                            .value=${effectiveVal}
                            .options=${options}
                            ?disabled=${isRepoFieldDisabled}
                            ?flush=${true}
                            @sutram-input-changed=${e => this._emitFormMutation({ ...this.formData, [field.id]: e.detail.value })}>
                        </sutram-select>
                    `;
                } else if (field.type === 'target_binding') {
                    const epField = field.endpoint_source || 'compute_endpoints';
                    const epList = Array.isArray(this.formData?.[epField]) ? this.formData[epField] : [];
                    const resolveModels = (epId) => {
                        if (typeof this.optionResolver === 'function') {
                            return this.optionResolver(field, epId, this.formData);
                        }
                        return [];
                    };
                    inputHtml = html`
                        <sutram-target-binding
                            ?flush=${true}
                            ?disabled=${isRepoFieldDisabled}
                            ?allowEmptyEndpoint=${Boolean(field.allow_empty)}
                            .value=${val || { endpoint: '', model: '' }}
                            .endpoints=${epList}
                            .models=${resolveModels}
                            .endpointPlaceholder=${field.endpoint_placeholder || 'Select endpoint...'}
                            .modelPlaceholder=${field.placeholder || 'Select or type model...'}
                            @sutram-input-changed=${e => this._emitFormMutation({ ...this.formData, [field.id]: e.detail.value })}>
                        </sutram-target-binding>
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
                            size="wide"
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
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-input
                                type="${inputType}"
                                ?grow=${true}
                                .value=${val ?? ''}
                                placeholder=${field.secure ? 'Enter secret key...' : (field.placeholder || '')}
                                ?disabled=${isRepoFieldDisabled}
                                ?flush=${true}
                                @sutram-input-changed=${e => this._emitFormMutation({ ...this.formData, [field.id]: e.detail.value })}>
                            </sutram-input>
                            ${isMaskedSecret ? html`
                                <sutram-tag text="✓ Configured" intent="success"></sutram-tag>
                                <sutram-btn
                                    ?compact=${true}
                                    intent="danger"
                                    label="Clear"
                                    @click=${() => this._emitFormMutation({ ...this.formData, [field.id]: '' })}>
                                </sutram-btn>
                            ` : ''}
                        </sutram-stack>
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
                <sutram-async-btn
                    ?fullWidth=${true}
                    label="Save ${manifest?.name || this.extName} Settings"
                    icon="save"
                    intent="primary"
                    .onClick=${(e) => this.triggerSave(e)}>
                </sutram-async-btn>
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
    }

    render() {
        if (!this.open) return html``;
        const registry = window.ExtensionRegistry;
        const manifest = registry?._manifests?.get(this.extName);
        const title = (manifest?.name || this.extName) + ' Settings';
        return html`
            <sutram-modal
                open
                titleText=${title}
                fullscreen
                @sutram-modal-closed=${(e) => { if (e.target === e.currentTarget) this.open = false; }}>
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
            </sutram-modal>
        `;
    }
}
customElements.define('sutram-generic-settings', SutramGenericSettingsModal);
// 8.4. Variant-Set Split Button (<sutram-variant-btn>)
export const ACTION_CONFIRM_HOLD_MS = 900;

export class SutramVariantBtn extends SutramElement {
    static properties = {
        setEntry: { type: Object },
        entityType: { type: String },
        entityData: { type: Object },
        compact: { type: Boolean, reflect: true },
        executeAction: { attribute: false },
        _lastUsedMap: { type: Object, state: true }
    };
    static styles = [sharedStyles, css`
        :host {
            display: inline-flex;
            align-items: stretch;
            vertical-align: middle;
            flex-shrink: 0;
        }
        .split-group {
            display: inline-flex;
            align-items: stretch;
            border-radius: 8px;
        }
        .split-main {
            display: inline-flex;
            min-width: var(--variant-min-width, max-content);
            --btn-border-radius: 8px 0 0 8px;
        }
        .split-main sutram-async-btn {
            width: 100%;
            min-width: var(--variant-min-width, max-content);
        }
        .split-arrow-trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 7px;
            margin: 0;
            border-radius: 0 8px 8px 0;
            border: 1px solid color-mix(in srgb, var(--btn-color, var(--intent-primary)) 40%, transparent);
            border-left: none;
            background: color-mix(in srgb, var(--btn-color, var(--intent-primary)) 15%, transparent);
            color: var(--btn-color, var(--intent-primary));
            cursor: pointer;
            transition: background 0.15s ease;
        }
        .split-arrow-trigger:hover {
            background: color-mix(in srgb, var(--btn-color, var(--intent-primary)) 26%, transparent);
        }
        .split-arrow-trigger--primary { --btn-color: var(--intent-primary); }
        .split-arrow-trigger--success { --btn-color: var(--intent-success); }
        .split-arrow-trigger--warning { --btn-color: var(--intent-warning); }
        .split-arrow-trigger--danger { --btn-color: var(--intent-danger); }
        .split-arrow-trigger--highlight { --btn-color: var(--intent-highlight); }
        .split-arrow-trigger--neutral { --btn-color: var(--intent-neutral); }
    `];

    constructor() {
        super();
        this.setEntry = null;
        this.entityType = '';
        this.entityData = null;
        this.compact = false;
        this.executeAction = null;
        this._lastUsedMap = {};
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(VariantDefaultStore, state => state.lastUsed, (lastUsed) => {
            this._lastUsedMap = lastUsed || {};
        });
        this._lastUsedMap = VariantDefaultStore.getState()?.lastUsed || {};
    }

    _resolveCurrentDefault() {
        const entry = this.setEntry;
        if (!entry || !Array.isArray(entry.variants) || entry.variants.length === 0) return null;
        const registry = window.ExtensionRegistry || ExtensionRegistry;
        const et = this.entityType || entry.entityType || 'file';
        return registry.resolveDefaultVariant(et, entry.setId, entry.variants) || entry.variants[0];
    }

    async _runVariant(variant, e) {
        if (!variant) return;
        const registry = window.ExtensionRegistry || ExtensionRegistry;
        const et = this.entityType || this.setEntry?.entityType || 'file';
        const setId = this.setEntry?.setId || variant.set;
        const recordId = variant.variantId || variant.id;
        if (setId && recordId && typeof registry.setLastUsedVariant === 'function') {
            registry.setLastUsedVariant(et, setId, recordId);
        }
        if (typeof this.executeAction === 'function') {
            return await this.executeAction(variant, e);
        }
        if (typeof registry.executeEntityAction === 'function') {
            return await registry.executeEntityAction(variant, this.entityData, e);
        }
        if (variant.asyncAction) return await variant.asyncAction(this.entityData, e);
        if (variant.onClick) return variant.onClick(this.entityData, e);
    }

    _buildDropdownItems() {
        const entry = this.setEntry;
        if (!entry || !Array.isArray(entry.variants)) return [];
        const items = [];
        const sections = Array.isArray(entry.sections) && entry.sections.length > 0
            ? entry.sections
            : Array.from(new Set(entry.variants.map(v => v.section || 'Actions')));

        sections.forEach(sec => {
            const members = entry.variants.filter(v => (v.section || 'Actions') === sec);
            if (members.length === 0) return;
            items.push({ sectionHeading: sec });
            members.forEach(v => {
                const lbl = typeof v.label === 'function' ? v.label(this.entityData) : v.label;
                const ic = typeof v.icon === 'function' ? v.icon(this.entityData) : (v.icon || '');
                items.push({
                    id: v.id,
                    label: lbl,
                    icon: ic,
                    section: sec,
                    successLabel: v.successLabel || 'Done',
                    confirmHoldMs: ACTION_CONFIRM_HOLD_MS,
                    keepDrawerOpen: Boolean(v.keepDrawerOpen),
                    asyncAction: (e) => this._runVariant(v, e)
                });
            });
        });
        return items;
    }

    render() {
        const entry = this.setEntry;
        const activeVariant = this._resolveCurrentDefault();
        if (!entry || !activeVariant) return html``;

        const label = typeof activeVariant.label === 'function' ? activeVariant.label(this.entityData) : activeVariant.label;
        const icon = typeof activeVariant.icon === 'function' ? activeVariant.icon(this.entityData) : (activeVariant.icon || entry.icon || '');
        const intent = typeof activeVariant.intent === 'function' ? activeVariant.intent(this.entityData) : (activeVariant.intent || entry.intent || 'primary');
        const successLabel = activeVariant.successLabel || 'Done';
        const maxChars = Math.max(Number(entry.maxLabelChars) || 0, String(label || '').length);
        const minWidthStyle = maxChars > 0 ? `--variant-min-width: calc(${maxChars}ch + 38px);` : '';
        const dropdownItems = this._buildDropdownItems();

        return html`
            <div class="split-group" style="${minWidthStyle}" @click=${(e) => e.stopPropagation()}>
                <div class="split-main">
                    <sutram-async-btn
                        ?compact=${this.compact}
                        .label=${label}
                        .icon=${icon}
                        .successLabel=${successLabel}
                        intent="${intent}"
                        .onClick=${(e) => this._runVariant(activeVariant, e)}>
                    </sutram-async-btn>
                </div>
                <sutram-dropdown .items=${dropdownItems} align="right">
                    <button
                        slot="trigger"
                        type="button"
                        class="split-arrow-trigger split-arrow-trigger--${intent}"
                        title="More ${entry.label || 'options'}">
                        <sutram-icon name="chevron-down" size="xs"></sutram-icon>
                    </button>
                </sutram-dropdown>
            </div>
        `;
    }
}
if (!customElements.get('sutram-variant-btn')) {
    customElements.define('sutram-variant-btn', SutramVariantBtn);
}

// 8.5. Standalone IoC Action Broker ("Fit, then Three-Dot Menu")
const GROUP_LABELS = Object.freeze({
    file: 'File',
    edit: 'Edit',
    share: 'Share',
    vcs: 'Source Control',
    tools: 'Tools'
});

export function computeFitActionCount(containerWidth, buttonWidths = [], moreTriggerWidth = 38, gapPx = 6, hasGuaranteedOverflow = false) {
    if (!Array.isArray(buttonWidths) || buttonWidths.length === 0) return 0;
    const avail = Number(containerWidth) || 0;
    if (avail <= 0) return buttonWidths.length;

    if (!hasGuaranteedOverflow) {
        const totalAll = buttonWidths.reduce((sum, w, idx) => sum + w + (idx > 0 ? gapPx : 0), 0);
        if (totalAll <= avail) return buttonWidths.length;
    }

    const budgetWithMore = Math.max(0, avail - moreTriggerWidth - gapPx);
    let used = 0;
    let fit = 0;
    for (let i = 0; i < buttonWidths.length; i++) {
        const w = buttonWidths[i] + (fit > 0 ? gapPx : 0);
        if (used + w <= budgetWithMore) {
            used += w;
            fit++;
        } else {
            break;
        }
    }
    return fit;
}

export class SutramEntityActions extends SutramElement {
    static properties = {
        entityType: { type: String },
        entityData: { type: Object },
        actionsList: { type: Array },
        variant: { type: String },
        compact: { type: Boolean, reflect: true },
        _containerWidth: { type: Number, state: true },
        _overflowClampCount: { type: Number, state: true }
    };
    static styles = [sharedStyles, css`
        :host {
            display: flex;
            flex-wrap: nowrap;
            gap: 6px;
            align-items: center;
            justify-content: flex-end;
            width: 100%;
            min-width: 0;
            overflow: hidden;
            box-sizing: border-box;
        }
        .action-row {
            display: flex;
            flex-wrap: nowrap;
            gap: 6px;
            align-items: center;
            justify-content: flex-end;
            width: 100%;
            min-width: 0;
            overflow: hidden;
        }
        .more-trigger-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 30px;
            min-width: 34px;
            padding: 0 8px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: var(--input-bg);
            color: var(--text);
            cursor: pointer;
            font-weight: bold;
            flex-shrink: 0;
            transition: background 0.15s ease, border-color 0.15s ease;
        }
        .more-trigger-btn:hover {
            background: var(--bg-hover);
            border-color: var(--intent-primary);
        }
        .sync-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            margin: 0;
            padding: var(--btn-padding, 6px 12px);
            font-size: var(--btn-font-size, 0.82rem);
            font-family: inherit;
            font-weight: var(--btn-font-weight, normal);
            border-radius: var(--btn-border-radius, 6px);
            border: 1px solid var(--border);
            background: transparent;
            color: var(--text);
            cursor: pointer;
            white-space: nowrap;
            box-sizing: border-box;
            transition: filter 0.2s ease, transform 0.1s ease;
        }
        .sync-btn:hover { background: var(--bg-hover); }
    `];

    constructor() {
        super();
        this.entityType = '';
        this.entityData = {};
        this.actionsList = null;
        this.variant = 'row';
        this.compact = false;
        this._containerWidth = 0;
        this._overflowClampCount = null;
        this._lastRenderedFitCount = 0;
        this._lastClampContextKey = '';
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(VariantDefaultStore, state => state.lastUsed, () => {
            this._overflowClampCount = null;
            this.requestUpdate();
        });
        if (typeof ResizeObserver !== 'undefined') {
            this._rowResizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const w = entry.contentRect ? entry.contentRect.width : this.clientWidth;
                    if (w > 0 && Math.abs(w - this._containerWidth) > 2) {
                        this._containerWidth = w;
                        this._overflowClampCount = null;
                    }
                }
            });
            this._rowResizeObserver.observe(this);
        }
        if (this.clientWidth > 0) {
            this._containerWidth = this.clientWidth;
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (this.variant === 'footer' || this.variant === 'menu-bar') return;
        const rowEl = this.shadowRoot?.querySelector('.action-row');
        if (!rowEl || rowEl.clientWidth <= 0) return;
        const isOverflowing = rowEl.scrollWidth > rowEl.clientWidth + 1;
        if (isOverflowing && this._lastRenderedFitCount > 0) {
            this._overflowClampCount = this._lastRenderedFitCount - 1;
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._rowResizeObserver) {
            this._rowResizeObserver.disconnect();
            this._rowResizeObserver = null;
        }
    }

    _resolveActions() {
        if (Array.isArray(this.actionsList)) {
            return this.actionsList;
        }
        const registry = window.ExtensionRegistry || ExtensionRegistry;
        if (!this.entityType || typeof registry?.getEntityActions !== 'function') return [];
        return registry.getEntityActions(this.entityType, this.entityData || {});
    }

    _estimateEntryWidth(entry) {
        if (entry.kind === 'variant-set') {
            const chars = Math.max(Number(entry.maxLabelChars) || 10, 8);
            return chars * 7.5 + 68;
        }
        const lbl = typeof entry.label === 'function' ? entry.label(this.entityData) : (entry.label || '');
        return String(lbl).length * 7.5 + 38;
    }

    _buildOverflowMenuItems(overflowEntries, executeAction) {
        const items = [];
        const bySection = new Map();

        const addToSection = (secTitle, itemObj) => {
            if (!bySection.has(secTitle)) bySection.set(secTitle, []);
            bySection.get(secTitle).push(itemObj);
        };

        overflowEntries.forEach(entry => {
            if (entry.kind === 'variant-set' && Array.isArray(entry.variants)) {
                const setLabel = entry.label || 'Options';
                const sections = Array.isArray(entry.sections) && entry.sections.length > 0
                    ? entry.sections
                    : ['Actions'];
                sections.forEach(sec => {
                    const secTitle = sections.length > 1 ? `${setLabel} · ${sec}` : setLabel;
                    entry.variants
                        .filter(v => (v.section || 'Actions') === sec)
                        .forEach(v => {
                            const lbl = typeof v.label === 'function' ? v.label(this.entityData) : v.label;
                            const ic = typeof v.icon === 'function' ? v.icon(this.entityData) : (v.icon || '');
                            addToSection(secTitle, {
                                id: v.id,
                                label: lbl,
                                icon: ic,
                                successLabel: v.successLabel || 'Done',
                                confirmHoldMs: ACTION_CONFIRM_HOLD_MS,
                                keepDrawerOpen: Boolean(v.keepDrawerOpen),
                                asyncAction: async (e) => {
                                    const registry = window.ExtensionRegistry || ExtensionRegistry;
                                    if (typeof registry?.setLastUsedVariant === 'function') {
                                        registry.setLastUsedVariant(this.entityType || entry.entityType || 'file', entry.setId, v.variantId || v.id);
                                    }
                                    await executeAction(v, e);
                                }
                            });
                        });
                });
            } else {
                const gKey = entry.group || 'tools';
                const secTitle = GROUP_LABELS[gKey] || (gKey.charAt(0).toUpperCase() + gKey.slice(1));
                const lbl = typeof entry.label === 'function' ? entry.label(this.entityData) : entry.label;
                const ic = typeof entry.icon === 'function' ? entry.icon(this.entityData) : (entry.icon || '');
                addToSection(secTitle, {
                    id: entry.id,
                    label: lbl,
                    icon: ic,
                    intent: entry.intent,
                    successLabel: entry.successLabel || 'Done',
                    confirmHoldMs: ACTION_CONFIRM_HOLD_MS,
                    keepDrawerOpen: Boolean(entry.keepDrawerOpen),
                    asyncAction: (e) => executeAction(entry, e)
                });
            }
        });

        bySection.forEach((secItems, secTitle) => {
            if (secItems.length === 0) return;
            items.push({ sectionHeading: secTitle });
            const nonDestructive = secItems.filter(i => i.intent !== 'danger');
            const destructive = secItems.filter(i => i.intent === 'danger');
            [...nonDestructive, ...destructive].forEach(i => items.push(i));
        });

        return items;
    }

    render() {
        const actions = this._resolveActions();
        if (!actions || actions.length === 0) return '';

        const registry = window.ExtensionRegistry || ExtensionRegistry;
        const executeAction = async (act, e) => {
            const isBulkList = Array.isArray(this.actionsList);
            if (!isBulkList && registry?.executeEntityAction) {
                return await registry.executeEntityAction(act, this.entityData, e);
            }
            if (act.asyncAction) {
                return isBulkList ? await act.asyncAction(e) : await act.asyncAction(this.entityData, e);
            }
            if (act.onClick) {
                const res = isBulkList ? act.onClick(e) : act.onClick(this.entityData, e);
                if (res && typeof res.then === 'function') await res;
                return res;
            }
        };

        if (this.variant === 'menu-bar') {
            const groups = { file: [], edit: [], share: [], vcs: [], tools: [] };
            actions.forEach(act => {
                const g = act.group && groups[act.group] ? act.group : 'tools';
                if (act.kind === 'variant-set' && Array.isArray(act.variants)) {
                    const setLabel = act.label || 'Options';
                    const sections = Array.isArray(act.sections) && act.sections.length > 0 ? act.sections : ['Actions'];
                    sections.forEach(sec => {
                        const members = act.variants.filter(v => (v.section || 'Actions') === sec);
                        if (members.length > 0) {
                            const secTitle = sections.length > 1 ? `${setLabel} · ${sec}` : setLabel;
                            groups[g].push({ sectionHeading: secTitle });
                            members.forEach(v => {
                                groups[g].push({
                                    ...v,
                                    label: typeof v.label === 'function' ? v.label(this.entityData) : v.label,
                                    icon: typeof v.icon === 'function' ? v.icon(this.entityData) : (v.icon || ''),
                                    successLabel: v.successLabel || 'Done',
                                    confirmHoldMs: ACTION_CONFIRM_HOLD_MS,
                                    asyncAction: async (e) => {
                                        if (typeof registry?.setLastUsedVariant === 'function') {
                                            registry.setLastUsedVariant(this.entityType || act.entityType || 'file', act.setId, v.variantId || v.id);
                                        }
                                        await executeAction(v, e);
                                    }
                                });
                            });
                        }
                    });
                } else {
                    if (groups[g].length === 0 || groups[g].every(item => item.sectionHeading)) {
                        groups[g].push({ sectionHeading: GROUP_LABELS[g] });
                    }
                    groups[g].push({
                        ...act,
                        label: typeof act.label === 'function' ? act.label(this.entityData) : act.label,
                        icon: typeof act.icon === 'function' ? act.icon(this.entityData) : (act.icon || ''),
                        successLabel: act.successLabel || 'Done',
                        confirmHoldMs: ACTION_CONFIRM_HOLD_MS,
                        asyncAction: act.asyncAction ? (e) => executeAction(act, e) : null,
                        onClick: (!act.asyncAction && act.onClick) ? (e) => executeAction(act, e) : null
                    });
                }
            });
            const groupIcons = { file: 'file-text', edit: 'edit-3', share: 'share-2', vcs: 'git-branch', tools: 'wrench' };

            return html`
                <div class="action-row" style="justify-content: flex-start;">
                    ${Object.keys(groups).map(g => {
                        if (groups[g].length === 0) return '';
                        return html`
                            <sutram-dropdown .items=${groups[g]} align="left">
                                <button slot="trigger" class="sync-btn">
                                    <sutram-icon name="${groupIcons[g]}" size="sm"></sutram-icon>
                                    <span>${GROUP_LABELS[g]}</span>
                                </button>
                            </sutram-dropdown>
                        `;
                    })}
                </div>
            `;
        }

        const isFooterBar = this.variant === 'footer';
        const isBulkRow = Array.isArray(this.actionsList);

        // Destructive actions are never surfaced into a row unless explicitly in a footer bar.
        // Once an entity type uses `surfaced` ranks, only actions with a `surfaced` rank are row candidates;
        // legacy entity types with no `surfaced` actions fall back to `order < 20`.
        const usesSurfacedModel = actions.some(a => a.surfaced !== undefined && a.surfaced !== null);
        const rowCandidates = [];
        const menuOnlyEntries = [];

        actions.forEach(entry => {
            const isDestructive = entry.intent === 'danger';
            const hasSurfacedRank = entry.surfaced !== undefined && entry.surfaced !== null;
            const allowInRow = isFooterBar || (!isDestructive && (
                usesSurfacedModel
                    ? hasSurfacedRank
                    : (isBulkRow || (entry.order ?? 99) < 20)
            ));
            if (allowInRow) rowCandidates.push(entry);
            else menuOnlyEntries.push(entry);
        });

        const estimatedWidths = rowCandidates.map(e => this._estimateEntryWidth(e));
        const effectiveWidth = this._containerWidth || this.clientWidth || 0;
        const hasGuaranteedOverflow = menuOnlyEntries.length > 0;
        const clampContextKey = `${effectiveWidth}:${rowCandidates.map((e, i) => `${e.id || e.setId || i}:${estimatedWidths[i]}`).join(',')}`;
        if (clampContextKey !== this._lastClampContextKey) {
            this._lastClampContextKey = clampContextKey;
            this._overflowClampCount = null;
        }
        const estimatedFitCount = isFooterBar
            ? rowCandidates.length
            : (effectiveWidth > 0
                ? computeFitActionCount(effectiveWidth, estimatedWidths, 38, 6, hasGuaranteedOverflow)
                : rowCandidates.length);
        const fitCount = (!isFooterBar && this._overflowClampCount !== null)
            ? Math.min(estimatedFitCount, this._overflowClampCount)
            : estimatedFitCount;
        this._lastRenderedFitCount = fitCount;

        const visibleRowEntries = rowCandidates.slice(0, fitCount);
        const overflowEntries = [...rowCandidates.slice(fitCount), ...menuOnlyEntries];

        const renderRowEntry = (entry) => {
            if (entry.kind === 'variant-set') {
                return html`
                    <sutram-variant-btn
                        ?compact=${!isFooterBar}
                        .setEntry=${entry}
                        .entityType=${this.entityType || entry.entityType}
                        .entityData=${this.entityData}
                        .executeAction=${executeAction}>
                    </sutram-variant-btn>
                `;
            }
            if (entry.component) {
                return html`<div style="display: contents;">${entry.component(this.entityData)}</div>`;
            }
            const label = typeof entry.label === 'function' ? entry.label(this.entityData) : entry.label;
            const rawIcon = typeof entry.icon === 'function' ? entry.icon(this.entityData) : (entry.icon || '');
            const intent = typeof entry.intent === 'function' ? entry.intent(this.entityData) : (entry.intent || 'primary');
            const isActive = typeof entry.isActive === 'function' ? entry.isActive(this.entityData) : !!entry.isActive;
            const successLabel = entry.successLabel || 'Done';

            if (entry.asyncAction || entry.successLabel || (registry?.executeEntityAction && entry.vfsBound)) {
                return html`
                    <sutram-async-btn
                        ?compact=${!isFooterBar}
                        .label=${label}
                        .icon=${rawIcon}
                        .successLabel=${successLabel}
                        intent="${intent}"
                        ?active=${isActive}
                        ?grow=${isFooterBar}
                        ?fullWidth=${isFooterBar}
                        .onClick=${(e) => executeAction(entry, e)}>
                    </sutram-async-btn>
                `;
            }
            const clickHandler = async (e) => {
                if (e) e.stopPropagation();
                if (entry.emitEvent) {
                    const payload = entry.emitEvent(this.entityData);
                    window.dispatchEvent(new CustomEvent(payload.name, { detail: payload.detail, bubbles: true, composed: true }));
                } else {
                    await executeAction(entry, e);
                }
                if (!entry.keepDrawerOpen) {
                    this.dispatchEvent(new CustomEvent('yenvui-action-confirmed', {
                        bubbles: true,
                        composed: true,
                        detail: { action: entry, status: 'success', phase: 'settled', holdMs: 0, keepDrawerOpen: false }
                    }));
                }
            };
            return html`
                <sutram-btn
                    ?compact=${!isFooterBar}
                    intent=${intent}
                    ?active=${isActive}
                    ?grow=${isFooterBar}
                    ?fullWidth=${isFooterBar}
                    .label=${label}
                    .icon=${rawIcon}
                    @click=${clickHandler}>
                </sutram-btn>
            `;
        };

        const overflowItems = overflowEntries.length > 0
            ? this._buildOverflowMenuItems(overflowEntries, executeAction)
            : [];

        return html`
            <div class="action-row" @click=${(e) => e.stopPropagation()}>
                ${visibleRowEntries.map(renderRowEntry)}
                ${overflowItems.length > 0 ? html`
                    <sutram-dropdown .items=${overflowItems} align="right">
                        <button slot="trigger" type="button" class="more-trigger-btn" title="More actions">
                            <sutram-icon name="more-horizontal" size="sm"></sutram-icon>
                        </button>
                    </sutram-dropdown>
                ` : ''}
            </div>
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

        this.addEventListener('yenvui-card-tier-changed', () => {
            this._injectEntityActions();
        });

        this.addEventListener('yenvui-action-confirmed', (e) => {
            if (!this._overlayActive || this._wideCard) return;
            if (e.detail?.keepDrawerOpen || e.detail?.action?.keepDrawerOpen || e.detail?.item?.keepDrawerOpen) return;
            if (e.detail?.phase === 'settled') {
                this._overlayActive = false;
            }
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
        if (changedProperties.has('entityType') || changedProperties.has('entityData') || changedProperties.has('_overlayActive') || changedProperties.has('_wideCard')) {
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
            if (!this.hasActions) this.hasActions = true;

            // Inject DOM nodes when either the drawer is opened OR the card is in the wide (>= 720px) inline tier
            if (!this.actionsOpen && !this._wideCard) return;

            let actionsContainer = this.querySelector('.sutram-injected-actions');
            if (!actionsContainer) {
                actionsContainer = document.createElement('div');
                actionsContainer.className = 'sutram-injected-actions';
                actionsContainer.slot = 'actions';
                actionsContainer.style.display = 'flex';
                actionsContainer.style.flexWrap = 'nowrap';
                actionsContainer.style.gap = '6px';
                actionsContainer.style.alignItems = 'center';
                actionsContainer.style.justifyContent = 'flex-end';
                actionsContainer.style.width = '100%';
                actionsContainer.style.minWidth = '0';

                // Stop propagation so clicking actions doesn't trigger card click
                actionsContainer.addEventListener('click', e => e.stopPropagation());
                const actionsNode = document.createElement('sutram-entity-actions');
                actionsNode.style.width = '100%';
                actionsNode.style.minWidth = '0';
                actionsNode.entityType = this.entityType;
                actionsNode.entityData = this.entityData;
                actionsContainer.appendChild(actionsNode);
                this.appendChild(actionsContainer);
                this.hasActions = true;
            } else {
                const actionsNode = actionsContainer.querySelector('sutram-entity-actions');
                if (actionsNode) {
                    actionsNode.entityType = this.entityType;
                    actionsNode.entityData = this.entityData;
                }
            }
        } else {
            const staleContainer = this.querySelector('.sutram-injected-actions');
            if (staleContainer) staleContainer.remove();
            if (this.hasActions) this.hasActions = false;
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
if (!customElements.get('sutram-card-group')) customElements.define('sutram-card-group', SutramCardGroup);

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
if (!customElements.get('sutram-spinner')) customElements.define('sutram-spinner', SutramSpinner);

export class SutramEmptyState extends YenvuiEmptyState {}
if (!customElements.get('sutram-empty-state')) customElements.define('sutram-empty-state', SutramEmptyState);

export class SutramBoard extends YenvuiBoard {}
if (!customElements.get('sutram-board')) customElements.define('sutram-board', SutramBoard);

export class SutramColumn extends YenvuiColumn {}
if (!customElements.get('sutram-column')) customElements.define('sutram-column', SutramColumn);

export class SutramTag extends YenvuiTag {}
if (!customElements.get('sutram-tag')) customElements.define('sutram-tag', SutramTag);

export class SutramLabel extends YenvuiLabel {}
if (!customElements.get('sutram-label')) customElements.define('sutram-label', SutramLabel);
export class SutramScrubTrack extends YenvuiScrubTrack {}
if (!customElements.get('sutram-scrub-track')) customElements.define('sutram-scrub-track', SutramScrubTrack);

export class SutramScrollView extends YenvuiScrollView {}
if (!customElements.get('sutram-scroll-view')) customElements.define('sutram-scroll-view', SutramScrollView);
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
export class SutramDropdown extends YenvuiDropdown {
    constructor() {
        super();
        this.filterFn = (items, query) => fuzzyFilterObjects(
            items,
            query,
            item => `${item.label || ''} ${item.id || ''} ${item.token || ''} ${item.badge || ''} ${item.description || ''} ${item.section || ''}`
        );
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('yenvui-action-error', (e) => {
            window.dispatchEvent(new CustomEvent('sutram-status-update', {
                detail: { msg: e.detail?.msg || 'Action failed', timeout: 4000, isError: true }
            }));
        });
    }
}
customElements.define('sutram-dropdown', SutramDropdown);

export class SutramTabs extends YenvuiTabs {
    connectedCallback() {
        super.connectedCallback();
        if (!this._tabsBridged) {
            this._tabsBridged = true;
            this.addEventListener('yenvui-tab-selected', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('sutram-tab-selected', {
                    detail: e.detail,
                    bubbles: true,
                    composed: true
                }));
            });
        }
    }
}
if (!customElements.get('sutram-tabs')) customElements.define('sutram-tabs', SutramTabs);

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
if (!customElements.get('sutram-category-section')) customElements.define('sutram-category-section', SutramCategorySection);

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
            this._lastEmittedValue = e.detail?.value;
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
        this.addEventListener('yenvui-editor-link-clicked', e => {
            this.dispatchEvent(new CustomEvent('editor-link-clicked', { detail: e.detail, bubbles: true, composed: true }));
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
            <sutram-modal open titleText=${this.titleText} @sutram-modal-closed=${() => { this.open = false; this.dispatchEvent(new CustomEvent('selector-closed')); }}>
                <sutram-stack slot="body" direction="col" gap="sm" ?flex=${true}>
                    <sutram-input placeholder="Search..." ?flush=${true} .value=${this._searchQuery} @sutram-input-changed=${e => this._searchQuery = e.detail.value}></sutram-input>
                    <sutram-stack direction="col" gap="xs" ?flex=${true} ?scrollable=${true}>
                        ${filtered.length === 0 ? html`<sutram-empty-state text="No matches found."></sutram-empty-state>` : filtered.map(item => {
                            const displayText = typeof item === 'string' ? item : (item.label || item);
                            return html`
                                <sutram-surface variant="inset" padding="sm" ?interactive=${true}
                                    @click=${() => {
                                        this.open = false;
                                        this.dispatchEvent(new CustomEvent('item-selected', { detail: { item }, bubbles: true, composed: true }));
                                    }}>
                                    <sutram-stack direction="row" align="center" gap="sm">
                                        <sutram-icon name="file" size="sm" intent="primary"></sutram-icon>
                                        <sutram-label ?monospace=${true} intent="neutral" .text=${displayText}></sutram-label>
                                    </sutram-stack>
                                </sutram-surface>
                            `;
                        })}
                    </sutram-stack>
                </sutram-stack>
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
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: var(--mobile-edge-padding, 15px); gap: 10px;">
                ${this.caption ? html`<p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${this.caption}</p>` : ''}
                ${hasTabs ? html`
                    <sutram-stack direction="row" gap="sm">
                        ${this.tabs.map(tab => html`
                            <sutram-btn
                                ?compact=${true}
                                .icon=${tab.icon || 'file-text'}
                                .label=${tab.label}
                                intent="${currentTabId === tab.id ? 'primary' : 'neutral'}"
                                ?active=${currentTabId === tab.id}
                                @click=${() => { this.activeTab = tab.id; }}>
                            </sutram-btn>
                        `)}
                    </sutram-stack>
                ` : ''}
                <div class="output-box">${activeContent || 'No output.'}</div>
                ${this.extraContent ? html`<div style="flex-shrink: 0;">${this.extraContent}</div>` : ''}
                <sutram-surface variant="panel" padding="xs" align="end">
                    <sutram-entity-actions
                        .entityType=${'text_blob'}
                        .entityData=${{
                            textContent: activeContent,
                            suggestedFilename: filename
                        }}>
                    </sutram-entity-actions>
                </sutram-surface>
            </div>
            ${this.actions && this.actions.length > 0 ? html`
                <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; width: 100%; gap: 10px; flex-shrink: 0; box-sizing: border-box;">
                    ${this.actions.map(act => {
                        if (act.asyncAction) {
                            return html`
                                <sutram-async-btn
                                    .icon=${act.icon}
                                    .label=${act.label}
                                    intent="${act.intent || 'primary'}"
                                    ?grow=${true}
                                    ?emphasis=${Boolean(act.primary)}
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
                                ?grow=${true}
                                ?emphasis=${Boolean(act.primary)}
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
        extraContentNodes: { type: Array },
        _menuItems: { type: Array, state: true },
        _selectedCount: { type: Number, state: true }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; align-items: stretch; height: 100%; flex-shrink: 0; }
        .subtab-menu-trigger {
            background: transparent;
            color: var(--text);
            border: none;
            border-right: 1px solid var(--border);
            border-radius: 0;
            cursor: pointer;
            font-weight: bold;
            height: 100%;
            min-height: 44px;
            min-width: 44px;
            width: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            position: relative;
            padding: 0;
            margin: 0;
            transition: background 0.15s ease, opacity 0.15s ease;
        }
        .subtab-menu-trigger:hover:not(:disabled) {
            background: var(--input-bg);
        }
        .subtab-menu-trigger:disabled {
            opacity: 0.35;
            cursor: default;
        }
        .extra-view-section {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 4px 6px 6px 6px;
        }
        .extra-view-heading {
            font-size: 0.7rem;
            font-weight: 800;
            font-family: var(--font-mono, monospace);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--intent-primary, #8b5cf6);
            padding: 4px 6px 3px 6px;
            border-bottom: 1px solid color-mix(in srgb, var(--intent-primary, #8b5cf6) 28%, transparent);
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
        this.extraContentNodes = [];
        this._menuItems = [];
        this._selectedCount = 0;
        this._selectedItems = new Map();
        this._boundMenuStoresKey = '';
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
    _bindSlotMenuStores(force = false) {
        const stores = Array.isArray(this.slotConfig?.menuStores) ? this.slotConfig.menuStores : [];
        const nextKey = stores.join(',');
        if (!force && nextKey === this._boundMenuStoresKey && this._slotStoreUnsubs && this._slotStoreUnsubs.length === stores.length) {
            return;
        }
        if (this._slotStoreUnsubs) {
            this._slotStoreUnsubs.forEach(u => this.unsubscribe(u));
        }
        this._slotStoreUnsubs = [];
        this._boundMenuStoresKey = nextKey;
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
        this._boundMenuStoresKey = '';
    }

    willUpdate(changedProperties) {
        super.willUpdate(changedProperties);
        if (changedProperties.has('slotConfig')) {
            const prevCfg = changedProperties.get('slotConfig');
            this._bindSlotMenuStores();
            const sameStaticSlot = Boolean(
                prevCfg &&
                this.slotConfig &&
                prevCfg.id === this.slotConfig.id &&
                prevCfg.bulkActionGroup === this.slotConfig.bulkActionGroup &&
                prevCfg.bulkEntityTypes === this.slotConfig.bulkEntityTypes &&
                prevCfg.menuActions === this.slotConfig.menuActions &&
                typeof this.slotConfig.menuActions !== 'function'
            );
            if (!sameStaticSlot) {
                this._rebuildMenu();
            }
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
        const scopedEntityType = resolveSelectionEntityType(scopedSelected);

        if (cfg.bulkActionGroup && scopedSelected.length > 0) {
            const registry = window.ExtensionRegistry || ExtensionRegistry;
            const bulkActions = registry?.getAggregatableActions
                ? registry.getAggregatableActions(scopedSelected, { group: cfg.bulkActionGroup })
                : [];
            if (bulkActions.length > 0) {
                let currentBulkHeading = null;
                bulkActions.forEach(act => {
                    if (act.kind === 'variant-set' && Array.isArray(act.variants)) {
                        const setLabel = act.label || 'Options';
                        const sections = Array.isArray(act.sections) && act.sections.length > 0
                            ? act.sections
                            : ['Actions'];
                        sections.forEach(sec => {
                            const members = act.variants.filter(v => (v.section || 'Actions') === sec);
                            if (members.length === 0) return;
                            const secTitle = sections.length > 1 ? `${setLabel} · ${sec}` : setLabel;
                            currentBulkHeading = secTitle;
                            items.push({ sectionHeading: secTitle });
                            members.forEach(v => {
                                items.push({
                                    ...v,
                                    successLabel: v.successLabel || 'Done',
                                    confirmHoldMs: ACTION_CONFIRM_HOLD_MS,
                                    asyncAction: async (e) => {
                                        if (typeof registry?.setLastUsedVariant === 'function') {
                                            registry.setLastUsedVariant(act.entityType || scopedEntityType, act.setId, v.variantId || v.id);
                                        }
                                        if (v.asyncAction) await v.asyncAction(e);
                                        else if (v.onClick) await v.onClick(e);
                                    },
                                    onClick: null
                                });
                            });
                        });
                    } else {
                        if (currentBulkHeading !== 'Selection') {
                            currentBulkHeading = 'Selection';
                            items.push({ sectionHeading: 'Selection' });
                        }
                        items.push(act);
                    }
                });
                if (currentBulkHeading !== 'Selection') {
                    items.push({ sectionHeading: 'Selection' });
                }
            } else {
                items.push({ sectionHeading: 'Selection' });
            }
            items.push({
                label: `Clear Selection (${scopedSelected.length})`,
                icon: 'x',
                section: 'Selection',
                onClick: () => SelectionStore.getState().clearSelection()
            });
        }

        const customMenu = typeof cfg.menuActions === 'function'
            ? cfg.menuActions(cfg)
            : (Array.isArray(cfg.menuActions) ? cfg.menuActions : []);

        let activeSectionHeading = null;
        customMenu.forEach(entry => {
            if (!entry) return;
            if (entry.divider) {
                activeSectionHeading = null;
                return;
            }
            if (entry.sectionHeading) {
                activeSectionHeading = entry.sectionHeading;
                items.push(entry);
                return;
            }
            const desiredSection = entry.section || 'View';
            if (activeSectionHeading !== desiredSection) {
                activeSectionHeading = desiredSection;
                items.push({ sectionHeading: desiredSection });
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
        const extraNodes = Array.isArray(this.extraContentNodes) ? this.extraContentNodes.filter(Boolean) : [];
        const hasAnyItems = Boolean((this._menuItems && this._menuItems.length > 0) || extraNodes.length > 0);
        const count = this._selectedCount || 0;
        if (!hasAnyItems) {
            return html`
                <button type="button" class="subtab-menu-trigger" disabled title="No view actions">
                    <sutram-icon name="more-vertical" size="sm"></sutram-icon>
                </button>
            `;
        }
        return html`
            <sutram-dropdown align="left" .items=${this._menuItems}>
                <button slot="trigger" type="button" class="subtab-menu-trigger" @pointerdown=${() => this._rebuildMenu()} title="${count > 0 ? `View & Bulk Actions (${count} selected)` : 'View Menu'}">
                    ${count > 0 ? html`
                        <sutram-icon name="more-vertical" size="sm" intent="warning"></sutram-icon>
                        <span class="subtab-badge">${count > 9 ? '9+' : count}</span>
                    ` : html`
                        <sutram-icon name="more-vertical" size="sm"></sutram-icon>
                    `}
                </button>
                ${extraNodes.length > 0 ? html`
                    <div
                        slot="content"
                        class="extra-view-section"
                        @yenvui-action-confirmed=${(e) => {
                            if (e.detail?.phase === 'settled' && !e.detail?.keepDrawerOpen) {
                                const dd = this.shadowRoot?.querySelector('sutram-dropdown');
                                if (dd) dd.open = false;
                            }
                        }}>
                        <div class="extra-view-heading">View Controls</div>
                        ${extraNodes}
                    </div>
                ` : ''}
            </sutram-dropdown>
        `;
    }
}
if (!customElements.get('sutram-subtab-menu')) {
    customElements.define('sutram-subtab-menu', SutramSubtabMenu);
}

