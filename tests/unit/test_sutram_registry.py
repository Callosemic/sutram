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
assert.equal(conflictMerge.merged, 'alpha\nbeta_local\ngamma', 'A conflict returns the local text untouched');

// 9b. The same algorithm runs in akasa (akasa/merge.py); insetu's tests/parity/three_way_merge.json checks the two agree.
assert.deepEqual(
    threeWayMergeText('d\nc\nf\nf\nb\nb', 'd\nc\nf\nf\nb', 'd\nf\nf\nb*\nb'),
    { merged: 'd\nf\nf\nb*', clean: true },
    'A deleted line next to a line the other side changed must not be lost (insetu issue #18)'
);
assert.deepEqual(threeWayMergeText('a\nb\nc', 'a\nb\nn\nc', 'a\nB\nc'), { merged: 'a\nB\nn\nc', clean: true });
assert.equal(threeWayMergeText('a\nb', 'a\ny\nb', 'a\nx\nb').clean, false, 'Two different insertions at one place are a conflict');
const longBase = Array.from({ length: 5000 }, (_, i) => `row ${i}`);
const longLocal = longBase.slice();
const longRemote = longBase.slice();
longLocal[4990] = 'changed near the end';
longRemote[10] = 'changed near the top';
const longWant = longRemote.slice();
longWant[4990] = 'changed near the end';
assert.deepEqual(
    threeWayMergeText(longBase.join('\n'), longLocal.join('\n'), longRemote.join('\n')),
    { merged: longWant.join('\n'), clean: true },
    'Edits far apart in a long file must merge, not fall back to one whole-file block'
);

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

    def test_sutram_backend_adapter_contract_and_offline_transport_in_node(self):
        """Verifies validateBackendAdapter, AkasaBackendAdapter, and offline.js network I/O routing through the registered adapter."""
        test_mjs = r"""
import assert from 'node:assert/strict';

const {
    REQUIRED_BACKEND_ADAPTER_METHODS,
    validateBackendAdapter,
    BackendAdapterRegistry,
    registerBackendAdapter,
    getBackendAdapter,
    SutramBackendAdapter,
    AkasaBackendAdapter
} = await import('sutram/client.js');
const {
    OfflineHttpProvider,
    NetworkHysteresisManager,
    ensureSutramAppShellCached,
    SutramCacheWarmer
} = await import('sutram/offline.js');

// 1. validateBackendAdapter rejects incomplete adapters and accepts valid ones
assert.throws(
    () => validateBackendAdapter({ name: 'BrokenAdapter', bootstrap: async () => ({}) }),
    /\[Sutram Boot Error\] Backend adapter 'BrokenAdapter' fails contract\. Missing methods:/
);
assert.equal(validateBackendAdapter(new SutramBackendAdapter()), true);

// 2. AkasaBackendAdapter: bootstrap, passive X-Akasa-Build-ID sniffing, 401 retry & scoped URL resolution
const recordedRequests = [];
let serverBuildId = 'build_100';
let issuedToken = 'tok_initial';
let rejectFirstGet = false;
const mismatches = [];

const mockFetch = async (url, init = {}) => {
    const headers = new Headers(init.headers || {});
    recordedRequests.push({
        url: String(url),
        method: init.method || 'GET',
        body: init.body ?? null,
        akasaToken: headers.get('X-Akasa-Token'),
        aliasToken: headers.get('X-Host-Token'),
        workspaceId: headers.get('X-Workspace-ID'),
        revalidate: headers.get('X-Sutram-Revalidate'),
        ifNoneMatch: headers.get('If-None-Match')
    });

    if (headers.get('If-None-Match') === '"etag-app"') {
        return new Response(null, { status: 304 });
    }

    if (String(url).startsWith('/auth/bootstrap')) {
        return new Response(JSON.stringify({ status: 'ok', token: issuedToken, build_id: serverBuildId }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'X-Akasa-Build-ID': serverBuildId
            }
        });
    }

    if (rejectFirstGet) {
        rejectFirstGet = false;
        issuedToken = 'tok_refreshed';
        return new Response(JSON.stringify({ error: 'Expired' }), { status: 401 });
    }

    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'X-Akasa-Build-ID': serverBuildId
        }
    });
};

const adapter = new AkasaBackendAdapter({
    namespace: 'testapp',
    tokenHeader: 'X-Akasa-Token',
    tokenAliasHeader: 'X-Host-Token',
    fetchImpl: mockFetch,
    getActiveScope: () => 'ws_one',
    onBuildMismatch: (nextId, prevId) => mismatches.push({ nextId, prevId })
});
for (const method of REQUIRED_BACKEND_ADAPTER_METHODS) {
    assert.equal(typeof adapter[method], 'function', `AkasaBackendAdapter must implement ${method}`);
}
registerBackendAdapter(adapter);
assert.strictEqual(getBackendAdapter(), adapter);

const bootRes = await adapter.bootstrap();
assert.equal(bootRes.authenticated, true);
assert.equal(bootRes.token, 'tok_initial');
assert.equal(adapter.getBuildId(), 'build_100');
assert.equal(adapter.resolveScopedUrl('fs/fetch', 'ws_one'), '/api/ws_one/fs/fetch');

// 401 single-flight re-authentication + build ID mismatch detection
rejectFirstGet = true;
serverBuildId = 'build_200';
const retriedRes = await adapter.get('system/config');
assert.equal(retriedRes.status, 200);
assert.equal(adapter.getBuildId(), 'build_200');
assert.deepEqual(mismatches, [{ nextId: 'build_200', prevId: 'build_100' }]);
const lastReq = recordedRequests[recordedRequests.length - 1];
assert.equal(lastReq.akasaToken, 'tok_refreshed');
assert.equal(lastReq.aliasToken, 'tok_refreshed');
assert.equal(lastReq.workspaceId, 'ws_one');

// 3. offline.js components route all network I/O through registered adapter (zero unauthenticated window.fetch calls)
globalThis.fetch = async (url) => {
    throw new Error(`Unauthenticated bare globalThis.fetch was called for ${url}`);
};

const provider = new OfflineHttpProvider({
    shouldCacheGet: () => false
});
const providerRes = await provider.get('/api/ws_one/fs/list', {}, 'ws_one');
assert.equal(providerRes.status, 200);
assert.equal(recordedRequests[recordedRequests.length - 1].akasaToken, 'tok_refreshed');

const hysteresis = new NetworkHysteresisManager(null, 2);
let restoredCount = 0;
await hysteresis.check(async () => { restoredCount++; });
assert.equal(restoredCount, 1, 'NetworkHysteresisManager must use adapter.probeHealth() when pingUrl is omitted');

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

serverBuildId = 'build_300';
const shellRes = await ensureSutramAppShellCached({
    buildId: 'build_200',
    additionalAssets: ['/static/js/app.js']
});
assert.equal(shellRes.complete, true);
assert.equal(shellRes.updated, true);
assert.equal(shellRes.buildId, 'build_300');
const shellReqs = recordedRequests.slice(-2);
assert.ok(shellReqs.every(r => r.akasaToken === 'tok_refreshed' && r.revalidate === '1'));

// A settled build is not swept again while the backend reports the same build.
const beforeSkip = recordedRequests.length;
const [skipA, skipB] = await Promise.all([
    ensureSutramAppShellCached({ buildId: 'build_200' }),
    ensureSutramAppShellCached({ buildId: 'build_200' })
]);
assert.equal(recordedRequests.length, beforeSkip, 'a settled build must not trigger another sweep');
assert.equal(skipA.skipped, true);
assert.equal(skipB.buildId, 'build_300');

// A new server build triggers one run, shared by concurrent callers.
serverBuildId = 'build_400';
adapter._recordObservedBuildId('build_400');
const beforeShared = recordedRequests.length;
const [sharedA, sharedB] = await Promise.all([
    ensureSutramAppShellCached({ buildId: 'build_200', additionalAssets: ['/static/js/app.js'] }),
    ensureSutramAppShellCached({ buildId: 'build_200', additionalAssets: ['/static/js/app.js'] })
]);
assert.equal(recordedRequests.slice(beforeShared).filter(r => r.url === '/').length, 1, 'concurrent calls must share one run');
assert.equal(sharedA.buildId, 'build_400');
assert.equal(sharedB.buildId, 'build_400');

// An unchanged asset revalidates with If-None-Match, and a 304 restages the cached copy.
const cachedApp = new Response('cached app', { status: 200, headers: { ETag: '"etag-app"' } });
globalThis.caches.match = async (k) => (k === '/static/js/app.js' ? cachedApp.clone() : null);
serverBuildId = 'build_500';
adapter._recordObservedBuildId('build_500');
const before304 = recordedRequests.length;
const res304 = await ensureSutramAppShellCached({ buildId: 'build_200', additionalAssets: ['/static/js/app.js'] });
assert.equal(res304.complete, true);
const appReq = recordedRequests.slice(before304).find(r => r.url === '/static/js/app.js');
assert.equal(appReq.ifNoneMatch, '"etag-app"');
assert.equal(await cacheBuckets.get(res304.cacheName).get('/static/js/app.js').text(), 'cached app');
delete globalThis.caches.match;

// Verify object payloads passed to adapter.request() are JSON-serialized on the wire when online
const mutRes = await adapter.request('/api/ws_one/notes/create', {
    method: 'POST',
    body: { title: 'Serialized Note' }
}, 'ws_one');
assert.equal(mutRes.status, 200);
const lastMutReq = recordedRequests[recordedRequests.length - 1];
assert.equal(typeof lastMutReq.body, 'string');
assert.deepEqual(JSON.parse(lastMutReq.body), { title: 'Serialized Note' });

SutramCacheWarmer.clear();
SutramCacheWarmer.enqueue('ws_one', ['/api/ws_one/fs/fetch?file=vfs://repo/a.py']);
await SutramCacheWarmer.drain(0);
assert.equal(recordedRequests[recordedRequests.length - 1].akasaToken, 'tok_refreshed');

BackendAdapterRegistry.clear();
console.log('BACKEND_ADAPTER_TESTS_PASSED');
"""
        res = self._run_node_script(test_mjs)
        self.assertIn("BACKEND_ADAPTER_TESTS_PASSED", res.stdout)

    def test_sprint_u1_card_actions_variant_sets_and_fit_overflow_in_node(self):
        """Tests Sprint U1: fit-then-overflow at three container widths, variant-set default resolution, nesting refusal, and confirmation timing."""
        test_mjs = r"""
import assert from 'node:assert/strict';

const {
    ExtensionRegistry,
    SelectionStore,
    VariantDefaultStore,
    SUTRAM_COLUMN_UNIT_PX,
    SUTRAM_WIDE_CARD_MIN_PX
} = await import('sutram/sutram_sdk.js');
const {
    computeFitActionCount,
    ACTION_CONFIRM_HOLD_MS,
    SutramVariantBtn,
    SutramEntityActions,
    SutramSubtabMenu
} = await import('sutram/primitives.js');
const { YenvuiDropdown } = await import('yenvui/dropdown.js');

// 0. Column unit and wide-card tier threshold constants
assert.equal(SUTRAM_COLUMN_UNIT_PX, 360);
assert.equal(SUTRAM_WIDE_CARD_MIN_PX, 720);
assert.equal(ACTION_CONFIRM_HOLD_MS, 900);

// 1. Fit-then-overflow across three container widths (and property invariant across arbitrary widths)
const buttonWidths = [120, 95, 110]; // total = 120 + 6 + 95 + 6 + 110 = 337px
assert.equal(computeFitActionCount(360, buttonWidths, 38, 6, false), 3, 'At 360px, all 3 buttons fit without overflow trigger');
assert.equal(computeFitActionCount(360, buttonWidths, 38, 6, true), 2, 'At 360px with menu-only items, 38+6px is reserved once so 2 buttons (221 <= 316) fit');
assert.equal(computeFitActionCount(280, buttonWidths, 38, 6, false), 2, 'At 280px, 2 buttons (120+6+95=221 <= 280-44=236) fit plus the 3-dot trigger');
assert.equal(computeFitActionCount(180, buttonWidths, 38, 6, false), 1, 'At 180px, 1 button (120 <= 180-44=136) fits plus the 3-dot trigger');

for (const hasExtra of [false, true]) {
    for (let containerW = 60; containerW <= 500; containerW += 17) {
        const fit = computeFitActionCount(containerW, buttonWidths, 38, 6, hasExtra);
        const needsMore = hasExtra || fit < buttonWidths.length;
        const usedButtonsW = buttonWidths.slice(0, fit).reduce((s, w, i) => s + w + (i > 0 ? 6 : 0), 0);
        const totalUsedW = usedButtonsW + (needsMore ? (fit > 0 ? 6 + 38 : 38) : 0);
        if (fit > 0) {
            assert.ok(totalUsedW <= containerW, `Fitted buttons + trigger (${totalUsedW}) must never exceed container (${containerW})`);
        }
        if (fit < buttonWidths.length) {
            const nextW = usedButtonsW + (fit > 0 ? 6 : 0) + buttonWidths[fit] + 6 + 38;
            assert.ok(nextW > containerW, `Next button (${nextW}) must strictly exceed container (${containerW})`);
        }
    }
}

// 2. Variant set registration, first-use family preference order, last-used persistence, and unavailable fallback
ExtensionRegistry.registerVariantSet({
    id: 'send',
    label: 'Send',
    icon: 'send',
    group: 'share',
    surfaced: 1,
    sections: ['Raw', 'Expanded'],
    families: {
        files: ['file', 'file:draft', 'file:template'],
        structured: ['record', 'file:record', 'skill'],
        packs: ['file:bundle', 'file:patch', 'bundle', 'patch'],
        folders: ['folder', 'repo', 'workspace-repo']
    },
    defaults: {
        files: ['file-copy', 'file-share', 'file-download'],
        structured: ['file-copy', 'file-share', 'file-download'],
        packs: ['file-copy', 'file-share', 'file-download'],
        folders: ['file-download']
    }
});

let canShareDevice = true;
ExtensionRegistry.registerExtension('u1_send_test', {
    name: 'U1 Send Test',
    entityActions: [
        {
            targetEntities: ['file', 'bundle', 'folder'],
            id: 'file-copy',
            label: 'Copy Raw',
            successLabel: 'Copied',
            set: 'send',
            section: 'Raw',
            group: 'share',
            surfaced: 1,
            order: 10,
            bulkable: true,
            match: (d) => !d?.isMultiPart && !d?.isFolder,
            asyncAction: async () => 'copied-raw'
        },
        {
            targetEntities: ['file', 'bundle', 'folder'],
            id: 'file-share',
            label: 'Share Raw',
            successLabel: 'Shared',
            set: 'send',
            section: 'Raw',
            group: 'share',
            surfaced: 1,
            order: 20,
            bulkable: true,
            match: (d) => canShareDevice && !d?.isFolder,
            asyncAction: async () => 'shared-raw'
        },
        {
            targetEntities: ['file', 'bundle', 'folder'],
            id: 'file-download',
            label: 'Download Raw',
            successLabel: 'Downloaded',
            set: 'send',
            section: 'Raw',
            group: 'share',
            surfaced: 1,
            order: 30,
            bulkable: true,
            match: () => true,
            asyncAction: async () => 'downloaded-raw'
        },
        {
            targetEntities: ['file'],
            id: 'file-share-expanded',
            label: 'Share Expanded',
            successLabel: 'Shared',
            set: 'send',
            section: 'Expanded',
            group: 'share',
            surfaced: 1,
            order: 40,
            match: (d) => Boolean(canShareDevice && d?.hasMacros),
            asyncAction: async () => 'shared-expanded'
        },
        {
            targetEntities: ['file'],
            id: 'publish-doc',
            label: 'Publish Document',
            set: 'send',
            section: 'Publish',
            group: 'share',
            order: 50,
            match: (d) => Boolean(d?.filepath?.endsWith('.md')),
            asyncAction: async () => 'published'
        },
        {
            targetEntities: ['file'],
            id: 'file-delete',
            label: 'Delete',
            intent: 'danger',
            surfaced: 0, // Even if given a low surfaced rank, danger actions must never surface first
            order: 99,
            onClick: () => {}
        },
        {
            targetEntities: ['file'],
            id: 'un-grouped-action',
            label: 'Inspect',
            order: 60,
            bulkable: true,
            onClick: () => {}
        }
    ]
});

// 2a. First-use preference order for 'file:template' (files family -> Copy Raw)
const templateActions = ExtensionRegistry.getEntityActions('file:template', { filepath: 'app://templates/a.md', hasMacros: true });
const sendEntry = templateActions.find(a => a.kind === 'variant-set' && a.setId === 'send');
assert.ok(sendEntry, 'Send variant set must collapse into a single entry');
assert.equal(sendEntry.defaultVariant.id, 'file-copy', 'First-use default for file:template must be file-copy (Copy Raw)');
assert.deepEqual(sendEntry.sections, ['Raw', 'Expanded', 'Publish'], 'Publish section must be appended after declared Raw and Expanded sections');
assert.equal(sendEntry.maxLabelChars, 'Publish Document'.length, 'maxLabelChars must equal the longest available variant label');

// 2b. Missing group defaults to 'tools' on both single and bulk paths
const ungroupedSingle = templateActions.find(a => a.id === 'un-grouped-action');
assert.equal(ungroupedSingle.group, 'tools', 'Single action with no group must default to tools');
const ungroupedBulk = ExtensionRegistry.getAggregatableActions([{ entityType: 'file', data: { filepath: 'app://a/b.py' } }]);
const ungroupedBulkAct = ungroupedBulk.find(a => a.id === 'bulk-un-grouped-action');
assert.equal(ungroupedBulkAct.group, 'tools', 'Bulk action with no group must default to tools');

// 2c. Multi-part bundle (Copy Raw unavailable -> falls through to Share Raw, or Download Raw when Share unavailable)
const multiPartPackActions = ExtensionRegistry.getEntityActions('file:bundle', { filepath: 'app://bundles/a.txt', isMultiPart: true });
const packSend = multiPartPackActions.find(a => a.setId === 'send');
assert.equal(packSend.defaultVariant.id, 'file-share', 'Multi-part pack must fall through to Share Raw when Copy Raw is unavailable');

canShareDevice = false;
const multiPartNoShareActions = ExtensionRegistry.getEntityActions('file:bundle', { filepath: 'app://bundles/a.txt', isMultiPart: true });
const packSendNoShare = multiPartNoShareActions.find(a => a.setId === 'send');
assert.equal(packSendNoShare.defaultVariant.id, 'file-download', 'Multi-part pack without share sheet must fall through to Download Raw');
canShareDevice = true;

// 2d. Last-used variant resolution and fallback when last-used is unavailable for the current item
ExtensionRegistry.setLastUsedVariant('file:template', 'send', 'file-share-expanded');
const templateWithMacros = ExtensionRegistry.getEntityActions('file:template', { filepath: 'app://templates/a.md', hasMacros: true });
assert.equal(templateWithMacros.find(a => a.setId === 'send').defaultVariant.id, 'file-share-expanded', 'Last-used variant must win when available');

const templateWithoutMacros = ExtensionRegistry.getEntityActions('file:template', { filepath: 'app://templates/plain.md', hasMacros: false });
assert.equal(
    templateWithoutMacros.find(a => a.setId === 'send').defaultVariant.id,
    'file-copy',
    'When last-used variant (file-share-expanded) is unavailable on an item without macros, resolution must fall back to family preference order (file-copy)'
);

// 2e. SutramSubtabMenu flattens collapsed bulk variant sets into section headings and actionable items
window.ExtensionRegistry = ExtensionRegistry;
SelectionStore.getState().clearSelection();
SelectionStore.getState().toggleSelection('app://a/b.py', 'file', { filepath: 'app://a/b.py' });
const subMenu = new SutramSubtabMenu();
subMenu.slotConfig = { bulkActionGroup: 'share', bulkEntityTypes: ['file'] };
subMenu._selectedItems = SelectionStore.getState().selectedItems;
subMenu._rebuildMenu();
assert.equal(subMenu._menuItems.some(i => i.kind === 'variant-set'), false, 'Subtab menu must flatten variant-set entries');
assert.equal(subMenu._menuItems.some(i => i.sectionHeading === 'Send'), true, 'Subtab menu must include section heading for flattened variant set');
assert.equal(subMenu._menuItems.some(i => i.variantId === 'file-copy' && typeof i.asyncAction === 'function'), true, 'Flattened variant item must be directly executable');
SelectionStore.getState().clearSelection();

// 3. One-level nesting refusal
const warnings = [];
const origWarn = console.warn;
console.warn = (...args) => warnings.push(args.join(' '));
try {
    const refusedSet = ExtensionRegistry.registerVariantSet({ id: 'nested-set', set: 'send' });
    assert.equal(refusedSet, null, 'registerVariantSet inside another set must be refused');
    ExtensionRegistry.registerExtension('bad_nested_ext', {
        name: 'Bad Nested',
        entityActions: [
            { id: 'bad-group-in-set', targetEntity: 'file', set: 'send', kind: 'group', items: [] }
        ]
    });
} finally {
    console.warn = origWarn;
}
assert.equal(warnings.some(w => w.includes('Refusing nested')), true, 'Refusing nested set/group must log a console warning');

// 4. Two-phase success-state confirmation timing on YenvuiDropdown ('start' -> ~900ms hold -> 'settled' & close)
const dd = new YenvuiDropdown();
dd.open = true;
dd.confirmHoldMs = 60; // fast test hold
let actionRan = false;
const confirmedPhases = [];
dd.addEventListener('yenvui-action-confirmed', (e) => {
    confirmedPhases.push(e.detail?.phase);
});
const testItem = {
    id: 'copy-test',
    label: 'Copy Raw',
    successLabel: 'Copied',
    confirmHoldMs: 60,
    asyncAction: async () => { actionRan = true; }
};
const execPromise = dd._executeItem(testItem, {});
await new Promise(r => setTimeout(r, 20));
assert.equal(actionRan, true);
assert.equal(dd.open, true, 'Dropdown must stay open while showing confirmation label');
assert.equal(dd._confirmedItemId, 'copy-test');
assert.equal(dd._confirmedLabel, 'Copied');
assert.deepEqual(confirmedPhases, ['start'], 'Phase start must fire immediately when confirmation begins');
await execPromise;
assert.equal(dd.open, false, 'Dropdown must close after confirmation hold completes');
assert.deepEqual(confirmedPhases, ['start', 'settled'], 'Phase settled must fire when confirmation hold completes');

// 5. Sprint U3: Registry manifest readers, getExtensionNames, pre-collapse setActionFilter, and same-type bulk variant keys
ExtensionRegistry.registerExtension('u3_active_ext', {
    name: 'U3 Active Ext',
    corePrompts: ['ctx://prompts/a.md', 'ctx://prompts/b.md'],
    customMeta: { priority: 1 }
});
ExtensionRegistry.registerExtension('u3_inactive_ext', {
    name: 'U3 Inactive Ext',
    corePrompts: ['ctx://prompts/inactive.md'],
    customMeta: { priority: 2 }
});
const prevFilterPred = ExtensionRegistry._filterPredicate;
ExtensionRegistry.setFilterPredicate((extName) => extName !== 'u3_inactive_ext');

const activeEntries = ExtensionRegistry.getManifestEntries('corePrompts', { activeOnly: true });
assert.equal(activeEntries.some(e => e.extName === 'u3_active_ext'), true);
assert.equal(activeEntries.some(e => e.extName === 'u3_inactive_ext'), false, 'activeOnly: true must filter out inactive extensions');

const allEntries = ExtensionRegistry.getManifestEntries('corePrompts', { activeOnly: false });
assert.equal(allEntries.some(e => e.extName === 'u3_inactive_ext'), true, 'activeOnly: false must include inactive extensions');

const flattenedActivePrompts = ExtensionRegistry.collectManifestField('corePrompts', { activeOnly: true });
assert.equal(flattenedActivePrompts.includes('ctx://prompts/a.md'), true);
assert.equal(flattenedActivePrompts.includes('ctx://prompts/inactive.md'), false);

const flattenedAllPrompts = ExtensionRegistry.collectManifestField('corePrompts', { activeOnly: false });
assert.equal(flattenedAllPrompts.includes('ctx://prompts/inactive.md'), true);

const allExtNames = ExtensionRegistry.getExtensionNames({ activeOnly: false });
assert.equal(allExtNames.includes('u3_inactive_ext'), true);
const activeExtNames = ExtensionRegistry.getExtensionNames({ activeOnly: true });
assert.equal(activeExtNames.includes('u3_inactive_ext'), false);

// 5b. setActionFilter runs BEFORE variant collapse on both single and bulk paths (every item must pass in bulk)
ExtensionRegistry.setActionFilter((act, itemData) => {
    if (itemData?.readonly && act.id === 'file-copy') return false;
    return true;
});
const rwActions = ExtensionRegistry.getEntityActions('file', { filepath: 'app://local/a.py', readonly: false });
assert.equal(rwActions.find(a => a.setId === 'send').variants.some(v => v.id === 'file-copy'), true);

const roActions = ExtensionRegistry.getEntityActions('file', { filepath: 'ws://shared/a.py', readonly: true });
const roSend = roActions.find(a => a.setId === 'send');
assert.equal(roSend.variants.some(v => v.id === 'file-copy'), false, 'setActionFilter must hide file-copy before variant set collapse');
assert.equal(roSend.defaultVariant.id, 'file-share', 'Default variant must advance to next available variant when filter hides preferred one');

// Bulk selection: mixed RW + RO items must fail every-item filter for file-copy
const mixedBulk = ExtensionRegistry.getAggregatableActions([
    { entityType: 'file', data: { filepath: 'app://local/a.py', readonly: false } },
    { entityType: 'file', data: { filepath: 'ws://shared/b.py', readonly: true } }
]);
const mixedSend = mixedBulk.find(a => a.setId === 'send');
assert.equal(mixedSend.variants.some(v => v.id === 'file-copy'), false, 'Bulk action must survive only if every selected item passes setActionFilter');

// Replacing setActionFilter overwrites the previous filter
ExtensionRegistry.setActionFilter(() => true);
const restoredRoActions = ExtensionRegistry.getEntityActions('file', { filepath: 'ws://shared/a.py', readonly: true });
assert.equal(restoredRoActions.find(a => a.setId === 'send').variants.some(v => v.id === 'file-copy'), true);
ExtensionRegistry.setActionFilter(null);
ExtensionRegistry.setFilterPredicate(prevFilterPred);

// 5c. Same-type bulk selection remembers last-used variant under that entity type; mixed selection uses 'bulk'
const { resolveSelectionEntityType } = await import('sutram/sutram_sdk.js');
assert.equal(resolveSelectionEntityType([
    { entityType: 'file:note', data: {} },
    { entityType: 'file:note', data: {} }
]), 'file:note');
assert.equal(resolveSelectionEntityType([
    { entityType: 'file', data: {} },
    { entityType: 'folder', data: {} }
]), 'bulk');

// 5d. SutramEntityActions post-render overflow clamping steps down when rendered row overflows container, and resets when variant-set width changes
const actionsRow = new SutramEntityActions();
actionsRow.entityType = 'file';
actionsRow.entityData = { filepath: 'app://a/test.py' };
actionsRow._containerWidth = 220;
actionsRow.render();
actionsRow._lastRenderedFitCount = 2;
actionsRow.shadowRoot = {
    querySelector: (sel) => sel === '.action-row' ? { clientWidth: 200, scrollWidth: 245 } : null
};
actionsRow.updated(new Map());
assert.equal(actionsRow._overflowClampCount, 1, 'Post-render overflow must decrement fit count so clipped button moves to 3-dot menu');
assert.ok(actionsRow._lastClampContextKey.includes('send:'), 'clampContextKey must track variant-set setId and estimated width');
actionsRow.entityData = { filepath: 'app://a/test.md' }; // Publish Document becomes available -> maxLabelChars increases
actionsRow.render();
assert.equal(actionsRow._overflowClampCount, null, 'Changing variant-set estimated width must reset _overflowClampCount');

// 5e. SutramSubtabMenu stays rendered in place and disabled when view has no actions
const emptySubMenu = new SutramSubtabMenu();
emptySubMenu.slotConfig = { id: 'plain_view', label: 'Plain View' };
emptySubMenu._rebuildMenu();
const emptyMenuTpl = emptySubMenu.render();
const emptyMarkup = emptyMenuTpl?.strings ? emptyMenuTpl.strings.join('') : '';
assert.ok(emptyMarkup.includes('subtab-menu-trigger'), 'SutramSubtabMenu must stay rendered when empty');
assert.ok(emptyMarkup.includes('disabled'), 'SutramSubtabMenu trigger must be disabled when empty');

// 5f. SutramAppShell single-row top bar and position bar rendering
const { SutramAppShell } = await import('sutram/app_shell.js');
const { LayoutStore } = await import('sutram/sutram_sdk.js');
ExtensionRegistry.registerExtension('u3_shell_ext', {
    name: 'U3 Shell Ext',
    layoutSlots: [
        { slot: 'slots:primary-navigation', id: 'context', label: 'Context', icon: 'folder-code', order: 1 },
        { slot: 'slots:sub-navigation', targetParent: 'context', id: 'prompts', label: 'Prompts', icon: 'file-text', order: 1 },
        { slot: 'slots:sub-navigation', targetParent: 'context', id: 'files', label: 'Files', icon: 'folder', order: 2 }
    ]
});
LayoutStore.setState({
    capacity: 1,
    userCapacity: 1,
    mobileViewportIndex: 1,
    focusedColumn: 'center',
    layoutRatios: [1, 2, 1],
    columns: {
        left: { active: 'u3_shell_ext:prompts', pinned: [{ id: 'u3_shell_ext:prompts', label: 'Prompts' }, { id: 'u3_shell_ext:files', label: 'Files' }], history: [] },
        center: { active: 'u3_shell_ext:files', pinned: [{ id: 'u3_shell_ext:files', label: 'Files' }], history: [] },
        right: { active: null, pinned: [], history: [] }
    },
    windows: []
});
const shell = new SutramAppShell();
shell._layoutConfig = ExtensionRegistry.getLayoutSlots();
shell._spatialState = LayoutStore.getState();
const dropdownItems = shell._buildColumnTabDropdownItems(
    { id: 'left', label: 'Left' },
    [
        { id: 'u3_shell_ext:prompts', rawId: 'prompts', label: 'Prompts', icon: 'file-text', actualSourceCol: 'left' },
        { id: 'u3_shell_ext:files', rawId: 'files', label: 'Files', icon: 'folder', actualSourceCol: 'left' }
    ],
    { id: 'u3_shell_ext:prompts', rawId: 'prompts', label: 'Prompts', icon: 'file-text', actualSourceCol: 'left' },
    shell._layoutConfig.filter(s => s.slot === 'slots:primary-navigation'),
    shell._layoutConfig.filter(s => s.slot === 'slots:sub-navigation')
);
assert.equal(dropdownItems[0].sectionHeading, 'Open in this column');
assert.equal(dropdownItems[1].checked, true, 'Active tab must be ticked in Open in this column');
assert.equal(dropdownItems[2].checked, false);
assert.equal(typeof dropdownItems[1].trailingButton?.onClick, 'function', 'Open tabs must expose close trailing button');
assert.equal(dropdownItems.some(i => i.sectionHeading === 'Add a tab · Context'), true, 'Launcher categories must appear under Add a tab sections');

// 5g. SutramAppShell inline tab post-render overflow clamping & dirty label shrink reset
let dirtyTabId = 'u3_shell_ext:files';
ExtensionRegistry.registerExtension('u3_dirty_hook_ext', {
    name: 'U3 Dirty Hook Ext',
    uiHooks: {
        'sutram:is-projection-dirty': (id) => id === dirtyTabId
    }
});
shell._colTabsWidths = { left: 260, center: 0, right: 0 };
shell.render();
shell._lastRenderedInlineCounts = { left: 1, center: 0, right: 0 };
shell._inlineTabClampCounts = { left: null, center: null, right: null };
shell.shadowRoot = {
    querySelectorAll: (sel) => sel === '.col-tabs-area'
        ? [{ dataset: { colTabs: 'left' }, clientWidth: 180, scrollWidth: 240 }]
        : []
};
shell._checkInlineTabsOverflow();
assert.equal(shell._inlineTabClampCounts.left, 0, 'Post-render overflow on .col-tabs-area must decrement inline tab count');
dirtyTabId = null; // File saved -> loses '*' suffix -> clampKey changes
shell.render();
assert.equal(shell._inlineTabClampCounts.left, null, 'Saving a dirty inline tab (losing *) must reset _inlineTabClampCounts for that column');

// 5h. SutramSelectionTray empty collapse & Shadow-boundary assignedSlot width resolution
const { SutramSelectionTray } = await import('sutram/primitives.js');
SelectionStore.getState().clearSelection();
const tray = new SutramSelectionTray();
const mockSpatialCol = {
    clientWidth: 820,
    matches: (sel) => sel.includes('.spatial-col')
};
const mockSlot = {
    parentElement: mockSpatialCol,
    matches: () => false
};
tray.assignedSlot = mockSlot;
tray.parentElement = { clientWidth: 44, matches: () => false }; // Shrink-wrapped Light-DOM wrapper
tray.connectedCallback();
assert.equal(tray.empty, true, 'Selection tray must reflect empty=true when nothing is selected');
assert.equal(tray._compactChip, false, 'Selection tray must pierce assignedSlot to read .spatial-col width (820px >= 480px -> full "N selected" label)');

mockSpatialCol.clientWidth = 360;
tray._syncChipMode();
assert.equal(tray._compactChip, true, 'Selection tray in 360px column must switch to compact icon + count badge');

SelectionStore.getState().toggleSelection('app://a/1.py', 'file', { filepath: 'app://a/1.py' });
SelectionStore.getState().toggleSelection('app://a/2.py', 'file', { filepath: 'app://a/2.py' });
assert.equal(tray.empty, false, 'Selection tray must reflect empty=false while items are selected');
SelectionStore.getState().clearSelection();
tray.disconnectedCallback();

// 5i. SutramSubtabMenu store subscription cleanup across slotConfig changes, same-store deduplication, & synchronous lazy store resolution
const { createSutramStore, SutramElement } = await import('sutram/sutram_sdk.js');
const MenuWatchStore = createSutramStore('MenuWatch', { tick: 0 });
const leakTestMenu = new SutramSubtabMenu();
leakTestMenu.connectedCallback();
let firstUnsubRef = null;
for (let i = 0; i < 5; i++) {
    leakTestMenu.slotConfig = {
        id: `tab_${i}`,
        bulkActionGroup: 'share',
        bulkEntityTypes: ['file'],
        menuStores: ['MenuWatch'],
        menuActions: [{ label: 'Refresh View', icon: 'refresh-cw', onClick: () => {} }]
    };
    leakTestMenu._bindSlotMenuStores();
    if (i === 0) firstUnsubRef = leakTestMenu._slotStoreUnsubs[0];
}
assert.equal(
    leakTestMenu._slotStoreUnsubs.length,
    1,
    'Switching slotConfig repeatedly must never accumulate duplicate menuStores listeners'
);
assert.equal(
    leakTestMenu._slotStoreUnsubs[0],
    firstUnsubRef,
    'Re-rendering with an identical menuStores list must preserve the existing store subscription without churn'
);

// Event-driven lazy store subscription fires synchronously upon StoreRegistry.register without timers
class LazySubProbe extends SutramElement {}
if (!customElements.get('lazy-sub-probe')) customElements.define('lazy-sub-probe', LazySubProbe);
const lazyProbe = new LazySubProbe();
let lazyHydratedVal = null;
lazyProbe.subscribe('LateRegisteredU3Store', (state) => { lazyHydratedVal = state?.ready; });
createSutramStore('LateRegisteredU3Store', { ready: 'instant-no-timer' });
assert.equal(lazyHydratedVal, 'instant-no-timer', 'Lazy store subscription must bind and fire synchronously upon store registration');
lazyProbe.disconnectedCallback();
SelectionStore.getState().toggleSelection('app://a/1.py', 'file', { filepath: 'app://a/1.py' });
leakTestMenu._selectedItems = SelectionStore.getState().selectedItems;
leakTestMenu._rebuildMenu();
const clearIdx = leakTestMenu._menuItems.findIndex(i => (i.label || '').startsWith('Clear Selection'));
assert.ok(clearIdx > 0, 'Clear Selection item must be present when items are selected');
let precedingHeading = null;
for (let i = clearIdx - 1; i >= 0; i--) {
    if (leakTestMenu._menuItems[i].sectionHeading) {
        precedingHeading = leakTestMenu._menuItems[i].sectionHeading;
        break;
    }
}
assert.equal(precedingHeading, 'Selection', 'Clear Selection must sit under its own Selection section heading, never under a variant-set section');
SelectionStore.getState().clearSelection();
leakTestMenu.disconnectedCallback();

// 5j. YenvuiDropdown section-preserving search filter and trailingButton click isolation
const tabDd = new YenvuiDropdown();
let rowClicked = 0;
let trailingClicked = 0;
tabDd.items = [
    { sectionHeading: 'Open in this column' },
    {
        id: 'open:prompts',
        label: 'Prompts',
        checked: true,
        onClick: () => { rowClicked++; },
        trailingButton: {
            icon: 'x',
            title: 'Close Prompts',
            closeMenu: false,
            onClick: () => { trailingClicked++; }
        }
    },
    { sectionHeading: 'Add a tab · Context' },
    { id: 'add:gather', label: 'Gather', onClick: () => {} },
    { sectionHeading: 'Add a tab · Tasks' },
    { id: 'add:tracker', label: 'Tracker', onClick: () => {} }
];
tabDd.open = true;
const openRowItem = tabDd.items[1];
let trailingStopped = false;
openRowItem.trailingButton.onClick({
    stopPropagation() { trailingStopped = true; },
    preventDefault() {}
});
assert.equal(trailingClicked, 1, 'Trailing button handler must execute');
assert.equal(rowClicked, 0, 'Trailing button click must not invoke parent row onClick');
assert.equal(tabDd.open, true, 'Trailing button with closeMenu: false must keep dropdown open');

tabDd._searchQuery = 'gather';
const filteredDdItems = tabDd._getFilteredItems();
assert.deepEqual(
    filteredDdItems.map(i => i.sectionHeading || i.id),
    ['Add a tab · Context', 'add:gather'],
    'Dropdown search must keep matching section headings and omit non-matching sections'
);

// 5k. YenvuiGestureController suppresses synthetic click after pan/drag but allows click on stationary tap
const { YenvuiGestureController } = await import('yenvui/physics.js');
const dummyHost = {
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    releasePointerCapture() {}
};
const gesture = new YenvuiGestureController(dummyHost, {});
gesture.start({ button: 0, pointerType: 'mouse', pointerId: 1, clientX: 100, clientY: 100 });
gesture._handlePointerMove({ clientX: 130, clientY: 100 }); // pan > 5px
gesture._handlePointerUp({ clientX: 130, clientY: 100 });

let postDragClickReachedChild = false;
const childClickMonitor = () => { postDragClickReachedChild = true; };
window.addEventListener('click', childClickMonitor);
window.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
window.removeEventListener('click', childClickMonitor);
assert.equal(postDragClickReachedChild, false, 'Capture-phase click interceptor must suppress the synthetic click immediately following a drag');

// Stationary tap (< 5px) on a second controller instance immediately after a drag on the first must NOT be swallowed
gesture.start({ button: 0, pointerType: 'mouse', pointerId: 2, clientX: 100, clientY: 100 });
gesture._handlePointerMove({ clientX: 140, clientY: 100 });
gesture._handlePointerUp({ clientX: 140, clientY: 100 }); // Arms click suppressor on gesture 1 without firing click

const gesture2 = new YenvuiGestureController(dummyHost, {});
gesture2.start({ button: 0, pointerType: 'mouse', pointerId: 3, clientX: 50, clientY: 50 });
gesture2._handlePointerUp({ clientX: 51, clientY: 50 }); // Stationary tap on gesture 2 clears gesture 1's lingering suppressor
let postTapClickReachedChild = false;
const tapClickMonitor = () => { postTapClickReachedChild = true; };
window.addEventListener('click', tapClickMonitor);
window.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
window.removeEventListener('click', tapClickMonitor);
assert.equal(postTapClickReachedChild, true, 'Stationary tap on any controller instance must clear prior suppressors and allow normal click propagation');

console.log('SPRINT_U1_TESTS_PASSED');
"""
        res = self._run_node_script(test_mjs)
        self.assertIn("SPRINT_U1_TESTS_PASSED", res.stdout)


if __name__ == "__main__":
    unittest.main()
