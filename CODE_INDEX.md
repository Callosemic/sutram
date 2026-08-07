# sutram Code Index

This index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.

```text
sutram/
├── .gitkeep                        # Folder preservation tracking marker
├── CODE_INDEX.md                   # Architectural directory map and operational index
├── build_matrix.json               # Vendor artifact distribution build matrix schema
├── docs/                           # Central Single Source of Truth for documentation
│   ├── 00_index.md                 # Master ecosystem documentation index
│   ├── 01_engineering_standards.md # Unified Sutram and yenVUI engineering standards & guardrails
│   ├── 02_yenvui_blueprint.md      # Presentation chassis philosophy and atomic component arsenal
│   ├── ADR_INDEX.md                # Global Architectural Decision Record (ADR) ledger index
│   └── adrs/                       # Centralized ADR chronological decision ledger
│       ├── 0001_sutram_ioc_microkernel_architecture.md # ADR-0001: IoC microkernel and slot layout architecture
│       ├── 0002_sutram_bootloader_and_resilience_patterns.md # ADR-0002: Stage 1 bootloader and error boundary standards
│       ├── 0003_yenvui_theme_mutation_observers.md # ADR-0003: Dynamic theme mutation observer pattern
│       ├── 0004_yenvui_codemirror6_tab_view_caching.md # ADR-0004: Encapsulated CodeMirror 6 and tab caching
│       ├── 0005_yenvui_popover_toasts_gesture_selection.md # ADR-0005: Native popover API and selection physics
│       └── 0006_yenvui_gesture_swipe_axis_locking.md # ADR-0006: Gesture swipe axis locking and event handshakes
├── pyproject.toml                  # [comment required]
├── sutram/                         # Core Sutram IoC Micro-Kernel runtime
│   └── js/                         # Pure ES module frontend runtime kernel and utilities
│       ├── app_shell.js            # Declarative web component app shell and tab layout router
│       ├── inputs.js               # Standard form input elements (text, select, textarea, toggle)
│       ├── poller.js               # Background job status polling factory with tier-0 API integration
│       ├── primitives.js           # Presentation primitives (buttons, modals, toast, selection, status)
│       ├── sdk.js                  # IoC Micro-Kernel, SutramElement base class, and ExtensionRegistry
│       ├── shared_styles.js        # Lit CSS intent tokens, presentation primitives, and theme styles
│       ├── shortcuts.js            # Centralized context-aware keydown shortcut router
│       ├── sutram-boot.js          # Stage 1 bootloader for importmap synthesis, SemVer parsing, and guardrails
│       └── utils.js                # Pure algorithmic utility helpers (fuzzy filter, debounce, slugify, time formatting)
├── tests/                          # Automated presentation chassis compliance tests and fitness functions
│   └── sutram_consumer_linter.py   # Reusable static analysis script for consumer UDF compliance
└── yenvui/                         # Edge-Native presentation chassis and Web Component UI library
    ├── css/                        # Universal CSS theme tokens and layout resets
    │   └── theme-tokens.css        # CSS custom property tokens for Dark, Light, and E-Ink brutalist themes
    ├── js/                         # Pure ES module frontend runtime kernel and utilities
    │   ├── async-btn.js            # Agnostic asynchronous action button with status feedback state machine
    │   ├── card-group.js           # Gesture-locked card container with edge-selection swipe detection, stacked layout rendering, and accordion deck physics
    │   ├── card.js                 # Polymorphic card primitive with drawer overlay and long-press selection
    │   ├── category-section.js     # Categorized list section wrapper with header action slot
    │   ├── collapsible.js          # Expandable accordion container with semantic intent styling
    │   ├── dropdown.js             # Context popover trigger menus and filter dropdown panels
    │   ├── editor.js               # CodeMirror 6 code editor wrapper with dynamic ESM language loading
    │   ├── empty-state.js          # Centered empty state feedback container with icon and text slot
    │   ├── filter-group.js         # Interactive pill array for multi-attribute filtering
    │   ├── modal.js                # Native HTML5 top-layer dialog modal overlay with backdrop handling
    │   ├── pill.js                 # Toggleable tag/badge primitive supporting standard and text variants
    │   ├── search-bar.js           # Standardized text search input with instant clear action
    │   ├── selection-tray.js       # Floating action tray for batch selection operations
    │   ├── spinner.js              # Asynchronous CSS loading indicator component with custom text label
    │   ├── status-bar.js           # System status and background synchronization indicator bar
    │   ├── tabs.js                 # Horizontal swipe carousel tab navigation and cached view router
    │   ├── toast.js                # Non-blocking toast notification alert container
    │   └── toolbar.js              # Sticky header toolbar integrating search, filters, and action slots
    └── tests/                      # Automated presentation chassis compliance tests and fitness functions
        ├── .gitkeep                # Folder preservation tracking marker
        └── fitness_functions.py    # Static analysis and linting fitness functions enforcing yenVUI standards
```
