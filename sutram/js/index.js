// sutram/js/index.js
// Layer 2: Sutram Headless State, Offline & Layout Kernel Public Entrypoint
import * as Chassis from 'sutram-chassis';

export * from './sutram_sdk.js';
export * from './offline.js';
export * from './poller.js';
export * from './shortcuts.js';
export * from './projection_engine.js';
export * from './drag-coordinator.js';
export * from './app_shell.js';
export * from './shared_styles.js';
export * from './primitives.js';
export * from './inputs.js';
export * from './utils.js';

export const {
    getEventPath,
    getEventTarget,
    getDeepElementFromPoint,
    anchorTopLayerPopover,
    syncTopLayerPopover,
    acquireBodyScrollLock,
    releaseBodyScrollLock
} = Chassis.physics || {};
