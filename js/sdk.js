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
    const { type = 'text', placeholder = '', style = '', id = '', selectOptions = [], min, max, onUpdate } = options;
    const handleInput = (e) => {
        let val = type === 'checkbox' ? e.target.checked : e.target.value;
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
        return html`<textarea id=${id} style=${style} placeholder=${placeholder} .value=${currentValue || ''} @input=${handleInput}></textarea>`;
    } else if (type === 'select') {
        return html`<select id=${id} style=${style} .value=${currentValue || ''} @change=${handleInput}>
            ${selectOptions.map(o => html`<option value=${o.value !== undefined ? o.value : o}>${o.label || o}</option>`)}
        </select>`;
    } else if (type === 'checkbox') {
        return html`<input id=${id} type="checkbox" style=${style} .checked=${!!currentValue} @change=${handleInput}>`;
    }
    return html`<input id=${id} type=${type} style=${style} placeholder=${placeholder} min=${min||''} max=${max||''} .value=${currentValue || ''} @input=${handleInput}>`;
}

export class SutramElement extends LitElement {
    constructor() {
        super();
        this._storeUnsubs = [];
        this._managedIntervals = [];
        this._managedListeners = [];
    }

    subscribe(store, selectorOrListener, listener = undefined) {
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
    tabOrder: [],

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
        return slots;
    },

    compileLayout: function() {
        window.dispatchEvent(new Event('sutram-layout-recompile'));
        window.dispatchEvent(new Event('sutram-settings-actions-updated'));
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
        this.compileLayout();
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
            .filter(act => !act.match || act.match(data))
            .sort((a, b) => (a.order || 99) - (b.order || 99));
    },

    executeUIHook: function(zone, data) {
        if (this.uiHooks[zone]) {
            for (let cb of this.uiHooks[zone]) {
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
    }
};