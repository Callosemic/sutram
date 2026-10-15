// sutram/js/sdk.js
// Pure IoC Micro-Kernel & State Container Factory
import { LitElement, html } from 'lit';
import { createStore } from 'zustand/vanilla';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { getEventPath, getEventTarget } from '../../yenvui/js/physics.js';
import { shallowEqual } from './utils.js';
export function createSutramStore(name, initialState, persistenceSchema = {}, getScopeId = () => 'default', prefix = 'sutram') {
    const store = createStore(
        devtools(
            subscribeWithSelector((set, get) => ({
                ...initialState,
                resetState: () => set(initialState)
            })),
            { name: `${name}Store` }
        )
    );
    if (typeof window !== 'undefined') {
        window.Sutram = window.Sutram || {};
        window.Sutram.stores = window.Sutram.stores || {};
        window.Sutram.stores[name] = store;
    }

    const isLegacyArray = Array.isArray(persistenceSchema);
    const schema = isLegacyArray ? { localSync: persistenceSchema } : (persistenceSchema || {});
    const localKeys = schema.localSync || [];
    const sessionKeys = schema.sessionSync || [];

    if (localKeys.length > 0 || sessionKeys.length > 0 || schema.urlParser) {
        const hydrate = (scope) => {
            const hydrated = {};

            localKeys.forEach(k => {
                const storageKey = isLegacyArray ? `${prefix}_${name.toLowerCase()}_${k}_${scope}` : `${prefix}_local_${scope}_${name}_${k}`;
                const val = localStorage.getItem(storageKey);
                if (val) {
                    try { 
                        const parsed = JSON.parse(val); 
                        hydrated[k] = initialState[k] instanceof Set ? new Set(parsed) : parsed;
                    } catch(e) {}
                }
            });

            sessionKeys.forEach(k => {
                const val = sessionStorage.getItem(`${prefix}_session_${scope}_${name}_${k}`);
                if (val) {
                    try { 
                        const parsed = JSON.parse(val); 
                        hydrated[k] = initialState[k] instanceof Set ? new Set(parsed) : parsed;
                    } catch(e) {}
                }
            });

            if (typeof schema.urlParser === 'function' && typeof window !== 'undefined') {
                const urlState = schema.urlParser(window.location.hash);
                if (urlState && typeof urlState === 'object') {
                    Object.assign(hydrated, urlState);
                }
            }

            if (Object.keys(hydrated).length > 0) store.setState(hydrated);
        };
        store.hydrateStore = hydrate;
        setTimeout(() => hydrate(getScopeId()), 0);

        store.subscribe((state, prevState) => {
            const scope = getScopeId();
            localKeys.forEach(k => {
                if (state[k] !== prevState[k]) {
                    const valToSave = state[k] instanceof Set ? Array.from(state[k]) : state[k];
                    const storageKey = isLegacyArray ? `${prefix}_${name.toLowerCase()}_${k}_${scope}` : `${prefix}_local_${scope}_${name}_${k}`;
                    localStorage.setItem(storageKey, JSON.stringify(valToSave));
                }
            });
            sessionKeys.forEach(k => {
                if (state[k] !== prevState[k]) {
                    const valToSave = state[k] instanceof Set ? Array.from(state[k]) : state[k];
                    sessionStorage.setItem(`${prefix}_session_${scope}_${name}_${k}`, JSON.stringify(valToSave));
                }
            });
        });
    }

    if (typeof window !== 'undefined' && schema.onEvict) {
        window.addEventListener('sutram-evict-projection', (e) => {
            const id = e.detail?.id;
            if (id && schema.onEvict[id]) {
                const patch = typeof schema.onEvict[id] === 'function' 
                    ? schema.onEvict[id](store.getState()) 
                    : schema.onEvict[id];
                if (patch && typeof patch === 'object') {
                    store.setState(patch);
                }
            }
        });
    }

    return store;
}
export function bindStoreInput(store, statePath, currentValue, options = {}) {
    const { type = 'text', label = '', placeholder = '', style = '', id = '', selectOptions = [], min, max, onUpdate, inline = false, flush = false } = options;
    const handleInput = (e) => {
        let val = e.detail !== undefined ? e.detail.value : (type === 'checkbox' ? e.target.checked : e.target.value);
        if (type === 'number') val = parseFloat(val);
        const parts = statePath.split('.');
        if (parts.length === 1) {
            store.setState({ [parts[0]]: val });
        } else {
            const state = store.getState();
            store.setState({ [parts[0]]: { ...state[parts[0]], [parts[1]]: val } });
        }
        if (onUpdate) onUpdate(val, e);
    };
    if (type === 'textarea') {
        return html`<sutram-textarea id=${id} style=${style} .label=${label} placeholder=${placeholder} .value=${currentValue || ''} ?inline=${inline} ?flush=${flush} @sutram-input-changed=${handleInput}></sutram-textarea>`;
    } else if (type === 'select') {
        const mappedOptions = selectOptions.map(o => typeof o === 'object' ? { value: o.value !== undefined ? o.value : o.label, label: o.label || o.value } : { value: o, label: o });
        return html`<sutram-select id=${id} style=${style} .label=${label} .value=${currentValue || ''} .options=${mappedOptions} ?inline=${inline} ?flush=${flush} @sutram-input-changed=${handleInput}></sutram-select>`;
    } else if (type === 'checkbox') {
        return html`<sutram-toggle id=${id} style=${style} .label=${label} .checked=${!!currentValue} ?flush=${flush} @sutram-input-changed=${handleInput}></sutram-toggle>`;
    }
    return html`<sutram-input id=${id} type=${type} style=${style} .label=${label} placeholder=${placeholder} min=${min||''} max=${max||''} .value=${currentValue || ''} ?inline=${inline} ?flush=${flush} @sutram-input-changed=${handleInput}></sutram-input>`;
}
export const SutramContextMixin = (SuperClass) => class extends SuperClass {
    constructor() {
        super();
        this._storeUnsubs = [];
        this._managedIntervals = [];
        this._sutramManagedListeners = [];
    }

    connectedCallback() {
        if (super.connectedCallback) super.connectedCallback();
        if (typeof this.onProjectionEvicted === 'function') {
            this.registerGlobalListener('sutram-evict-projection', window, (e) => {
                this.onProjectionEvicted(e.detail?.id);
            });
        }
    }
    subscribe(storeOrName, selectorOrListener, listener = undefined, equalityFn = shallowEqual) {
        let store = storeOrName;
        if (typeof storeOrName === 'string') {
            store = window.Sutram?.stores?.[storeOrName] || 
                    window.stores?.[storeOrName];

            // Lazy Subscription: If the named store isn't on window yet, defer binding until it hydrates
            if (!store) {
                const pendingKey = storeOrName;
                let activeUnsub = () => {};
                const checkInterval = setInterval(() => {
                    const lateStore = window.Sutram?.stores?.[pendingKey];
                    if (lateStore) {
                        clearInterval(checkInterval);
                        activeUnsub = listener
                            ? lateStore.subscribe(selectorOrListener, listener, { equalityFn })
                            : lateStore.subscribe(selectorOrListener);
                        if (typeof lateStore.getState === 'function') {
                            try {
                                if (listener && typeof selectorOrListener === 'function') {
                                    listener(selectorOrListener(lateStore.getState()));
                                } else if (!listener && typeof selectorOrListener === 'function') {
                                    selectorOrListener(lateStore.getState());
                                }
                            } catch (e) {}
                        }
                    }
                }, 20);

                this._managedIntervals.push(checkInterval);
                const teardown = () => {
                    clearInterval(checkInterval);
                    activeUnsub();
                };
                this._storeUnsubs.push(teardown);
                return teardown;
            }
        }

        if (!store) {
            console.warn(`[SutramElement] Attempted to subscribe to an uninitialized store in <${this.tagName ? this.tagName.toLowerCase() : 'element'}>.`);
            return () => {};
        }
        const unsub = listener
            ? store.subscribe(selectorOrListener, listener, { equalityFn })
            : store.subscribe(selectorOrListener);
        if (!listener && typeof selectorOrListener === 'function' && typeof store.getState === 'function') {
            try { selectorOrListener(store.getState()); } catch (e) {}
        }
        this._storeUnsubs.push(unsub);
        return unsub;
    }

    registerInterval(callback, delayMs) {
        const id = setInterval(callback, delayMs);
        this._managedIntervals.push(id);
        return id;
    }
    registerGlobalListener(eventType, targetNode, callback, options = false) {
        targetNode.addEventListener(eventType, callback, options);
        this._sutramManagedListeners.push({ eventType, targetNode, callback, options });
    }

    dispatch(eventName, detail = null) {
        this.dispatchEvent(new CustomEvent(eventName, { 
            detail, 
            bubbles: true, 
            composed: true 
        }));
    }

    disconnectedCallback() {
        if (super.disconnectedCallback) super.disconnectedCallback();

        this._storeUnsubs.forEach(unsub => unsub());
        this._storeUnsubs = [];

        this._managedIntervals.forEach(id => clearInterval(id));
        this._managedIntervals = [];

        this._sutramManagedListeners.forEach(({ eventType, targetNode, callback, options }) => {
            if (targetNode && typeof targetNode.removeEventListener === 'function') {
                targetNode.removeEventListener(eventType, callback, options);
            }
        });
        this._sutramManagedListeners = [];
    }
};

export class SutramElement extends SutramContextMixin(LitElement) {
    constructor() {
        super();

        // Class-Level Error Boundary: Safely isolate subclass connectedCallback & render exceptions
        const proto = Object.getPrototypeOf(this);
        if (proto && proto.connectedCallback && !proto._isSafeConnected) {
            const origConnected = proto.connectedCallback;
            proto.connectedCallback = function(...args) {
                try {
                    origConnected.apply(this, args);
                } catch (e) {
                    console.error(`⚠️ [Component Error Boundary] <${this.tagName ? this.tagName.toLowerCase() : 'element'}> failed in connectedCallback:`, e);
                    if (window.Sutram?.stores?.Toast?.getState) {
                        window.Sutram.stores.Toast.getState().addToast(
                            `Component <${this.tagName ? this.tagName.toLowerCase() : 'element'}> error: ${e.message}`,
                            'danger'
                        );
                    }
                }
            };
            proto._isSafeConnected = true;
        }

        if (proto && proto.render && !proto._isSafeRender) {
            const origRender = proto.render;
            proto.render = function(...args) {
                try {
                    return origRender.apply(this, args);
                } catch (e) {
                    console.error(`[Component Render Boundary] <${this.tagName ? this.tagName.toLowerCase() : 'element'}> failed in render:`, e);
                    return html`<div style="padding: 10px; color: var(--intent-danger); background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; font-family: var(--font-mono); font-size: 0.8rem; display: flex; align-items: center; gap: 6px;"><yv-icon name="alert-triangle" style="width: 14px; height: 14px; flex-shrink: 0;"></yv-icon><span>Element &lt;${this.tagName ? this.tagName.toLowerCase() : 'element'}&gt; render error: ${e.message}</span></div>`;
                }
            };
            proto._isSafeRender = true;
        }
    }
    updated(changedProperties) {
        super.updated(changedProperties);
    }
    registerOutsideClick(callback) {
        const listener = (e) => {
            if (!getEventPath(e).includes(this)) {
                callback(e);
            }
        };
        this.registerGlobalListener('click', document, listener);
    }

    getEventPath(e) {
        return getEventPath(e);
    }

    getEventTarget(e, selector = null) {
        return getEventTarget(e, selector);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
}
export const ExtensionRegistry = {
    _manifests: new Map(),
    uiHooks: {},
    shortcuts: {},
    _entityActions: new Map(),
    _actionMiddlewares: [],
    _filterPredicate: null,
    tabOrder: [],
    isBooting: true,

    registerActionMiddleware: function(middlewareFn) {
        this._actionMiddlewares.push(middlewareFn);
    },

    executeEntityAction: async function(action, data, e) {
        // Execute all registered middleware sequentially
        for (const middleware of this._actionMiddlewares) {
            await middleware(action, data);
        }

        // If middleware passes without throwing, execute the target action
        if (action.asyncAction) {
            return await action.asyncAction(data, e);
        } else if (action.onClick) {
            return action.onClick(data, e);
        }
    },

    setFilterPredicate: function(fn) {
        this._filterPredicate = fn;
    },

    getExtension: function(extName) {
        return this._manifests.get(extName);
    },
    hasExtension: function(extName) {
        return this._manifests.has(extName);
    },

    resolveCustomEditor: function(filepath) {
        if (!filepath) return null;
        for (const [extName, manifest] of this._manifests.entries()) {
            if (this._filterPredicate && !this._filterPredicate(extName)) continue;
            if (Array.isArray(manifest.customEditors)) {
                for (const ed of manifest.customEditors) {
                    try {
                        if (typeof ed.match === 'function' && ed.match(filepath)) {
                            return { ...ed, extName };
                        }
                    } catch (e) {}
                }
            }
        }
        return null;
    },

    setTabOrder: function(newOrder = []) {
        if (!Array.isArray(newOrder)) return;
        this.tabOrder = newOrder;
        if (!this.isBooting) {
            this.compileLayout();
        }
    },
    getLayoutSlots: function() {
        const slots = [];
        this._manifests.forEach((manifest, extName) => {
            if (manifest.layoutSlots && Array.isArray(manifest.layoutSlots)) {
                slots.push(...manifest.layoutSlots.map(s => {
                    const slotType = (s.slot || '').startsWith('slots:') ? s.slot : 'slots:' + s.slot;

                    // Legacy Adapter: Map targetParent to spatial columns for the Strangler Fig rollout
                    let pCol = s.preferredColumn;
                    if (!pCol && s.targetParent) {
                        const t = s.targetParent.toLowerCase();
                        if (t === 'context' || t === 'library') pCol = 'left';
                        else if (t === 'edit' || t === 'ctrl') pCol = 'center';
                        else pCol = 'right';
                    }

                    const isSubNav = slotType === 'slots:sub-navigation';
                    const rawId = s.rawId || s.id || '';
                    const isUriOrCustom = rawId.includes('://') || rawId.startsWith('vfs:') || rawId.startsWith('ctx:') || rawId.startsWith('virtual:');
                    const isAlreadyScoped = rawId.startsWith(`${extName}:`);
                    const scopedId = (isSubNav && !isUriOrCustom && !isAlreadyScoped) ? `${extName}:${rawId}` : rawId;

                    let scopedTargetSub = s.targetSub;
                    if (s.targetSub && !s.targetSub.includes(':') && !s.targetSub.startsWith(`${extName}:`)) {
                        scopedTargetSub = `${extName}:${s.targetSub}`;
                    }

                    return {
                        ...s,
                        id: scopedId,
                        rawId: rawId,
                        targetSub: scopedTargetSub,
                        slot: slotType,
                        extName,
                        preferredColumn: pCol || 'center'
                    };
                }));
            }
        });

        // Fail-safe sorting: tabOrder takes priority for primary slots, numeric .order handles fallback
        const order = this.tabOrder || [];
        slots.sort((a, b) => {
            if (a.slot === 'slots:primary-navigation' && b.slot === 'slots:primary-navigation') {
                const idxA = order.indexOf(a.id);
                const idxB = order.indexOf(b.id);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
            }
            return (a.order || 99) - (b.order || 99);
        });

        return slots;
    },

    compileLayout: function() {
        window.dispatchEvent(new Event('sutram-layout-recompile'));
        window.dispatchEvent(new Event('sutram-settings-actions-updated'));
    },
    async loadBatches(batches = []) {
        this.isBooting = true;
        const bootTs = window.SUTRAM_BOOT_TS || (window.SUTRAM_BOOT_TS = Date.now());
        for (const batchUrls of batches) {
            if (!Array.isArray(batchUrls) || batchUrls.length === 0) continue;
            await Promise.all(
                batchUrls.map(url => 
                    import(/* webpackIgnore: true */ `${url}?v=${bootTs}`)
                        .catch(e => console.error(`[Sutram] Failed to load module [${url}]:`, e))
                )
            );
        }
        this.isBooting = false;
        this.compileLayout();
    },
    registerExtension: function(extName, config) {
        this._manifests.set(extName, config);

        // Clear previous registrations for this extension to prevent duplicate firing on HMR/reloads
        this._entityActions.forEach((actions, target) => {
            this._entityActions.set(target, actions.filter(a => a.extName !== extName));
        });

        Object.keys(this.uiHooks).forEach(zone => {
            this.uiHooks[zone] = this.uiHooks[zone].filter(cb => cb._extName !== extName);
        });
        if (config.entityActions) {
            config.entityActions.forEach(act => {
                act.extName = extName;
                const targets = act.targetEntities || (act.targetEntity ? [act.targetEntity] : []);
                targets.forEach(target => {
                    if (!this._entityActions.has(target)) this._entityActions.set(target, []);
                    this._entityActions.get(target).push(act);
                });
            });
        }
        if (config.uiHooks) {
            Object.entries(config.uiHooks).forEach(([zone, callback]) => {
                if (!this.uiHooks[zone]) this.uiHooks[zone] = [];
                callback._extName = extName;
                this.uiHooks[zone].push(callback);
            });
        }

        if (config.shortcuts) {
            config.shortcuts.forEach(s => {
                const id = s.id || `${extName}:${(s.label || s.key || 'shortcut').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                this.registerShortcut(s.context, s.key, s.action, { id, extName, label: s.label });
            });
        }
        console.log(`📦 Registered Declarative Extension: ${extName} v${config.version || '1.0'}`);
        window.dispatchEvent(new CustomEvent('sutram:extension-registered', { detail: { extName, config } }));
        if (!this.isBooting) {
            this.compileLayout();
        }
    },
    registerShortcut: function(context, keyCombo, callback, meta = {}) {
        if (!this.shortcuts[context]) this.shortcuts[context] = {};
        const key = keyCombo.toLowerCase();
        this.shortcuts[context][key] = callback;
        if (meta.id) {
            this._shortcutMeta = this._shortcutMeta || new Map();
            this._shortcutMeta.set(meta.id, { context, key, extName: meta.extName, label: meta.label });
        }
    },

    registerUIHook: function(zone, callback) {
        if (!this.uiHooks[zone]) this.uiHooks[zone] = [];
        this.uiHooks[zone].push(callback);
    },
    getEntityActions: function(compoundType, data) {
        if (!compoundType) return [];
        const types = compoundType.split(':');
        if (!types.includes(compoundType)) types.push(compoundType);
        const combined = [];
        const seen = new Set();
        types.forEach(type => {
            if (this._entityActions.has(type)) {
                this._entityActions.get(type).forEach(act => {
                    if (!act.bulkOnly && !seen.has(act.id)) {
                        seen.add(act.id);
                        combined.push(act);
                    }
                });
            }
        });
        return combined
            .filter(act => {
                // 1. Enforce Whitelist (showOnly)
                if (data?.showOnly && Array.isArray(data.showOnly)) {
                    if (!data.showOnly.includes(act.id)) return false;
                }

                // 2. Enforce Blacklist (suppress)
                if (data?.suppress && Array.isArray(data.suppress)) {
                    if (data.suppress.includes(act.id)) return false;
                }

                // 3. Evaluate the component's native domain logic
                return !act.match || act.match(data);
            })
            .sort((a, b) => (a.order || 99) - (b.order || 99));
    },
    getAggregatableActions: function(selectedItems, options = {}) {
        if (!selectedItems) return [];
        const items = Array.isArray(selectedItems) ? selectedItems : Array.from(selectedItems.values());
        if (items.length === 0) return [];

        const { group = null } = options;
        const candidateGroups = new Map();

        const registerCandidate = (act) => {
            if (!act.bulkable) return;
            if (group && act.group !== group) return;
            const dedupeKey = act.bulkGroupKey || act.id;
            if (!candidateGroups.has(dedupeKey)) {
                candidateGroups.set(dedupeKey, []);
            }
            const groupList = candidateGroups.get(dedupeKey);
            if (!groupList.some(a => a.id === act.id)) {
                groupList.push(act);
            }
        };

        items.forEach(item => {
            const types = (item.entityType || '').split(':');
            types.forEach(t => {
                if (this._entityActions.has(t)) {
                    this._entityActions.get(t).forEach(registerCandidate);
                }
            });
        });

        if (this._entityActions.has('*')) {
            this._entityActions.get('*').forEach(registerCandidate);
        }

        const aggregated = [];
        candidateGroups.forEach((groupActions, dedupeKey) => {
            const leadAction = groupActions.find(a => typeof a.bulkAction === 'function' || typeof a.bulkOnClick === 'function') || groupActions[0];
            if (this._filterPredicate && leadAction.extName && !this._filterPredicate(leadAction.extName)) {
                return;
            }
            const allMatch = items.every(item => {
                const types = (item.entityType || '').split(':');
                return groupActions.some(act => {
                    const targetMatches = types.some(t => {
                        if (act.targetEntities && (act.targetEntities.includes(t) || act.targetEntities.includes('*'))) return true;
                        if (act.targetEntity && (act.targetEntity.split(':').includes(t) || act.targetEntity === '*')) return true;
                        return false;
                    });
                    if (!targetMatches) return false;
                    return typeof act.match === 'function' ? act.match(item.data) : true;
                });
            });

            if (allMatch) {
                const count = items.length;
                const baseLabel = typeof leadAction.label === 'function' ? leadAction.label(items[0]?.data) : leadAction.label;
                const dynamicLabel = typeof leadAction.bulkLabel === 'function' 
                    ? leadAction.bulkLabel(items) 
                    : (leadAction.bulkLabel || `${baseLabel} (${count})`);

                const isVfsBound = groupActions.some(a => a.vfsBound);
                const hasSyncClick = typeof leadAction.bulkOnClick === 'function';

                aggregated.push({
                    id: `bulk-${dedupeKey}`,
                    label: dynamicLabel,
                    icon: typeof leadAction.icon === 'function' ? leadAction.icon(items[0]?.data) : (leadAction.icon || ''),
                    intent: typeof leadAction.intent === 'function' ? leadAction.intent(items[0]?.data) : (leadAction.intent || 'primary'),
                    variant: leadAction.variant || 'tinted',
                    emphasis: !!leadAction.emphasis,
                    group: leadAction.group || 'file',
                    order: leadAction.order || 50,
                    vfsBound: isVfsBound,
                    onClick: hasSyncClick ? (e) => leadAction.bulkOnClick(items, e) : null,
                    asyncAction: hasSyncClick ? null : async (e) => {
                        const executeDirect = async () => {
                            if (typeof leadAction.bulkAction === 'function') {
                                return await leadAction.bulkAction(items, e);
                            }
                            for (const item of items) {
                                const types = (item.entityType || '').split(':');
                                const handler = groupActions.find(act => {
                                    return types.some(t => (act.targetEntities && (act.targetEntities.includes(t) || act.targetEntities.includes('*'))) || (act.targetEntity && (act.targetEntity.split(':').includes(t) || act.targetEntity === '*')));
                                }) || leadAction;

                                if (typeof handler.asyncAction === 'function') {
                                    await handler.asyncAction(item.data, e);
                                } else if (typeof handler.onClick === 'function') {
                                    handler.onClick(item.data, e);
                                }
                            }
                        };

                        if (isVfsBound && typeof this.executeEntityAction === 'function') {
                            const syntheticPayload = items.map(i => i.data);
                            return await this.executeEntityAction({ ...leadAction, vfsBound: true, asyncAction: executeDirect }, syntheticPayload, e);
                        }
                        return await executeDirect();
                    }
                });
            }
        });

        return aggregated.sort((a, b) => (a.order || 99) - (b.order || 99));
    },
    executeUIHook: function(zone, data) {
        if (this.uiHooks[zone]) {
            for (let cb of this.uiHooks[zone]) {
                if (this._filterPredicate && cb._extName && !this._filterPredicate(cb._extName)) {
                    continue; // Auto-suppress hook execution if disabled by host predicate
                }
                try {
                    const res = cb(data);
                    if (res) return res;
                } catch (e) {
                    console.error(`[Sutram Event Bus] Error executing UI hook for zone '${zone}':`, e);
                }
            }
        }
        return null;
    },

    _settingsActions: [],
    registerSettingsAction: function(id, label, icon, callback, section = 'Extensions') {
        this._settingsActions = this._settingsActions.filter(a => a.id !== id);
        this._settingsActions.push({ id, label, icon, callback, section });
        window.dispatchEvent(new Event('sutram-settings-actions-updated'));
    },

    _unloadHooks: new Map(),
    _ticks: new Map(),

    registerUnloadHook: function(extName, callback) {
        this._unloadHooks.set(extName, callback);
    },

    registerTick: function(extName, intervalMs, callback) {
        if (!this._ticks.has(extName)) this._ticks.set(extName, []);
        this._ticks.get(extName).push({ interval: intervalMs, lastRun: Date.now(), cb: callback });
    },
    executeUnload: function(extName) {
        if (this._unloadHooks.has(extName)) {
            try { this._unloadHooks.get(extName)(); } catch (e) { console.error(`Error unloading extension [${extName}]:`, e); }
            this._unloadHooks.delete(extName);
        }
        if (this._ticks.has(extName)) this._ticks.delete(extName);
    },
    startMetronome: function(getActiveExtensions = null, coreExtensions = []) {
        if (this._metronomeId) clearTimeout(this._metronomeId);

        const tick = () => {
            const now = Date.now();
            this._ticks.forEach((tasks, extName) => {
                // Guardrail: Statelessly evaluate host application topology
                const activeExts = getActiveExtensions ? getActiveExtensions() : null;
                const isCore = coreExtensions.includes(extName);

                if (!isCore && activeExts && !activeExts.includes(extName)) {
                    return;
                }

                tasks.forEach(task => {
                    if (now - task.lastRun >= task.interval) {
                        task.lastRun = now;
                        try { 
                            task.cb(); 
                        } catch (e) { 
                            console.error(`Tick error in extension [${extName}]:`, e); 
                        }
                    }
                });
            });

            // Phase 4: Metronome Backoff (Visibility API)
            // Hibernate to 60s when backgrounded to preserve mobile battery
            const nextTick = document.hidden ? 60000 : 100;
            this._metronomeId = setTimeout(tick, nextTick);
        };

        if (!this._visibilityListenerAdded) {
            document.addEventListener("visibilitychange", () => {
                if (!document.hidden) {
                    clearTimeout(this._metronomeId);
                    tick(); // Instantly wake and force tick upon refocus
                }
            });
            this._visibilityListenerAdded = true;
        }

        this._metronomeId = setTimeout(tick, 100);
    }
};

export const StatusStore = createSutramStore('Status', {
message: '',
isError: false,
timeoutId: null,
setStatus: (msg, timeout = 3000, isError = false) => {
    const currentTimeout = StatusStore.getState().timeoutId;
    if (currentTimeout) clearTimeout(currentTimeout); // utils.debounce whitelist

    let newTimeoutId = null;
    if (timeout) {
        newTimeoutId = setTimeout(() => {
            StatusStore.setState({ message: '', isError: false, timeoutId: null });
        }, timeout);
    }
    StatusStore.setState({ message: msg, isError, timeoutId: newTimeoutId });
}
});

export const ToastStore = createSutramStore('Toast', {
toasts: [],
addToast: (message, intent = 'danger', duration = 6000) => {
    const id = `toast_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const state = ToastStore.getState();
    if (state.toasts.some(t => t.message === message)) return;
    ToastStore.setState({ toasts: [...state.toasts, { id, message, intent }] });
    setTimeout(() => {
        ToastStore.setState(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, duration);
},
removeToast: (id) => ToastStore.setState(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
});
export const SelectionStore = createSutramStore('Selection', {
selectedItems: new Map(),
toggleSelection: (id, entityType, data) => {
    const newMap = new Map(SelectionStore.getState().selectedItems);
    if (newMap.has(id)) newMap.delete(id);
    else newMap.set(id, { entityType, data });
    SelectionStore.setState({ selectedItems: newMap });
},
clearSelection: () => SelectionStore.setState({ selectedItems: new Map() })
});
export const EnvironmentStore = createSutramStore('Environment', {
    isOffline: false
});
export const LayoutStore = createSutramStore('Layout', {
    columns: {
        left: { active: null, pinned: [], history: [] },
        center: { active: null, pinned: [], history: [] },
        right: { active: null, pinned: [], history: [] }
    },
    focusHistory: [], // Global MRU stack of { col, id }
    focusedColumn: 'center',
    mobileViewportIndex: 1, // 0 = left, 1 = center, 2 = right
    capacity: 3, // 1, 2, or 3 columns
    layoutRatios: null, // e.g., [1, 2, 1]
    windows: [],
    setLayoutRatios: (ratios) => LayoutStore.setState({ layoutRatios: ratios }),
    openWindow: (entity, anchorCol = 'center', span = 1) => LayoutStore.setState((state) => {
        const { capacity, focusedColumn, mobileViewportIndex } = state;
        let visibleCols = ['left', 'center', 'right'];
        if (capacity === 1) {
            const colMap = ['left', 'center', 'right'];
            visibleCols = [colMap[mobileViewportIndex] || focusedColumn || 'center'];
        } else if (capacity === 2) {
            visibleCols = ['left', 'center'];
        }

        let safeAnchor = anchorCol;
        let safeSpan = Math.min(span, capacity);
        if (!visibleCols.includes(safeAnchor)) {
            safeAnchor = visibleCols[0];
        }
        if (capacity === 2 && safeSpan === 2 && safeAnchor === 'right') {
            safeAnchor = 'left';
        }
        const existing = state.windows.find(w => w.id === entity.id);
        return {
            windows: [
                ...state.windows.filter(w => w.id !== entity.id),
                { ...(existing || {}), ...entity, anchorCol: existing ? existing.anchorCol : safeAnchor, span: existing ? existing.span : safeSpan, z: Date.now() }
            ]
        };
    }),
    closeWindow: (id) => {
        LayoutStore.setState((state) => {
            const nextWindows = state.windows.filter(w => w.id !== id);
            const nextGlobalHistory = (state.focusHistory || []).filter(h => h.id !== id);
            return {
                windows: nextWindows,
                focusHistory: nextGlobalHistory
            };
        });
        const st = LayoutStore.getState();
        const lastFocus = (st.focusHistory || [])[st.focusHistory.length - 1];
        if (lastFocus && st.columns[lastFocus.col]?.pinned?.some(p => p.id === lastFocus.id)) {
            st.setActiveProjection(lastFocus.col, lastFocus.id);
            st.setFocusedColumn(lastFocus.col);
        }
        LayoutStore.getState().evictProjection(id);
    },
    updateWindowConstraints: (id, anchorCol, span) => LayoutStore.setState((state) => ({
        windows: state.windows.map(w => w.id === id ? { ...w, anchorCol, span, z: Date.now() } : w)
    })),
    enforceWindowBounds: () => LayoutStore.setState((state) => {
        const { capacity, focusedColumn, mobileViewportIndex } = state;
        let visibleCols = ['left', 'center', 'right'];
        if (capacity === 1) {
            const colMap = ['left', 'center', 'right'];
            visibleCols = [colMap[mobileViewportIndex] || focusedColumn || 'center'];
        } else if (capacity === 2) {
            visibleCols = ['left', 'center'];
        }

        const newWindows = state.windows.map(w => {
            let newAnchor = w.anchorCol || 'center';
            let newSpan = Math.min(w.span || 1, capacity);

            if (!visibleCols.includes(newAnchor)) {
                if (newAnchor === 'left' && !visibleCols.includes('left')) newAnchor = visibleCols[0];
                if (newAnchor === 'right' && !visibleCols.includes('right')) newAnchor = visibleCols[visibleCols.length - 1];
                if (newAnchor === 'center') newAnchor = visibleCols[0];
            }

            if (capacity === 2 && newSpan === 2 && newAnchor === 'right') {
                newAnchor = 'left';
            }

            return { ...w, anchorCol: newAnchor, span: newSpan };
        });

        return { windows: newWindows };
    }),
    focusWindow: (id) => LayoutStore.setState((state) => ({
        windows: state.windows.map(w => w.id === id ? { ...w, z: Date.now() } : w)
    })),

    pinToColumn: (column, entity) => LayoutStore.setState((state) => ({
        columns: { 
            ...state.columns, 
            [column]: { ...state.columns[column], pinned: [...state.columns[column].pinned, entity] } 
        }
    })),
    unpinFromColumn: (column, entityId) => {
        let targetReturnCol = column;
        LayoutStore.setState((state) => {
            const colState = state.columns[column] || { pinned: [], history: [], active: null };
            const newPinned = (colState.pinned || []).filter(e => e.id !== entityId);
            const newColHistory = (colState.history || []).filter(id => id !== entityId && newPinned.some(p => p.id === id));
            const newGlobalHistory = (state.focusHistory || []).filter(h => !(h.col === column && h.id === entityId));

            let newActive = colState.active;
            if (colState.active === entityId) {
                newActive = newColHistory.length > 0
                    ? newColHistory[newColHistory.length - 1]
                    : (newPinned.length > 0 ? newPinned[newPinned.length - 1].id : null);
            }

            const nextColumns = {
                ...state.columns,
                [column]: {
                    ...colState,
                    pinned: newPinned,
                    history: newColHistory,
                    active: newActive
                }
            };

            // Determine if global focus should return to a prior projection (in this column or another column)
            const lastGlobal = newGlobalHistory.length > 0 ? newGlobalHistory[newGlobalHistory.length - 1] : null;
            if (lastGlobal && nextColumns[lastGlobal.col]?.pinned?.some(p => p.id === lastGlobal.id)) {
                targetReturnCol = lastGlobal.col;
                nextColumns[lastGlobal.col] = {
                    ...nextColumns[lastGlobal.col],
                    active: lastGlobal.id
                };
            } else if (!newActive) {
                const fallbackCol = ['center', 'left', 'right'].find(c => nextColumns[c]?.pinned?.length > 0);
                if (fallbackCol) targetReturnCol = fallbackCol;
            }

            return {
                columns: nextColumns,
                focusHistory: newGlobalHistory
            };
        });
        if (targetReturnCol) {
            LayoutStore.getState().setFocusedColumn(targetReturnCol);
        }
    },
    setActiveProjection: (col, id) => LayoutStore.setState((state) => {
        const colState = state.columns[col] || { pinned: [], history: [], active: null };
        const nextColHistory = [...(colState.history || []).filter(x => x !== id), id].slice(-30);
        const nextGlobalHistory = id
            ? [...(state.focusHistory || []).filter(h => !(h.col === col && h.id === id)), { col, id }].slice(-50)
            : (state.focusHistory || []);
        return {
            columns: {
                ...state.columns,
                [col]: { ...colState, active: id, history: nextColHistory }
            },
            focusHistory: nextGlobalHistory
        };
    }),
    setFocusedColumn: (col) => {
        LayoutStore.setState(state => {
            if (state.columns[col] && (!state.columns[col].pinned || state.columns[col].pinned.length === 0)) return {};

            const colMap = { 'left': 0, 'center': 1, 'right': 2 };
            const targetIdx = colMap[col] !== undefined ? colMap[col] : 1;
            const layout = state.layoutRatios || [1, 1, 1];
            const maxIdx = Math.max(0, layout.length - state.capacity);

            let newViewport = state.mobileViewportIndex;
            if (targetIdx < newViewport) {
                newViewport = targetIdx;
            } else if (targetIdx >= newViewport + state.capacity) {
                newViewport = targetIdx - state.capacity + 1;
            }

            const activeId = state.columns[col]?.active;
            const nextGlobalHistory = activeId
                ? [...(state.focusHistory || []).filter(h => !(h.col === col && h.id === activeId)), { col, id: activeId }].slice(-50)
                : (state.focusHistory || []);

            return { 
                focusedColumn: col, 
                mobileViewportIndex: Math.max(0, Math.min(newViewport, maxIdx)),
                focusHistory: nextGlobalHistory
            };
        });
        LayoutStore.getState().enforceWindowBounds();
    },
    setMobileViewport: (index) => {
        LayoutStore.setState({ mobileViewportIndex: index });
        LayoutStore.getState().enforceWindowBounds();
    },
    setCapacity: (cap) => {
        LayoutStore.setState({ capacity: cap });
        LayoutStore.getState().enforceWindowBounds();
    },
    evictProjection: (id) => {
        // Defer eviction broadcast to the microtask queue so synchronous callers of closeWindow()
        // finish reading component/store state before teardown listeners reset store fields.
        if (typeof window !== 'undefined') {
            queueMicrotask(() => {
                window.dispatchEvent(new CustomEvent('sutram-evict-projection', { detail: { id }, bubbles: true, composed: true }));
            });
        }
    }
}, {
    sessionSync: ['columns', 'focusHistory', 'capacity', 'mobileViewportIndex', 'windows', 'layoutRatios'],
    localSync: ['columns', 'focusHistory', 'layoutRatios']
});