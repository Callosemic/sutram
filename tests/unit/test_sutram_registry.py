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
                "export const getEventPath = () => [];\nexport const getEventTarget = () => null;\n",
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
}, () => activeWs, 'insetu');
DomainStore.setState({ items: ['alpha_intermediate'], ephemeral: 'alpha_temp' });
DomainStore.setState({ items: ['alpha_1', 'alpha_2'], ephemeral: 'alpha_session' });
assert.equal(
    localStorage.getItem('insetu_local_ws_alpha_DomainTest_items'),
    null,
    'Trailing-edge debounce must defer synchronous localStorage writes during rapid state mutations'
);
DomainStore.flushPersistence();
assert.equal(
    localStorage.getItem('insetu_local_ws_alpha_DomainTest_items'),
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
const editorNodeA = pool.resolve('insetu-editor-projection', 'vfs://alpha/old.md', { filepath: 'vfs://alpha/old.md' });
const toolNodeB = pool.resolve('insetu-ext-git', 'git:status');
pool.commitPass();

assert.equal(editorNodeA.dataset.subId, 'vfs://alpha/old.md');
assert.equal(editorNodeA.filepath, 'vfs://alpha/old.md');

// Rekeying preserves the exact DOM node instance while migrating its subId
assert.equal(pool.rekey('vfs://alpha/old.md', 'vfs://alpha/new.md'), true);
assert.equal(editorNodeA.dataset.subId, 'vfs://alpha/new.md');

// Next render pass: resolving under the new ID returns the preserved DOM instance, while unreferenced toolNodeB is swept
pool.beginPass();
const editorNodeAfterRename = pool.resolve('insetu-editor-projection', 'vfs://alpha/new.md');
pool.commitPass();
assert.strictEqual(editorNodeAfterRename, editorNodeA, 'Rekeyed projection must reuse the exact DOM element instance');
assert.equal(pool._activeNodes.has('insetu-ext-git:git:status'), false, 'Unreferenced nodes must be swept on commitPass()');

// Extension eviction removes matching extension nodes
pool.beginPass();
const extNode = pool.resolve('insetu-ext-notes', 'notes:main');
pool.commitPass();
assert.equal(pool.evictExtension('notes'), true);
assert.equal(extNode.removed, true);
assert.equal(pool._activeNodes.has('insetu-ext-notes:notes:main'), false);
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
    parentElement: null,
    getRootNode: () => ({ host: null })
};
anchorTopLayerPopover(topTrigger, popoverMock, { mode: 'menu', align: 'left', offset: 5 });
assert.equal(popoverMock.style.top, '95px', 'Dropdown must drop downward when space below is sufficient');
assert.equal(popoverMock.style.bottom, 'auto', 'Downward dropdown must clear style.bottom');

// 13b. Viewport bottom collision: flips upward
const bottomTrigger = {
    getBoundingClientRect: () => ({ top: 700, bottom: 740, left: 100, right: 200 }),
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

if __name__ == "__main__":
    unittest.main()