// sutram/js/app_shell.js (Compiled Vendor Artifact)
import { html, css } from 'lit';
import { SutramElement, ExtensionRegistry } from './sdk.js';
import '../../yenvui/js/tabs.js';

export class SutramAppShell extends SutramElement {
    static properties = {
        activeTab: { type: String },
        activeSubTabs: { type: Object },
        _layoutConfig: { type: Array }
    };

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100dvh;
            width: 100vw;
            overflow: hidden;
            background: var(--bg);
        }
        .shell-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            position: relative;
        }
        .nested-tab-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
            background: var(--bg);
        }
    `;

    constructor() {
        super();
        this.activeTab = '';
        this.activeSubTabs = {};
        this._layoutConfig = [];
        this._componentCache = new Map();
    }

    connectedCallback() {
        super.connectedCallback();
        this.registerGlobalListener('sutram-layout-recompile', window, () => this._compileLayout());
        this.registerGlobalListener('sutram-route-changed', window, (e) => {
            this.activeTab = e.detail.tab;
            this.activeSubTabs = e.detail.subTabs;
        });
        this._compileLayout();
    }

    _compileLayout() {
        const registry = window.ExtensionRegistry || ExtensionRegistry;
        const slots = typeof registry.getLayoutSlots === 'function' ? registry.getLayoutSlots() : [];

        // Deduplicate primary tabs so redeclarations become one
        const primarySlotsMap = new Map();
        const finalSlots = [];

        slots.forEach(s => {
            if (s.slot === 'slots:primary-navigation') {
                const normId = (s.id || '').toLowerCase();
                if (!normId) return;
                
                if (!primarySlotsMap.has(normId)) {
                    primarySlotsMap.set(normId, s);
                } else {
                    // Preserve the lowest order for the merged tab
                    const existing = primarySlotsMap.get(normId);
                    if ((s.order || 99) < (existing.order || 99)) {
                        existing.order = s.order;
                        existing.label = s.label; 
                    }
                }
            } else {
                finalSlots.push(s);
            }
        });

        // Auto-infer missing primary tabs from sub-navigation targets to maintain loose coupling
        finalSlots.filter(s => s.slot === 'slots:sub-navigation').forEach(s => {
            if (s.targetParent) {
                const normId = s.targetParent.toLowerCase();
                if (!primarySlotsMap.has(normId)) {
                    primarySlotsMap.set(normId, {
                        slot: 'slots:primary-navigation',
                        id: normId,
                        label: s.targetParent.charAt(0).toUpperCase() + s.targetParent.slice(1),
                        order: 50
                    });
                }
            }
        });

        finalSlots.push(...primarySlotsMap.values());

        const tabOrder = registry.tabOrder || [];
        this._layoutConfig = finalSlots.sort((a, b) => {
            // Ensure transitive sorting by isolating primary-navigation evaluation
            if (a.slot === 'slots:primary-navigation' && b.slot === 'slots:primary-navigation') {
                let idxA = tabOrder.findIndex(t => t.toLowerCase() === (a.id || '').toLowerCase());
                let idxB = tabOrder.findIndex(t => t.toLowerCase() === (b.id || '').toLowerCase());
                if (idxA === -1) idxA = 999;
                if (idxB === -1) idxB = 999;
                if (idxA !== idxB) return idxA - idxB;
                return (a.order || 99) - (b.order || 99);
            }
            if (a.slot === 'slots:primary-navigation') return -1;
            if (b.slot === 'slots:primary-navigation') return 1;
            return (a.order || 99) - (b.order || 99);
        });

        this.requestUpdate();
    }

    _getCachedComponent(componentTag, subId = null) {
        if (!componentTag) return '';
        const cacheKey = componentTag + (subId ? '-' + subId : '');
        if (!this._componentCache.has(cacheKey)) {
            try {
                const el = document.createElement(componentTag);
                if (subId) el.dataset.subId = subId;

                // Component-Level Safety Boundary: Catch unhandled connectedCallback errors
                const originalConnected = el.connectedCallback;
                if (originalConnected && typeof originalConnected === 'function') {
                    el.connectedCallback = function(...args) {
                        try {
                            originalConnected.apply(this, args);
                        } catch (err) {
                            console.error(`[Sutram Error Boundary] Extension component <${componentTag}> failed during connectedCallback:`, err);
                            this.innerHTML = `<div style="padding: 15px; background: var(--input-bg); border: 1px solid var(--intent-danger); border-radius: 4px; color: var(--intent-danger); font-family: var(--font-mono); font-size: 0.85rem;">⚠️ Extension Component &lt;${componentTag}&gt; failed to mount. Check console for details.</div>`;
                        }
                    };
                }

                this._componentCache.set(cacheKey, el);
            } catch (e) {
                console.error(`[SutramAppShell] Failed to create component <${componentTag}>:`, e);
                const fallback = document.createElement('div');
                fallback.style.cssText = "padding: 15px; color: var(--intent-danger); font-family: monospace;";
                fallback.innerText = `⚠️ Failed to initialize <${componentTag}>`;
                return fallback;
            }
        }
        return this._componentCache.get(cacheKey);
    }

    _handleTabClick(tabId) {
        const isAlreadyActive = this.activeTab === tabId;
        this.dispatchEvent(new CustomEvent('shell-tab-changed', { detail: { tabId, isAlreadyActive }, bubbles: true, composed: true }));
    }

    _handleSubTabClick(tabId, subId) {
        const isAlreadyActive = this.activeSubTabs[tabId] === subId;
        this.dispatchEvent(new CustomEvent('shell-subtab-changed', { detail: { tabId, subId, isAlreadyActive }, bubbles: true, composed: true }));
    }

    render() {
        // Compile navigation and views strictly from the Extension Registry
        const primarySlots = this._layoutConfig.filter(s => s.slot === 'slots:primary-navigation');
        const globalSlots = this._layoutConfig.filter(s => s.slot === 'slots:global');
        
        return html`
            <div class="shell-container">
                <yenvui-tabs 
                    .tabs=${primarySlots} 
                    .activeTab=${this.activeTab} 
                    ?cacheViews=${true}
                    @yenvui-tab-selected=${(e) => { e.stopPropagation(); this._handleTabClick(e.detail.tabId); }}>
                    
                    <slot name="header-actions" slot="header-actions"></slot>

                    ${primarySlots.map(slot => {
                        // Extract sub-navigation specific to the active primary tab using case-insensitive bounds
                        const subSlots = this._layoutConfig.filter(s => s.slot === 'slots:sub-navigation' && (s.targetParent || '').toLowerCase() === (slot.id || '').toLowerCase());
                        const activeSub = this.activeSubTabs[slot.id] || (subSlots.length > 0 ? subSlots[0].id : null);
                        
                        return html`
                            <div slot="${slot.id}" style="display: flex; flex-direction: column; flex: 1; height: 100%; min-height: 0;">
                                ${subSlots.length > 0 ? html`
                                    <yenvui-tabs 
                                        variant="sub"
                                        ?cacheViews=${true}
                                        .tabs=${subSlots}
                                        .activeTab=${activeSub}
                                        @yenvui-tab-selected=${(e) => { e.stopPropagation(); this._handleSubTabClick(slot.id, e.detail.tabId); }}>
                                        <div slot="header-actions" style="display: flex; gap: 8px; align-items: center;">
                                            ${this._layoutConfig.filter(s => s.slot === 'slots:sub-navigation-actions' && (s.targetParent || '').toLowerCase() === (slot.id || '').toLowerCase() && s.targetSub === activeSub).map(act => html`<div style="display: contents;" data-ext="${act.extName}">${this._getCachedComponent(act.component, activeSub)}</div>`)}
                                        </div>

                                        ${subSlots.map(subSlot => html`
                                            <div slot="${subSlot.id}" style="display: contents;" data-ext="${subSlot.extName}">
                                                ${this._getCachedComponent(subSlot.component, subSlot.id)}
                                            </div>
                                        `)}
                                    </yenvui-tabs>
                                ` : html`
                                    <div class="nested-tab-container" style="padding: 20px; color: var(--text-muted); font-style: italic;">
                                        No extensions mapped to this workspace partition.
                                    </div>
                                `}
                            </div>
                        `;
                    })}
                </yenvui-tabs>
            </div>
            <div style="display: contents;">
                ${globalSlots.map(s => this._getCachedComponent(s.component))}
            </div>
        `;
    }
}

customElements.define('sutram-app-shell', SutramAppShell);