// sutram/js/sdk.js
// Pure IoC Micro-Kernel & State Container Factory
import { LitElement, html } from 'lit';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';
export function createSutramStore(name, initialState, persistKeys = [], getScopeId = () => 'default', prefix = 'sutram') {
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
        window.inSetu = window.inSetu || {};
        window.inSetu.stores = window.inSetu.stores || {};
        window.inSetu.stores[name] = store;

        window.Sutram = window.Sutram || {};
        window.Sutram.stores = window.Sutram.stores || {};
        window.Sutram.stores[name] = store;
    }

    if (persistKeys && persistKeys.length > 0) {
        const hydrate = (scope) => {
            const hydrated = {};
            persistKeys.forEach(k => {
                const val = localStorage.getItem(`${prefix}_${name.toLowerCase()}_${k}_${scope}`);
                if (val) {
                    try { 
                        const parsed = JSON.parse(val); 
                        hydrated[k] = initialState[k] instanceof Set ? new Set(parsed) : parsed;
                    } catch(e) {}
                }
            });
            if (Object.keys(hydrated).length > 0) store.setState(hydrated);
        };

        // Defer hydration to allow downstream consumers to set up their scope
        setTimeout(() => hydrate(getScopeId()), 0);

        store.subscribe((state, prevState) => {
            const scope = getScopeId();
            persistKeys.forEach(k => {
                if (state[k] !== prevState[k]) {
                    const valToSave = state[k] instanceof Set ? Array.from(state[k]) : state[k];
                    localStorage.setItem(`${prefix}_${name.toLowerCase()}_${k}_${scope}`, JSON.stringify(valToSave));
                }
            });
        });
    }

    return store;
}
export function bindStoreInput(store, statePath, currentValue, options = {}) {
    const { type = 'text', label = '', placeholder = '', style = '', id = '', selectOptions = [], min, max, onUpdate, inline = false } = options;
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
        return html`<sutram-textarea id=${id} style=${style} .label=${label} placeholder=${placeholder} .value=${currentValue || ''} ?inline=${inline} @sutram-input-changed=${handleInput}></sutram-textarea>`;
    } else if (type === 'select') {
        const mappedOptions = selectOptions.map(o => typeof o === 'object' ? { value: o.value !== undefined ? o.value : o.label, label: o.label || o.value } : { value: o, label: o });
        return html`<sutram-select id=${id} style=${style} .label=${label} .value=${currentValue || ''} .options=${mappedOptions} ?inline=${inline} @sutram-input-changed=${handleInput}></sutram-select>`;
    } else if (type === 'checkbox') {
        return html`<sutram-toggle id=${id} style=${style} .label=${label} .checked=${!!currentValue} @sutram-input-changed=${handleInput}></sutram-toggle>`;
    }
    return html`<sutram-input id=${id} type=${type} style=${style} .label=${label} placeholder=${placeholder} min=${min||''} max=${max||''} .value=${currentValue || ''} ?inline=${inline} @sutram-input-changed=${handleInput}></sutram-input>`;
}

export class SutramElement extends LitElement {
    constructor() {
        super();
        this._storeUnsubs = [];
        this._managedIntervals = [];
        this._managedListeners = [];

        // Class-Level Error Boundary: Safely isolate subclass connectedCallback & render exceptions
        const proto = Object.getPrototypeOf(this);
        if (proto && proto.connectedCallback && !proto._isSafeConnected) {
            const origConnected = proto.connectedCallback;
            proto.connectedCallback = function(...args) {
                try {
                    origConnected.apply(this, args);
                } catch (e) {
                    console.error(`⚠️ [Component Error Boundary] <${this.tagName ? this.tagName.toLowerCase() : 'element'}> failed in connectedCallback:`, e);
                    if (window.inSetu?.stores?.Toast?.getState) {
                        window.inSetu.stores.Toast.getState().addToast(
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
    subscribe(storeOrName, selectorOrListener, listener = undefined) {
        let store = storeOrName;
        if (typeof storeOrName === 'string') {
            store = window.inSetu?.stores?.[storeOrName] || 
                    window.Sutram?.stores?.[storeOrName] || 
                    window.stores?.[storeOrName];

            // Lazy Subscription: If the named store isn't on window yet, defer binding until it hydrates
            if (!store) {
                const pendingKey = storeOrName;
                let activeUnsub = () => {};
                const checkInterval = setInterval(() => {
                    const lateStore = window.inSetu?.stores?.[pendingKey] || window.Sutram?.stores?.[pendingKey];
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
        super.disconnectedCallback();
        
        // Memory safety: automated teardown of all subscriptions and listeners
        this._storeUnsubs.forEach(unsub => unsub());
        this._storeUnsubs = [];

        this._managedIntervals.forEach(id => clearInterval(id));
        this._managedIntervals = [];

        this._managedListeners.forEach(({ eventType, targetNode, callback, options }) => {
            targetNode.removeEventListener(eventType, callback, options);
        });
        this._managedListeners = [];
    }
}
export const ExtensionRegistry = {
    _manifests: new Map(),
    uiHooks: {},
    shortcuts: {},
    _entityActions: new Map(),
    _filterPredicate: null,
    tabOrder: [],
    isBooting: true,

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
                    return { ...s, slot: slotType, extName };
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
        console.log(`📦 Registered Declarative Extension: ${extName} v${config.version || '1.0'}`);
        window.dispatchEvent(new CustomEvent('sutram:extension-registered', { detail: { extName, config } }));
        if (!this.isBooting) {
            this.compileLayout();
        }
    },

    registerShortcut: function(context, keyCombo, callback) {
        if (!this.shortcuts[context]) this.shortcuts[context] = {};
        this.shortcuts[context][keyCombo.toLowerCase()] = callback;
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
        if (this._metronomeId) clearInterval(this._metronomeId);

        this._metronomeId = setInterval(() => {
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
        }, 100);
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