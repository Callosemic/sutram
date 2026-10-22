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
│   │   ├── 0001_sutram_ioc_microkernel_architecture.md # ADR-0001: IoC microkernel and slot layout architecture
│   │   ├── 0002_sutram_bootloader_and_resilience_patterns.md # ADR-0002: Stage 1 bootloader and error boundary standards
│   │   ├── 0003_yenvui_theme_mutation_observers.md # ADR-0003: Dynamic theme mutation observer pattern
│   │   ├── 0004_yenvui_codemirror6_tab_view_caching.md # ADR-0004: Encapsulated CodeMirror 6 and tab caching
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
│   │   ├── 0022_codemirror_viewport_preservation_prose_engine_and_virtualizer_sizing.md # [comment required]
│   │   ├── 0022_store_registry_multi_tenancy_three_way_merge_and_projection_rekeying.md # ADR-0022: StoreRegistry multi-tenancy scoping, three-way text merge, and projection rekeying
│   │   └── 0023_codemirror_viewport_preservation_prose_engine_and_virtualizer_sizing.md # ADR-0023: CodeMirror viewport preservation, prose typography engine, and virtualizer intrinsic sizing
│   └── yenvui_contracts.md         # Interface contract specification and CSS intent tokens for yenVUI presentation chassis
├── pyproject.toml                  # Python project metadata and semantic release configuration
├── readme.md                       # Master repository architecture map and component reference
├── sutram/                         # Core Sutram IoC Micro-Kernel runtime
│   └── js/                         # Pure ES module frontend runtime kernel and utilities
│       ├── app_shell.js            # Declarative web component app shell and tab layout router
│       ├── client.js               # Agnostic data provider client and HTTP transport provider interface
│       ├── drag-coordinator.js     # Spatial drag-and-drop overlay coordinator for interactive column reordering
│       ├── inputs.js               # Standard form input elements (text, select, textarea, toggle)
│       ├── offline.js              # Offline IndexedDB persistence manager, outbox reconciler, and network hysteresis manager
│       ├── poller.js               # Background job status polling factory with tier-0 API integration
│       ├── primitives.js           # Presentation primitives (buttons, modals, toast, selection, status)
│       ├── projection_engine.js    # Declarative layout projection compiler (SutramProjectionCompiler)
│       ├── shared_styles.js        # Lit CSS intent tokens, presentation primitives, and theme styles
│       ├── shortcuts.js            # Centralized context-aware keydown shortcut router
│       ├── sutram-boot.js          # Stage 1 bootloader for importmap synthesis, SemVer parsing, and guardrails
│       ├── sutram_sdk.js           # IoC Micro-Kernel, SutramElement base class, SutramContextMixin, and ExtensionRegistry
│       ├── sw-core.js              # Abstracted Service Worker core runtime for offline caching and navigation fallbacks
│       ├── utils.js                # Pure algorithmic utility helpers (fuzzy filter, debounce, coalescedAsync, slugify, time formatting, nativeShareFiles)
│       ├── wordcount.js            # Ephemeral word count widget decoration plugin for CodeMirror 6
│       └── workers/                # Dedicated off-main-thread Web Worker scripts
│           └── search-worker.js    # Web Worker for asynchronous fuzzy filtering and directory tree construction
├── tests/                          # Automated presentation chassis compliance tests and fitness functions
│   ├── fitness/                    # Modular static analysis rules for Sutram and yenVUI architectural invariants
│   │   ├── __init__.py             # Unit test package initializer
│   │   ├── core.py                 # Shared file walker and violation reporting state
│   │   ├── rules_sutram.py         # Sutram micro-kernel domain isolation, metronome, and store schema rules
│   │   └── rules_yenvui.py         # yenVUI presentation token, dialog lifecycle, and container query rules
│   ├── fitness_functions.py        # CLI entrypoint for Sutram and yenVUI architectural fitness validation
│   ├── run_unit_tests.py           # CLI test runner for platform behavioral unit tests
│   ├── sutram_consumer_linter.py   # Reusable static analysis script for consumer UDF compliance
│   └── unit/                       # Behavioral unit and integration tests for the Sutram runtime
│       ├── __init__.py             # Unit test package initializer
│       └── test_sutram_registry.py # Node.js and Python behavioral tests for StoreRegistry, ExtensionRegistry, and utilities
└── yenvui/                         # Edge-Native presentation chassis and Web Component UI library
    ├── css/                        # Universal CSS theme tokens and layout resets
    │   ├── theme-tokens.css        # CSS custom property tokens for Dark, Light, and E-Ink brutalist themes
    │   └── yenvui-primitives.css   # Atomic presentation resets and utility classes
    └── js/                         # Pure ES module frontend runtime kernel and utilities
        ├── async-btn.js            # Agnostic asynchronous action button with status feedback state machine
        ├── board.js                # Multi-column container-query responsive layout grid and column container
        ├── card-group.js           # Gesture-locked card container with edge-selection swipe detection, stacked layout rendering, and accordion deck physics
        ├── card.js                 # Polymorphic card primitive with drawer overlay and long-press selection
        ├── category-section.js     # Categorized list section wrapper with header action slot
        ├── collapsible.js          # Expandable accordion container with semantic intent styling
        ├── diff-utils.js           # Line-by-line diff calculation algorithms and patch formatting utilities
        ├── diff-viewer.js          # Dual-box and interleaved split-pane diff presentation component
        ├── drop-zone.js            # Top-layer popover drop overlay and drop target presentation primitives
        ├── dropdown.js             # Context popover trigger menus and filter dropdown panels
        ├── editor.js               # CodeMirror 6 code editor wrapper with dynamic ESM language loading
        ├── empty-state.js          # Centered empty state feedback container with icon and text slot
        ├── filter-group.js         # Interactive pill array for multi-attribute filtering
        ├── label.js                # Standardized form label primitive with theme observation support
        ├── modal.js                # Native HTML5 top-layer dialog modal overlay with backdrop handling
        ├── physics.js              # Universal gesture physics controller and Shadow DOM point resolution
        ├── pill.js                 # Toggleable tag/badge primitive supporting standard and text variants
        ├── scroll-view.js          # Container-query responsive scrollable view container with adaptive edge padding
        ├── search-bar.js           # Standardized text search input with instant clear action
        ├── selection-tray.js       # Floating action tray for batch selection operations
        ├── shared_styles.js        # Lit CSS intent tokens, presentation primitives, and theme styles
        ├── spinner.js              # Asynchronous CSS loading indicator component with custom text label
        ├── status-bar.js           # System status and background synchronization indicator bar
        ├── tabs.js                 # Horizontal swipe carousel tab navigation and cached view router
        ├── tag.js                  # Semantic intent tag primitive with high-contrast theme overrides
        ├── toast.js                # Non-blocking toast notification alert container
        ├── toolbar.js              # Sticky header toolbar integrating search, filters, and action slots
        ├── window.js               # Grid-constrained floating workspace dialog surface with column anchor and span layout control
        └── yenvui-base.js          # Base presentation class encapsulating theme mutation observation and lifecycle hooks
```
