# sutram Code Index

This index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.

```text
sutram/
├── .gitkeep                        # Folder preservation tracking marker
├── CODE_INDEX.md                   # Architectural directory map and operational index
├── build_matrix.json               # Vendor artifact distribution build matrix schema
├── docs/                           # Architectural documentation and decision records
│   ├── 00_index.md                 # yenVUI presentation chassis master index
│   ├── 01_engineering_standards.md # yenVUI Web Component presentation standards and UI guardrails
│   └── ADR_INDEX.md                # yenVUI presentation chassis decision record index
├── sutram/                         # Core Sutram IoC Micro-Kernel runtime and decision records
│   ├── docs/                       # Architectural documentation and decision records
│   │   └── adrs/                   # Architectural Decision Records (ADRs) ledger
│   │       ├── 0001_sutram_ioc_microkernel_architecture.md # IoC microkernel and slot layout architecture
│   │       └── 0002_sutram_bootloader_and_resilience_patterns.md # Stage 1 bootloader and error boundary standards
│   └── js/                         # Pure ES module frontend runtime kernel and utilities
│       ├── app_shell.js            # Declarative web component app shell and tab layout router
│       ├── inputs.js               # Standard form input elements (text, select, textarea, toggle)
│       ├── poller.js               # Background job status polling factory with tier-0 API integration
│       ├── primitives.js           # Presentation primitives (buttons, modals, toast, selection, status)
│       ├── sdk.js                  # IoC Micro-Kernel, SutramElement base class, and ExtensionRegistry
│       ├── shared_styles.js        # Lit CSS intent tokens, presentation primitives, and theme styles
│       ├── shortcuts.js            # Centralized context-aware keydown shortcut router
│       ├── sutram-boot.js          # Stage 1 bootloader for importmap synthesis, SemVer parsing, and guardrails
│       └── utils.js                # Pure algorithmic utility helpers (fuzzy filter, debounce, slugify)
├── tests/                          # Automated presentation chassis compliance tests and fitness functions
│   └── sutram_consumer_linter.py   # Reusable static analysis script for consumer UDF compliance
└── yenvui/                         # Edge-Native presentation chassis and Web Component UI library
    ├── css/                        # Universal CSS theme tokens and layout resets
    │   └── theme-tokens.css        # CSS custom property tokens for Dark, Light, and E-Ink brutalist themes
    ├── docs/                       # Architectural documentation and decision records
    │   ├── .gitkeep                # Folder preservation tracking marker
    │   ├── 00_index.md             # yenVUI presentation chassis master index
    │   ├── 01_engineering_standards.md # yenVUI Web Component presentation standards and UI guardrails
    │   ├── 2026-07-18-yenvui-blueprint.md # yenVUI architectural standup blueprint and execution plan
    │   ├── ADR_INDEX.md            # yenVUI presentation chassis decision record index
    │   └── adrs/                   # Architectural Decision Records (ADRs) ledger
    │       ├── 0001-theme-mutation-observers-and-top-layer-dialog-visibility.md # ADR-0001: Dynamic theme MutationObservers and top-layer dialog host visibility
    │       ├── 0002-codemirror6-shadow-dom-and-tab-view-caching.md # ADR-0002: Encapsulated CodeMirror 6 compartments and tab view caching
    │       ├── 0003-native-popover-toasts-and-gesture-selection-trays.md # ADR-0003: Popover toast container elevation and multi-modal selection tray physics
    │       └── 0004-gesture-swipe-axis-locking-and-hybrid-property-handshakes.md # ADR-0004: Gesture swipe axis locking, Safari back-nav interception, and hybrid handshakes
    ├── js/                         # Pure ES module frontend runtime kernel and utilities
    │   ├── async-btn.js            # Agnostic asynchronous action button with status feedback state machine
    │   ├── card-group.js           # Gesture-locked card container with edge-selection swipe detection
    │   ├── card.js                 # Polymorphic card primitive with drawer overlay and long-press selection
    │   ├── category-section.js     # Categorized list section wrapper with header action slot
    │   ├── collapsible.js          # Expandable accordion container with semantic intent styling
    │   ├── dropdown.js             # Context popover trigger menus and filter dropdown panels
    │   ├── editor.js               # CodeMirror 6 code editor wrapper with dynamic ESM language loading
    │   ├── filter-group.js         # Interactive pill array for multi-attribute filtering
    │   ├── modal.js                # Native HTML5 top-layer dialog modal overlay with backdrop handling
    │   ├── pill.js                 # Toggleable tag/badge primitive supporting standard and text variants
    │   ├── search-bar.js           # Standardized text search input with instant clear action
    │   ├── selection-tray.js       # Floating action tray for batch selection operations
    │   ├── status-bar.js           # System status and background synchronization indicator bar
    │   ├── tabs.js                 # Horizontal swipe carousel tab navigation and cached view router
    │   ├── toast.js                # Non-blocking toast notification alert container
    │   └── toolbar.js              # Sticky header toolbar integrating search, filters, and action slots
    └── tests/                      # Automated presentation chassis compliance tests and fitness functions
        ├── .gitkeep                # Folder preservation tracking marker
        └── fitness_functions.py    # Static analysis and linting fitness functions enforcing yenVUI standards
```
