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

            test_script = """
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
    location: { hash: '#/ws_alpha/center/', search: '', pathname: '/' },
    addEventListener: et.addEventListener.bind(et),
    removeEventListener: et.removeEventListener.bind(et),
    dispatchEvent: et.dispatchEvent.bind(et),
    CustomEvent: CustomEventPolyfill,
    Event: Event,
    Sutram: { stores: {} }
};
globalThis.document = { hidden: false, addEventListener: () => {} };
globalThis.localStorage = new StorageMock();
globalThis.sessionStorage = new StorageMock();

let activeWs = 'ws_alpha';
const { createSutramStore, StoreRegistry, ExtensionRegistry } = await import('./sutram_sdk.mjs');
const { debounce, threeWayMergeText, HostPath, truncateFilename, clone } = await import('./utils.mjs');

// 1. Bound-Scope Persistence
const DomainStore = createSutramStore('DomainTest', {
    items: ['default_item'],
    ephemeral: 'initial'
}, {
    localSync: ['items', 'nonExistentKey'],
    sessionSync: ['ephemeral'],
    onEvict: { 'dom:view': { ephemeral: 'evicted' } }
}, () => activeWs, 'insetu');

DomainStore.setState({ items: ['alpha_1', 'alpha_2'], ephemeral: 'alpha_session' });
assert.equal(
    localStorage.getItem('insetu_local_ws_alpha_DomainTest_items'),
    JSON.stringify(['alpha_1', 'alpha_2']),
    'ws_alpha localSync must be written under ws_alpha key'
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
assert.equal(truncateFilename('very_long_filename_example.md', 14), 'very_long_…md');
assert.deepEqual(clone({ a: [1, 2] }), { a: [1, 2] });
StoreRegistry.setScopedStorage('test_key', 'scoped_val', 'ws_alpha');
assert.equal(StoreRegistry.getScopedStorage('test_key', null, 'ws_alpha'), 'scoped_val');

// 9. threeWayMergeText Behavioral & CRLF Vectors
const disjoint = threeWayMergeText('a\\nb\\nc\\nd', 'a_mod\\nb\\nc\\nd', 'a\\nb\\nc\\nd_mod');
assert.deepEqual(disjoint, { merged: 'a_mod\\nb\\nc\\nd_mod', clean: true });

const zombieAck = threeWayMergeText('line1\\nline2\\nline3', 'line1\\nline2_v1\\nline2_v2\\nline3', 'line1\\nline2_v1\\nline3');
assert.deepEqual(zombieAck, { merged: 'line1\\nline2_v1\\nline2_v2\\nline3', clean: true });

const crlfMerge = threeWayMergeText('one\\r\\ntwo\\r\\nthree', 'one_mod\\r\\ntwo\\r\\nthree', 'one\\r\\ntwo\\r\\nthree_mod');
assert.deepEqual(crlfMerge, { merged: 'one_mod\\r\\ntwo\\r\\nthree_mod', clean: true });

const conflictMerge = threeWayMergeText('alpha\\nbeta\\ngamma', 'alpha\\nbeta_local\\ngamma', 'alpha\\nbeta_remote\\ngamma');
assert.equal(conflictMerge.clean, false);

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