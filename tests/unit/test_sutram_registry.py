import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SUTRAM_JS_DIR = PROJECT_ROOT / "sutram" / "js"
YENVUI_JS_DIR = PROJECT_ROOT / "yenvui" / "js"
JS_LOADER_PATH = Path(__file__).resolve().parent / "js_loader.mjs"


class TestSutramRegistry(unittest.TestCase):
    def _run_node_script(self, script_body: str, extra_files: dict = None) -> subprocess.CompletedProcess:
        node_bin = shutil.which("node")
        if not node_bin:
            self.skipTest("Node.js binary not available in PATH.")
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "package.json").write_text(json.dumps({"type": "module"}), encoding="utf-8")
            for rel_name, content in (extra_files or {}).items():
                (tmp_path / rel_name).write_text(content, encoding="utf-8")
            (tmp_path / "run_test.mjs").write_text(script_body, encoding="utf-8")
            res = subprocess.run(
                [node_bin, f"--import={JS_LOADER_PATH.as_uri()}", "run_test.mjs"],
                cwd=tmp_path.as_posix(),
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(res.returncode, 0, f"Node test failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
            return res

    def test_sutram_store_registry_and_extension_lifecycle_in_node(self):
        test_script = r"""
import assert from 'node:assert/strict';

assert.strictEqual(globalThis.window, globalThis, 'window must be identical to globalThis');

let activeWs = 'ws_alpha';
const { createSutramStore, StoreRegistry, ExtensionRegistry, LayoutStore } = await import('sutram/sutram_sdk.js');
const { SutramProjectionCompiler, SutramProjectionPool } = await import('sutram/projection_engine.js');
const { debounce, threeWayMergeText, HostPath, truncateFilename, clone, SutramWorker } = await import('sutram/utils.js');
const { SutramDB, SutramCacheWarmer, ensureSutramAppShellCached } = await import('sutram/offline.js');
const { anchorTopLayerPopover } = await import('yenvui/physics.js');

// 1. Bound-Scope Persistence + Functional (set, get, store) Store Initializer + TDZ-Safe urlParser(_hash, hydratedState)
localStorage.setItem('sutram_local_ws_alpha_FuncStore_count', JSON.stringify(7));
const FuncStore = createSutramStore('FuncStore', (set, get) => ({
    count: 1,
    increment: () => set({ count: (get()?.count || 0) + 1 })
}), {
    localSync: ['count'],
    urlParser: (_hash, hydratedState) => {
        return hydratedState.count === 7 ? { count: hydratedState.count + 10 } : null;
    }
}, () => activeWs, 'sutram');
assert.equal(FuncStore.getState().count, 17, 'Functional store initializer and urlParser(_hash, hydratedState) must hydrate synchronously without TDZ');
FuncStore.getState().increment();
assert.equal(FuncStore.getState().count, 18, 'Functional store action using set/get must update state without outer variable self-reference');

// 1b. LayoutStore.setUserCapacity clamping against viewport width
window.innerWidth = 1200; // maxViewportCap = 3
LayoutStore.getState().setUserCapacity(2);
assert.equal(LayoutStore.getState().userCapacity, 2);
assert.equal(LayoutStore.getState().capacity, 2, 'capacity must respect userCapacity when viewport is wider');
window.innerWidth = 500; // maxViewportCap = 1
LayoutStore.getState().setUserCapacity(2);
assert.equal(LayoutStore.getState().userCapacity, 2);
assert.equal(LayoutStore.getState().capacity, 1, 'capacity must clamp to maxViewportCap on compact viewports');
window.innerWidth = 1200;
LayoutStore.getState().setUserCapacity(3);

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

// 12b. SutramDB tenant-agnostic fallback & subscribeTelemetry
let lastTelemetry = null;
const unsubTelemetry = SutramDB.subscribeTelemetry((detail) => { lastTelemetry = detail; });
mockStores.vfs_cache.set('default::/api/shared/schema.json', { blob: { size: 10, text: 'schema' }, ts: 2000 });
SutramDB.configure({ isTenantAgnosticUrl: (u) => u.includes('/api/shared/') });
const fallbackBlob = await SutramDB.getVFSBlob('ws_alpha', '/api/shared/schema.json');
assert.deepEqual(fallbackBlob, { size: 10, text: 'schema' }, 'getVFSBlob must fall back to default:: for tenant-agnostic URLs');
unsubTelemetry();
assert.equal(typeof unsubTelemetry, 'function');

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

// 14. SutramCacheWarmer.removeByPrefix & size + ensureSutramAppShellCached versioned build & captive-portal guard
SutramCacheWarmer.clear();
SutramCacheWarmer._isDraining = true; // hold queue to inspect entries
SutramCacheWarmer.enqueue('ws_alpha', ['/api/ws_alpha/fs/fetch?file=vfs://a/1.py', '/api/ws_alpha/fs/fetch?file=vfs://b/2.py']);
assert.equal(SutramCacheWarmer.size, 2);
SutramCacheWarmer.removeByPrefix('ws_alpha', '/api/ws_alpha/fs/fetch?file=vfs://a/');
assert.equal(SutramCacheWarmer.size, 1);
SutramCacheWarmer.clear();
SutramCacheWarmer._isDraining = false;

const cacheBuckets = new Map();
globalThis.caches = {
    keys: async () => Array.from(cacheBuckets.keys()),
    delete: async (k) => cacheBuckets.delete(k),
    open: async (name) => {
        if (!cacheBuckets.has(name)) cacheBuckets.set(name, new Map());
        const bucket = cacheBuckets.get(name);
        return {
            put: async (k, res) => bucket.set(typeof k === 'string' ? k : k.url, res),
            match: async (k) => bucket.get(typeof k === 'string' ? k : k.url) || null
        };
    }
};
globalThis.window.location.origin = 'https://box.tailnet.ts.net';
globalThis.document.querySelectorAll = () => [];
globalThis.navigator = { onLine: true, serviceWorker: { controller: { postMessage() {} } } };

// 14a. A redirected or 511 captive-portal response is never cached and leaves existing build intact
cacheBuckets.set('sutram-build-v1', new Map([['/', new Response('v1-shell', { status: 200 })]]));
globalThis.fetch = async () => ({
    status: 511,
    redirected: false,
    type: 'basic',
    url: 'https://box.tailnet.ts.net/',
    clone() { return this; },
    text: async () => 'Captive Portal Login'
});
await ensureSutramAppShellCached({ buildId: 'v2', additionalAssets: ['/static/js/app.js'] });
assert.equal(cacheBuckets.has('sutram-build-v2'), false, '511 captive portal response must never create or overwrite a build cache');
assert.equal(cacheBuckets.has('sutram-build-v1'), true, 'Existing v1 build cache must remain intact');

// 14b. A complete newer build stages into sutram-build-v2 as pending; v1 stays for the running page until the next load
globalThis.fetch = async (url) => ({
    status: 200,
    redirected: false,
    type: 'basic',
    url: `https://box.tailnet.ts.net${url}`,
    headers: { get: (h) => (h === 'X-Sutram-Build-ID' ? 'v2' : null) },
    clone() { return this; },
    text: async () => '<!DOCTYPE html><meta name="sutram-build-id" content="v2">'
});
const stageRes = await ensureSutramAppShellCached({ buildId: 'v1', additionalAssets: ['/static/js/app.js'] });
assert.equal(stageRes.complete, true);
assert.equal(stageRes.updated, true);
assert.equal(cacheBuckets.has('sutram-build-v2'), true, 'Complete v2 build must be staged');
assert.equal(cacheBuckets.get('sutram-build-v2').has('/static/js/app.js'), true);
assert.equal(cacheBuckets.has('sutram-build-v1'), true, 'The running v1 build must stay until the next page load');
assert.equal(await cacheBuckets.get('sutram-meta').get('/__sutram_pending_build__').text(), 'sutram-build-v2', 'v2 must be recorded as the pending build');

// 14c. A newer build ID that fails midway is not promoted and leaves sutram-build-v2 intact
globalThis.fetch = async (url) => {
    if (url === '/static/js/app.js') {
        return { status: 503, redirected: false, type: 'basic', url: 'https://box.tailnet.ts.net/static/js/app.js' };
    }
    return {
        status: 200,
        redirected: false,
        type: 'basic',
        url: `https://box.tailnet.ts.net${url}`,
        headers: { get: (h) => (h === 'X-Sutram-Build-ID' ? 'v3' : null) },
        clone() { return this; },
        text: async () => '<!DOCTYPE html><meta name="sutram-build-id" content="v3">'
    };
};
const partialRes = await ensureSutramAppShellCached({ buildId: 'v2', additionalAssets: ['/static/js/app.js'] });
assert.equal(partialRes.complete, false, 'Incomplete v3 build must not be marked complete');
assert.equal(cacheBuckets.has('sutram-build-v2'), true, 'Previous complete v2 build must remain intact when v3 fails');

console.log('ALL_SUTRAM_TESTS_PASSED');
process.exit(0);
"""
        res = self._run_node_script(test_script)
        self.assertIn("ALL_SUTRAM_TESTS_PASSED", res.stdout)

    def test_yenvui_chassis_provider_contract_and_ui_adapter_in_node(self):
        """Verifies yenvui/js/index.js fulfills REQUIRED_CHASSIS_PRIMITIVES and SutramUIAdapter registers all pass-through <sutram-*> elements."""
        test_mjs = r"""
import assert from 'node:assert/strict';

const YenvuiChassis = await import('yenvui/index.js');
const { REQUIRED_CHASSIS_PRIMITIVES, validateChassisContract, SutramUIAdapter } = await import('sutram/primitives.js');

// 1. Validate real YenvuiChassis exports against REQUIRED_CHASSIS_PRIMITIVES
assert.equal(YenvuiChassis.CHASSIS_PROVIDER_META.name, 'yenvui');
assert.equal(validateChassisContract(YenvuiChassis), true);
assert.ok(YenvuiChassis.sharedStyles !== undefined);
assert.equal(typeof YenvuiChassis.physics.getEventPath, 'function');
assert.equal(typeof YenvuiChassis.physics.anchorTopLayerPopover, 'function');

// 2. Verify SutramUIAdapter.registerChassis mounts all pass-through <sutram-*> custom elements
SutramUIAdapter.registerChassis(YenvuiChassis);
for (const [sutramTag, exportKey] of Object.entries(SutramUIAdapter.PASSTHROUGH_MAP)) {
    const registeredCls = customElements.get(sutramTag);
    assert.equal(typeof registeredCls, 'function', `Expected ${sutramTag} to be registered by SutramUIAdapter`);
    assert.ok(
        registeredCls.prototype instanceof YenvuiChassis[exportKey],
        `${sutramTag} must inherit from YenvuiChassis.${exportKey}`
    );
}

// 2b. Verify Zero-CSS Lego layout & icon primitives initialize default properties cleanly
const iconInst = new (customElements.get('sutram-icon'))();
assert.equal(iconInst.size, 'md');
assert.equal(iconInst.intent, 'current');

const stackInst = new (customElements.get('sutram-stack'))();
assert.equal(stackInst.direction, 'col');
assert.equal(stackInst.gap, 'md');

const surfaceInst = new (customElements.get('sutram-surface'))();
assert.equal(surfaceInst.variant, 'panel');
assert.equal(surfaceInst.padding, 'md');

const actionBarInst = new (customElements.get('sutram-action-bar'))();
assert.equal(actionBarInst.align, 'start');
assert.equal(actionBarInst.gap, 'sm');

// 3. Verify validateChassisContract rejects incomplete chassis providers
const BadChassis = { ...YenvuiChassis, CHASSIS_PROVIDER_META: { name: 'broken-chassis' } };
delete BadChassis.Modal;
delete BadChassis.Editor;
assert.throws(
    () => validateChassisContract(BadChassis),
    /\[Sutram Boot Error\] Chassis 'broken-chassis' fails contract\. Missing primitives: Modal, Editor/
);
console.log('CHASSIS_CONTRACT_TESTS_PASSED');
"""
        res = self._run_node_script(test_mjs)
        self.assertIn("CHASSIS_CONTRACT_TESTS_PASSED", res.stdout)

    def test_yenvui_diff_utils_and_sutram_ring0_algorithms_in_node(self):
        """Tests Ring 0 pure algorithms in yenvui/js/diff-utils.js and sutram/js/utils.js."""
        test_mjs = r"""
import assert from 'node:assert/strict';
import {
    computeIntraLineTokens,
    parseRawHunks,
    parseUnifiedDiff,
    parseDiffPayload
} from 'yenvui/diff-utils.js';
import {
    compileDagWavefronts,
    extractTemplateVariables,
    interpolateTemplateVariables,
    buildFileTree,
    resolveDirectoryState,
    shallowEqual,
    slugify,
    fuzzyFilterObjects
} from 'sutram/utils.js';

// 1. diff-utils.js: Intra-line token diffing & unified diff parsing
const intra = computeIntraLineTokens('const x = 10;', 'const x = 20;');
assert.equal(intra.oldTokens.some(t => t.changed && t.text.includes('1')), true);
assert.equal(intra.newTokens.some(t => t.changed && t.text.includes('2')), true);
const rawHunks = parseRawHunks('line1\nold_line\nline3', 'line1\nnew_line\nline3');
assert.equal(rawHunks.interleaved.some(r => r.type === 'removed' && r.text === 'old_line'), true);
assert.equal(rawHunks.interleaved.some(r => r.type === 'added' && r.text === 'new_line'), true);

const unified = parseUnifiedDiff('@@ -1,2 +1,2 @@\n-foo\n+bar\n baz');
assert.equal(unified.split.searchLines.some(l => l.text === 'foo' && l.type === 'removed'), true);
assert.equal(unified.split.replaceLines.some(l => l.text === 'bar' && l.type === 'added'), true);

const payload = parseDiffPayload({ searchStr: 'a\nb', replaceStr: 'a\nc' });
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
        res = self._run_node_script(test_mjs)
        self.assertIn("RING0_ALGORITHM_TESTS_PASSED", res.stdout)

    def test_sutram_poller_shortcuts_and_network_hysteresis_in_node(self):
        """Tests createJobPoller sequential chaining, initShortcutRouter context precedence, and NetworkHysteresisManager."""
        test_mjs = r"""
import assert from 'node:assert/strict';

globalThis.Sutram = { stores: { Environment: { getState: () => ({ isOffline: false }) } } };

const { createJobPoller } = await import('sutram/poller.js');
const { initShortcutRouter } = await import('sutram/shortcuts.js');
const { NetworkHysteresisManager } = await import('sutram/offline.js');
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
        res = self._run_node_script(test_mjs)
        self.assertIn("ORCHESTRATOR_TESTS_PASSED", res.stdout)

    def test_sutram_combobox_target_binding_and_settings_schema_in_node(self):
        """Tests SutramCombobox normalization & navigation, SutramTargetBinding, and dynamic settings schema options."""
        test_mjs = r"""
import assert from 'node:assert/strict';

const { SutramCombobox, SutramTargetBinding, SutramComposer } = await import('sutram/inputs.js');

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
let outsideListener = null;
globalThis.document.addEventListener = (evt, cb) => { if (evt === 'click') outsideListener = cb; };
combo.connectedCallback();
combo._open = true;
combo._filterText = 'temp';
assert.equal(typeof outsideListener, 'function');
outsideListener({ composedPath: () => [] });
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

// 5. SutramComposer slash-command absorption & Backspace token clearing
const composer = new SutramComposer();
composer.triggers = [
    { token: 'code', id: 'code', label: 'Code Mode', badge: 'Mode' },
    { token: 'plan', id: 'plan', label: 'Plan Mode', badge: 'Mode' }
];
let trigChangedEvt = null;
let valChangedEvt = null;
composer.dispatchEvent = (e) => {
    if (e.type === 'sutram-trigger-changed') trigChangedEvt = e;
    if (e.type === 'sutram-input-changed') valChangedEvt = e;
};
composer._handleTextInput({ detail: { value: '/code Refactor widget' } });
assert.equal(composer.activeTrigger?.id, 'code', 'Leading /code command followed by space must be absorbed into activeTrigger');
assert.equal(composer.value, 'Refactor widget');
assert.equal(trigChangedEvt?.detail?.trigger?.id, 'code');
assert.equal(valChangedEvt?.detail?.value, 'Refactor widget');

// Backspace at cursor 0 clears activeTrigger chip
composer.value = '';
composer._handleKeyDown({
    key: 'Backspace',
    target: { selectionStart: 0, selectionEnd: 0 },
    preventDefault() {}
});
assert.equal(composer.activeTrigger, null);

console.log('INPUTS_AND_SETTINGS_TESTS_PASSED');
"""
        res = self._run_node_script(test_mjs)
        self.assertIn("INPUTS_AND_SETTINGS_TESTS_PASSED", res.stdout)

    def test_yenvui_editor_language_loader_in_node(self):
        """Tests loadLanguageExtension in yenvui/js/editor.js: built-ins (json, ts, tsx), lezer/stream descriptors, caching, and plain-text fallback."""
        extra_files = {
            "lang_rust_stub.mjs": (
                "export let rustLoadCalls = 0;\n"
                "export function rust(opts = {}) { rustLoadCalls++; return { kind: 'lezer-rust', opts }; }\n"
            ),
            "legacy_toml_stub.mjs": "export const toml = { name: 'toml-stream-parser', token() {} };\n",
            "legacy_url_stub.mjs": "export function go() { return { kind: 'legacy-url-go' }; }\n",
        }

        test_mjs = r"""
import assert from 'node:assert/strict';

const { loadLanguageExtension, YenvuiEditor } = await import('yenvui/editor.js');
const rustStub = await import('./lang_rust_stub.mjs');

// 1. Built-in core languages (including corrected json, ts, tsx, and sanitized markdown)
assert.deepEqual(await loadLanguageExtension('python'), { lang: 'python' });
assert.deepEqual(await loadLanguageExtension('json'), { lang: 'json' });
assert.deepEqual(await loadLanguageExtension('javascript'), { lang: 'javascript', opts: {} });
assert.deepEqual(await loadLanguageExtension('ts'), { lang: 'javascript', opts: { typescript: true } });
assert.deepEqual(await loadLanguageExtension('typescript'), { lang: 'javascript', opts: { typescript: true } });
assert.deepEqual(await loadLanguageExtension('tsx'), { lang: 'javascript', opts: { jsx: true, typescript: true } });

const mdExt = await loadLanguageExtension('markdown');
assert.equal(mdExt.language.name, 'markdown');
assert.deepEqual(mdExt.extensions, ['safeExt'], 'htmlCompletion and closeTags must be stripped from markdown');

// 2. Host resolver descriptors: lezer, stream, builtin with options, and legacy URL string
let resolverCalls = 0;
const baseUrl = new URL('./', import.meta.url).href;
YenvuiEditor.languageResolver = async (lang) => {
    resolverCalls++;
    if (lang === 'rust') {
        return { url: new URL('lang_rust_stub.mjs', baseUrl).href, kind: 'lezer', export: 'rust', options: { strict: true } };
    }
    if (lang === 'toml') {
        return { url: new URL('legacy_toml_stub.mjs', baseUrl).href, kind: 'stream', export: 'toml' };
    }
    if (lang === 'go') {
        return new URL('legacy_url_stub.mjs', baseUrl).href;
    }
    return null;
};

const rustExt1 = await loadLanguageExtension('rust');
const rustExt2 = await loadLanguageExtension('rust');
assert.deepEqual(rustExt1, { kind: 'lezer-rust', opts: { strict: true } });
assert.strictEqual(rustExt1, rustExt2, 'Repeated loadLanguageExtension calls must share cached result');
assert.equal(rustStub.rustLoadCalls, 1, 'Cached lezer language pack must only be invoked once');
assert.equal(resolverCalls, 1, 'Resolver must only be called once for cached language');

const tomlExt = await loadLanguageExtension('toml');
assert.equal(tomlExt.kind, 'stream-defined');
assert.equal(tomlExt.parser.name, 'toml-stream-parser');

const goExt = await loadLanguageExtension('go');
assert.deepEqual(goExt, { kind: 'legacy-url-go' });

// 3. Unknown languages fall back to plain text ([]), never Markdown
const unknownExt = await loadLanguageExtension('cobol');
assert.deepEqual(unknownExt, [], 'Unknown language must fall back to plain text []');
assert.deepEqual(await loadLanguageExtension(''), []);
assert.deepEqual(await loadLanguageExtension('plaintext'), []);

// 4. YenvuiEditor Markdown link click event emission
const editorInst = new YenvuiEditor();
assert.equal(editorInst.enableMarkdownLinks, true, 'enableMarkdownLinks must default to true');
let linkEvt = null;
editorInst.dispatchEvent = (e) => { linkEvt = e; };
editorInst._emitLinkClicked('https://example.com/docs', 'Docs');
assert.equal(linkEvt.type, 'yenvui-editor-link-clicked');
assert.equal(linkEvt.detail.href, 'https://example.com/docs');
assert.equal(linkEvt.detail.text, 'Docs');

console.log('EDITOR_LOADER_TESTS_PASSED');
"""
        res = self._run_node_script(test_mjs, extra_files=extra_files)
        self.assertIn("EDITOR_LOADER_TESTS_PASSED", res.stdout)


if __name__ == "__main__":
    unittest.main()
