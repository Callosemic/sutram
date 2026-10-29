# Ledger of Logic (ADR Index)

**Mission**: To preserve the institutional memory and rationale behind major architectural decisions within the unified Sutram micro-kernel and yenVUI presentation chassis.

## Active ADRs
### Sutram Micro-Kernel
* [ADR-0007: Sutram Offline Micro-Kernel & Metronome Visibility Backoff](./adrs/0007_sutram_offline_microkernel_and_metronome_backoff.md)
* [ADR-0009: Spatial 3-Column Layout Engine and DOM Projection Pooling](./adrs/0009_sutram_spatial_layout_and_projection_engine.md)
* [ADR-0011: SutramContextMixin and Grid-Constrained Spatial Window Projections](./adrs/0011_sutram_context_mixin_and_grid_constrained_windows.md)
* [ADR-0012: Native `<yv-icon>` Component and Direct Lit Element Node Retention](./adrs/0012_yv_icon_component_and_direct_node_retention.md)
* [ADR-0013: Dynamic Spatial Column Ratios, Off-Main-Thread Search Workers, and Light-DOM BEM Shared Styles](./adrs/0013_sutram_dynamic_spatial_ratios_and_light_dom_bem_styles.md)
* [ADR-0014: Focus Backstack Navigation, Singleton Worker Broker, and Content-Visibility Performance](./adrs/0014_sutram_focus_backstack_worker_broker_and_content_visibility.md)
* [ADR-0015: Decoupled Host Domain Contracts, Popout Shell Projections, and Aggregated Action Staging](./adrs/0015_sutram_decoupled_host_contracts_popout_shell_and_action_aggregation.md)
* [ADR-0021: Declarative Settings Form Engine, Configuration Registry Hooks, and Clean ESM Caching](./adrs/0021_declarative_settings_form_engine_configuration_hooks_and_native_esm_caching.md)
* [ADR-0022: StoreRegistry Multi-Tenancy Scoping, Three-Way Text Merge Engine, and Projection Rekeying](./adrs/0022_store_registry_multi_tenancy_three_way_merge_and_projection_rekeying.md)
* [ADR-0024: Generational Projection Pooling, Debounced Store Persistence, and Lazy LRU Cache Buffering](./adrs/0024_generational_projection_pooling_debounced_persistence_and_lazy_lru_caching.md)
* [ADR-0026: Pluggable Chassis Provider Contract, SutramUIAdapter, Input Event Bridging, and Public Kernel Entrypoint](./adrs/0026_pluggable_chassis_contract_ui_adapter_and_kernel_entrypoint.md)
* [ADR-0028: Compound Target Binding Controls, Dynamic Schema Option Sources, and Development Service Worker Cache Bypass](./adrs/0028_compound_target_binding_and_sw_dev_cache_bypass.md)
### yenVUI Presentation Chassis
* [ADR-0005: Native Popover API Toast Container Elevation](./adrs/0005_yenvui_popover_toasts_gesture_selection.md)
* [ADR-0006: Gesture Swipe Axis Locking](./adrs/0006_yenvui_gesture_swipe_axis_locking.md)
* [ADR-0008: Duck-Typed Selection Contracts for yenVUI Gestures](./adrs/0008_yenvui_duck_typed_selection_contracts.md)
* [ADR-0016: Zero-Dependency Kinetic Diff Viewer and Intra-Line LCS Diff Utilities](./adrs/0016_yenvui_diff_viewer_and_diff_utils.md)
* [ADR-0017: Native Top-Layer Popover API Elevation for Context Overlays and Spatial Geometry Design Tokens](./adrs/0017_yenvui_top_layer_popover_anchoring_and_spatial_geometry_tokens.md)
* [ADR-0018: Spatial Drag HUD Coordinator, CSS Mask-Image Icon Primitive, and Offline Cache Write-Through](./adrs/0018_spatial_drag_hud_css_mask_icons_and_offline_write_through.md)
* [ADR-0019: CodeMirror Tag Completion Defense, Font Ligature Suppression, and Substrate InnerHTML Elimination](./adrs/0019_codemirror_tag_completion_defense_ligature_suppression_and_innerhtml_ban.md)
* [ADR-0020: Multi-Window Popout Lifecycle, BroadcastChannel IPC Synchronization, and Declarative Job Runner](./adrs/0020_multi_window_popout_lifecycle_broadcast_channel_and_declarative_job_runner.md)
* [ADR-0023: CodeMirror Viewport Preservation, Prose Typography Engine, WebKit Text-Size Normalization, and Virtualizer Intrinsic Sizing](./adrs/0023_codemirror_viewport_preservation_prose_engine_and_virtualizer_sizing.md)
* [ADR-0025: Root Viewport Physics Guard, Kinetic Momentum Throw Engine, Reentrant Scroll Locking, and Chassis Overscroll Containment](./adrs/0025_root_viewport_physics_guard_kinetic_throw_and_reentrant_scroll_lock.md)
* [ADR-0027: yenVUI Autonomous Chassis Provider Implementation, Input Primitives Extraction, and Upward Kernel Decoupling](./adrs/0027_yenvui_autonomous_chassis_provider_and_input_primitives.md)

## Archived ADRs
* [ADR-0001: Sutram IoC Micro-Kernel Architecture](./adrs/archived/0001_sutram_ioc_microkernel_architecture.md)
* [ADR-0002: Sutram Bootloader and Resilience Patterns](./adrs/archived/0002_sutram_bootloader_and_resilience_patterns.md)
* [ADR-0003: Dynamic Theme Mutation Observer Pattern](./adrs/archived/0003_yenvui_theme_mutation_observers.md)
* [ADR-0004: Encapsulated CodeMirror 6 Integration](./adrs/archived/0004_yenvui_codemirror6_tab_view_caching.md)

## Superseded ADRs
* [ADR-0010: Floating Window Projection Layer and Z-Index Management (Superseded by ADR-0011)](./adrs/0010_sutram_floating_window_projection.md)