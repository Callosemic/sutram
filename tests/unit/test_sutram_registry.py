import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SUTRAM_JS_DIR = PROJECT_ROOT / "sutram" / "js"
YENVUI_JS_DIR = PROJECT_ROOT / "yenvui" / "js"

class TestSutramRegistry(unittest.TestCase):
    def test_sutram_store_registry_and_extension_lifecycle_in_node(self):
        node_bin = shutil.which("node")
        if not node_bin:
            self.skipTest("Node.js binary not available in PATH.")
        sutram_sdk_path = SUTRAM_JS_DIR / "sutram_sdk.js"
        sutram_utils_path = SUTRAM_JS_DIR / "utils.js"
        projection_engine_path = SUTRAM_JS_DIR / "projection_engine.js"
        sutram_offline_path = SUTRAM_JS_DIR / "offline.js"
        yenvui_physics_path = YENVUI_JS_DIR / "physics.js"

        if not sutram_sdk_path.exists():
            self.skipTest("sutram_sdk.js not found in repository.")

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "package.json").write_text(json.dumps({"type": "module"}), encoding="utf-8")
            (tmp_path / "lit_stub.mjs").write_text(
                "export class LitElement {}\nexport const html = () => '';\nexport const css = () => '';\n",
                encoding="utf-8",
            )
            (tmp_path / "physics_stub.mjs").write_text(
                "export const getEventPath = () => [];\nexport const getEventTarget = () => null;\nexport const physics = { getEventPath, getEventTarget };\n",
                encoding="utf-8",
            )
            # Lightweight in-memory stub of Zustand vanilla and middleware
            (tmp_path / "vanilla.mjs").write_text("""
export function createStore(createState) {
    let state;
    const listeners = new Set();
    const setState = (partial, replace) => {
        const nextState = typeof partial === 'function' ? partial(state) : partial;
        if (!Object.is(nextState, state)) {
            const previousState = state;
            state = (replace ?? (typeof nextState !== 'object' || nextState === null))
                ? nextState
                : Object.assign({}, state, nextState);
            listeners.forEach(listener => listener(state, previousState));
        }
    };
    const getState = () => state;
    const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const destroy = () => { listeners.clear(); };
    const api = { setState, getState, subscribe, destroy };
    state = createState(setState, getState, api);
    return api;
}
""", encoding="utf-8")

            (tmp_path / "middleware.mjs").write_text("""
export const devtools = (fn) => fn;
export const subscribeWithSelector = (fn) => (set, get, api) => {
    const origSubscribe = api.subscribe;
    api.subscribe = (selector, optListener, options) => {
        if (!optListener) return origSubscribe(selector);
        let currentSlice = selector(get());
        return origSubscribe((state, previousState) => {
            const nextSlice = selector(state);
            const eq = options?.equalityFn || Object.is;
            if (!eq(currentSlice, nextSlice)) {
                const prev = currentSlice;
                currentSlice = nextSlice;
                optListener(currentSlice, prev);
            }
        });
    };
    return fn(set, get, api);
};
""", encoding="utf-8")
            shutil.copy2(sutram_utils_path, tmp_path / "utils.mjs")
            sdk_src = sutram_sdk_path.read_text(encoding="utf-8")
            sdk_src = sdk_src.replace("from 'lit'", "from './lit_stub.mjs'")
            sdk_src = sdk_src.replace("from 'zustand/vanilla'", "from './vanilla.mjs'")
            sdk_src = sdk_src.replace("from 'zustand/middleware'", "from './middleware.mjs'")
            sdk_src = sdk_src.replace("from '../../yenvui/js/physics.js'", "from './physics_stub.mjs'")
            sdk_src = sdk_src.replace("from 'sutram-chassis'", "from './physics_stub.mjs'")
            sdk_src = sdk_src.replace("from './utils.js'", "from './utils.mjs'")
            (tmp_path / "sutram_sdk.mjs").write_text(sdk_src, encoding="utf-8")
            proj_src = projection_engine_path.read_text(encoding="utf-8")
            proj_src = proj_src.replace("from './sutram_sdk.js'", "from './sutram_sdk.mjs'")
            (tmp_path / "projection_engine.mjs").write_text(proj_src, encoding="utf-8")
            shutil.copy2(sutram_offline_path, tmp_path / "offline.mjs")
            if yenvui_physics_path.exists():
                shutil.copy2(yenvui_physics_path, tmp_path / "physics.mjs")
            test_script = r"""
import assert from 'node:assert/strict';

class StorageMock {
    constructor() { this.map = new Map(); }
    getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
    setItem(k, v) { this.map.set(k, String(v)); }
    removeItem(k) { this.map.delete(k); }
}

class CustomEventMock extends Event {
    constructor(type, options = {}) {
        super(type, options);
        this.detail = options?.detail ?? null;
    }
}
const CustomEventPolyfill = globalThis.CustomEvent || CustomEventMock;
globalThis.CustomEvent = CustomEventPolyfill;

class BroadcastChannelMock {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    postMessage() {}
    close() {}
    unref() {}
}
globalThis.BroadcastChannel = BroadcastChannelMock;

const et = new EventTarget();
globalThis.window = {
    innerWidth: 1200,
    innerHeight: 800,
    location: { hash: '#/ws_alpha/center/', search: '', pathname: '/' },
    addEventListener: et.addEventListener.bind(et),
    removeEventListener: et.removeEventListener.bind(et),
    dispatchEvent: et.dispatchEvent.bind(et),
    CustomEvent: CustomEventPolyfill,
    Event: Event,
    Sutram: { stores: {} }
};
globalThis.document = {
    hidden: false,
    addEventListener: () => {},
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
globalThis.localStorage = new StorageMock();
globalThis.sessionStorage = new StorageMock();

let activeWs = 'ws_alpha';
const { createSutramStore, StoreRegistry, ExtensionRegistry } = await import('./sutram_sdk.mjs');
const { SutramProjectionCompiler, SutramProjectionPool } = await import('./projection_engine.mjs');
const { debounce, threeWayMergeText, HostPath, truncateFilename, clone, SutramWorker } = await import('./utils.mjs');
const { SutramDB } = await import('./offline.mjs');
const { anchorTopLayerPopover } = await import('./physics.mjs');

// 1. Bound-Scope Persistence
const DomainStore = createSutramStore('DomainTest', {
    items: ['default_item'],
    ephemeral: 'initial'
}, {
    localSync: ['items', 'nonExistentKey'],
    sessionSync: ['ephemeral'],
    onEvict: { 'dom:view': { ephemeral: 'evicted' } }
}, () => activeWs, 'sutram');
DomainStore.setState({ items: ['alpha_intermediate'], ephemeral: 'alpha_temp' });
DomainStore.setState({ items: ['alpha_1', 'alpha_2'], ephemeral: 'alpha_session' });
assert.equal(
    localStorage.getItem('sutram_local_ws_alpha_DomainTest_items'),
    null,
    'Trailing-edge debounce must defer synchronous localStorage writes during rapid state mutations'
);
DomainStore.flushPersistence();
assert.equal(
    localStorage.getItem('sutram_local_ws_alpha_DomainTest_items'),
    JSON.stringify(['alpha_1', 'alpha_2']),
    'flushPersistence() must commit the settled state under ws_alpha key'
);

// Switch scope
activeWs = 'ws_beta';
StoreRegistry.switchTenantScope('ws_beta');
assert.equal(DomainStore.getState().ephemeral, 'initial');

// 2. Scope-stamped eviction
window.dispatchEvent(new CustomEvent('sutram-evict-projection', {
    detail: { id: 'dom:view', scopeId: 'ws_alpha' }
}));
assert.equal(DomainStore.getState().ephemeral, 'initial', 'Stale scope eviction must be ignored');

window.dispatchEvent(new CustomEvent('sutram-evict-projection', {
    detail: { id: 'dom:view', scopeId: 'ws_beta' }
}));
assert.equal(DomainStore.getState().ephemeral, 'evicted', 'Matching scope eviction must apply');

// 3. ExtensionRegistry dynamic slots & unload
let unloadCount = 0;
let activeExts = ['tracker'];
ExtensionRegistry.setFilterPredicate((ext) => activeExts.includes(ext));
ExtensionRegistry.registerExtension('tracker', {
    name: 'Issue Tracker',
    layoutSlots: [
        { slot: 'slots:global', component: 'tracker-modals' },
        { slot: 'slots:sub-navigation', targetParent: 'tasks', id: 'todos', label: 'To-Dos' }
    ]
});
ExtensionRegistry.registerUnloadHook('tracker', () => { unloadCount++; });

ExtensionRegistry.setDynamicLayoutSlots('tracker', [
    { slot: 'slots:sub-navigation', targetParent: 'tasks', id: 'custom_sprint', label: 'Custom Sprint' }
]);
assert.equal(ExtensionRegistry.getExtension('tracker').layoutSlots.some(s => s.id === 'custom_sprint'), true);

activeExts = [];
ExtensionRegistry.executeUnload('tracker');
assert.equal(unloadCount, 1);
assert.equal(ExtensionRegistry.getExtension('tracker').layoutSlots.some(s => s.id === 'custom_sprint'), false);
// 4. Transactional Scope Transition Lock
let recompileCount = 0;
let transitionEvents = [];
window.addEventListener('sutram-layout-recompile', () => { recompileCount++; });
window.addEventListener('sutram:scope-transition-start', (e) => { transitionEvents.push(`start:${e.detail?.targetScopeId}`); });
window.addEventListener('sutram:scope-transition-end', (e) => { transitionEvents.push(`end:${e.detail?.scopeId}`); });

activeWs = 'ws_alpha';
StoreRegistry.beginScopeTransition('ws_alpha');
assert.equal(StoreRegistry.isTransitioning(), true);
ExtensionRegistry.compileLayout();
ExtensionRegistry.compileLayout();
assert.equal(recompileCount, 0, 'compileLayout must be suppressed while scope transition lock is active');

StoreRegistry.endScopeTransition();
assert.equal(StoreRegistry.isTransitioning(), false);
assert.equal(recompileCount, 1, 'endScopeTransition must flush exactly one compileLayout pass');
assert.deepEqual(transitionEvents, ['start:ws_alpha', 'end:ws_alpha']);
// 5. Group-Scoped Bulk Action Aggregation (Quickpack 'share' vs Sub-tab 'vcs' / 'file')
ExtensionRegistry.registerExtension('git', {
    name: 'Version Control',
    entityActions: [
        {
            targetEntity: 'diff',
            targetEntities: ['diff'],
            id: 'git-push',
            bulkGroupKey: 'git-push',
            label: 'Push',
            bulkLabel: (items) => `Commit & Push (${items.length})`,
            group: 'vcs',
            bulkable: true,
            bulkAction: async () => {}
        }
    ]
});
ExtensionRegistry.registerExtension('gather', {
    name: 'Context Gatherer',
    entityActions: [
        {
            targetEntity: 'file',
            targetEntities: ['file', 'diff'],
            id: 'quickpack-compile',
            bulkGroupKey: 'quickpack-compile',
            label: 'Compile Quickpack',
            group: 'share',
            bulkable: true,
            bulkAction: async () => {}
        }
    ]
});
activeExts = ['git', 'gather'];
const selectedDiffs = [
    { entityType: 'file:diff', data: { filepath: 'ctx://diffs/alpha_diffs.txt', repoDir: 'alpha' } },
    { entityType: 'file:diff', data: { filepath: 'ctx://diffs/beta_diffs.txt', repoDir: 'beta' } }
];
const shareBulk = ExtensionRegistry.getAggregatableActions(selectedDiffs, { group: 'share' });
const vcsBulk = ExtensionRegistry.getAggregatableActions(selectedDiffs, { group: 'vcs' });
assert.equal(shareBulk.some(a => a.id === 'bulk-git-push'), false, 'vcs bulk actions must never leak into Quickpack share group');
assert.equal(shareBulk.some(a => a.id === 'bulk-quickpack-compile'), true, 'share bulk actions must appear in Quickpack share group');
assert.equal(vcsBulk.length, 1, 'vcs bulk actions must be returned when querying group: vcs');
assert.equal(vcsBulk[0].label, 'Commit & Push (2)');
// 6. Cancellable debounce
let debounceFired = false;
const fn = debounce(() => { debounceFired = true; }, 20);
fn();
fn.cancel();
await new Promise(r => setTimeout(r, 40));
assert.equal(debounceFired, false);

// 7. Settings Actions Metadata Preservation (component & saveLabel)
ExtensionRegistry.registerExtension('custom_panel_ext', {
    name: 'Custom Panel Extension',
    settingsActions: [
        {
            id: 'custom_embedded_panel',
            label: 'Embedded Panel',
            icon: 'sliders',
            component: 'custom-settings-panel',
            saveLabel: 'Save Custom Panel',
            onClick: () => {}
        }
    ]
});
activeExts = ['git', 'gather', 'custom_panel_ext'];
const settingsActs = ExtensionRegistry.getSettingsActions();
const customAct = settingsActs.find(a => a.id === 'custom_embedded_panel');
assert.ok(customAct, 'Custom settingsAction must be returned by getSettingsActions()');
assert.equal(customAct.component, 'custom-settings-panel', 'getSettingsActions() must preserve component property');
assert.equal(customAct.saveLabel, 'Save Custom Panel', 'getSettingsActions() must preserve saveLabel property');
// 8. HostPath, truncateFilename, clone, & StoreRegistry ScopedStorage
assert.equal(HostPath.basename('/Users/alice/repos/sutram/'), 'sutram');
assert.equal(HostPath.join('/Users/alice', 'repos', 'sutram'), '/Users/alice/repos/sutram');
assert.equal(HostPath.parent('/Users/alice/repos'), '/Users/alice');
assert.equal(HostPath.parent('/Users'), '/');
assert.equal(HostPath.join('C:\\Users\\alice', 'Documents'), 'C:/Users/alice/Documents');
assert.equal(truncateFilename('very_long_filename_example.md', 14), 'very_long_….md');
assert.deepEqual(clone({ a: [1, 2] }), { a: [1, 2] });
StoreRegistry.setScopedStorage('test_key', 'scoped_val', 'ws_alpha');
assert.equal(StoreRegistry.getScopedStorage('test_key', null, 'ws_alpha'), 'scoped_val');

// 9. threeWayMergeText Behavioral & CRLF Vectors
const disjoint = threeWayMergeText('a\nb\nc\nd', 'a_mod\nb\nc\nd', 'a\nb\nc\nd_mod');
assert.deepEqual(disjoint, { merged: 'a_mod\nb\nc\nd_mod', clean: true });

const zombieAck = threeWayMergeText('line1\nline2\nline3', 'line1\nline2_v1\nline2_v2\nline3', 'line1\nline2_v1\nline3');
assert.deepEqual(zombieAck, { merged: 'line1\nline2_v1\nline2_v2\nline3', clean: true });

const crlfMerge = threeWayMergeText('one\r\ntwo\r\nthree', 'one_mod\r\ntwo\r\nthree', 'one\r\ntwo\r\nthree_mod');
assert.deepEqual(crlfMerge, { merged: 'one_mod\r\ntwo\r\nthree_mod', clean: true });
const conflictMerge = threeWayMergeText('alpha\nbeta\ngamma', 'alpha\nbeta_local\ngamma', 'alpha\nbeta_remote\ngamma');
assert.equal(conflictMerge.clean, false);

// 10. SutramProjectionCompiler & SutramProjectionPool (Generational Mark-and-Sweep, Rekey, & Evict)
ExtensionRegistry.setTabOrder(['tasks', 'context']);
const compiledSlots = SutramProjectionCompiler.getCompiledLayout();
assert.ok(Array.isArray(compiledSlots), 'getCompiledLayout() must return a compiled slot array');
const pool = new SutramProjectionPool();
pool.beginPass();
const editorNodeA = pool.resolve('sutram-editor-projection', 'vfs://alpha/old.md', { filepath: 'vfs://alpha/old.md' });
const toolNodeB = pool.resolve('sutram-ext-git', 'git:status');
pool.commitPass();

assert.equal(editorNodeA.dataset.subId, 'vfs://alpha/old.md');
assert.equal(editorNodeA.filepath, 'vfs://alpha/old.md');

// Rekeying preserves the exact DOM node instance while migrating its subId
assert.equal(pool.rekey('vfs://alpha/old.md', 'vfs://alpha/new.md'), true);
assert.equal(editorNodeA.dataset.subId, 'vfs://alpha/new.md');

// Next render pass: resolving under the new ID returns the preserved DOM instance, while unreferenced toolNodeB is swept
pool.beginPass();
const editorNodeAfterRename = pool.resolve('sutram-editor-projection', 'vfs://alpha/new.md');
pool.commitPass();
assert.strictEqual(editorNodeAfterRename, editorNodeA, 'Rekeyed projection must reuse the exact DOM element instance');
assert.equal(pool._activeNodes.has('sutram-ext-git:git:status'), false, 'Unreferenced nodes must be swept on commitPass()');

// Extension eviction removes matching extension nodes
pool.beginPass();
const extNode = pool.resolve('sutram-ext-notes', 'notes:main');
pool.commitPass();
assert.equal(pool.evictExtension('notes'), true);
assert.equal(extNode.removed, true);
assert.equal(pool._activeNodes.has('sutram-ext-notes:notes:main'), false);
// 11. RFC 4: SutramWorker < 500 synchronous fast-path and >= 500 fallback/worker search
const smallList = ['vfs://alpha/app.py', 'vfs://alpha/utils.py', 'vfs://alpha/readme.md'];
const smallSearch = await SutramWorker.dispatch('FUZZY_SEARCH', { items: smallList, query: 'utils' });
assert.equal(smallSearch.results[0], 'vfs://alpha/utils.py', 'Sub-500 item FUZZY_SEARCH must resolve ranked matches');

const largeList = Array.from({ length: 600 }, (_, idx) => `vfs://alpha/module_${idx}.py`);
largeList.push('vfs://alpha/target_needle_file.py');
const largeSearch = await SutramWorker.dispatch('FUZZY_SEARCH', { items: largeList, query: 'target_needle' });
assert.equal(largeSearch.results[0], 'vfs://alpha/target_needle_file.py', '>= 500 item FUZZY_SEARCH must resolve ranked matches');

// 12. RFC 1: SutramDB Lazy LRU (readonly getVFSBlob + batched _flushLRUQueue into manifest_cache)
const txModes = [];
const mockStores = {
    vfs_cache: new Map([['ws_alpha::/api/ws_alpha/fs/fetch?file=vfs://alpha/app.py', { blob: { size: 42, text: 'hello' }, ts: 1000 }]]),
    manifest_cache: new Map()
};
SutramDB._db = {
    transaction: (storeNames, mode) => {
        txModes.push({ storeNames, mode });
        const txObj = {
            objectStore: (name) => ({
                get: (key) => {
                    const req = {};
                    queueMicrotask(() => {
                        req.result = mockStores[name].get(key);
                        if (req.onsuccess) req.onsuccess({ target: req });
                        if (txObj.oncomplete) txObj.oncomplete();
                    });
                    return req;
                },
                put: (val, key) => {
                    mockStores[name].set(key, val);
                }
            })
        };
        return txObj;
    }
};

const cachedBlob = await SutramDB.getVFSBlob('ws_alpha', '/api/ws_alpha/fs/fetch?file=vfs://alpha/app.py&t=12345');
assert.deepEqual(cachedBlob, { size: 42, text: 'hello' }, 'getVFSBlob must resolve the cached blob');
assert.equal(txModes[0].mode, 'readonly', 'getVFSBlob must use a readonly transaction');
assert.equal(SutramDB._lruBuffer.has('ws_alpha::/api/ws_alpha/fs/fetch?file=vfs://alpha/app.py'), true, 'getVFSBlob must stage access timestamp in _lruBuffer');
await SutramDB._flushLRUQueue();
assert.equal(SutramDB._lruBuffer.size, 0, '_flushLRUQueue must drain _lruBuffer');
const lruIndex = mockStores.manifest_cache.get('vfs_lru_index');
assert.ok(lruIndex && lruIndex['ws_alpha::/api/ws_alpha/fs/fetch?file=vfs://alpha/app.py'] >= 1000, '_flushLRUQueue must persist compact vfs_lru_index in manifest_cache');

// 13. anchorTopLayerPopover (Bidirectional Collision Flipping & Direction Handling)
const popoverMock = {
    style: {},
    offsetHeight: 200
};
// 13a. Sufficient bottom clearance: drops downward
const topTrigger = {
    getBoundingClientRect: () => ({ top: 50, bottom: 90, left: 100, right: 200 }),
    hasAttribute: () => false,
    parentElement: null,
    getRootNode: () => ({ host: null })
};
anchorTopLayerPopover(topTrigger, popoverMock, { mode: 'menu', align: 'left', offset: 5 });
assert.equal(popoverMock.style.top, '95px', 'Dropdown must drop downward when space below is sufficient');
assert.equal(popoverMock.style.bottom, 'auto', 'Downward dropdown must clear style.bottom');
// 13b. Viewport bottom collision: flips upward
const bottomTrigger = {
    getBoundingClientRect: () => ({ top: 700, bottom: 740, left: 100, right: 200 }),
    hasAttribute: () => false,
    parentElement: null,
    getRootNode: () => ({ host: null })
};
anchorTopLayerPopover(bottomTrigger, popoverMock, { mode: 'menu', align: 'left', offset: 5 });
assert.equal(popoverMock.style.bottom, '105px', 'Dropdown near viewport bottom must flip upward (800 - 700 + 5)');
assert.equal(popoverMock.style.top, 'auto', 'Flipped dropdown must clear style.top to auto');

// 13c. Explicit direction: 'up' forces upward drop even with ample bottom space
anchorTopLayerPopover(topTrigger, popoverMock, { mode: 'menu', direction: 'up', offset: 5 });
assert.equal(popoverMock.style.bottom, '755px', 'Explicit direction: up must drop upward (800 - 50 + 5)');
assert.equal(popoverMock.style.top, 'auto');

// 13d. Explicit direction: 'down' suppresses collision flipping near viewport bottom
anchorTopLayerPopover(bottomTrigger, popoverMock, { mode: 'menu', direction: 'down', offset: 5 });
assert.equal(popoverMock.style.top, '745px', 'Explicit direction: down must preserve downward positioning');
assert.equal(popoverMock.style.bottom, 'auto');

console.log('ALL_SUTRAM_TESTS_PASSED');
process.exit(0);
"""
            (tmp_path / "run_test.mjs").write_text(test_script, encoding="utf-8")
            res = subprocess.run(
                [node_bin, "run_test.mjs"],
                cwd=tmp_path.as_posix(),
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(res.returncode, 0, f"Node test failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
            self.assertIn("ALL_SUTRAM_TESTS_PASSED", res.stdout)

    def test_yenvui_chassis_provider_contract_and_ui_adapter_in_node(self):
        """Verifies yenvui/js/index.js fulfills REQUIRED_CHASSIS_PRIMITIVES and SutramUIAdapter registers all pass-through <sutram-*> elements."""
        node_bin = shutil.which("node")
        if not node_bin:
            self.skipTest("Node.js binary not available in PATH.")

        yenvui_index_path = YENVUI_JS_DIR / "index.js"
        sutram_prim_path = SUTRAM_JS_DIR / "primitives.js"
        self.assertTrue(yenvui_index_path.exists(), "yenvui/js/index.js must exist")
        self.assertTrue(sutram_prim_path.exists(), "sutram/js/primitives.js must exist")

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "package.json").write_text(json.dumps({"type": "module"}), encoding="utf-8")

            # Copy all yenvui/js/*.js files and stub 'lit' + 'lit/directives/*' + 'codemirror-core'
            for js_file in YENVUI_JS_DIR.glob("*.js"):
                src = js_file.read_text(encoding="utf-8")
                src = src.replace("from 'lit'", "from './lit_stub.mjs'").replace('from "lit"', 'from "./lit_stub.mjs"')
                src = src.replace("from 'lit/directives/live.js'", "from './lit_stub.mjs'")
                src = src.replace("from 'lit/directives/unsafe-html.js'", "from './lit_stub.mjs'")
                (tmp_path / js_file.name).write_text(src, encoding="utf-8")

            (tmp_path / "lit_stub.mjs").write_text(
                "export class LitElement { static properties = {}; static styles = []; connectedCallback() {} disconnectedCallback() {} updated() {} requestUpdate() {} }\n"
                "export const html = () => '';\n"
                "export const css = () => '';\n"
                "export const unsafeCSS = () => '';\n"
                "export const live = (v) => v;\n"
                "export const unsafeHTML = (v) => v;\n",
                encoding="utf-8",
            )

            prim_src = sutram_prim_path.read_text(encoding="utf-8")
            start_idx = prim_src.index("export const REQUIRED_CHASSIS_PRIMITIVES")
            end_idx = prim_src.index("SutramUIAdapter.registerChassis(Chassis);")
            adapter_code = prim_src[start_idx:end_idx]

            test_mjs = f"""
import assert from 'node:assert/strict';

const definedTags = new Map();
globalThis.HTMLElement = class HTMLElement {{}};
globalThis.customElements = {{
    get: (tag) => definedTags.get(tag),
    define: (tag, cls) => definedTags.set(tag, cls)
}};
globalThis.window = {{
    addEventListener: () => {{}},
    removeEventListener: () => {{}},
    dispatchEvent: () => {{}},
    matchMedia: () => ({{ matches: false }})
}};
globalThis.document = {{
    body: {{ getAttribute: () => 'dark', style: {{}} }},
    head: {{ appendChild: () => {{}} }},
    getElementById: () => ({{}}),
    createElement: () => ({{ style: {{}}, setAttribute: () => {{}} }}),
    addEventListener: () => {{}},
    removeEventListener: () => {{}}
}};

const YenvuiChassis = await import('./index.js');
{adapter_code}

// 1. Validate real YenvuiChassis exports against REQUIRED_CHASSIS_PRIMITIVES
assert.equal(YenvuiChassis.CHASSIS_PROVIDER_META.name, 'yenvui');
assert.equal(validateChassisContract(YenvuiChassis), true);
assert.ok(YenvuiChassis.sharedStyles !== undefined);
assert.equal(typeof YenvuiChassis.physics.getEventPath, 'function');
assert.equal(typeof YenvuiChassis.physics.anchorTopLayerPopover, 'function');

// 2. Verify SutramUIAdapter.registerChassis mounts all pass-through <sutram-*> custom elements
SutramUIAdapter.registerChassis(YenvuiChassis);
for (const [sutramTag, exportKey] of Object.entries(SutramUIAdapter.PASSTHROUGH_MAP)) {{
    const registeredCls = customElements.get(sutramTag);
    assert.equal(typeof registeredCls, 'function', `Expected ${{sutramTag}} to be registered by SutramUIAdapter`);
    assert.ok(
        registeredCls.prototype instanceof YenvuiChassis[exportKey],
        `${{sutramTag}} must inherit from YenvuiChassis.${{exportKey}}`
    );
}}

// 3. Verify validateChassisContract rejects incomplete chassis providers
const BadChassis = {{ ...YenvuiChassis, CHASSIS_PROVIDER_META: {{ name: 'broken-chassis' }} }};
delete BadChassis.Modal;
delete BadChassis.Editor;
assert.throws(
    () => validateChassisContract(BadChassis),
    /\\[Sutram Boot Error\\] Chassis 'broken-chassis' fails contract\\. Missing primitives: Modal, Editor/
);
console.log('CHASSIS_CONTRACT_TESTS_PASSED');
"""
            (tmp_path / "test_chassis.mjs").write_text(test_mjs, encoding="utf-8")
            res = subprocess.run(
                [node_bin, "test_chassis.mjs"],
                cwd=tmp_path.as_posix(),
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(res.returncode, 0, f"Chassis contract test failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
            self.assertIn("CHASSIS_CONTRACT_TESTS_PASSED", res.stdout)

    def test_yenvui_diff_utils_and_sutram_ring0_algorithms_in_node(self):
        """Tests Ring 0 pure algorithms in yenvui/js/diff-utils.js and sutram/js/utils.js."""
        node_bin = shutil.which("node")
        if not node_bin:
            self.skipTest("Node.js binary not available in PATH.")

        diff_utils_path = YENVUI_JS_DIR / "diff-utils.js"
        sutram_utils_path = SUTRAM_JS_DIR / "utils.js"

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "package.json").write_text(json.dumps({"type": "module"}), encoding="utf-8")
            shutil.copy2(diff_utils_path, tmp_path / "diff-utils.mjs")
            shutil.copy2(sutram_utils_path, tmp_path / "utils.mjs")

            test_mjs = """
import assert from 'node:assert/strict';
import {
    computeIntraLineTokens,
    parseRawHunks,
    parseUnifiedDiff,
    parseDiffPayload
} from './diff-utils.mjs';
import {
    compileDagWavefronts,
    extractTemplateVariables,
    interpolateTemplateVariables,
    buildFileTree,
    resolveDirectoryState,
    shallowEqual,
    slugify,
    fuzzyFilterObjects
} from './utils.mjs';

// 1. diff-utils.js: Intra-line token diffing & unified diff parsing
const intra = computeIntraLineTokens('const x = 10;', 'const x = 20;');
assert.equal(intra.oldTokens.some(t => t.changed && t.text.includes('1')), true);
assert.equal(intra.newTokens.some(t => t.changed && t.text.includes('2')), true);
const rawHunks = parseRawHunks('line1\\nold_line\\nline3', 'line1\\nnew_line\\nline3');
assert.equal(rawHunks.interleaved.some(r => r.type === 'removed' && r.text === 'old_line'), true);
assert.equal(rawHunks.interleaved.some(r => r.type === 'added' && r.text === 'new_line'), true);

const unified = parseUnifiedDiff('@@ -1,2 +1,2 @@\\n-foo\\n+bar\\n baz');
assert.equal(unified.split.searchLines.some(l => l.text === 'foo' && l.type === 'removed'), true);
assert.equal(unified.split.replaceLines.some(l => l.text === 'bar' && l.type === 'added'), true);

const payload = parseDiffPayload({ searchStr: 'a\\nb', replaceStr: 'a\\nc' });
assert.equal(payload.maxChars >= 1, true);

// 2. utils.js: compileDagWavefronts
const waves = compileDagWavefronts([
    { id: 'step_1', parents: [] },
    { id: 'step_2a', parents: ['step_1'] },
    { id: 'step_2b', parents: ['step_1'] },
    { id: 'step_3', parents: ['step_2a', 'step_2b'] }
]);
assert.deepEqual(waves.map(w => w.map(n => n.id)), [['step_1'], ['step_2a', 'step_2b'], ['step_3']]);

// Cyclic fallback terminates cleanly without infinite loop
const cyclicWaves = compileDagWavefronts([
    { id: 'a', parents: ['b'] },
    { id: 'b', parents: ['a'] }
]);
assert.equal(cyclicWaves.length, 1);
assert.equal(cyclicWaves[0].length, 2);

// 3. utils.js: extractTemplateVariables & interpolateTemplateVariables
const tpl = 'Hello {{ user_name }}, role is {{ macro_role | Architect }}.';
const vars = extractTemplateVariables(tpl);
assert.deepEqual(
    vars.map(v => ({ name: v.name, default: v.default, required: v.required })),
    [
        { name: 'user_name', default: null, required: true },
        { name: 'role', default: 'Architect', required: false }
    ]
);
assert.equal(
    interpolateTemplateVariables(tpl, { user_name: 'Ada' }),
    'Hello Ada, role is Architect.'
);

// 4. utils.js: buildFileTree & resolveDirectoryState
const tree = buildFileTree(['alpha/src/index.js', 'alpha/README.md', 'alpha/.gitkeep']);
const rootState = resolveDirectoryState(tree, ['alpha'], { ignoreDotKeep: true });
assert.deepEqual(rootState.validPath, ['alpha']);
assert.equal(rootState.entries.length, 2, '.gitkeep must be filtered when ignoreDotKeep is true');
assert.equal(rootState.entries[0].type, 'directory');
assert.equal(rootState.entries[0].name, 'src');
// 5. utils.js: shallowEqual, slugify & fuzzyFilterObjects
assert.equal(shallowEqual(new Set(['a', 'b']), new Set(['a', 'b'])), true);
assert.equal(shallowEqual(new Set(['a']), new Set(['b'])), false);
assert.equal(slugify('Hello World! 2026'), 'hello_world_2026');

const ranked = fuzzyFilterObjects(['src/components/modal.js', 'src/utils/math.js'], 'modal');
assert.equal(ranked[0], 'src/components/modal.js');

console.log('RING0_ALGORITHM_TESTS_PASSED');
"""
            (tmp_path / "test_ring0.mjs").write_text(test_mjs, encoding="utf-8")
            res = subprocess.run(
                [node_bin, "test_ring0.mjs"],
                cwd=tmp_path.as_posix(),
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(res.returncode, 0, f"Ring 0 algorithm test failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
            self.assertIn("RING0_ALGORITHM_TESTS_PASSED", res.stdout)

    def test_sutram_poller_shortcuts_and_network_hysteresis_in_node(self):
        """Tests createJobPoller sequential chaining, initShortcutRouter context precedence, and NetworkHysteresisManager."""
        node_bin = shutil.which("node")
        if not node_bin:
            self.skipTest("Node.js binary not available in PATH.")

        poller_path = SUTRAM_JS_DIR / "poller.js"
        shortcuts_path = SUTRAM_JS_DIR / "shortcuts.js"
        offline_path = SUTRAM_JS_DIR / "offline.js"

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "package.json").write_text(json.dumps({"type": "module"}), encoding="utf-8")
            shutil.copy2(poller_path, tmp_path / "poller.mjs")
            shutil.copy2(shortcuts_path, tmp_path / "shortcuts.mjs")
            shutil.copy2(offline_path, tmp_path / "offline.mjs")

            test_mjs = """
import assert from 'node:assert/strict';

const et = new EventTarget();
globalThis.window = {
    addEventListener: et.addEventListener.bind(et),
    removeEventListener: et.removeEventListener.bind(et),
    dispatchEvent: et.dispatchEvent.bind(et),
    Sutram: { stores: { Environment: { getState: () => ({ isOffline: false }) } } }
};
globalThis.document = { hidden: false };

const { createJobPoller } = await import('./poller.mjs');
const { initShortcutRouter } = await import('./shortcuts.mjs');
const { NetworkHysteresisManager } = await import('./offline.mjs');
// 1. createJobPoller: Sequential job chaining (job_1 -> job_2 -> completed)
const visitedUrls = [];
const responses = {
    'jobs/job_1': { status: 'completed', message: 'Step 1 done', artifact: { next_job_id: 'job_2', step1: true } },
    'jobs/job_2': { status: 'completed', message: 'Step 2 done', artifact: { step2: true } }
};
const poller = createJobPoller({
    get: async (url) => {
        visitedUrls.push(url);
        return {
            ok: true,
            status: 200,
            json: async () => responses[url]
        };
    }
});
const finalData = await new Promise((resolve, reject) => {
    poller('job_1', {
        interval: 10,
        onComplete: (data) => resolve(data),
        onError: (err) => reject(err)
    });
});
assert.ok(finalData, 'Poller must resolve chained jobs to completion');
assert.equal(finalData.artifact.step2, true);
assert.deepEqual(visitedUrls, ['jobs/job_1', 'jobs/job_2']);

// 2. initShortcutRouter: Context precedence (modal > subtab > global)
let triggered = null;
const mockRegistry = {
    shortcuts: {
        'global': { 'ctrl+s': () => { triggered = 'global'; } },
        'modal:settings': { 'ctrl+s': () => { triggered = 'modal'; } }
    }
};
initShortcutRouter(mockRegistry, () => ['modal:settings', 'global']);
const keyEv = new Event('keydown', { cancelable: true });
Object.assign(keyEv, { key: 's', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false });
window.dispatchEvent(keyEv);
assert.equal(triggered, 'modal', 'Higher-priority context (modal:settings) must win over global');

// 3. NetworkHysteresisManager: Burst verification inside check()
let pingCalls = 0;
globalThis.fetch = async () => {
    pingCalls++;
    return { ok: true, status: 200 };
};
const hysteresis = new NetworkHysteresisManager('/?t={t}', 2);
let onlineResolved = 0;
await hysteresis.check(async () => { onlineResolved++; });
assert.equal(pingCalls, 2, 'NetworkHysteresisManager must execute threshold (2) pings before restoring');
assert.equal(onlineResolved, 1, 'Consecutive successful burst pings must invoke onRestored callback');

console.log('ORCHESTRATOR_TESTS_PASSED');
"""
            (tmp_path / "test_orchestrators.mjs").write_text(test_mjs, encoding="utf-8")
            res = subprocess.run(
                [node_bin, "test_orchestrators.mjs"],
                cwd=tmp_path.as_posix(),
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(res.returncode, 0, f"Orchestrator test failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
            self.assertIn("ORCHESTRATOR_TESTS_PASSED", res.stdout)

    def test_sutram_combobox_target_binding_and_settings_schema_in_node(self):
        """Tests SutramCombobox normalization & navigation, SutramTargetBinding, and dynamic settings schema options."""
        node_bin = shutil.which("node")
        if not node_bin:
            self.skipTest("Node.js binary not available in PATH.")

        inputs_path = SUTRAM_JS_DIR / "inputs.js"
        if not inputs_path.exists():
            self.skipTest("inputs.js not found in repository.")

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "package.json").write_text(json.dumps({"type": "module"}), encoding="utf-8")
            (tmp_path / "lit_stub.mjs").write_text(
                "export class LitElement { connectedCallback() {} disconnectedCallback() {} requestUpdate() {} dispatchEvent() {} }\n"
                "export const html = () => '';\n"
                "export const css = () => '';\n",
                encoding="utf-8",
            )
            (tmp_path / "chassis_stub.mjs").write_text(
                "export class Input { connectedCallback() {} addEventListener() {} dispatchEvent() {} }\n"
                "export class Select { connectedCallback() {} addEventListener() {} dispatchEvent() {} }\n"
                "export class Textarea { connectedCallback() {} addEventListener() {} dispatchEvent() {} }\n"
                "export class Toggle { connectedCallback() {} addEventListener() {} dispatchEvent() {} }\n",
                encoding="utf-8",
            )
            (tmp_path / "sutram_sdk_stub.mjs").write_text(
                "import { LitElement } from './lit_stub.mjs';\n"
                "export class SutramElement extends LitElement {\n"
                "    constructor() {\n"
                "        super();\n"
                "        this._outsideClickCallbacks = [];\n"
                "    }\n"
                "    registerOutsideClick(cb) {\n"
                "        this._outsideClickCallbacks.push(cb);\n"
                "    }\n"
                "}\n",
                encoding="utf-8",
            )
            (tmp_path / "shared_styles_stub.mjs").write_text("export const sharedStyles = '';\n", encoding="utf-8")

            inputs_src = inputs_path.read_text(encoding="utf-8")
            inputs_src = inputs_src.replace("from 'sutram-chassis'", "from './chassis_stub.mjs'")
            inputs_src = inputs_src.replace("from 'lit'", "from './lit_stub.mjs'")
            inputs_src = inputs_src.replace("from './sutram_sdk.js'", "from './sutram_sdk_stub.mjs'")
            inputs_src = inputs_src.replace("from './shared_styles.js'", "from './shared_styles_stub.mjs'")
            (tmp_path / "inputs.mjs").write_text(inputs_src, encoding="utf-8")

            test_mjs = """
import assert from 'node:assert/strict';

const tags = new Map();
globalThis.customElements = {
    get: (t) => tags.get(t),
    define: (t, c) => tags.set(t, c)
};
class CustomEventMock extends Event {
    constructor(type, opt = {}) {
        super(type, opt);
        this.detail = opt.detail ?? null;
    }
}
globalThis.CustomEvent = globalThis.CustomEvent || CustomEventMock;

const { SutramCombobox, SutramTargetBinding } = await import('./inputs.mjs');

// 1. SutramCombobox option normalization & filtering
const combo = new SutramCombobox();
combo.options = [
    'simple-model',
    { value: 'gpt-4o', label: 'GPT-4o Omnichannel', badge: 'OpenAI' },
    { id: 'claude-3-5', name: 'Claude 3.5 Sonnet', detail: 'Anthropic' }
];
const normalized = combo._getNormalizedOptions();
assert.equal(normalized.length, 3);
assert.deepEqual(normalized[0], { value: 'simple-model', label: 'simple-model', badge: '' });
assert.deepEqual(normalized[1], { value: 'gpt-4o', label: 'GPT-4o Omnichannel', badge: 'OpenAI' });
assert.deepEqual(normalized[2], { value: 'claude-3-5', label: 'Claude 3.5 Sonnet', badge: 'Anthropic' });

combo._filterText = 'simple';
assert.equal(combo._getFilteredOptions().length, 1);
assert.equal(combo._getFilteredOptions()[0].value, 'simple-model');

combo._filterText = 'anthropic';
assert.equal(combo._getFilteredOptions().length, 1);
assert.equal(combo._getFilteredOptions()[0].value, 'claude-3-5');

combo._filterText = '';
combo.options = Array.from({ length: 80 }, (_, i) => `model-${i}`);
assert.equal(combo._getFilteredOptions().length, 60, 'SutramCombobox must cap rendered items at 60');

// 2. SutramCombobox keyboard navigation & outside-click dismissal
combo.options = ['alpha', 'beta', 'gamma'];
combo._open = false;
combo._highlightedIndex = -1;
combo._filterText = null;

combo._handleKeyDown({ key: 'ArrowDown', preventDefault() {} });
assert.equal(combo._open, true);
assert.equal(combo._highlightedIndex, 0);

combo._handleKeyDown({ key: 'ArrowDown', preventDefault() {} });
assert.equal(combo._highlightedIndex, 1);

combo._handleKeyDown({ key: 'ArrowDown', preventDefault() {} });
assert.equal(combo._highlightedIndex, 2);

// Wrap modulo length
combo._handleKeyDown({ key: 'ArrowDown', preventDefault() {} });
assert.equal(combo._highlightedIndex, 0);

// ArrowUp wrap
combo._handleKeyDown({ key: 'ArrowUp', preventDefault() {} });
assert.equal(combo._highlightedIndex, 2);

// Enter commits highlighted value
let committedEvt = null;
combo.dispatchEvent = (e) => { committedEvt = e; };
combo._handleKeyDown({ key: 'Enter', preventDefault() {} });
assert.equal(combo.value, 'gamma');
assert.equal(combo._open, false);
assert.equal(committedEvt.detail.value, 'gamma');

// Escape closes menu and resets filterText
combo._open = true;
combo._filterText = 'gam';
combo._handleKeyDown({ key: 'Escape', preventDefault() {} });
assert.equal(combo._open, false);
assert.equal(combo._filterText, null);

// Outside click callback dismisses open menu
combo.connectedCallback();
combo._open = true;
combo._filterText = 'temp';
assert.equal(combo._outsideClickCallbacks.length, 1);
combo._outsideClickCallbacks[0]();
assert.equal(combo._open, false);
assert.equal(combo._filterText, null);

// 3. SutramTargetBinding value normalization & event dispatch
const binding = new SutramTargetBinding();
binding.value = 'openai::gpt-4o';
assert.deepEqual(binding._normalizeValue(), { endpoint: 'openai', model: 'gpt-4o' });

binding.value = 'claude-3-opus';
assert.deepEqual(binding._normalizeValue(), { endpoint: '', model: 'claude-3-opus' });

binding.value = { endpoint: 'local-ollama', model: 'mistral-7b' };
assert.deepEqual(binding._normalizeValue(), { endpoint: 'local-ollama', model: 'mistral-7b' });

binding.value = { endpoint_id: 'modal-cluster', model: 'deepseek-v3' };
assert.deepEqual(binding._normalizeValue(), { endpoint: 'modal-cluster', model: 'deepseek-v3' });

binding.value = null;
assert.deepEqual(binding._normalizeValue(), { endpoint: '', model: '' });

// Custom keys
binding.endpointKey = 'provider';
binding.modelKey = 'engine';
binding.value = 'groq::llama-3';
assert.deepEqual(binding._normalizeValue(), { provider: 'groq', engine: 'llama-3' });

// Functional model candidates resolution
const modelCatalog = {
    'aws-bedrock': ['claude-3-sonnet', 'titan-embed'],
    'ollama': ['llama-3', 'qwen-2.5']
};
binding.models = (epId) => modelCatalog[epId] || [];
assert.deepEqual(binding.models('ollama'), ['llama-3', 'qwen-2.5']);
assert.deepEqual(binding.models('aws-bedrock'), ['claude-3-sonnet', 'titan-embed']);
assert.deepEqual(binding.models('missing'), []);

let bindingEvt = null;
binding.dispatchEvent = (e) => { bindingEvt = e; };
binding._emitBinding({ provider: 'groq', engine: 'llama-3-70b' });
assert.deepEqual(binding.value, { provider: 'groq', engine: 'llama-3-70b' });
assert.deepEqual(bindingEvt.detail.value, { provider: 'groq', engine: 'llama-3-70b' });

// 4. Dynamic options_from schema extraction and effectiveVal fallback
const formData = {
    compute_endpoints: [
        { id: 'ep-alpha', name: 'Alpha Cluster' },
        { id: 'ep-beta', name: 'Beta VPC' }
    ]
};
const selectField = {
    id: 'active_ep',
    type: 'select',
    options_from: {
        field: 'compute_endpoints',
        value_key: 'id',
        label_key: 'name'
    }
};
const srcArr = Array.isArray(formData[selectField.options_from.field]) ? formData[selectField.options_from.field] : [];
const extractedOptions = srcArr.map(item => ({
    value: String(item[selectField.options_from.value_key] || item[selectField.options_from.label_key]),
    label: String(item[selectField.options_from.label_key] || item[selectField.options_from.value_key])
}));
assert.deepEqual(extractedOptions, [
    { value: 'ep-alpha', label: 'Alpha Cluster' },
    { value: 'ep-beta', label: 'Beta VPC' }
]);

const validVal = 'ep-beta';
const effValid = (validVal !== undefined && validVal !== '' && extractedOptions.some(o => o.value === validVal))
    ? validVal
    : (extractedOptions[0]?.value ?? validVal ?? '');
assert.equal(effValid, 'ep-beta');

const invalidVal = 'ep-deleted';
const effFallback = (invalidVal !== undefined && invalidVal !== '' && extractedOptions.some(o => o.value === invalidVal))
    ? invalidVal
    : (extractedOptions[0]?.value ?? invalidVal ?? '');
assert.equal(effFallback, 'ep-alpha', 'effectiveVal must clamp to first available option when active value is missing');

console.log('INPUTS_AND_SETTINGS_TESTS_PASSED');
"""
            (tmp_path / "test_inputs.mjs").write_text(test_mjs, encoding="utf-8")
            res = subprocess.run(
                [node_bin, "test_inputs.mjs"],
                cwd=tmp_path.as_posix(),
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(res.returncode, 0, f"Inputs test failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
            self.assertIn("INPUTS_AND_SETTINGS_TESTS_PASSED", res.stdout)


if __name__ == "__main__":
    unittest.main()
