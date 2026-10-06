// sutram/js/sdk.js
// Pure IoC Micro-Kernel & State Container Factory
import { LitElement, html } from 'lit';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';
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
let globalSutramThemeObserver = null;
const sutramThemeSubscribers = new Set();

function subscribeSutramToTheme(element) {
    sutramThemeSubscribers.add(element);
    element.setAttribute('data-theme', document.body.getAttribute('data-theme') || 'dark');
    if (!globalSutramThemeObserver) {
        globalSutramThemeObserver = new MutationObserver(() => {
            const theme = document.body.getAttribute('data-theme') || 'dark';
            sutramThemeSubscribers.forEach(el => el.setAttribute('data-theme', theme));
        });
        globalSutramThemeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    }
}
export const SutramContextMixin = (SuperClass) => class extends SuperClass {
    constructor() {
        super();
        this._storeUnsubs = [];
        this._managedIntervals = [];
        this._managedListeners = [];
    }

    subscribe(storeOrName, selectorOrListener, listener = undefined) {
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
                        activeUnsub = listener ? lateStore.subscribe(selectorOrListener, listener) : lateStore.subscribe(selectorOrListener);
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
        const unsub = listener ? store.subscribe(selectorOrListener, listener) : store.subscribe(selectorOrListener);
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
        this._managedListeners.push({ eventType, targetNode, callback, options });
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

        this._managedListeners.forEach(({ eventType, targetNode, callback, options }) => {
            targetNode.removeEventListener(eventType, callback, options);
        });
        this._managedListeners = [];
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
                    console.error(`⚠️ [Component Render Boundary] <${this.tagName ? this.tagName.toLowerCase() : 'element'}> failed in render:`, e);
                    return html`<div style="padding: 10px; color: var(--intent-danger); background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; font-family: var(--font-mono); font-size: 0.8rem;">⚠️ Element &lt;${this.tagName ? this.tagName.toLowerCase() : 'element'}&gt; render error: ${e.message}</div>`;
                }
            };
            proto._isSafeRender = true;
        }
    }
    observeTheme() {
        subscribeSutramToTheme(this);
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: this.shadowRoot });
        }
    }
    registerOutsideClick(callback) {
        const listener = (e) => {
            if (!e.composedPath().includes(this)) {
                callback(e);
            }
        };
        this.registerGlobalListener('click', document, listener);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        sutramThemeSubscribers.delete(this);
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

                    return { ...s, slot: slotType, extName, preferredColumn: pCol || 'center' };
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
                const target = act.targetEntity;
                if (!this._entityActions.has(target)) this._entityActions.set(target, []);
                this._entityActions.get(target).push(act);
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
        const combined = [];
        types.forEach(type => {
            if (this._entityActions.has(type)) {
                combined.push(...this._entityActions.get(type));
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
        left: { active: null, pinned: [] },
        center: { active: null, pinned: [] },
        right: { active: null, pinned: [] }
    },
    focusedColumn: 'center',
    mobileViewportIndex: 1, // 0 = left, 1 = center, 2 = right
    capacity: 3, // 1, 2, or 3 columns
    windows: [],
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

        return {
            windows: [...state.windows.filter(w => w.id !== entity.id), { ...entity, anchorCol: safeAnchor, span: safeSpan, z: Date.now() }]
        };
    }),
    closeWindow: (id) => {
        LayoutStore.setState((state) => ({
            windows: state.windows.filter(w => w.id !== id)
        }));
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
    unpinFromColumn: (column, entityId) => LayoutStore.setState((state) => ({
        columns: { 
            ...state.columns, 
            [column]: { 
                ...state.columns[column], 
                pinned: state.columns[column].pinned.filter(e => e.id !== entityId),
                active: state.columns[column].active === entityId ? null : state.columns[column].active
            } 
        }
    })),
    setActiveProjection: (col, id) => LayoutStore.setState((state) => ({
        columns: {
            ...state.columns,
            [col]: { ...state.columns[col], active: id }
        }
    })),
    setFocusedColumn: (col) => {
        LayoutStore.setState(state => {
            // Guard: Prevent navigating into empty spatial columns
            if (state.columns[col] && (!state.columns[col].pinned || state.columns[col].pinned.length === 0)) {
                return {};
            }

            const colMap = { 'left': 0, 'center': 1, 'right': 2 };
            const targetIdx = colMap[col] !== undefined ? colMap[col] : 1;
            let newViewport = state.mobileViewportIndex;
            if (state.capacity === 1) {
                newViewport = targetIdx;
            } else if (state.capacity === 2) {
                newViewport = 1;
            }

            return { focusedColumn: col, mobileViewportIndex: newViewport };
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
        // Dispatch a global intent so the shell and domain stores can perform surgical garbage collection
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sutram-evict-projection', { detail: { id }, bubbles: true, composed: true }));
        }
    }
}, {
    sessionSync: ['columns', 'capacity', 'mobileViewportIndex', 'windows'],
    localSync: ['columns']
});