# ADR-0020: Multi-Window Popout Lifecycle, BroadcastChannel IPC Synchronization, and Declarative Job Runner

## Status
Accepted

## Context
As workspace projections scale across multi-monitor setups, users require the ability to eject active editor tabs or inspection views into dedicated operating system windows without losing state, corrupting local VFS storage, or disconnecting from main application store synchronization.

Prior iterations (ADR-0015) introduced a minimal popout shell route (`variant="popout"`) driven by URL hashes. However, several critical architectural deficiencies existed:
1. **Popup Blocker Suppression**: Triggering asynchronous save operations or state checks prior to calling `window.open` detached execution from the user pointer gesture, causing browsers to block popout windows.
2. **Unidirectional Isolation**: The popped-out window had no real-time communication channel with the parent workbench, preventing automated re-docking and leaving orphaned window references when windows were closed.
3. **Display Incompatibility**: Mobile devices and standalone PWA displays were attempting multi-window popouts where unsupported, leading to clipped or broken viewports.
4. **Lack of Self-Healing**: If a user closed the main application window while retaining a popped-out editor, attempting to dock back into the workbench resulted in an unhandled failure.

Concurrently, background execution tasks within action buttons relied on ad-hoc promise wrappers rather than standardized job status telemetry.

## Decision

1. **BroadcastChannel Layout Synchronization**:
   - Establish a singleton `_layoutBus = new BroadcastChannel('sutram_layout_bus')` bridging all active application windows under the same origin.
   - Implement presence ping/pong handshakes (`presence_ping` / `presence_pong`) to verify host window availability prior to dispatching `dock_projection` messages.
   - Synchronize popout lifecycle closures via `pagehide` dispatches (`popout_closed`).

2. **Synchronous WindowProxy Gesture Acquisition**:
   - Ensure `LayoutStore.popoutProjection` immediately calls `window.open('about:blank', ...)` synchronously within the native user pointer gesture.
   - If asynchronous pre-save hooks (`sutram:before-popout`) are registered, await completion and update the child window location using `childWin.location.replace(targetUrl)`.

3. **Double-Click Recall & Self-Healing Docking**:
   - Track popout focus attempts via `_lastPopoutFocusTs`. If a user activates a popout target twice within 3500ms, close the child window and re-dock the projection locally into the focused column.
   - In `dockInProjection`, if the host window does not respond to presence pings within 120ms, automatically self-heal by redirecting the popout window into the full application workbench (`window.location.href = ...`).

4. **Multi-Window Capability Gating**:
   - Enforce `canUseMultiWindowPopout()` across `LayoutStore` and `SutramDragCoordinator`, disabling popout drop zones and action triggers on standalone PWAs and compact mobile screens (`pointer: coarse` under 768px).

5. **Declarative Background Job Bridge**:
   - Overhaul `SutramAsyncBtn` to natively support `jobRoute` bindings, connecting directly to `ExtensionRegistry.executeJobAction` with standardized progress, completion, and error states.

## Consequences

### Positive
* Popout windows reliably spawn without popup blocker interference.
* Projections dock back cleanly into their origin column on demand.
* Host window closure no longer results in broken popout state; popouts cleanly self-heal into primary workbench instances.
* Action buttons gain uniform background job telemetry without custom wrapper boilerplate.

### Negative / Trade-offs
* `BroadcastChannel` requires modern browser support (universally available in target evergreen browsers).
* Memory management requires diligent tracking and clearing of child `WindowProxy` references upon window disposal.