// sutram/js/sdk.js
// Pure IoC Micro-Kernel & State Container Factory
import { LitElement, html } from 'lit';
import { createStore } from 'zustand/vanilla';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { getEventPath, getEventTarget } from '../../yenvui/js/physics.js';
import { shallowEqual, coalescedAsync, slugify } from './utils.js';
function _cloneInitialValue(val) {
    if (val instanceof Set) return new Set(val);
    if (val instanceof Map) return new Map(val);
    if (Array.isArray(val)) return [...val];
    if (val && typeof val === 'object' && val.constructor === Object) return { ...val };
    return val;
}
function _buildCleanBaseline(initialState) {
    const clean = {};
    Object.keys(initialState).forEach(k => {
        if (k === 'resetState' && typeof initialState[k] === 'function') return;
        clean[k] = _cloneInitialValue(initialState[k]);
    });
    return clean;
}
export const StoreRegistry = {
    _stores: new Map(),
    _isTransitioning: false,
    _transitionTargetScope: null,
    isTransitioning() {
        return Boolean(this._isTransitioning);
    },
    _scopeProvider: () => {
        try {
            if (typeof window !== 'undefined') {
                const hashWs = window.location.hash.replace(/^#\/?/, '').split('/')[0];
                if (hashWs) return decodeURIComponent(hashWs);
            }
        } catch (e) {}
        return 'default';
    },
    setScopeProvider(fn) {
        if (typeof fn === 'function') {
            this._scopeProvider = fn;
            const currentScope = this.getActiveScope();
            this._stores.forEach((store) => {
                if (store._storeScope !== 'global' && store._boundScope !== currentScope && typeof store.hydrateStore === 'function') {
                    try { store.hydrateStore(currentScope); } catch (e) {}
                }
            });
        }
    },
    getActiveScope() {
        try {
            return this._scopeProvider() || 'default';
        } catch (e) {
            return 'default';
        }
    },
    register(name, store) {
        this._stores.set(name, store);
    },
    get(name) {
        return this._stores.get(name);
    },
    getAll() {
        return this._stores;
    },
    switchTenantScope(newScopeId, excludeNames = []) {
        const excluded = new Set(excludeNames || []);
        this._stores.forEach((store, name) => {
            if (excluded.has(name) || store._storeScope === 'global') return;
            if (typeof store.switchScope === 'function') {
                try { store.switchScope(newScopeId); } catch (e) {
                    console.error(`[StoreRegistry] Failed to switch scope for store [${name}]:`, e);
                }
            }
        });
    },
    beginScopeTransition(targetScopeId = null, excludeNames = []) {
        const resolvedTarget = targetScopeId || this.getActiveScope();
        this._isTransitioning = true;
        this._transitionTargetScope = resolvedTarget;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sutram:scope-transition-start', {
                detail: { targetScopeId: resolvedTarget },
                bubbles: true,
                composed: true
            }));
        }
        if (targetScopeId) {
            this.switchTenantScope(targetScopeId, excludeNames);
        }
    },
    endScopeTransition() {
        const completedScope = this._transitionTargetScope || this.getActiveScope();
        this._isTransitioning = false;
        this._transitionTargetScope = null;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sutram:scope-transition-end', {
                detail: { scopeId: completedScope },
                bubbles: true,
                composed: true
            }));
        }
        if (typeof ExtensionRegistry !== 'undefined' && typeof ExtensionRegistry.compileLayout === 'function') {
            ExtensionRegistry.compileLayout();
        }
    },
    getScopedStorage(key, defaultVal = null, scopeId = null, prefix = 'sutram') {
        if (typeof localStorage === 'undefined') return defaultVal;
        const ws = scopeId || this.getActiveScope() || 'default';
        const val = localStorage.getItem(`${prefix}_${ws}_${key}`);
        if (val === null) {
            const legacyVal = localStorage.getItem(`${prefix}_${key}`);
            return legacyVal !== null ? legacyVal : defaultVal;
        }
        return val;
    },
    setScopedStorage(key, value, scopeId = null, prefix = 'sutram') {
        if (typeof localStorage === 'undefined') return;
        const ws = scopeId || this.getActiveScope() || 'default';
        localStorage.setItem(`${prefix}_${ws}_${key}`, typeof value === 'string' ? value : JSON.stringify(value));
    },
    removeScopedStorage(key, scopeId = null, prefix = 'sutram') {
        if (typeof localStorage === 'undefined') return;
        const ws = scopeId || this.getActiveScope() || 'default';
        localStorage.removeItem(`${prefix}_${ws}_${key}`);
    }
};
export function createSutramStore(name, initialState, persistenceSchema = {}, getScopeId = null, prefix = 'sutram') {
    const resolveScope = typeof getScopeId === 'function' ? getScopeId : () => StoreRegistry.getActiveScope();
    const isLegacyArray = Array.isArray(persistenceSchema);
    const schema = isLegacyArray ? { localSync: persistenceSchema } : (persistenceSchema || {});
    const localKeys = (schema.localSync || []).filter(k => Object.prototype.hasOwnProperty.call(initialState, k));
    const sessionKeys = (schema.sessionSync || []).filter(k => Object.prototype.hasOwnProperty.call(initialState, k));
    const storeScope = schema.scope || 'tenant';
    const customResetFn = typeof initialState.resetState === 'function' ? initialState.resetState : null;

    let storeRef = null;
    const processedState = { ...initialState };
    Object.keys(processedState).forEach(key => {
        if (key.startsWith('fetch') && typeof processedState[key] === 'function' && !processedState[key]._isEpochGuarded) {
            const origFn = processedState[key];
            const epochGuardedFn = async function(...args) {
                const startScope = resolveScope();
                const startEpoch = storeRef ? storeRef._scopeEpoch : 0;
                const result = await origFn.apply(this, args);
                if (storeRef && (storeRef._scopeEpoch !== startEpoch || resolveScope() !== startScope)) {
                    return undefined;
                }
                return result;
            };
            const wrapped = coalescedAsync(epochGuardedFn);
            wrapped._isEpochGuarded = true;
            processedState[key] = wrapped;
        }
    });

    const store = createStore(
        devtools(
            subscribeWithSelector((set, get) => ({
                ..._buildCleanBaseline(processedState),
                resetState: () => {
                    set(_buildCleanBaseline(processedState));
                    if (customResetFn) {
                        try { customResetFn(); } catch (_) {}
                    }
                }
            })),
            { name: `${name}Store` }
        )
    );
    storeRef = store;
    store._storeName = name;
    store._storeScope = storeScope;
    store._boundScope = resolveScope() || 'default';
    store._scopeEpoch = 0;
    store._suspendPersistence = false;
    store._hydrated = false;

    store.resetMemoryOnly = () => {
        store._suspendPersistence = true;
        store._scopeEpoch = (store._scopeEpoch || 0) + 1;
        try {
            const st = store.getState();
            if (st && typeof st.clearPayload === 'function') {
                try { st.clearPayload(); } catch (_) {}
            }
            store.setState(_buildCleanBaseline(processedState));
            if (customResetFn) {
                try { customResetFn(); } catch (_) {}
            }
        } finally {
            store._suspendPersistence = false;
        }
    };

    const _isEmptyPersistedValue = (k, parsed) => {
        if (parsed === null || parsed === undefined) return true;
        if (k === 'columns' && typeof parsed === 'object') {
            return !['left', 'center', 'right'].some(c => Array.isArray(parsed[c]?.pinned) && parsed[c].pinned.length > 0);
        }
        if (Array.isArray(parsed)) return parsed.length === 0;
        return false;
    };

    const readHydratedPatch = (scope) => {
        const hydrated = {};
        const allSyncedKeys = new Set([...localKeys, ...sessionKeys]);
        allSyncedKeys.forEach(k => {
            hydrated[k] = _cloneInitialValue(initialState[k]);
        });

        localKeys.forEach(k => {
            const storageKey = isLegacyArray ? `${prefix}_${name.toLowerCase()}_${k}_${scope}` : `${prefix}_local_${scope}_${name}_${k}`;
            const val = localStorage.getItem(storageKey);
            if (val !== null) {
                try {
                    const parsed = JSON.parse(val);
                    hydrated[k] = initialState[k] instanceof Set ? new Set(parsed) : parsed;
                } catch (e) {}
            }
        });

        sessionKeys.forEach(k => {
            const val = sessionStorage.getItem(`${prefix}_session_${scope}_${name}_${k}`);
            if (val !== null) {
                try {
                    const parsed = JSON.parse(val);
                    const isSharedWithLocal = localKeys.includes(k);
                    if (!isSharedWithLocal || !_isEmptyPersistedValue(k, parsed) || _isEmptyPersistedValue(k, hydrated[k])) {
                        hydrated[k] = initialState[k] instanceof Set ? new Set(parsed) : parsed;
                    }
                } catch (e) {}
            }
        });

        if (typeof schema.urlParser === 'function' && typeof window !== 'undefined') {
            const urlState = schema.urlParser(window.location.hash);
            if (urlState && typeof urlState === 'object') {
                Object.assign(hydrated, urlState);
            }
        }
        return hydrated;
    };

    store.hydrateStore = (scope = null) => {
        const targetScope = scope || resolveScope() || 'default';
        store._boundScope = targetScope;
        if (localKeys.length === 0 && sessionKeys.length === 0 && !schema.urlParser) {
            store._hydrated = true;
            return;
        }
        store._suspendPersistence = true;
        try {
            const patch = readHydratedPatch(targetScope);
            if (Object.keys(patch).length > 0) {
                store.setState(patch);
            }
            store._hydrated = true;
        } finally {
            store._suspendPersistence = false;
        }
    };
    store.switchScope = (newScopeId) => {
        const targetScope = newScopeId || resolveScope() || 'default';
        store._suspendPersistence = true;
        store._scopeEpoch = (store._scopeEpoch || 0) + 1;
        try {
            const currentSt = store.getState();
            if (currentSt && typeof currentSt.clearPayload === 'function') {
                try { currentSt.clearPayload(); } catch (_) {}
            }
            store._boundScope = targetScope;
            const nextState = {
                ..._buildCleanBaseline(processedState),
                ...readHydratedPatch(targetScope)
            };
            store.setState(nextState);
            store._hydrated = true;
            if (customResetFn) {
                try { customResetFn(); } catch (_) {}
            }
        } finally {
            store._suspendPersistence = false;
        }
    };
    if (localKeys.length > 0 || sessionKeys.length > 0 || schema.urlParser) {
        store.hydrateStore(resolveScope());

        store.subscribe((state, prevState) => {
            if (store._suspendPersistence || !store._hydrated) return;
            const scope = store._boundScope || resolveScope() || 'default';
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
            const { id, scopeId } = e.detail || {};
            if (scopeId && store._storeScope === 'tenant' && store._boundScope && scopeId !== store._boundScope) {
                return;
            }
            if (id && schema.onEvict[id]) {
                const patch = typeof schema.onEvict[id] === 'function'
                    ? schema.onEvict[id](store.getState(), scopeId || store._boundScope)
                    : schema.onEvict[id];
                if (patch && typeof patch === 'object' && Object.keys(patch).length > 0) {
                    store.setState(patch);
                }
            }
        });
    }

    StoreRegistry.register(name, store);
    if (typeof window !== 'undefined') {
        window.Sutram = window.Sutram || {};
        window.Sutram.stores = window.Sutram.stores || {};
        window.Sutram.stores[name] = store;
        window.Sutram.storeRegistry = StoreRegistry;
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
        this._managedTimeouts = new Set();
        this._sutramManagedListeners = [];
    }
    connectedCallback() {
        if (super.connectedCallback) super.connectedCallback();
        if (typeof this.onProjectionEvicted === 'function') {
            this.registerGlobalListener('sutram-evict-projection', window, (e) => {
                this.onProjectionEvicted(e.detail?.id);
            });
        }
        if (typeof this.onProjectionRekeyed === 'function') {
            this.registerGlobalListener('sutram-rekey-projection', window, (e) => {
                const { oldId, newId, newLabel } = e.detail || {};
                if (oldId && newId) {
                    this.onProjectionRekeyed(oldId, newId, newLabel);
                }
            });
        }
    }
    getStore(storeOrName) {
        if (!storeOrName) return null;
        if (typeof storeOrName !== 'string') return storeOrName;
        return (
            StoreRegistry.get(storeOrName) ||
            window.Sutram?.stores?.[storeOrName] ||
            window.stores?.[storeOrName] ||
            null
        );
    }
    subscribe(storeOrName, selectorOrListener, listener = undefined, equalityFn = shallowEqual) {
        let store = storeOrName;
        if (typeof storeOrName === 'string') {
            store = StoreRegistry.get(storeOrName) ||
                    window.Sutram?.stores?.[storeOrName] ||
                    window.stores?.[storeOrName];

            // Lazy Subscription: If the named store isn't registered yet, defer binding until it hydrates
            if (!store) {
                const pendingKey = storeOrName;
                let activeUnsub = () => {};
                const checkInterval = setInterval(() => {
                    const lateStore = StoreRegistry.get(pendingKey) || window.Sutram?.stores?.[pendingKey];
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
    bindStore(store, stateMapper, options = {}) {
        const { autoFetch = 'fetchData', equalityFn } = options;

        this.subscribe(store, stateMapper, (mappedSlice) => {
            Object.assign(this, mappedSlice);
            this.requestUpdate();
        }, equalityFn);

        if (autoFetch) {
            const triggerFetch = (scopeId) => {
                if (typeof this.isExtensionActive === 'function' && !this.isExtensionActive()) return;
                if (typeof autoFetch === 'function') {
                    autoFetch(scopeId);
                } else if (typeof autoFetch === 'string') {
                    const resolvedStore = this.getStore(store);
                    const state = typeof resolvedStore?.getState === 'function' ? resolvedStore.getState() : resolvedStore;
                    if (state && typeof state[autoFetch] === 'function') {
                        state[autoFetch](scopeId);
                    }
                }
            };

            this._autoFetchFns = this._autoFetchFns || [];
            this._autoFetchFns.push(triggerFetch);

            const activeScope = this.workspaceId || StoreRegistry.getActiveScope();
            triggerFetch(activeScope);
        }
    }
    registerInterval(callback, delayMs) {
        const id = setInterval(callback, delayMs);
        this._managedIntervals.push(id);
        return id;
    }

    registerTimeout(callback, delayMs) {
        const id = setTimeout(() => {
            this._managedTimeouts.delete(id);
            if (this.isConnected) {
                callback();
            }
        }, delayMs);
        this._managedTimeouts.add(id);
        return id;
    }
    clearManagedTimeouts() {
        this._managedTimeouts.forEach(timeoutTimer => clearTimeout(timeoutTimer));
        this._managedTimeouts.clear();
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

        this.clearManagedTimeouts();

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

    getRepoConfigOptions: function() {
        const options = [];
        for (const [extName, manifest] of this._manifests.entries()) {
            if (this._filterPredicate && !this._filterPredicate(extName)) continue;
            if (Array.isArray(manifest.repoConfigOptions)) {
                manifest.repoConfigOptions.forEach(opt => {
                    if (opt && typeof opt.component === 'function') {
                        options.push({ ...opt, extName });
                    }
                });
            }
        }
        return options.sort((a, b) => (a.order || 50) - (b.order || 50));
    },

    getBucketConfigOptions: function() {
        const options = [];
        for (const [extName, manifest] of this._manifests.entries()) {
            if (this._filterPredicate && !this._filterPredicate(extName)) continue;
            if (Array.isArray(manifest.bucketConfigOptions)) {
                manifest.bucketConfigOptions.forEach(opt => {
                    if (opt && typeof opt.component === 'function') {
                        options.push({ ...opt, extName });
                    }
                });
            }
        }
        return options.sort((a, b) => (a.order || 50) - (b.order || 50));
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
                    // Resolve preferred spatial column via hook or fallback
                    let pCol = s.preferredColumn;
                    if (!pCol && s.targetParent) {
                        const hookedCol = this.executeUIHook ? this.executeUIHook('sutram:resolve-preferred-column', s.targetParent) : null;
                        if (hookedCol) {
                            pCol = hookedCol;
                        } else {
                            const t = s.targetParent.toLowerCase();
                            if (t === 'left' || t === 'center' || t === 'right') pCol = t;
                            else pCol = 'center';
                        }
                    }

                    const isSubNav = slotType === 'slots:sub-navigation';
                    const rawId = s.rawId || s.id || '';
                    const isUriOrCustom = rawId.includes('://') || rawId.includes(':');
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
        if (StoreRegistry.isTransitioning()) {
            return;
        }
        window.dispatchEvent(new Event('sutram-layout-recompile'));
        window.dispatchEvent(new Event('sutram-settings-actions-updated'));
    },
    async loadBatches(batches = []) {
        this.isBooting = true;
        for (const batchUrls of batches) {
            if (!Array.isArray(batchUrls) || batchUrls.length === 0) continue;
            await Promise.all(
                batchUrls.map(url => 
                    import(/* webpackIgnore: true */ url)
                        .catch(e => console.error(`[Sutram] Failed to load module [${url}]:`, e))
                )
            );
        }
        this.isBooting = false;
        this.compileLayout();
    },
    setDynamicLayoutSlots: function(extName, dynamicSlots = []) {
        const manifest = this._manifests.get(extName);
        if (!manifest) return;
        const baseGlobals = (manifest._baseLayoutSlots || manifest.layoutSlots || []).filter(s => s.slot === 'slots:global');
        manifest.layoutSlots = [...baseGlobals, ...dynamicSlots];
        if (!this.isBooting) {
            this.compileLayout();
        }
    },
    registerExtension: function(extName, config) {
        if (Array.isArray(config.layoutSlots) && !config._baseLayoutSlots) {
            try {
                config._baseLayoutSlots = JSON.parse(JSON.stringify(config.layoutSlots));
            } catch (_) {
                config._baseLayoutSlots = [...config.layoutSlots];
            }
        }
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
                if (act.emitEvent && !act.onClick && !act.asyncAction) {
                    act.onClick = (data, e) => {
                        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                        const payload = typeof act.emitEvent === 'function' ? act.emitEvent(data) : act.emitEvent;
                        if (payload && payload.name && typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent(payload.name, {
                                detail: payload.detail,
                                bubbles: true,
                                composed: true
                            }));
                        }
                    };
                }
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
                s.id = s.id || `${extName}:${slugify(s.label || s.key || 'shortcut')}`;
                this.registerShortcut(s.context, s.key, s.action, { id: s.id, extName, label: s.label });
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
        const extName = meta.extName || callback._extName || null;
        const wrappedShortcut = (e) => {
            if (extName && this._filterPredicate && !this._filterPredicate(extName)) {
                return;
            }
            return callback(e);
        };
        wrappedShortcut._extName = extName;
        this.shortcuts[context][key] = wrappedShortcut;
        if (meta.id) {
            this._shortcutMeta = this._shortcutMeta || new Map();
            this._shortcutMeta.set(meta.id, { context, key, extName, label: meta.label });
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
    _extAbortControllers: new Map(),

    getSignal: function(extName) {
        if (!this._extAbortControllers.has(extName) || this._extAbortControllers.get(extName).signal.aborted) {
            this._extAbortControllers.set(extName, new AbortController());
        }
        return this._extAbortControllers.get(extName).signal;
    },
    registerSettingsAction: function(id, label, icon, callback, section = 'Extensions', extName = null, meta = {}) {
        this._settingsActions = this._settingsActions.filter(a => a.id !== id);
        this._settingsActions.push({
            id,
            label,
            icon,
            callback,
            section,
            extName,
            ...(meta && typeof meta === 'object' ? meta : {})
        });
        window.dispatchEvent(new Event('sutram-settings-actions-updated'));
    },

    getSettingsActions: function() {
        const results = [];
        const seen = new Set();
        this._manifests.forEach((manifest, extName) => {
            if (this._filterPredicate && !this._filterPredicate(extName)) return;
            if (Array.isArray(manifest.settingsActions)) {
                manifest.settingsActions.forEach(act => {
                    if (!act || act.id === `${extName}_generic_settings` || seen.has(act.id)) return;
                    seen.add(act.id);
                    const section = act.section || manifest.settingsCategory || 'Extensions';
                    results.push({
                        ...act,
                        id: act.id,
                        label: act.label,
                        icon: act.icon,
                        callback: act.onClick || act.callback,
                        section,
                        extName
                    });
                });
            }
        });
        this._settingsActions.forEach(act => {
            if (seen.has(act.id)) return;
            if (act.extName && this._filterPredicate && !this._filterPredicate(act.extName)) return;
            seen.add(act.id);
            results.push(act);
        });
        return results;
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
        if (!extName) return;
        // 0. Abort any in-flight extension lifecycle signal
        if (this._extAbortControllers.has(extName)) {
            try { this._extAbortControllers.get(extName).abort(); } catch (_) {}
            this._extAbortControllers.delete(extName);
        }
        // 0.5 Restore baseline layout slots if the extension dynamically mutated its layoutSlots
        const manifest = this._manifests.get(extName);
        if (manifest && Array.isArray(manifest._baseLayoutSlots)) {
            try {
                manifest.layoutSlots = JSON.parse(JSON.stringify(manifest._baseLayoutSlots));
            } catch (_) {
                manifest.layoutSlots = [...manifest._baseLayoutSlots];
            }
        }
        // 1. Execute custom unload hook if registered (retain in Map so re-enabling doesn't lose the hook)
        if (this._unloadHooks.has(extName)) {
            try { this._unloadHooks.get(extName)(); } catch (e) { console.error(`Error unloading extension [${extName}]:`, e); }
        }
        // 2. Evict any open windows or column projections owned by this extension
        const layoutStore = window.Sutram?.stores?.Layout;
        if (layoutStore && typeof layoutStore.getState === 'function') {
            const st = layoutStore.getState();
            (st.windows || []).forEach(w => {
                if (w.extName === extName || (typeof w.id === 'string' && w.id.startsWith(`${extName}:`))) {
                    st.closeWindow(w.id, true);
                }
            });
            ['left', 'center', 'right'].forEach(col => {
                const pinned = st.columns?.[col]?.pinned || [];
                pinned.forEach(p => {
                    if (p.extName === extName || (typeof p.id === 'string' && p.id.startsWith(`${extName}:`))) {
                        st.unpinFromColumn(col, p.id);
                        st.evictProjection(p.id, true);
                    }
                });
            });
        }
        // 3. Reset any Zustand store matching this extension's namespace without clobbering storage
        if (window.Sutram?.stores) {
            const capName = extName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
            const targetStore = window.Sutram.stores[capName] || window.Sutram.stores[extName];
            if (targetStore && typeof targetStore.getState === 'function') {
                if (typeof targetStore.resetMemoryOnly === 'function') {
                    try { targetStore.resetMemoryOnly(); } catch (_) {}
                } else {
                    const sState = targetStore.getState();
                    if (typeof sState?.clearPayload === 'function') {
                        try { sState.clearPayload(); } catch (_) {}
                    }
                    if (typeof sState?.resetState === 'function') {
                        try { sState.resetState(); } catch (_) {}
                    }
                }
            }
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sutram-extension-unloaded', { detail: { extName }, bubbles: true, composed: true }));
        }
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
        }, { scope: 'global' });

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
        }, { scope: 'global' });
        export const SelectionStore = createSutramStore('Selection', {
        selectedItems: new Map(),
        toggleSelection: (id, entityType, data) => {
            const newMap = new Map(SelectionStore.getState().selectedItems);
            if (newMap.has(id)) newMap.delete(id);
            else newMap.set(id, { entityType, data });
            SelectionStore.setState({ selectedItems: newMap });
        },
        clearSelection: () => SelectionStore.setState({ selectedItems: new Map() })
        }, { scope: 'tenant' });
        export const EnvironmentStore = createSutramStore('Environment', {
            isOffline: false
        }, { scope: 'global' });
const _layoutBus = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('sutram_layout_bus') : null;

export function canUseMultiWindowPopout() {
    if (typeof window === 'undefined') return false;
    if (new URLSearchParams(window.location.search).get('popout') === 'true') return false;
    if (window.navigator?.standalone === true) return false;
    const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
    const isCompactScreen = window.innerWidth < 768;
    if (isCoarsePointer && isCompactScreen) return false;
    return true;
}
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
    activePopoutWindows: new Map(),
    lastPopoutFocusTs: new Map(),
    clearPayload: () => {
        const st = LayoutStore.getState();
        st.activePopoutWindows?.clear();
        st.lastPopoutFocusTs?.clear();
    },
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
    closeWindow: (id, sync = false) => {
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
        LayoutStore.getState().evictProjection(id, sync);
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
    rekeyProjection: (oldId, newId, newLabel = null, options = {}) => {
        if (!oldId || !newId || oldId === newId) return;
        const deriveLabel = (targetId) => {
            if (targetId === newId && newLabel) return newLabel;
            return String(targetId).replace(/\/+$/, '').split('/').pop() || targetId;
        };
        const mapSegment = (seg) => {
            if (!seg || typeof seg !== 'string') return seg;
            if (seg === oldId) return newId;
            if (seg.startsWith(oldId + '/')) return newId + seg.slice(oldId.length);
            return seg;
        };
        const registry = (typeof window !== 'undefined' && window.ExtensionRegistry) || ExtensionRegistry;
        const mapId = (id) => {
            if (!id || typeof id !== 'string') return id;
            const direct = mapSegment(id);
            if (direct !== id) return direct;
            if (registry?.executeUIHook) {
                const hooked = registry.executeUIHook('sutram:rekey-projection-id', { id, oldId, newId, mapSegment });
                if (typeof hooked === 'string' && hooked) return hooked;
            }
            return id;
        };

        const rekeyedPairs = [];
        const recordPair = (fromId, toId) => {
            if (fromId !== toId && !rekeyedPairs.some(p => p.oldId === fromId)) {
                rekeyedPairs.push({ oldId: fromId, newId: toId, newLabel: deriveLabel(toId) });
            }
        };
        recordPair(oldId, newId);

        LayoutStore.setState((state) => {
            let changed = false;
            const nextColumns = { ...state.columns };

            ['left', 'center', 'right'].forEach(col => {
                const colState = nextColumns[col];
                if (!colState) return;
                let colChanged = false;

                const nextPinned = (colState.pinned || []).map(p => {
                    const mapped = mapId(p.id);
                    if (mapped !== p.id) {
                        colChanged = true;
                        changed = true;
                        recordPair(p.id, mapped);
                        const lbl = deriveLabel(mapped);
                        return { ...p, id: mapped, rawId: mapped, label: lbl };
                    }
                    return p;
                });

                let nextActive = colState.active;
                const mappedActive = mapId(colState.active);
                if (mappedActive !== colState.active) {
                    nextActive = mappedActive;
                    colChanged = true;
                    changed = true;
                }

                const nextHistory = Array.isArray(colState.history)
                    ? colState.history.map(hId => {
                        const mh = mapId(hId);
                        if (mh !== hId) { colChanged = true; changed = true; }
                        return mh;
                    })
                    : [];

                if (colChanged) {
                    nextColumns[col] = {
                        ...colState,
                        pinned: nextPinned,
                        active: nextActive,
                        history: nextHistory
                    };
                }
            });

            const nextFocusHistory = (state.focusHistory || []).map(h => {
                if (!h || !h.id) return h;
                const mh = mapId(h.id);
                if (mh !== h.id) {
                    changed = true;
                    return { ...h, id: mh };
                }
                return h;
            });
            const nextWindows = (state.windows || []).map(w => {
                const mw = mapId(w.id);
                if (mw !== w.id) {
                    changed = true;
                    recordPair(w.id, mw);
                    const lbl = deriveLabel(mw);
                    let nextProps = w.props;
                    if (w.props && typeof w.props === 'object') {
                        nextProps = { ...w.props };
                        Object.keys(nextProps).forEach(pk => {
                            if (typeof nextProps[pk] === 'string') {
                                nextProps[pk] = mapSegment(nextProps[pk]);
                            }
                        });
                    }
                    return { ...w, id: mw, label: lbl, titleText: lbl, props: nextProps };
                }
                return w;
            });

            if (!changed) return {};
            return {
                columns: nextColumns,
                focusHistory: nextFocusHistory,
                windows: nextWindows
            };
        });

        // Rekey active popout window handles
        const popoutMap = LayoutStore.getState().activePopoutWindows;
        if (popoutMap) {
            Array.from(popoutMap.keys()).forEach(k => {
                const sepIdx = k.indexOf('::');
                if (sepIdx === -1) return;
                const scopePrefix = k.slice(0, sepIdx);
                const popId = k.slice(sepIdx + 2);
                const mappedPopId = mapId(popId);
                if (mappedPopId !== popId) {
                    const winRef = popoutMap.get(k);
                    popoutMap.delete(k);
                    popoutMap.set(`${scopePrefix}::${mappedPopId}`, winRef);
                }
            });
        }

        if (typeof window !== 'undefined') {
            rekeyedPairs.forEach(pair => {
                window.dispatchEvent(new CustomEvent('sutram-rekey-projection', {
                    detail: pair,
                    bubbles: true,
                    composed: true
                }));
            });
            if (!options.fromBus && _layoutBus) {
                _layoutBus.postMessage({
                    type: 'rekey_projection',
                    data: { oldId, newId, newLabel }
                });
            }
        }
    },
    evictProjection: (id, sync = false) => {
        if (typeof window === 'undefined' || !id) return;
        const evictScope = LayoutStore._boundScope || 'default';
        const dispatchEvict = () => {
            window.dispatchEvent(new CustomEvent('sutram-evict-projection', {
                detail: { id, scopeId: evictScope },
                bubbles: true,
                composed: true
            }));
        };
        if (sync) {
            dispatchEvict();
        } else {
            queueMicrotask(dispatchEvict);
        }
    },
    canPopout: () => canUseMultiWindowPopout(),
    focusPopout: (id, scopeId = null) => {
        if (!id || typeof window === 'undefined') return false;
        if (new URLSearchParams(window.location.search).get('popout') === 'true') return false;
        const scope = scopeId || (window.location.hash.replace(/^#\/?/, '').split('/')[0] || 'default');
        const key = `${scope}::${id}`;
        const { activePopoutWindows, lastPopoutFocusTs } = LayoutStore.getState();
        const win = activePopoutWindows?.get(key);
        if (win) {
            if (!win.closed) {
                const now = Date.now();
                const lastAttempt = lastPopoutFocusTs?.get(key) || 0;
                lastPopoutFocusTs?.set(key, now);

                // Double-click recall escape hatch for OS window managers that block window.focus()
                if (now - lastAttempt < 3500) {
                    activePopoutWindows?.delete(key);
                    lastPopoutFocusTs?.delete(key);
                    try { win.close(); } catch (e) {}
                    StatusStore.getState().setStatus(`↙️ Re-docked ${id.split('/').pop()} into main window`, 2500);
                    return false;
                }
                try {
                    win.focus();
                    StatusStore.getState().setStatus(`↗️ Open in pop-out window (click again to recall here)`, 3000);
                    return true;
                } catch (e) {}
            }
            activePopoutWindows?.delete(key);
            lastPopoutFocusTs?.delete(key);
        }
        return false;
    },
    clearPopout: (id, scopeId = null) => {
        if (!id) return;
        const scope = scopeId || (window.location.hash.replace(/^#\/?/, '').split('/')[0] || 'default');
        const { activePopoutWindows, lastPopoutFocusTs } = LayoutStore.getState();
        activePopoutWindows?.delete(`${scope}::${id}`);
        lastPopoutFocusTs?.delete(`${scope}::${id}`);
    },
    popoutProjection: async (id, options = {}) => {
        if (!id || typeof window === 'undefined') return false;
        const registry = window.ExtensionRegistry || ExtensionRegistry;
        const normId = (registry?.executeUIHook && registry.executeUIHook('sutram:normalize-projection-id', id)) || id;
        const scope = options.scopeId || (window.location.hash.replace(/^#\/?/, '').split('/')[0] || 'default');

        if (LayoutStore.getState().focusPopout(normId, scope) || LayoutStore.getState().focusPopout(id, scope)) {
            return true;
        }

        if (!canUseMultiWindowPopout()) {
            const fallbackHandled = registry?.executeUIHook && registry.executeUIHook('sutram:popout-fallback', normId);
            if (!fallbackHandled) {
                StatusStore.getState().setStatus(`🔍 Multi-window pop-outs are not supported in this display mode.`, 2500);
            }
            return false;
        }

        const layoutState = LayoutStore.getState();
        let originCol = options.originCol || layoutState.focusedColumn || 'center';
        ['left', 'center', 'right'].forEach(col => {
            const pinned = layoutState.columns[col]?.pinned || [];
            if (pinned.some(p => p.id === normId || p.id === id)) {
                originCol = col;
            }
        });
        const winMatch = (layoutState.windows || []).find(w => w.id === normId || w.id === id);
        if (winMatch && winMatch.anchorCol) {
            originCol = winMatch.anchorCol;
        }

        const customUrl = registry?.executeUIHook && registry.executeUIHook('sutram:build-popout-url', { id: normId, colId: originCol, scopeId: scope });
        const targetUrl = customUrl || `${window.location.pathname}?popout=true#/${encodeURIComponent(scope)}/${encodeURIComponent(originCol)}/${encodeURIComponent(normId)}`;

        // Acquire WindowProxy synchronously inside user gesture before any async pre-save hook
        const preSavePromise = registry?.executeUIHook ? registry.executeUIHook('sutram:before-popout', normId) : null;
        const isAsyncPreSave = Boolean(preSavePromise && typeof preSavePromise.then === 'function');

        const childWin = window.open(isAsyncPreSave ? 'about:blank' : targetUrl, '_blank', 'popup=yes,width=850,height=900');
        if (!childWin) {
            ToastStore.getState().addToast("Pop-out window was blocked by your browser. Please allow pop-ups for this site.", "warning");
            return false;
        }
        const popoutMap = LayoutStore.getState().activePopoutWindows;
        popoutMap?.set(`${scope}::${normId}`, childWin);
        popoutMap?.set(`${scope}::${id}`, childWin);

        if (isAsyncPreSave) {
            try { await preSavePromise; } catch (e) {}
            if (!childWin.closed) {
                childWin.location.replace(targetUrl);
            }
        }

        ['left', 'center', 'right'].forEach(col => {
            const pinned = LayoutStore.getState().columns[col]?.pinned || [];
            pinned.forEach(p => {
                if (p.id === normId || p.id === id) {
                    LayoutStore.getState().unpinFromColumn(col, p.id);
                }
            });
        });
        LayoutStore.getState().closeWindow(normId);
        if (id !== normId) LayoutStore.getState().closeWindow(id);
        LayoutStore.getState().evictProjection(normId);
        if (id !== normId) LayoutStore.getState().evictProjection(id);

        const nextState = LayoutStore.getState();
        const activeCol = nextState.focusedColumn || 'center';
        const nextActiveId = nextState.columns[activeCol]?.active || '';
        const nextHash = (registry?.executeUIHook && registry.executeUIHook('sutram:resolve-route-hash', { colId: activeCol, subId: nextActiveId })) || `#/${encodeURIComponent(scope)}/${activeCol}/${encodeURIComponent(nextActiveId)}`;
        if (window.location.hash !== nextHash) {
            window.history.replaceState(null, '', nextHash);
        }
        return true;
    },
    dockInProjection: async (id = null) => {
        if (typeof window === 'undefined') return;
        const hash = window.location.hash.replace(/^#\/?/, '');
        const parts = hash.split('/').map(decodeURIComponent);
        const scope = parts[0] || 'default';
        const colId = ['left', 'center', 'right'].includes(parts[1]) ? parts[1] : 'center';
        const targetId = id || (parts.length >= 4 && parts[2] === 'editor' ? parts.slice(3).join('/') : parts.slice(2).join('/'));
        if (!targetId) return;

        const registry = window.ExtensionRegistry || ExtensionRegistry;
        const preSavePromise = registry?.executeUIHook ? registry.executeUIHook('sutram:before-dock-in', targetId) : null;
        if (preSavePromise && typeof preSavePromise.then === 'function') {
            try { await preSavePromise; } catch (e) {}
        }

        let hostAlive = false;
        if (_layoutBus) {
            const pongHandler = (ev) => {
                if (ev.data?.type === 'presence_pong') hostAlive = true;
            };
            _layoutBus.addEventListener('message', pongHandler);
            _layoutBus.postMessage({ type: 'presence_ping' });
            await new Promise(r => setTimeout(r, 120));
            _layoutBus.removeEventListener('message', pongHandler);
        }

        if (hostAlive && _layoutBus) {
            _layoutBus.postMessage({
                type: 'dock_projection',
                data: { scopeId: scope, id: targetId, colId }
            });
            window.close();
        } else {
            // Self-healing fallback: If host window was closed, upgrade this pop-out into the full workbench shell
            window.location.href = `${window.location.pathname}#/${encodeURIComponent(scope)}/${encodeURIComponent(colId)}/${encodeURIComponent(targetId)}`;
        }
    }
}, {
    sessionSync: ['columns', 'focusHistory', 'capacity', 'mobileViewportIndex', 'windows', 'layoutRatios'],
    localSync: ['columns', 'focusHistory', 'layoutRatios']
});

if (typeof window !== 'undefined' && _layoutBus) {
    const isPopoutWindow = new URLSearchParams(window.location.search).get('popout') === 'true';
    if (isPopoutWindow) {
        _layoutBus.addEventListener('message', (ev) => {
            const { type, data } = ev.data || {};
            if (type === 'rekey_projection' && data?.oldId && data?.newId) {
                LayoutStore.getState().rekeyProjection(data.oldId, data.newId, data.newLabel, { fromBus: true });
            }
        });
        window.addEventListener('pagehide', () => {
            const hash = window.location.hash.replace(/^#\/?/, '');
            const parts = hash.split('/').map(decodeURIComponent);
            const scope = parts[0] || 'default';
            const targetId = (parts.length >= 4 && parts[2] === 'editor') ? parts.slice(3).join('/') : parts.slice(2).join('/');
            if (targetId) {
                _layoutBus.postMessage({ type: 'popout_closed', data: { scopeId: scope, id: targetId } });
            }
        });
    } else {
        _layoutBus.addEventListener('message', (ev) => {
            const { type, data } = ev.data || {};
            if (type === 'presence_ping') {
                _layoutBus.postMessage({ type: 'presence_pong' });
            } else if (type === 'rekey_projection' && data?.oldId && data?.newId) {
                LayoutStore.getState().rekeyProjection(data.oldId, data.newId, data.newLabel, { fromBus: true });
            } else if (type === 'popout_closed') {
                LayoutStore.getState().clearPopout(data?.id, data?.scopeId);
            } else if (type === 'dock_projection') {
                const currentScope = window.location.hash.replace(/^#\/?/, '').split('/')[0] || 'default';
                if (data?.scopeId && data.scopeId !== currentScope) return;
                const targetId = data?.id;
                const colId = ['left', 'center', 'right'].includes(data?.colId) ? data.colId : 'center';
                if (!targetId) return;

                LayoutStore.getState().clearPopout(targetId, currentScope);
                const layout = LayoutStore.getState();
                layout.setFocusedColumn(colId);

                const registry = window.ExtensionRegistry || ExtensionRegistry;
                const slots = registry?.getLayoutSlots?.() || [];
                const matchingSlot = slots.find(s => s.id === targetId || s.rawId === targetId);
                if (matchingSlot) {
                    if (!layout.columns[colId]?.pinned?.some(p => p.id === matchingSlot.id)) {
                        layout.pinToColumn(colId, matchingSlot);
                    }
                    layout.setActiveProjection(colId, matchingSlot.id);
                    layout.setFocusedColumn(colId);
                } else if (registry?.executeUIHook) {
                    registry.executeUIHook('sutram:restore-docked-projection', { id: targetId, colId, scopeId: currentScope });
                }
                window.focus();
            }
        });
    }
}