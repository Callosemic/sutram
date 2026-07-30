# sutram Code Index

This index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.

```text
sutram/
├── .gitkeep                        # Folder preservation tracking marker
├── CODE_INDEX.md                   # Architectural directory map and operational index
├── build_matrix.json               # Vendor artifact distribution build matrix schema
├── docs/                           # [comment required]
│   └── adrs/                       # [comment required]
│       ├── 0001_sutram_ioc_microkernel_architecture.md # [comment required]
│       └── 0002_sutram_bootloader_and_resilience_patterns.md # [comment required]
└── js/                             # Pure ES module frontend runtime kernel and utilities
    ├── app_shell.js                # Declarative web component app shell and tab layout router
    ├── poller.js                   # Background job status polling factory with tier-0 API integration
    ├── primitives.js               # Presentation primitives (buttons, modals, toast, selection, status)
    ├── sdk.js                      # IoC Micro-Kernel, SutramElement base class, and ExtensionRegistry
    ├── shared_styles.js            # Lit CSS intent tokens, presentation primitives, and theme styles
    ├── shortcuts.js                # Centralized context-aware keydown shortcut router
    ├── sutram-boot.js              # Stage 1 bootloader for importmap synthesis, SemVer parsing, and guardrails
    └── utils.js                    # Pure algorithmic utility helpers (fuzzy filter, debounce, slugify)
```
