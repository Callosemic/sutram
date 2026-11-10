/**
 * Zero-dependency Node.js ESM loader and minimal browser environment shim for Sutram & yenVUI unit tests.
 * Enforces `globalThis.window === globalThis` and resolves 'sutram-chassis', 'sutram/*', 'yenvui/*',
 * 'lit', 'zustand/*', and 'codemirror-core' directly against repository sources.
 */
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

export class MemoryStorage {
    constructor() { this.map = new Map(); }
    getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
    setItem(k, v) { this.map.set(k, String(v)); }
    removeItem(k) { this.map.delete(k); }
    clear() { this.map.clear(); }
    key(i) { return Array.from(this.map.keys())[i] ?? null; }
    get length() { return this.map.size; }
}

if (typeof globalThis.window === 'undefined') {
    const et = new EventTarget();
    const definedTags = new Map();
    // Attributes live apart from properties, as in a real DOM, so reading one never calls a component's getter.
    const elementAttributes = new WeakMap();
    const attributesOf = (el) => {
        let attrs = elementAttributes.get(el);
        if (!attrs) {
            attrs = new Map();
            elementAttributes.set(el, attrs);
        }
        return attrs;
    };

    globalThis.localStorage = new MemoryStorage();
    globalThis.sessionStorage = new MemoryStorage();
    globalThis.IDBKeyRange = { only: (val) => val };
    globalThis.CustomEvent = globalThis.CustomEvent || class CustomEvent extends Event {
        constructor(type, options = {}) {
            super(type, options);
            this.detail = options?.detail ?? null;
        }
    };
    globalThis.BroadcastChannel = class BroadcastChannel {
        constructor(name) { this.name = name; }
        addEventListener() {}
        removeEventListener() {}
        postMessage() {}
        close() {}
        unref() {}
    };
    globalThis.HTMLElement = globalThis.HTMLElement || class HTMLElement {
        constructor() {
            this.dataset = {};
            this.style = { setProperty() {}, removeProperty() {} };
            this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
            this.shadowRoot = null;
        }
        connectedCallback() {}
        disconnectedCallback() {}
        requestUpdate() {}
        addEventListener() {}
        removeEventListener() {}
        dispatchEvent(ev) { return et.dispatchEvent(ev); }
        setAttribute(k, v) {
            const name = String(k).toLowerCase();
            const attrs = attributesOf(this);
            const oldValue = attrs.has(name) ? attrs.get(name) : null;
            const newValue = String(v);
            attrs.set(name, newValue);
            if (oldValue !== newValue && (this.constructor.observedAttributes || []).includes(name)) {
                this.attributeChangedCallback?.(name, oldValue, newValue);
            }
        }
        getAttribute(k) {
            const attrs = attributesOf(this);
            const name = String(k).toLowerCase();
            return attrs.has(name) ? attrs.get(name) : null;
        }
        hasAttribute(k) { return attributesOf(this).has(String(k).toLowerCase()); }
        removeAttribute(k) {
            const name = String(k).toLowerCase();
            const attrs = attributesOf(this);
            if (!attrs.has(name)) return;
            const oldValue = attrs.get(name);
            attrs.delete(name);
            if ((this.constructor.observedAttributes || []).includes(name)) {
                this.attributeChangedCallback?.(name, oldValue, null);
            }
        }
    };
    globalThis.customElements = {
        _tags: definedTags,
        get: (tag) => definedTags.get(tag),
        define: (tag, cls) => {
            if (!definedTags.has(tag)) definedTags.set(tag, cls);
        }
    };
    globalThis.document = {
        hidden: false,
        readyState: 'complete',
        body: { getAttribute: () => 'dark', style: {}, appendChild: () => {} },
        head: { appendChild: () => {} },
        getElementById: () => ({}),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        createElement: (tag) => ({
            tagName: String(tag).toUpperCase(),
            dataset: {},
            style: {},
            removed: false,
            remove() { this.removed = true; },
            setAttribute(k, v) { this[k] = v; },
            replaceChildren(...children) { this.children = children; }
        })
    };
    Object.defineProperty(globalThis, 'navigator', {
        value: {
            onLine: true,
            userAgent: 'node-test',
            serviceWorker: { controller: { postMessage() {} } },
            storage: { estimate: async () => ({ usage: 0, quota: 1000000 }), persisted: async () => true }
        },
        writable: true,
        configurable: true
    });
    globalThis.location = {
        hash: '#/ws_alpha/center/',
        search: '',
        pathname: '/',
        origin: 'https://box.tailnet.ts.net',
        href: 'https://box.tailnet.ts.net/'
    };
    globalThis.history = { replaceState() {}, pushState() {} };
    globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.innerWidth = 1200;
    globalThis.innerHeight = 800;
    globalThis.Sutram = { stores: {} };
    globalThis.addEventListener = et.addEventListener.bind(et);
    globalThis.removeEventListener = et.removeEventListener.bind(et);
    globalThis.dispatchEvent = et.dispatchEvent.bind(et);

    // Canonical Browser Identity Invariant: window and globalThis must be the exact same object reference
    globalThis.window = globalThis;
}

const VIRTUAL_MODULES = {
    'lit': [
        'export class LitElement extends globalThis.HTMLElement {',
        '  static properties = {};',
        '  static styles = [];',
        '  connectedCallback() {}',
        '  disconnectedCallback() {}',
        '  willUpdate() {}',
        '  updated() {}',
        '  firstUpdated() {}',
        '  requestUpdate() {}',
        '  dispatchEvent() {}',
        '}',
        'export const html = () => "";',
        'export const css = () => "";',
        'export const unsafeCSS = () => "";',
        'export const live = (v) => v;',
        'export const unsafeHTML = (v) => v;'
    ].join('\n'),
    'zustand/vanilla': [
        'export function createStore(createState) {',
        '  let state;',
        '  const listeners = new Set();',
        '  const setState = (partial, replace) => {',
        '    const nextState = typeof partial === "function" ? partial(state) : partial;',
        '    if (!Object.is(nextState, state)) {',
        '      const previousState = state;',
        '      state = (replace ?? (typeof nextState !== "object" || nextState === null))',
        '        ? nextState',
        '        : Object.assign({}, state, nextState);',
        '      listeners.forEach(listener => listener(state, previousState));',
        '    }',
        '  };',
        '  const getState = () => state;',
        '  const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };',
        '  const destroy = () => { listeners.clear(); };',
        '  const api = { setState, getState, subscribe, destroy };',
        '  state = createState(setState, getState, api);',
        '  return api;',
        '}'
    ].join('\n'),
    'zustand/middleware': [
        'export const devtools = (fn) => fn;',
        'export const subscribeWithSelector = (fn) => (set, get, api) => {',
        '  const origSubscribe = api.subscribe;',
        '  api.subscribe = (selector, optListener, options) => {',
        '    if (!optListener) return origSubscribe(selector);',
        '    let currentSlice = selector(get());',
        '    return origSubscribe((state) => {',
        '      const nextSlice = selector(state);',
        '      const eq = options?.equalityFn || Object.is;',
        '      if (!eq(currentSlice, nextSlice)) {',
        '        const prev = currentSlice;',
        '        currentSlice = nextSlice;',
        '        optListener(currentSlice, prev);',
        '      }',
        '    });',
        '  };',
        '  return fn(set, get, api);',
        '};'
    ].join('\n'),
    'codemirror-core': [
        'export class LanguageSupport {',
        '  constructor(language, extensions = []) { this.language = language; this.extensions = extensions; }',
        '}',
        'export const StreamLanguage = { define: (parser) => ({ kind: "stream-defined", parser }) };',
        'export const python = () => ({ lang: "python" });',
        'export const json = () => ({ lang: "json" });',
        'export const javascript = (opts = {}) => ({ lang: "javascript", opts });',
        'export const yaml = () => ({ lang: "yaml" });',
        'export const htmlLang = () => ({ lang: "html" });',
        'export const cssLang = () => ({ lang: "css" });',
        'export const markdown = () => ({ language: { name: "markdown" }, extensions: ["safeExt", "htmlCompletion", "closeTags"] });',
        'export class WidgetType {}',
        'export const StateField = { define: () => ({}) };',
        'export const Decoration = { widget: () => ({}) };',
        'export class RangeSetBuilder {}',
        'export const EditorView = { decorations: { from: () => ({}) } };',
        'export const EditorState = { transactionFilter: { of: () => ({}) } };'
    ].join('\n')
};

const loaderCode = `
import fs from 'node:fs';
import { URL } from 'node:url';

const VIRTUAL_MODULES = ${JSON.stringify(VIRTUAL_MODULES)};
const CHASSIS_URL = ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, 'yenvui', 'js', 'index.js')).href)};
const SUTRAM_JS_BASE = ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, 'sutram', 'js') + '/').href)};
const YENVUI_JS_BASE = ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, 'yenvui', 'js') + '/').href)};

export async function resolve(specifier, context, nextResolve) {
    if (specifier === 'sutram-chassis') {
        return { url: CHASSIS_URL, shortCircuit: true };
    }
    if (specifier.startsWith('sutram/')) {
        return { url: new URL(specifier.slice('sutram/'.length), SUTRAM_JS_BASE).href, shortCircuit: true };
    }
    if (specifier.startsWith('yenvui/')) {
        return { url: new URL(specifier.slice('yenvui/'.length), YENVUI_JS_BASE).href, shortCircuit: true };
    }
    if (specifier === 'lit' || specifier.startsWith('lit/') || specifier === 'lit-virtualizer') {
        return { url: 'sutram-stub:///lit', shortCircuit: true };
    }
    if (Object.prototype.hasOwnProperty.call(VIRTUAL_MODULES, specifier)) {
        return { url: 'sutram-stub:///' + specifier, shortCircuit: true };
    }
    return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
    if (url.startsWith('sutram-stub:///')) {
        const key = url.slice('sutram-stub:///'.length);
        return { format: 'module', source: VIRTUAL_MODULES[key] || 'export default {};', shortCircuit: true };
    }
    if (url.startsWith('file://') && url.endsWith('.js')) {
        return {
            format: 'module',
            source: fs.readFileSync(new URL(url), 'utf-8'),
            shortCircuit: true
        };
    }
    return nextLoad(url, context);
}
`;

register('data:text/javascript;charset=utf-8,' + encodeURIComponent(loaderCode), pathToFileURL(__filename));
