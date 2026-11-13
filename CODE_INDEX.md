# Sutram / yenVUI Code Index

This index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.

```text
sutram/
├── .github/                        # GitHub repository configuration
│   └── workflows/                  # GitHub Actions workflows
│       └── ci.yml                  # Runs the shared Callosemic stack battery (akasa -> sutram -> insetu) on every push to main.
├── .gitignore                      # Git exclusion rules and workspace tracking ignores
├── .gitkeep                        # Folder preservation tracking marker
├── CHANGELOG.md                    # Automated semantic release change log ledger
├── CODE_INDEX.md                   # Architectural directory map and operational index
├── LICENSE                         # Apache-2.0 open-source software license
├── NOTICE                          # Copyright notice and attribution ledger
├── build_matrix.json               # Vendor artifact distribution build matrix schema
├── docs/                           # Central Single Source of Truth for documentation
│   ├── 00_index.md                 # Master ecosystem documentation index
│   ├── 01_engineering_standards.md # Unified Sutram and yenVUI engineering standards & guardrails
│   ├── 02_yenvui_blueprint.md      # Presentation chassis philosophy and atomic component arsenal
│   ├── ADR_INDEX.md                # Global Architectural Decision Record (ADR) ledger index
│   ├── adrs/                       # Centralized ADR chronological decision ledger
│   │   ├── 0005_yenvui_popover_toasts_gesture_selection.md # ADR-0005: Native popover API and selection physics
│   │   ├── 0006_yenvui_gesture_swipe_axis_locking.md # ADR-0006: Gesture swipe axis locking and event handshakes
│   │   ├── 0007_sutram_offline_microkernel_and_metronome_backoff.md # ADR-0007: Offline micro-kernel architecture and metronome visibility backoff
│   │   ├── 0008_yenvui_duck_typed_selection_contracts.md # ADR-0008: Duck-typed selection contracts for gesture targets
│   │   ├── 0009_sutram_spatial_layout_and_projection_engine.md # ADR-0009: Spatial 3-column layout engine and DOM projection pooling
│   │   ├── 0010_sutram_floating_window_projection.md # ADR-0010: Floating window projection layer and z-index management
│   │   ├── 0011_sutram_context_mixin_and_grid_constrained_windows.md # ADR-0011: SutramContextMixin and grid-constrained spatial window projections
│   │   ├── 0012_yv_icon_component_and_direct_node_retention.md # ADR-0012: Native yv-icon component and direct Lit element node retention
│   │   ├── 0013_sutram_dynamic_spatial_ratios_and_light_dom_bem_styles.md # ADR-0013: Proportional column layout ratios and Light-DOM BEM primitive consolidation
│   │   ├── 0014_sutram_focus_backstack_worker_broker_and_content_visibility.md # ADR-0014: Focus MRU backstack, singleton worker broker, and content-visibility pruning
│   │   ├── 0015_sutram_decoupled_host_contracts_popout_shell_and_action_aggregation.md # ADR-0015: Decoupled host contracts, popout shell projection, and action aggregation
│   │   ├── 0016_yenvui_diff_viewer_and_diff_utils.md # ADR-0016: Kinetic diff-viewer primitive, LCS diff utilities, and theme-neutral observation
│   │   ├── 0017_yenvui_top_layer_popover_anchoring_and_spatial_geometry_tokens.md # ADR-0017: Top-layer popover anchoring engine and standardized spatial geometry tokens
│   │   ├── 0018_spatial_drag_hud_css_mask_icons_and_offline_write_through.md # ADR-0018: Spatial drag HUD coordinator, CSS mask-image icon primitive, and offline cache write-through
│   │   ├── 0019_codemirror_tag_completion_defense_ligature_suppression_and_innerhtml_ban.md # ADR-0019: CodeMirror tag completion defense, ligature suppression, and innerHTML ban
│   │   ├── 0020_multi_window_popout_lifecycle_broadcast_channel_and_declarative_job_runner.md # ADR-0020: Multi-window popout lifecycle, BroadcastChannel IPC synchronization, and declarative job runner
│   │   ├── 0021_declarative_settings_form_engine_configuration_hooks_and_native_esm_caching.md # ADR-0021: Declarative settings form engine, configuration hooks, and native ESM caching
│   │   ├── 0022_store_registry_multi_tenancy_three_way_merge_and_projection_rekeying.md # ADR-0022: StoreRegistry multi-tenancy scoping, three-way text merge, and projection rekeying
│   │   ├── 0023_codemirror_viewport_preservation_prose_engine_and_virtualizer_sizing.md # ADR-0023: CodeMirror viewport preservation, prose typography engine, and virtualizer intrinsic sizing
│   │   ├── 0024_generational_projection_pooling_debounced_persistence_and_lazy_lru_caching.md # ADR-0024: Generational projection pooling, debounced store persistence, and lazy LRU cache buffering
│   │   ├── 0025_root_viewport_physics_guard_kinetic_throw_and_reentrant_scroll_lock.md # ADR-0025: Root viewport physics guard, kinetic momentum throw engine, and reentrant scroll locking
│   │   ├── 0026_pluggable_chassis_contract_ui_adapter_and_kernel_entrypoint.md # ADR-0026: Pluggable Chassis Provider Contract, SutramUIAdapter, Input Event Bridging, and Public Kernel Entrypoint
│   │   ├── 0027_yenvui_autonomous_chassis_provider_and_input_primitives.md # ADR-0027: yenVUI Autonomous Chassis Provider Implementation, Input Primitives Extraction, and Upward Kernel Decoupling
│   │   ├── 0028_compound_target_binding_and_sw_dev_cache_bypass.md # ADR-0028: Compound Target Binding Controls, Dynamic Schema Option Sources, and Development Service Worker Cache Bypass
│   │   ├── 0029_host_agnostic_language_descriptors_stream_modes_and_plaintext_fallback.md # ADR-0029: Host-Agnostic Editor Language Descriptors, StreamLanguage Wrapping, Per-Language Caching, and Plain-Text Fallback
│   │   ├── 0030_zero_css_lego_layout_primitives_semantic_tokens_and_composer.md # ADR-0030: Zero-CSS Lego Layout Primitives, Semantic Token Parameterization, SutramComposer, and Floating HUD
│   │   ├── 0031_offline_app_shell_vault_atomic_cache_overlays_and_markdown_link_widgets.md # ADR-0031: Offline App Shell Vault, Atomic Read-Your-Writes Cache Overlays, Functional Store Initializers, User Column Capacity, and Editor Markdown Link Widgets
│   │   ├── 0032_versioned_build_staging_navigation_cutover_and_esm_loader.md # ADR-0032: Versioned Build Staging, Navigation-Gated Cutover, Captive-Portal Defense, and Zero-Dependency ESM Test Loader
│   │   └── archived/               # Deeply embedded baseline architectural records preserved for historical reference
│   │       ├── 0001_sutram_ioc_microkernel_architecture.md # ADR-0001: IoC microkernel and slot layout architecture
│   │       ├── 0002_sutram_bootloader_and_resilience_patterns.md # ADR-0002: Stage 1 bootloader and error boundary standards
│   │       ├── 0003_yenvui_theme_mutation_observers.md # ADR-0003: Dynamic theme mutation observer pattern
│   │       └── 0004_yenvui_codemirror6_tab_view_caching.md # ADR-0004: Encapsulated CodeMirror 6 and tab caching
│   └── yenvui_contracts.md         # Interface contract specification and CSS intent tokens for yenVUI presentation chassis
├── pyproject.toml                  # Python project metadata and semantic release configuration
├── readme.md                       # Master repository architecture map and component reference
├── sutram/                         # Core Sutram IoC Micro-Kernel runtime
│   └── js/                         # Pure ES module frontend runtime kernel and utilities
│       ├── app_shell.js            # Declarative web component app shell and tab layout router
│       │   ├── function getSpatialMetrics(capacity, activeViewport, layout...) # Computes proportional column widths, track offsets, and window bounds across 1-3 column capacities.
│       │   ├── function pinMatchesSlot(pin, slotOrId) # Evaluates whether a pinned projection entry matches a layout slot definition or target identifier.
│       │   └── class SutramAppShell # Top-level 3-column spatial viewport shell coordinating tab routing, user-clamped capacity, projection pooling, and windowed surfaces.
│       ├── client.js               # Agnostic data provider client and HTTP transport provider interface
│       │   ├── class SutramDataClient # sutram/js/client.js Phase 0: Sutram Micro-Kernel Data Provider Interface
│       │   └── class HttpProvider  # Default fetch-backed HTTP transport provider for GET, POST, and DELETE requests.
│       ├── drag-coordinator.js     # Spatial drag-and-drop overlay coordinator for interactive column reordering
│       │   └── class SutramDragCoordinator # Dual-mode spatial drag HUD coordinating tab docking, column reordering, window spanning, and popout ejection.
│       ├── index.js                # Public Layer 2 barrel entrypoint exporting Sutram stores, offline engines, and UI primitives
│       ├── inputs.js               # Standard form input elements (text, select, textarea, toggle, combobox, target binding, composer)
│       │   ├── function bridgeInputEvents(BaseClass) # Event bridge wrapping chassis form inputs to emit sutram-input-changed
│       │   ├── class SutramInput   # Single-line text input bridged to Sutram event bus
│       │   ├── class SutramSelect  # Dropdown select control bridged to Sutram event bus
│       │   ├── class SutramTextarea # Multiline auto-sizing textarea bridged to Sutram event bus
│       │   ├── class SutramToggle  # Boolean toggle switch bridged to Sutram event bus
│       │   ├── class SutramCombobox # Searchable and filterable text combobox with dropdown options
│       │   ├── class SutramTargetBinding # Compound endpoint and model selector pairing select and combobox with model candidate validity retention
│       │   └── class SutramComposer # Slash-command message composer with token chip extraction and native textarea synchronization
│       ├── merge.js                # The three-way text merge moves into its own module.
│       │   └── function threeWayMergeText(baseText, localText, remoteText) # Deterministic three-way text merge of two edits of baseText: the local one and the remote one.
│       ├── offline.js              # Offline IndexedDB persistence manager, outbox reconciler, and network hysteresis manager
│       │   ├── function emitOfflineTelemetry(message, type = 'info', category...) # Dispatches structured sutram:offline-telemetry events across the window bus.
│       │   ├── class SutramDB      # IndexedDB storage engine for VFS blob caching, atomic cache overlays, prefix eviction, lazy LRU tracking, outbox mutation sets, and DLQ management.
│       │   ├── class OfflineHttpProvider # Network-first HTTP gateway with 502/503/504 gateway fallback, IoC cache predicates, and offline outbox queueing.
│       │   ├── class NetworkHysteresisManager # Burst-verification connectivity probe preventing premature online transitions on flaky networks.
│       │   ├── class OutboxReconciler # Two-stage sequential outbox drainer with Web Locks API coordination, telemetry emission, and 4xx poison-pill DLQ isolation.
│       │   ├── function purgeSutramCaches({ forceWhenOffline = false } = {}) # Safely clears CacheStorage and Service Worker registrations while guarding offline sessions.
│       │   ├── function ensureSutramAppShellCached(options = {}) # Stages and synchronizes versioned App Shell builds into CacheStorage with captive-portal and partial-failure guards.
│       │   ├── class SutramCacheWarmer # Background low-priority cache warmer with queue inspection, prefix pruning, and offline circuit-breaking.
│       │   └── function bootSutramServiceWorker(options = {}) # Registers the Service Worker, wires reconciliation state, and triggers App Shell vault warming.
│       ├── poller.js               # Background job status polling factory with tier-0 API integration
│       │   └── function createJobPoller(apiClient) # sutram/js/poller.js Standalone background job status polling routine
│       ├── primitives.js           # Presentation primitives (buttons, modals, toast, selection, status)
│       │   ├── function validateChassisContract(chassisProvider) # Verifies that a mounted presentation chassis exports all 28 required UI primitive classes.
│       │   ├── class SutramUIAdapter # Registers pass-through <sutram-*> custom element wrappers over the active chassis provider.
│       │   ├── class SutramVirtualList # Virtualized scroll list wrapper around lit-virtualizer with double-virtualization de-escalation.
│       │   ├── class SutramIcon    # 0.5 Semantic Icon & Layout Bricks
│       │   ├── class SutramView    # Primary viewport container bridging zen-mode exit events to the Sutram event bus.
│       │   ├── class SutramStack   # Flexbox and auto-fit CSS Grid layout stack primitive.
│       │   ├── class SutramSurface # Semantic container surface supporting panel, inset, tinted, floating, and banner variants.
│       │   ├── class SutramActionBar # Responsive horizontal action bar that auto-collapses button labels on overflow.
│       │   ├── class SutramSidebarLayout # Responsive split-pane sidebar and stage layout with mobile drawer collapse.
│       │   ├── class SutramBtn     # Synchronous action button primitive.
│       │   ├── class SutramProjectionWindowControls # Multi-window pop-out and dock-in toolbar control with pre-action save hooks.
│       │   ├── class SutramAsyncBtn # 1.5 Async Action Button
│       │   ├── class SutramStatusBar # 2.
│       │   ├── class SutramToastContainer # 3.
│       │   ├── class SutramSelectionTray # [stale?] 4.
│       │   ├── class SutramCategorizedList # [stale?] 5.
│       │   ├── class SutramFolderBrowser # [stale?] 6.
│       │   ├── class SutramModal   # 7.
│       │   ├── class SutramWindow  # Grid-constrained floating window surface supporting column spanning, focus elevation, and tab docking.
│       │   ├── class SutramFieldCard # Labeled form field card primitive with validation feedback and reset controls.
│       │   ├── class SutramSettingsForm # Schema-driven settings form renderer supporting hierarchical scopes, repeaters, and action triggers.
│       │   ├── class SutramGenericSettingsModal # Modal wrapper hosting SutramSettingsForm for extension and system configuration.
│       │   ├── class SutramEntityActions # [stale?] 8.5.
│       │   ├── class SutramCard    # [stale?] 9.
│       │   ├── class SutramCardGroup # 10.
│       │   ├── class SutramSearchBar # 11.
│       │   ├── class SutramSpinner # [comment required]
│       │   ├── class SutramEmptyState # [comment required]
│       │   ├── class SutramBoard   # [comment required]
│       │   ├── class SutramColumn  # [comment required]
│       │   ├── class SutramTag     # [comment required]
│       │   ├── class SutramLabel   # [comment required]
│       │   ├── class SutramScrubTrack # [comment required]
│       │   ├── class SutramScrollView # [comment required]
│       │   ├── class SutramToolbar # [comment required]
│       │   ├── class SutramDropdown # [stale?] 12.
│       │   ├── class SutramTabs    # [comment required]
│       │   ├── class SutramFilterDropdown # [comment required]
│       │   ├── class SutramCollapsible # [comment required]
│       │   ├── class SutramCategorySection # [comment required]
│       │   ├── class SutramPill    # 13.
│       │   ├── class SutramFilterGroup # Pill filter group wrapper bridging yenvui-filter-changed to filter-changed.
│       │   ├── class SutramEditor  # CodeMirror 6 editor wrapper bridging change, selection, scroll, and link-clicked events with word-count plugin support.
│       │   ├── class SutramSelectorModal # [stale?] 15.
│       │   ├── class SutramReportProjection # [stale?] 16.
│       │   ├── class SutramDiffViewer # 17.
│       │   ├── class SutramSubtabMenu # [stale?] 18.
│       │   ├── class SutramDagTree # 19. Universal Wavefront & Hierarchy DAG Tree Primitive
│       │   └── class SutramFloatingHud # 20. Corner-Pinned Collapsible Status & Telemetry HUD
│       ├── projection_engine.js    # Declarative layout projection compiler (SutramProjectionCompiler)
│       │   ├── class SutramProjectionCompiler # [comment required]
│       │   └── class SutramProjectionPool # [comment required]
│       ├── shared_styles.js        # Lit CSS intent tokens, presentation primitives, and theme styles
│       ├── shortcuts.js            # Centralized context-aware keydown shortcut router
│       │   └── function initShortcutRouter(registry, getActiveContexts) # sutram/js/shortcuts.js Centralized hierarchical shortcut router
│       ├── sutram-boot.js          # Stage 1 bootloader for importmap synthesis, SemVer parsing, and guardrails
│       ├── sutram_sdk.js           # IoC Micro-Kernel, SutramElement base class, SutramContextMixin, and ExtensionRegistry
│       │   ├── function createSutramStore(name, initialStateOrFn, persiste...) # [comment required]
│       │   ├── function bindStoreInput(store, statePath, currentValue,...) # [comment required]
│       │   ├── function SutramContextMixin(SuperClass) # Mixin equipping Web Components with automatic Zustand subscriptions, intervals, and global listener teardown.
│       │   ├── class SutramElement # Base LitElement class with SutramContextMixin lifecycle management and render error boundaries.
│       │   └── function canUseMultiWindowPopout() # Evaluates whether the current viewport and display mode support multi-window popouts.
│       ├── sw-core.js              # Abstracted Service Worker core runtime for offline caching and navigation fallbacks
│       ├── utils.js                # Pure algorithmic utility helpers (fuzzy filter, debounce, coalescedAsync, slugify, time formatting, nativeShareFiles)
│       │   ├── function shallowEqual(a, b) # [comment required]
│       │   ├── function normalizeAccentText(str) # [comment required]
│       │   ├── function fuzzyFilterObjects(items, query, getSearchString =...) # [comment required]
│       │   ├── function debounce(callback, delay = 300) # [comment required]
│       │   ├── function coalescedAsync(asyncFn) # [comment required]
│       │   ├── function slugify(str) # [comment required]
│       │   ├── function truncateFilename(filename, maxLen = 24, ellipsis...) # [comment required]
│       │   ├── function clone(obj) # [comment required]
│       │   ├── function compileDagWavefronts(nodes, options = {}) # [comment required]
│       │   ├── function extractTemplateVariables(text, options = {}) # [comment required]
│       │   ├── function interpolateTemplateVariables(text, values = {}, options = {}) # [comment required]
│       │   ├── function copyToClipboard(text) # [comment required]
│       │   ├── function copyRichHtml(htmlStr, plainText = null) # [comment required]
│       │   ├── function copyRawText(text, successCallback, errorCall...) # [comment required]
│       │   ├── function downloadBlob(blob, filename) # [comment required]
│       │   ├── function nativeShareFiles(fileObjects) # [comment required]
│       │   ├── function downloadFile(fetchUrl, fallbackFilename, fetc...) # [comment required]
│       │   ├── function bindGhostDrag(e, label, icon = '📄', payloadDat...) # [comment required]
│       │   ├── function buildFileTree(files, stripPrefix = '', options...) # [comment required]
│       │   ├── function resolveDirectoryState(treeRoot, currentPath = [], opti...) # [comment required]
│       │   ├── function timeAgo(timestamp) # [comment required]
│       │   ├── function formatDate(timestamp) # [comment required]
│       │   ├── function resolveSutramAsset(relativePath, fallbackMetaUrl =...) # [comment required]
│       │   └── class SutramWorkerBroker # [comment required]
│       ├── wordcount.js            # Ephemeral word count widget decoration plugin for CodeMirror 6
│       │   ├── class WordCountWidget # [comment required]
│       │   └── function buildDecorations(state) # [comment required]
│       └── workers/                # Dedicated off-main-thread Web Worker scripts
│           └── search-worker.js    # Web Worker for asynchronous fuzzy filtering and directory tree construction
├── tests/                          # Automated presentation chassis compliance tests and fitness functions
│   ├── fitness/                    # Modular static analysis rules for Sutram and yenVUI architectural invariants
│   │   ├── __init__.py             # Unit test package initializer
│   │   │   └── def run_all()       # [comment required]
│   │   ├── core.py                 # Shared file walker and violation reporting state
│   │   │   ├── class FitnessState  # [comment required]
│   │   │   ├── def report_violation(rule_name, filepath, line_num, message) # [comment required]
│   │   │   └── def collect_unique_files(directories, extensions) # [comment required]
│   │   ├── rules_sutram.py         # Sutram micro-kernel domain isolation, metronome, and store schema rules
│   │   │   └── def check_sutram_rules() # [comment required]
│   │   └── rules_yenvui.py         # yenVUI presentation token, dialog lifecycle, and container query rules
│   │       └── def check_yenvui_rules() # [comment required]
│   ├── fitness_functions.py        # CLI entrypoint for Sutram and yenVUI architectural fitness validation
│   ├── run_unit_tests.py           # CLI test runner for platform behavioral unit tests
│   ├── sutram_consumer_linter.py   # Reusable static analysis script for consumer UDF compliance
│   │   ├── def strip_lit_expressions(line) # Replaces every Lit ${...} expression on a line with an empty '${}' (brace-balanced, so arrow functions and object literals inside bindings a...
│   │   ├── def iter_sutram_tags(text) # Yields every <sutram-*> opening tag with its line, attribute text, and names-only text; multi-line and ${...}-safe.
│   │   ├── def load_declared_properties(sutram_root) # Maps each sutram-* tag to its declared properties and reflected attributes, through inheritance, mixins, chassis aliases and passthrough tags.
│   │   ├── def undeclared_bindings(tag, attrs, declared) # Bindings on a sutram tag that name no declared property or attribute, so they would do nothing.
│   │   ├── def run_consumer_lint(target_dir, allow_host_globals) # Sweeps a consumer frontend directory for Sutram/yenVUI compliance; tag-level rules read whole tags.
│   │   └── def check_host_domain_decoupling(target_dir) # Fitness Function: Enforces pure host-neutral Inversion of Control.
│   └── unit/                       # Behavioral unit and integration tests for the Sutram runtime
│       ├── __init__.py             # Unit test package initializer
│       ├── js/                     # Standalone Node.js ESM behavioral integration test suites
│       │   └── sw_core_staging.mjs # Node behavioral test exercising ensureSutramAppShellCached through sw-core.js's real fetch event handler on a non-localhost origin.
│       │       ├── class FakeCache # [comment required]
│       │       ├── class FakeCacheStorage # [comment required]
│       │       ├── function networkFetch(input, init = {}) # [comment required]
│       │       └── function swInterceptedFetch(input, init = {}) # Route page fetch() through sw-core.js's real fetch listener
│       ├── js_loader.mjs           # Zero-dependency Node.js ESM loader and minimal browser environment shim for Sutram & yenVUI unit tests.
│       │   └── class MemoryStorage # [comment required]
│       ├── test_consumer_linter.py # Tests the consumer linter: Lit bindings in button labels, whole-tag rules across lines, and undeclared property bindings
│       │   ├── class TestConsumerLinterButtonLabels(unittest.TestCase) # SUTRAM_BUTTON_DECLARATIVE_LABEL_MANDATE must ignore '=>' and '>' inside Lit ${...} bindings.
│       │   └── class TestConsumerLinterWholeTags(unittest.TestCase) # Tag-level rules read whole tags; undeclared and attribute-mismatched bindings are flagged.
│       └── test_sutram_registry.py # Node.js and Python behavioral tests for StoreRegistry, ExtensionRegistry, and utilities
│           └── class TestSutramRegistry(unittest.TestCase) # [comment required]
└── yenvui/                         # Edge-Native presentation chassis and Web Component UI library
    ├── css/                        # Universal CSS theme tokens and layout resets
    │   ├── theme-tokens.css        # CSS custom property tokens for Dark, Light, and E-Ink brutalist themes
    │   └── yenvui-primitives.css   # Atomic presentation resets and utility classes
    └── js/                         # Pure ES module frontend runtime kernel and utilities
        ├── async-btn.js            # Agnostic asynchronous action button with status feedback state machine
        │   ├── class YenvuiBtn     # [comment required]
        │   └── class YenvuiAsyncBtn # [comment required]
        ├── board.js                # Multi-column container-query responsive layout grid and column container
        │   ├── class YenvuiBoard   # [comment required]
        │   └── class YenvuiColumn  # [comment required]
        ├── card-group.js           # Gesture-locked card container with edge-selection swipe detection, stacked layout rendering, and accordion deck physics
        │   └── class YenvuiCardGroup # [comment required]
        ├── card.js                 # Polymorphic card primitive with drawer overlay and long-press selection
        │   └── class YenvuiCard    # [comment required]
        ├── category-section.js     # Categorized list section wrapper with header action slot
        │   └── class YenvuiCategorySection # [comment required]
        ├── collapsible.js          # Expandable accordion container with semantic intent styling
        │   └── class YenvuiCollapsible # [comment required]
        ├── diff-utils.js           # Line-by-line diff calculation algorithms and patch formatting utilities
        │   ├── function computeIntraLineTokens(oldText = '', newText = '') # sutram/yenvui/js/diff-utils.js Zero-dependency diff parsing and 1:1 line alignment utility (Tier 0)
        │   ├── function computeMaxChars(searchLines, replaceLines, inter...) # [comment required]
        │   ├── function parseRawHunks(searchStr = '', replaceStr = '') # [comment required]
        │   ├── function parseNdiff(diffStr = '') # [comment required]
        │   ├── function parseUnifiedDiff(diffStr = '') # [comment required]
        │   └── function parseDiffPayload({ diffText = '', searchStr = '',...) # [comment required]
        ├── diff-viewer.js          # Dual-box and interleaved split-pane diff presentation component
        │   └── class YenvuiDiffViewer # [comment required]
        ├── drop-zone.js            # Top-layer popover drop overlay and drop target presentation primitives
        │   ├── class YenvuiDropOverlay # [comment required]
        │   └── class YenvuiDropTarget # [comment required]
        ├── dropdown.js             # Context popover trigger menus and filter dropdown panels
        │   ├── class YenvuiDropdown # [comment required]
        │   └── class YenvuiFilterDropdown # [comment required]
        ├── editor.js               # CodeMirror 6 code editor wrapper with descriptor-based language loading, StreamLanguage wrapping, and per-language caching
        │   ├── function loadLanguageExtension(lang, customResolver = null) # Resolves a CodeMirror language extension from core built-ins or a host descriptor ({url, kind, export, options}), falling back to plain text.
        │   └── class YenvuiEditor  # [stale?] Encapsulated CodeMirror 6 editor with minimal diff updates, prose helpers, and interactive Markdown link widgets.
        ├── empty-state.js          # Centered empty state feedback container with icon and text slot
        │   └── class YenvuiEmptyState # [comment required]
        ├── filter-group.js         # Interactive pill array for multi-attribute filtering
        │   └── class YenvuiFilterGroup # [comment required]
        ├── icon.js                 # Create Layer 1 YenvuiIcon chassis primitive supporting semantic size and intent attributes alongside SVG mask caching.
        │   ├── function getIconMaskUrl(name, strokeWidth = '2') # [comment required]
        │   └── class YenvuiIcon    # [comment required]
        ├── index.js                # Public Layer 1 chassis provider entrypoint exporting all yenVUI primitive classes, styles, and physics
        ├── inputs.js               # Standard form input elements (text, select, textarea, toggle)
        │   ├── class YenvuiInput   # [comment required]
        │   ├── class YenvuiSelect  # [comment required]
        │   ├── class YenvuiTextarea # [comment required]
        │   └── class YenvuiToggle  # [comment required]
        ├── label.js                # Standardized form label primitive with theme observation support
        │   └── class YenvuiLabel   # [comment required]
        ├── layout.js               # Implement YenvuiView, YenvuiStack, YenvuiSurface, and YenvuiActionBar layout primitives for the Zero-CSS Lego Standard.
        │   ├── class YenvuiView    # [comment required]
        │   ├── class YenvuiStack   # [comment required]
        │   ├── class YenvuiSurface # [comment required]
        │   ├── class YenvuiActionBar # [comment required]
        │   └── class YenvuiSidebarLayout # [comment required]
        ├── modal.js                # Native HTML5 top-layer dialog modal overlay with backdrop handling
        │   └── class YenvuiModal   # [comment required]
        ├── physics.js              # Universal gesture physics controller and Shadow DOM point resolution
        │   ├── function acquireBodyScrollLock() # [comment required]
        │   ├── function releaseBodyScrollLock() # [comment required]
        │   ├── function getEventPath(e) # [comment required]
        │   ├── function getEventTarget(e, selector = null) # Traverses the event path to find the first element matching a given CSS selector.
        │   ├── function anchorTopLayerPopover(triggerEl, popoverEl, options = {}) # Computes and applies true viewport coordinates for a #top-layer popover element.
        │   ├── function syncTopLayerPopover(triggerEl, popoverEl, isOpen, op...) # Promotes or dismisses a popover element in the browser's #top-layer and synchronizes its anchor coordinates.
        │   ├── function startKineticThrow(scrollEl, samples, { axis = 'y',...) # 60fps Inertial Momentum Throw Engine Applies exponential decay (0.94 friction) to a scroll container's scrollLeft/scrollTop based on recent...
        │   ├── class YenvuiViewportGuard # [stale?] Singleton Root Viewport Physics Guard (Tier 0 Chassis) Centralizes iOS Safari edge-swipe history navigation prevention across the entire doc...
        │   ├── function getDeepElementFromPoint(x, y, selector = null) # [comment required]
        │   └── class YenvuiGestureController # Universal Gesture Controller Normalizes PointerEvents for unified desktop/mobile dragging while maintaining an invisible TouchEvent listener...
        ├── pill.js                 # Toggleable tag/badge primitive supporting standard and text variants
        │   └── class YenvuiPill    # [comment required]
        ├── scroll-view.js          # Container-query responsive scrollable view container with adaptive edge padding
        │   └── class YenvuiScrollView # [comment required]
        ├── search-bar.js           # Standardized text search input with instant clear action
        │   └── class YenvuiSearchBar # [comment required]
        ├── selection-tray.js       # Floating action tray for batch selection operations
        │   └── class YenvuiSelectionTray # [comment required]
        ├── shared_styles.js        # Lit CSS intent tokens, presentation primitives, and theme styles
        ├── spinner.js              # Asynchronous CSS loading indicator component with custom text label
        │   └── class YenvuiSpinner # [comment required]
        ├── status-bar.js           # System status and background synchronization indicator bar
        │   └── class YenvuiStatusBar # [comment required]
        ├── tabs.js                 # Horizontal swipe carousel tab navigation and cached view router
        │   └── class YenvuiTabs    # [comment required]
        ├── tag.js                  # Semantic intent tag primitive with high-contrast theme overrides
        │   └── class YenvuiTag     # [comment required]
        ├── toast.js                # Non-blocking toast notification alert container
        │   └── class YenvuiToastContainer # [comment required]
        ├── toolbar.js              # Sticky header toolbar integrating search, filters, and action slots
        │   └── class YenvuiToolbar # [comment required]
        ├── window.js               # Grid-constrained floating workspace dialog surface with column anchor and span layout control
        │   └── class YenvuiWindow  # [comment required]
        └── yenvui-base.js          # Base presentation class encapsulating theme mutation observation and lifecycle hooks
            ├── class YenvuiBase    # [comment required]
            └── class YenvuiScrubTrack # [comment required]
```
