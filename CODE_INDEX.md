# Sutram / yenVUI Code Index

This index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.

```text
sutram/
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
│       │   ├── function getSpatialMetrics(capacity, activeViewport, layout...) # [comment required]
│       │   ├── function pinMatchesSlot(pin, slotOrId) # [comment required]
│       │   └── class SutramAppShell # [comment required]
│       ├── client.js               # Agnostic data provider client and HTTP transport provider interface
│       │   ├── class SutramDataClient # sutram/js/client.js Phase 0: Sutram Micro-Kernel Data Provider Interface
│       │   └── class HttpProvider  # [comment required]
│       ├── drag-coordinator.js     # Spatial drag-and-drop overlay coordinator for interactive column reordering
│       │   └── class SutramDragCoordinator # [comment required]
│       ├── index.js                # Public Layer 2 barrel entrypoint exporting Sutram stores, offline engines, and UI primitives
│       ├── inputs.js               # Standard form input elements (text, select, textarea, toggle, combobox, target binding)
│       │   ├── function bridgeInputEvents(BaseClass) # [comment required]
│       │   ├── class SutramInput   # [stale?] 1.
│       │   ├── class SutramSelect  # [stale?] 2.
│       │   ├── class SutramTextarea # [stale?] 3.
│       │   ├── class SutramToggle  # [stale?] 4.
│       │   ├── class SutramCombobox # [comment required]
│       │   └── class SutramTargetBinding # [comment required]
│       ├── offline.js              # Offline IndexedDB persistence manager, outbox reconciler, and network hysteresis manager
│       │   ├── class SutramDB      # [comment required]
│       │   ├── class OfflineHttpProvider # [comment required]
│       │   ├── class NetworkHysteresisManager # [comment required]
│       │   ├── class OutboxReconciler # [comment required]
│       │   ├── function purgeSutramCaches() # [comment required]
│       │   └── function bootSutramServiceWorker() # [comment required]
│       ├── poller.js               # Background job status polling factory with tier-0 API integration
│       │   └── function createJobPoller(apiClient) # sutram/js/poller.js Standalone background job status polling routine
│       ├── primitives.js           # Presentation primitives (buttons, modals, toast, selection, status)
│       │   ├── function validateChassisContract(chassisProvider) # [comment required]
│       │   ├── class SutramUIAdapter # [comment required]
│       │   ├── class SutramVirtualList # [stale?] 0.
│       │   ├── class SutramBtn     # 1.
│       │   ├── class SutramProjectionWindowControls # 1.25 Multi-Window Pop-Out / Dock-In Control Button
│       │   ├── class SutramAsyncBtn # 1.5 Async Action Button
│       │   ├── class SutramStatusBar # 2.
│       │   ├── class SutramToastContainer # 3.
│       │   ├── class SutramSelectionTray # [stale?] 4.
│       │   ├── class SutramCategorizedList # [stale?] 5.
│       │   ├── class SutramFolderBrowser # [stale?] 6.
│       │   ├── class SutramModal   # 7.
│       │   ├── class SutramWindow  # [comment required]
│       │   ├── class SutramFieldCard # [stale?] 8.
│       │   ├── class SutramSettingsForm # [comment required]
│       │   ├── class SutramGenericSettingsModal # [comment required]
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
│       │   ├── class SutramFilterGroup # [comment required]
│       │   ├── class SutramEditor  # [comment required]
│       │   ├── class SutramSelectorModal # 15.
│       │   ├── class SutramReportProjection # 16.
│       │   ├── class SutramDiffViewer # 17.
│       │   ├── class SutramSubtabMenu # 18.
│       │   └── class SutramDagTree # 19.
│       ├── projection_engine.js    # Declarative layout projection compiler (SutramProjectionCompiler)
│       │   ├── class SutramProjectionCompiler # [comment required]
│       │   └── class SutramProjectionPool # [comment required]
│       ├── shared_styles.js        # Lit CSS intent tokens, presentation primitives, and theme styles
│       ├── shortcuts.js            # Centralized context-aware keydown shortcut router
│       │   └── function initShortcutRouter(registry, getActiveContexts) # sutram/js/shortcuts.js Centralized hierarchical shortcut router
│       ├── sutram-boot.js          # Stage 1 bootloader for importmap synthesis, SemVer parsing, and guardrails
│       ├── sutram_sdk.js           # IoC Micro-Kernel, SutramElement base class, SutramContextMixin, and ExtensionRegistry
│       │   ├── function createSutramStore() # [comment required]
│       │   ├── function bindStoreInput() # [comment required]
│       │   ├── function SutramContextMixin(SuperClass) # [comment required]
│       │   ├── class SutramElement # [comment required]
│       │   └── function canUseMultiWindowPopout() # [comment required]
│       ├── sw-core.js              # Abstracted Service Worker core runtime for offline caching and navigation fallbacks
│       ├── utils.js                # Pure algorithmic utility helpers (fuzzy filter, debounce, coalescedAsync, slugify, time formatting, nativeShareFiles)
│       │   ├── function threeWayMergeText(baseText, localText, remoteText) # [comment required]
│       │   ├── function shallowEqual(a, b) # [comment required]
│       │   ├── function normalizeAccentText(str) # [comment required]
│       │   ├── function fuzzyFilterObjects(items, query, getSearchString =...) # [comment required]
│       │   ├── function debounce(callback, delay = 300) # [comment required]
│       │   ├── function coalescedAsync(asyncFn) # [comment required]
│       │   ├── function slugify(str) # [comment required]
│       │   ├── function truncateFilename(filename, maxLen = 24, ellipsis...) # [comment required]
│       │   ├── function clone(obj) # [comment required]
│       │   ├── function compileDagWavefronts() # [comment required]
│       │   ├── function extractTemplateVariables() # [comment required]
│       │   ├── function interpolateTemplateVariables() # [comment required]
│       │   ├── function copyToClipboard(text) # [comment required]
│       │   ├── function copyRichHtml(htmlStr, plainText = null) # [comment required]
│       │   ├── function copyRawText(text, successCallback, errorCall...) # [comment required]
│       │   ├── function downloadBlob(blob, filename) # [comment required]
│       │   ├── function nativeShareFiles(fileObjects) # [comment required]
│       │   ├── function downloadFile() # [comment required]
│       │   ├── function bindGhostDrag() # [comment required]
│       │   ├── function buildFileTree() # [comment required]
│       │   ├── function resolveDirectoryState() # [comment required]
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
│   │   ├── def run_consumer_lint(target_dir, allow_host_globals) # [stale?] Sweeps a consumer frontend directory to ensure compliance with the Sutram IoC Micro-Kernel and yenVUI presentation standards.
│   │   └── def check_host_domain_decoupling(target_dir) # Fitness Function: Enforces pure host-neutral Inversion of Control.
│   └── unit/                       # Behavioral unit and integration tests for the Sutram runtime
│       ├── __init__.py             # Unit test package initializer
│       ├── test_consumer_linter.py # Tests that the consumer linter ignores '=>' inside Lit ${...} bindings when checking sutram-btn labels
│       │   └── class TestConsumerLinterButtonLabels(unittest.TestCase) # SUTRAM_BUTTON_DECLARATIVE_LABEL_MANDATE must ignore '=>' and '>' inside Lit ${...} bindings.
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
        │   └── function parseDiffPayload() # [comment required]
        ├── diff-viewer.js          # Dual-box and interleaved split-pane diff presentation component
        │   └── class YenvuiDiffViewer # [comment required]
        ├── drop-zone.js            # Top-layer popover drop overlay and drop target presentation primitives
        │   ├── class YenvuiDropOverlay # [comment required]
        │   └── class YenvuiDropTarget # [comment required]
        ├── dropdown.js             # Context popover trigger menus and filter dropdown panels
        │   ├── class YenvuiDropdown # [comment required]
        │   └── class YenvuiFilterDropdown # [comment required]
        ├── editor.js               # CodeMirror 6 code editor wrapper with dynamic ESM language loading
        │   ├── function loadLanguageExtension(lang, customResolver = null) # [comment required]
        │   └── class YenvuiEditor  # [comment required]
        ├── empty-state.js          # Centered empty state feedback container with icon and text slot
        │   └── class YenvuiEmptyState # [comment required]
        ├── filter-group.js         # Interactive pill array for multi-attribute filtering
        │   └── class YenvuiFilterGroup # [comment required]
        ├── index.js                # Public Layer 1 chassis provider entrypoint exporting all yenVUI primitive classes, styles, and physics
        ├── inputs.js               # Standard form input elements (text, select, textarea, toggle)
        │   ├── class YenvuiInput   # [comment required]
        │   ├── class YenvuiSelect  # [comment required]
        │   ├── class YenvuiTextarea # [comment required]
        │   └── class YenvuiToggle  # [comment required]
        ├── label.js                # Standardized form label primitive with theme observation support
        │   └── class YenvuiLabel   # [comment required]
        ├── modal.js                # Native HTML5 top-layer dialog modal overlay with backdrop handling
        │   └── class YenvuiModal   # [comment required]
        ├── physics.js              # Universal gesture physics controller and Shadow DOM point resolution
        │   ├── function acquireBodyScrollLock() # [comment required]
        │   ├── function releaseBodyScrollLock() # [comment required]
        │   ├── function getEventPath(e) # [comment required]
        │   ├── function getEventTarget(e, selector = null) # Traverses the event path to find the first element matching a given CSS selector.
        │   ├── function anchorTopLayerPopover() # Computes and applies true viewport coordinates for a #top-layer popover element.
        │   ├── function syncTopLayerPopover() # Promotes or dismisses a popover element in the browser's #top-layer and synchronizes its anchor coordinates.
        │   ├── function startKineticThrow() # 60fps Inertial Momentum Throw Engine Applies exponential decay (0.94 friction) to a scroll container's scrollLeft/scrollTop based on recent...
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
