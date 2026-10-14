// sutram/js/app_shell.js (Compiled Vendor Artifact)
import { html, css } from 'lit';
import { SutramElement, ExtensionRegistry, LayoutStore } from './sutram_sdk.js';
import { sharedStyles } from './shared_styles.js';
import { debounce } from './utils.js';
import { SutramProjectionCompiler } from './projection_engine.js';
import './drag-coordinator.js';
import '../../yenvui/js/tabs.js';
import { YenvuiGestureController, getDeepElementFromPoint } from '../../yenvui/js/physics.js';
const getSpatialMetrics = (capacity, activeViewport, layoutRatios) => {
    const layout = (Array.isArray(layoutRatios) && layoutRatios.length > 0) ? layoutRatios : [1, 1, 1];
    const safeViewport = Math.max(0, Math.min(activeViewport, layout.length - capacity));
    const activeSum = layout.slice(safeViewport, safeViewport + capacity).reduce((a, b) => a + b, 0) || 1;

    return {
        getColWidth: (idx) => `${(layout[idx] / activeSum) * 100}%`,
        getColLeft: (idx) => {
            const leftOffset = layout.slice(0, idx).reduce((a, b) => a + b, 0);
            return `${(leftOffset / activeSum) * 100}%`;
        },
        getTrackOffset: () => {
            const leftOffset = layout.slice(0, safeViewport).reduce((a, b) => a + b, 0);
            return `-${(leftOffset / activeSum) * 100}%`;
        },
        getWinBounds: (colIdx, span) => {
            const safeSpan = Math.min(span, layout.length - colIdx);
            const leftOffset = layout.slice(0, colIdx).reduce((a, b) => a + b, 0);
            const spanWidth = layout.slice(colIdx, colIdx + safeSpan).reduce((a, b) => a + b, 0);
            return { 
                left: `${(leftOffset / activeSum) * 100}%`, 
                width: `${(spanWidth / activeSum) * 100}%` 
            };
        }
    };
};
export class SutramAppShell extends SutramElement {
    static properties = {
        _layoutConfig: { type: Array },
        _spatialState: { type: Object }
    };
    static styles = [sharedStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            height: calc(100dvh - 30px); /* Account for global status bar */
            width: 100%;
            overflow: hidden;
            background: var(--bg);
            overscroll-behavior: none;
        }
        .shell-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            position: relative;
        }
        .nested-tab-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
            background: var(--bg);
        }
        /* Primary Tab Buttons */
        .tab-btn {
            padding: 0 10px;
            height: 100%;
            display: flex;
            align-items: center;
            cursor: pointer;
            font-weight: 500;
            color: var(--text-muted);
            background: transparent;
            border-radius: 4px;
            white-space: nowrap;
            border: 2px solid transparent;
            box-sizing: border-box;
            font-size: 0.9rem;
            transition: all 0.2s;
            outline: none;
            margin: 0;
        }
        .tab-btn:hover {
            background: var(--bg-hover);
            color: var(--text);
        }
        .tab-btn.active {
            color: var(--text);
            background: transparent;
            border-color: transparent transparent var(--tab-intent, var(--intent-primary)) transparent;
            border-radius: 4px 4px 0 0;
        }
        :host-context([data-theme="e-ink"]) .tab-btn {
            color: #000000 !important;
            font-weight: 600 !important;
            border: 2px solid transparent;
            transition: none !important;
        }
        :host-context([data-theme="e-ink"]) .tab-btn:hover {
            background: transparent !important;
        }
        :host-context([data-theme="e-ink"]) .tab-btn.active {
            background: #ffffff !important;
            color: #000000 !important;
            border: 2px solid #3b82f6 !important;
            box-shadow: 3px -3px 0 #10b981 !important;
        }
        /* Viewport Layout */
        .spatial-viewport {
            overflow: hidden;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            position: relative;
        }
        .spatial-track {
            position: relative;
            flex: 1;
            min-height: 0;
            transition: transform 0.32s cubic-bezier(0.2, 0.9, 0.2, 1);
            width: 100%;
        }
        /* Responsive Viewport States */
        .spatial-col {
            position: absolute;
            top: 0;
            bottom: 0;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            border-right: 1px solid var(--border);
            container-type: inline-size;
            overscroll-behavior-x: none;
            width: var(--col-width, 33.333%) !important;
            left: var(--col-left, 0%) !important;
            transition: width 0.32s cubic-bezier(0.2, 0.9, 0.2, 1), left 0.32s cubic-bezier(0.2, 0.9, 0.2, 1);
        }

        :host([data-viewport="mobile"]) .spatial-col, [data-viewport="mobile"] .spatial-col {
            border-right: none;
        }
        .spatial-col:last-child {
            border-right: none !important;
        }
        .masthead-action-rail-cell {
            width: 44px;
            height: 100%;
            border-radius: 0;
            border: none;
            border-left: 1px solid var(--border);
            background: var(--rail-bg, rgba(255,255,255,0.02));
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.15s ease, color 0.15s ease;
            box-sizing: border-box;
            color: var(--text-muted);
        }
        .masthead-action-rail-cell:hover {
            background: var(--rail-hover, rgba(99, 102, 241, 0.22));
            color: var(--text);
        }

        /* Strip padding and force stretch alignment for full-bleed action rails */
        .masthead {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            padding-right: 0 !important;
            height: 44px;
            align-items: stretch !important;
        }
        .col-header {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            height: 44px;
            align-items: stretch !important;
        }
        .masthead-right-rail, .col-header-actions {
            display: flex;
            align-items: stretch;
            height: 100%;
        }

        /* Ensure tab contents stay vertically centered despite parent stretching */
        .col-header > div:first-child, .masthead > div:first-child {
            display: flex;
            align-items: center;
        }
        .col-header > div:last-child {
            align-items: stretch;
        }
        :host([data-viewport="mobile"]) .desktop-only-folders, [data-viewport="mobile"] .desktop-only-folders { display: none !important; }
        :host([data-viewport="mobile"]) .mobile-only-tools, [data-viewport="mobile"] .mobile-only-tools { display: flex !important; }
        :host([data-viewport="desktop"]) .desktop-only-folders, :host([data-viewport="tablet"]) .desktop-only-folders,
        [data-viewport="desktop"] .desktop-only-folders, [data-viewport="tablet"] .desktop-only-folders { display: flex !important; }
        :host([data-viewport="desktop"]) .mobile-only-tools, :host([data-viewport="tablet"]) .mobile-only-tools,
        [data-viewport="desktop"] .mobile-only-tools, [data-viewport="tablet"] .mobile-only-tools { display: none !important; }
        .pos-dot-target { padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .pos-dot { width: 6px; height: 6px; border-radius: 9999px; background: var(--text-muted); transition: all 0.2s ease; }
        .pos-dot.active { width: 14px; background: var(--intent-primary); box-shadow: none; }
        :host-context([data-theme="e-ink"]) .pos-dot.active { background: #000; box-shadow: none; }
        .spatial-col.is-focused {
            z-index: 10;
        }
        .spatial-col.is-focused .col-header {
            background: color-mix(in srgb, var(--active-sub-intent, var(--intent-primary)) var(--header-bg-mix, 20%), var(--bg-deep));
        }
        .col-header {
            display: flex;
            align-items: center;
            height: 36px;
            background: var(--bg-deep);
            border-bottom: 1px solid var(--border);
            padding: 0 0 0 12px;
            flex-shrink: 0;
            position: relative;
        }
        /* Draggable Tab Enhancements */
        .sub-tab {
            touch-action: none; user-select: none; display: flex; align-items: center;
            cursor: pointer; padding: 0; margin-right: 16px; font-size: 0.9rem; font-weight: 500; 
            color: var(--text-muted); white-space: nowrap; transition: all 0.2s; height: 100%; 
            border-bottom: 2px solid transparent; box-sizing: border-box; outline: none;
        }
        .sub-tab:last-child { margin-right: 0; }
        .sub-tab:hover { color: var(--text); }
        .sub-tab.active { color: var(--text); border-bottom: 2px solid var(--intent-primary); }

        :host([data-theme="e-ink"]) .sub-tab { transition: none !important; }
        :host([data-theme="e-ink"]) .sub-tab:hover { color: var(--text-muted); }
        :host([data-theme="e-ink"]) .sub-tab.active { color: var(--text) !important; }

        .sub-tab-icon-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            margin-right: 6px;
            border-radius: 4px;
            transition: background 0.2s;
        }
        .sub-tab-icon-wrapper .default-icon-container { display: flex !important; transition: opacity 0.2s; }
    `];
    constructor() {
        super();
        this._layoutConfig = [];
        this._activeNodes = new Map();
        this._spatialState = { capacity: 3, focusedColumn: 'center', mobileViewportIndex: 1, layoutRatios: null, columns: { left: { pinned: [] }, center: { pinned: [] }, right: { pinned: [] } } };
        // PointerEvent Drag State

        // Custom Overlay State for Launcher Folders
        this._launcherDropdown = null;
    }

    _safeEvict(id, executeEvict) {
        const buffer = window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[id];
        if (buffer && buffer.isFS && buffer.content !== buffer.originalContent) {
            if (!confirm(`You have unsaved changes in ${id.split('/').pop()}.\n\nClick OK to discard changes and close, or Cancel to abort.`)) {
                return;
            }
        }
        executeEvict();
    }

    // --- PointerEvent Drag & Drop Mechanics ---
    _activateDrag() {
        if (this._dragController && this._dragController._dragTimer) { 
            clearTimeout(this._dragController._dragTimer); 
            this._dragController._dragTimer = null; 
        }
        this._dragState.active = true;
        this.requestUpdate();
        if (navigator.vibrate) navigator.vibrate(50);
    }
    _handlePointerDown(e, entity, sourceCol, originType = 'subtab') {
        let sourceRect = null;
        if (sourceCol === 'window') {
            const path = e.composedPath();
            const winNode = path.find(n => n.tagName && n.tagName.toLowerCase() === 'sutram-window');
            if (winNode && winNode.parentElement) {
                const r = winNode.parentElement.getBoundingClientRect();
                sourceRect = { left: r.left, top: 0, width: r.width, height: window.innerHeight };
            }
        } else if (sourceCol) {
            const colNode = this.shadowRoot.querySelector(`.spatial-col[data-col-id="${sourceCol}"]`);
            if (colNode) {
                const r = colNode.getBoundingClientRect();
                sourceRect = { left: r.left, top: 0, width: r.width, height: window.innerHeight };
            }
        }

        this._dragState = { active: false, entity, sourceCol, currentZone: null, startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY, originType, sourceRect };

        if (!this._dragController) {
            this._dragController = new YenvuiGestureController(this, {
                longPressDelay: 500,
                onLongPress: () => {
                    this._activateDrag();
                },
                onPanMove: (x, y) => {
                    if (!this._dragState.active) {
                        const dx = Math.abs(x - this._dragState.startX);
                        const dy = Math.abs(y - this._dragState.startY);
                        if (dx > 8 || dy > 8) this._activateDrag();
                        return;
                    }
                    this._dragState.currentX = x;
                    this._dragState.currentY = y;
                    let zoneChanged = false;

                    const coordinator = this.shadowRoot.querySelector('sutram-drag-coordinator');
                    if (coordinator) {
                        const newZone = typeof coordinator.getHoveredZone === 'function' ? coordinator.getHoveredZone(x, y) : null;
                        if (this._dragState.currentZone !== newZone) {
                            this._dragState.currentZone = newZone;
                            zoneChanged = true;
                        }

                        // PERFORMANCE OPTIMIZATION: Bypass the heavy AppShell render cycle (O(N) layout nodes) 
                        // and write coordinates directly to the isolated DragCoordinator component at 60fps.
                        if (zoneChanged) {
                            // Only trigger a full Lit reconciliation if the drop zones actually need to visually shuffle
                            coordinator.dragState = { ...this._dragState };
                        } else if (typeof coordinator.updatePointer === 'function') {
                            // Hardware-accelerated GPU translation for buttery smooth 60fps tracking
                            coordinator.updatePointer(x, y);
                        }
                    }
                },
                onPanEnd: (endX, endY) => {
                    if (this._dragState.active) {
                        const targetZone = this._dragState.currentZone;
                        const entity = this._dragState.entity;
                        const sourceCol = this._dragState.sourceCol;
                        if (targetZone && window.Sutram?.stores?.Layout) {
                            const layout = window.Sutram.stores.Layout.getState();
                            if (targetZone === 'close') {
                                this._safeEvict(entity.id, () => {
                                    if (sourceCol === 'window') layout.closeWindow(entity.id);
                                    else if (sourceCol) layout.unpinFromColumn(sourceCol, entity.id);
                                    layout.evictProjection(entity.id);

                                    const updatedLayout = window.Sutram.stores.Layout.getState();
                                    const nextCol = updatedLayout.focusedColumn || sourceCol || 'center';
                                    const nextActive = updatedLayout.columns[nextCol]?.active || '';
                                    this._updateUrlHash(nextCol, nextActive);
                                });
                            } else if (targetZone === 'window') {
                                if (sourceCol === 'window') layout.closeWindow(entity.id);
                                else if (sourceCol) layout.unpinFromColumn(sourceCol, entity.id);
                                layout.openWindow(entity, layout.focusedColumn || 'center', 1);
                            } else if (targetZone.startsWith('span-')) {
                                const parts = targetZone.split('-');
                                const span = parseInt(parts[1], 10);
                                const anchorCol = parts[2];

                                if (sourceCol === 'window') {
                                    layout.updateWindowConstraints(entity.id, anchorCol, span);
                                } else {
                                    if (sourceCol) layout.unpinFromColumn(sourceCol, entity.id);
                                    layout.openWindow(entity, anchorCol, span);
                                }
                            } else if (targetZone.startsWith('reorder-')) {
                                if (sourceCol) {
                                    const targetIdx = parseInt(targetZone.replace('reorder-', ''), 10);
                                    const pinnedArray = [...layout.columns[sourceCol].pinned];
                                    const currentIdx = pinnedArray.findIndex(p => p.id === entity.id);

                                    if (currentIdx !== -1 && currentIdx !== targetIdx) {
                                        const [moved] = pinnedArray.splice(currentIdx, 1);
                                        pinnedArray.splice(targetIdx, 0, moved);
                                        window.Sutram.stores.Layout.setState(s => ({
                                            columns: { ...s.columns, [sourceCol]: { ...s.columns[sourceCol], pinned: pinnedArray } }
                                        }));
                                    }
                                }
                            } else if (['left', 'center', 'right'].includes(targetZone) && targetZone !== sourceCol && !entity?.windowOnly) {
                                const destCol = targetZone;
                                if (sourceCol === 'window') layout.closeWindow(entity.id);
                                else if (sourceCol) layout.unpinFromColumn(sourceCol, entity.id);
                                layout.pinToColumn(destCol, entity);
                                layout.setFocusedColumn(destCol);
                                layout.setActiveProjection(destCol, entity.id);
                                layout.setFocusedColumn(destCol);
                            }
                        }
                    }
                    this._dragState = { active: false, entity: null, sourceCol: null, currentZone: null, startX: 0, startY: 0, currentX: 0, currentY: 0, originType: null };
                    this.requestUpdate();
                }
            });
        }
        this._dragController.start(e, { lockAxis: originType === 'subtab' ? 'vertical' : 'both' });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._handleResize) window.removeEventListener('resize', this._handleResize);

        [this._dragController, this._folderDragController, this._dotDragController].forEach(ctrl => {
            if (ctrl && typeof ctrl.abort === 'function') ctrl.abort();
        });
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        const track = this.shadowRoot.querySelector('.spatial-track');
        if (track) {
            const capacity = this._spatialState?.capacity || 3;
            const index = this._spatialState?.mobileViewportIndex ?? 1;
            const layoutRatios = this._spatialState?.layoutRatios || [1, 1, 1];
            const metrics = getSpatialMetrics(capacity, index, layoutRatios);

            if (!this._isPanningTrack) {
                track.style.transform = `translateX(${metrics.getTrackOffset()})`;
            }
        }
        // Auto-scroll active sub-tabs into view
        const activeTabs = this.shadowRoot.querySelectorAll('.sub-tab.active');
        activeTabs.forEach(tab => {
            const track = tab.closest('yenvui-scrub-track');
            if (track && track.shadowRoot) {
                const container = track.shadowRoot.querySelector('.scrub-container');
                if (container) {
                    const tabRect = tab.getBoundingClientRect();
                    if (tabRect.width > 0) {
                        const contRect = container.getBoundingClientRect();
                        container.scrollBy({
                            left: tabRect.left - contRect.left - contRect.width / 2 + tabRect.width / 2,
                            behavior: 'smooth'
                        });
                    }
                }
            }
        });
    }

    connectedCallback() {
        try {
        super.connectedCallback();

        // iOS Edge-Swipe Defeater (Bound to OS Shell Lifecycle)
        this._edgeSwipeStartX = 0;
        this._edgeSwipeStartY = 0;
        this.registerGlobalListener('touchstart', window, (e) => {
            this._edgeSwipeStartX = e.touches[0].clientX;
            this._edgeSwipeStartY = e.touches[0].clientY;
        }, { passive: true, capture: true });

        this.registerGlobalListener('touchmove', window, (e) => {
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const dx = Math.abs(currentX - this._edgeSwipeStartX);
            const dy = Math.abs(currentY - this._edgeSwipeStartY);

            const isEdge = this._edgeSwipeStartX < 30 || this._edgeSwipeStartX > window.innerWidth - 30;
            if (isEdge && dx > dy && dx > 5 && e.cancelable) {
                e.preventDefault();
            }
        }, { passive: false, capture: true });

        this.registerGlobalListener('click', document, (e) => {
            if (this._launcherDropdown && !e.composedPath().some(n => n.classList?.contains('global-launcher-menu') || n.classList?.contains('tab-btn'))) {
                this._launcherDropdown = null;
                this.requestUpdate();
            }
        });
        if (LayoutStore) {
            this.subscribe(LayoutStore, state => {
                const safeState = state || {};
                this._spatialState = {
                    capacity: safeState.capacity || 3,
                    focusedColumn: safeState.focusedColumn || 'center',
                    mobileViewportIndex: safeState.mobileViewportIndex ?? 1,
                    layoutRatios: safeState.layoutRatios || null,
                    columns: safeState.columns || { left: { pinned: [] }, center: { pinned: [] }, right: { pinned: [] } },
                    windows: safeState.windows || []
                };
                this.requestUpdate();
            });
            // Garbage Collection: Handled natively by Lit conditional unmounting. Trigger re-render to reflect state.
            this.registerGlobalListener('sutram-evict-projection', window, () => {
                this.requestUpdate();
            });
            this._handleResize = debounce(() => {
                const width = window.innerWidth;
                const maxCapacity = Math.min(3, Math.max(1, Math.floor(width / 360)));
                const storeState = LayoutStore.getState();
                if (storeState) {
                    const currentCap = storeState.capacity || 3;
                    if (currentCap !== maxCapacity && typeof storeState.setCapacity === 'function') {
                        storeState.setCapacity(maxCapacity);
                        if (maxCapacity === 1 && storeState.focusedColumn) {
                            const colMap = { 'left': 0, 'center': 1, 'right': 2 };
                            storeState.setMobileViewport(colMap[storeState.focusedColumn] || 1);
                        } else if (maxCapacity === 2 && storeState.focusedColumn) {
                            const colMap = { 'left': 0, 'center': 1, 'right': 2 };
                            const targetIdx = colMap[storeState.focusedColumn] || 1;
                            const newViewport = targetIdx === 0 ? 0 : (targetIdx === 2 ? 2 : (storeState.mobileViewportIndex === 2 ? 2 : 0));
                            storeState.setMobileViewport(newViewport);
                        }

                        // Enforce window visibility bounds on resize
                        const windows = storeState.windows || [];
                        windows.forEach(win => {
                            let newSpan = Math.min(win.span || 1, maxCapacity);
                            let newAnchor = win.anchorCol || 'center';
                            if (maxCapacity === 1) {
                                newSpan = 1;
                                newAnchor = storeState.focusedColumn || 'center';
                            } else if (maxCapacity === 2) {
                                if (newAnchor === 'right') {
                                    newAnchor = newSpan === 2 ? 'left' : 'center';
                                }
                            }

                            if (newSpan !== win.span || newAnchor !== win.anchorCol) {
                                storeState.updateWindowConstraints(win.id, newAnchor, newSpan);
                            }
                        });
                    }
                }
            }, 100);
            window.addEventListener('resize', this._handleResize);
            this._handleResize();
        }
        // Break synchronous infinite loops by debouncing the layout compilation listener
        this._debouncedCompile = debounce(() => this._compileLayout(), 50);
        this.registerGlobalListener('sutram-layout-recompile', window, this._debouncedCompile);

        this._compileLayout();
        } catch(err) { console.error("[Telemetry] AppShell connectedCallback error:", err); }
    }
    _getPrimaryTabColor(tab) {
        if (tab && tab.intent) return `var(--intent-${tab.intent})`;
        const id = typeof tab === 'string' ? tab : tab?.id;
        const map = {
            'context': 'var(--intent-primary)',
            'edit': 'var(--intent-highlight)',
            'diagnostics': 'var(--intent-warning)',
            'tasks': 'var(--intent-warning)',
            'ctrl': 'var(--intent-danger)',
            'dev': 'var(--intent-success)',
            'offline': 'var(--text-muted)',
            'library': 'var(--intent-highlight)',
            'cronic': 'var(--intent-warning)',
            'skills': 'var(--intent-success)',
            'practice': 'var(--intent-success)'
        };
        return map[id?.toLowerCase()] || 'var(--intent-primary)';
    }

    _getPrimaryTabIcon(tab) {
        if (tab && tab.icon) {
            const color = this._getPrimaryTabColor(tab);
            return html`<yv-icon name="${tab.icon}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${color};"></yv-icon>`;
        }
        const id = typeof tab === 'string' ? tab : tab?.id;
        const map = {
            'context': 'folder-code',
            'edit': 'edit-3',
            'diagnostics': 'activity',
            'tasks': 'check-square',
            'ctrl': 'terminal',
            'dev': 'code',
            'offline': 'wifi-off',
            'library': 'book-open',
            'cronic': 'clock',
            'skills': 'award',
            'practice': 'target'
        };
        const icon = map[id?.toLowerCase()] || 'folder';
        const color = this._getPrimaryTabColor(tab);
        return html`<yv-icon name="${icon}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${color};"></yv-icon>`;
    }
    _compileLayout() {
        try {
            this._layoutConfig = SutramProjectionCompiler.getCompiledLayout();

            // Ghost Projection Cleanup: Purge orphaned layout states for deactivated extensions
            const layoutStore = window.Sutram?.stores?.Layout;
            if (layoutStore) {
                const state = layoutStore.getState();
                let changed = false;
                const newCols = { ...state.columns };
                const registry = window.ExtensionRegistry || ExtensionRegistry;
                const isExtActive = (extName) => typeof registry._filterPredicate === 'function' ? registry._filterPredicate(extName) : true;
                const subSlots = this._layoutConfig.filter(s => s.slot === 'slots:sub-navigation');
                ['left', 'center', 'right'].forEach(col => {
                    if (!newCols[col] || !newCols[col].pinned) return;
                    const validPins = newCols[col].pinned
                        .filter(p => !p.extName || isExtActive(p.extName))
                        .map(p => {
                            const slotDef = subSlots.find(s => s.id === p.id);
                            if (slotDef && (slotDef.icon !== p.icon || slotDef.label !== p.label || slotDef.intent !== p.intent)) {
                                changed = true;
                                return { ...p, icon: slotDef.icon, label: slotDef.label, intent: slotDef.intent };
                            }
                            return p;
                        });

                    if (validPins.length !== newCols[col].pinned.length || changed) {
                        newCols[col] = { ...newCols[col], pinned: validPins };
                        if (newCols[col].active && !validPins.some(p => p.id === newCols[col].active)) {
                            newCols[col].active = validPins.length > 0 ? validPins[0].id : null;
                        }
                        changed = true;
                    }
                });

                if (changed) layoutStore.setState({ columns: newCols });
            }

            this.requestUpdate();
        } catch(err) { console.error("[Telemetry] AppShell _compileLayout error:", err); }
    }
    _renderDropdownItem(child) {
        let existingCol = null;
        if (this._spatialState && this._spatialState.columns) {
            for (const colId of ['left', 'center', 'right']) {
                if (this._spatialState.columns[colId].pinned.some(p => p.id === child.id)) {
                    existingCol = colId;
                    break;
                }
            }
        }
        return html`
            <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); text-align: left; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                @pointerdown=${(e) => {
                    const layoutState = window.Sutram?.stores?.Layout?.getState();
                    let existingColDown = null;
                    if (layoutState && layoutState.columns) {
                        for (const colId of ['left', 'center', 'right']) {
                            if (layoutState.columns[colId].pinned.some(p => p.id === child.id)) {
                                existingColDown = colId;
                                break;
                            }
                        }
                    }
                    this._handlePointerDown(e, child, existingColDown, 'dropdown');
                }}
                @click=${() => {
                    if (this._dragState.active) return;
                    const layoutState = window.Sutram?.stores?.Layout?.getState();
                    const { capacity, focusedColumn, mobileViewportIndex } = this._spatialState || { capacity: 3, focusedColumn: 'center', mobileViewportIndex: 1 };

                    let existingColClick = null;
                    if (layoutState && layoutState.columns) {
                        for (const colId of ['left', 'center', 'right']) {
                            if (layoutState.columns[colId].pinned.some(p => p.id === child.id)) {
                                existingColClick = colId;
                                break;
                            }
                        }
                    }

                    let targetCol = existingColClick;
                    if (!existingColClick) {
                        targetCol = child.preferredColumn || 'center';
                        if (layoutState) layoutState.pinToColumn(targetCol, child);
                    }
                    if (layoutState) {
                        layoutState.setFocusedColumn(targetCol);
                        layoutState.setActiveProjection(targetCol, child.id);
                    }
                    this._handleSubTabClick(child.id);
                    this._launcherDropdown = null;
                    this.requestUpdate();
                }}>
                <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                    ${child.icon ? html`<yv-icon name="${child.icon}" style="width: 14px; height: 14px; color: ${existingCol ? this._getPrimaryTabColor({id: child.targetParent, intent: child.intent}) : 'var(--text-muted)'};"></yv-icon>` : html`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${existingCol ? this._getPrimaryTabColor({id: child.targetParent, intent: child.intent}) : 'var(--text-muted)'};"></yv-icon>`}
                </div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${child.label}</span>
            </button>
        `;
    }
    _updateUrlHash(colId, subId) {
        const activeWs = window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default';
        const deepPath = window.inSetu?.stores?.App?.getState()?.tabBrowsePaths?.[subId];
        const deepStr = deepPath && deepPath.length > 0 ? '/' + deepPath.map(encodeURIComponent).join('/') : '';
        const hash = `#/${activeWs}/${colId}/${subId}${deepStr}`;
        if (window.location.hash !== hash) {
            window.history.replaceState(null, '', hash);
        }
    }
    _handleSubTabClick(subId) {
        let targetCol = null;
        let isAlreadyActive = false;

        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            for (const col of ['left', 'center', 'right']) {
                if (layout.columns[col]?.pinned.some(p => p.id === subId)) {
                    targetCol = col;
                    break;
                }
            }
            if (targetCol) {
                isAlreadyActive = layout.columns[targetCol].active === subId;
                layout.setActiveProjection(targetCol, subId);
                layout.setFocusedColumn(targetCol);
                const colIndexes = { 'left': 0, 'center': 1, 'right': 2 };
                if (this._spatialState?.capacity === 1) {
                    this._setViewportIndex(colIndexes[targetCol]);
                }
            }
        }

        if (isAlreadyActive) {
            const node = this.shadowRoot.querySelector(`[data-sub-id="${subId}"]`);
            if (node && typeof node.onForceRefresh === 'function') {
                node.onForceRefresh();
            }
        }

        this.requestUpdate();
        if (targetCol) this._updateUrlHash(targetCol, subId);
    }
    _handleDotDragStart(e) {
        if (!this._dotDragController) {
            this._dotDragController = new YenvuiGestureController(this, {
                onPanStart: () => {
                    this._isPanningTrack = true;
                    const track = this.shadowRoot.querySelector('.spatial-track');
                    if (track) track.style.transition = 'none'; // Disable CSS snapping animation during active drag
                },
                onPanMove: (x, y, axis) => {
                    if (axis === 'horizontal') {
                        const deltaX = x - this._dotDragController.startX;
                        const currentIdx = this._spatialState?.mobileViewportIndex ?? 1;
                        const capacity = this._spatialState?.capacity || 3;
                        const layoutRatios = this._spatialState?.layoutRatios || [1, 1, 1];
                        const metrics = getSpatialMetrics(capacity, currentIdx, layoutRatios);
                        const baseOffset = parseFloat(metrics.getTrackOffset());

                        const track = this.shadowRoot.querySelector('.spatial-track');
                        if (track) {
                            let dragOffset = deltaX;
                            const maxIdx = Math.max(0, layoutRatios.length - capacity);
                            const minOffsetStr = getSpatialMetrics(capacity, maxIdx, layoutRatios).getTrackOffset();
                            const minOffset = parseFloat(minOffsetStr);
                            const maxOffset = 0; // The track never translates positively

                            // Apply a heavy rubber-band friction effect if dragging past the absolute edges
                            if ((baseOffset <= minOffset && deltaX < 0) || (baseOffset >= maxOffset && deltaX > 0)) {
                                dragOffset = deltaX * 0.2; 
                            }
                            // Direct DOM manipulation for buttery 60fps tracking without triggering Lit renders
                            track.style.transform = `translateX(calc(${baseOffset}% + ${dragOffset}px))`;
                        }
                    }
                },
                onPanEnd: (endX, endY, axis) => {
                    const track = this.shadowRoot.querySelector('.spatial-track');
                    if (track) {
                        track.style.transition = ''; // Restore CSS snap animation
                    }

                    if (axis === 'horizontal') {
                        const deltaX = endX - this._dotDragController.startX;
                        const threshold = window.innerWidth * 0.2;
                        const current = this._spatialState?.mobileViewportIndex ?? 1;
                        const capacity = this._spatialState?.capacity || 3;
                        const layoutRatios = this._spatialState?.layoutRatios || [1, 1, 1];
                        const maxIdx = Math.max(0, layoutRatios.length - capacity);

                        let newIdx = current;
                        if (deltaX > threshold) newIdx = Math.max(0, current - 1);
                        else if (deltaX < -threshold) newIdx = Math.min(maxIdx, current + 1);

                        this._isPanningTrack = false;

                        if (newIdx !== current) {
                            this._setViewportIndex(newIdx);
                        } else {
                            const metrics = getSpatialMetrics(capacity, newIdx, layoutRatios);
                            if (track) {
                                track.style.transform = `translateX(${metrics.getTrackOffset()})`;
                            }
                            this.requestUpdate();
                        }
                    } else {
                        this._isPanningTrack = false;
                        this.requestUpdate();
                    }
                }
            });
        }
        this._dotDragController.start(e);
    }

    _setViewportIndex(index) {
        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            layout.setMobileViewport(index);
            // Sync the explicit focus to the new column so the viewport math doesn't fight the manual pan
            const cols = ['left', 'center', 'right'];
            if (cols[index]) layout.setFocusedColumn(cols[index]);
        }
    }
    render() {
        try {
        const nextNodes = new Map();
        const getDynamicNode = (componentTag, subId = null, props = null) => {
            if (!componentTag) return '';
            const cacheKey = subId ? `${componentTag}:${subId}` : componentTag;
            let node = this._activeNodes.get(cacheKey);
            if (!node) {
                try {
                    node = document.createElement(componentTag);
                } catch (e) {
                    node = document.createElement('div');
                    node.style.cssText = "padding: 15px; color: var(--intent-danger); font-family: monospace; display: flex; align-items: center; gap: 6px;";
                    node.innerHTML = `<yv-icon name="alert-triangle" style="width: 14px; height: 14px;"></yv-icon><span>Failed to initialize &lt;${componentTag}&gt;</span>`;
                }
            }
            if (subId && node.dataset) node.dataset.subId = subId;
            if (props && typeof props === 'object') {
                Object.assign(node, props);
            }
            nextNodes.set(cacheKey, node);
            return node;
        };

        const registry = window.ExtensionRegistry || ExtensionRegistry;
        const isOffline = window.Sutram?.stores?.Environment?.getState()?.isOffline || false;

        let primarySlots = this._layoutConfig.filter(s => s.slot === 'slots:primary-navigation');
        const globalSlots = this._layoutConfig.filter(s => s.slot === 'slots:global');
        const subSlots = this._layoutConfig.filter(s => s.slot === 'slots:sub-navigation');

        // Phase 5: Visual Degradation for Offline Mode
        if (isOffline && typeof registry.getExtension === 'function') {
            primarySlots = primarySlots.filter(slot => {
                const primaryManifest = slot.extName ? registry.getExtension(slot.extName) : null;
                if (primaryManifest && primaryManifest.offline_mode && primaryManifest.offline_mode !== 'none') return true;

                const subs = subSlots.filter(s => (s.targetParent || '').toLowerCase() === (slot.id || '').toLowerCase());
                return subs.some(sub => {
                    const subManifest = registry.getExtension(sub.extName);
                    return (subManifest?.offline_mode || 'none') !== 'none';
                });
            });
        }
        const { capacity, mobileViewportIndex, focusedColumn } = this._spatialState || { capacity: 3, mobileViewportIndex: 1, focusedColumn: 'center' };
        const viewportMode = capacity === 1 ? 'mobile' : (capacity === 2 ? 'tablet' : 'desktop');

        const colDefinitions = [
            { id: 'left', label: 'Left Flank' },
            { id: 'center', label: 'Center Focus' },
            { id: 'right', label: 'Right Flank' }
        ];

        const layoutRatios = this._spatialState.layoutRatios || [1, 1, 1];
        const metrics = getSpatialMetrics(capacity, mobileViewportIndex, layoutRatios);

        // Apply viewport to the host to ensure child elements correctly execute :host-context CSS rules
        this.dataset.viewport = viewportMode;

        // GC: Overwrite the active nodes map with only the nodes requested during this render cycle
        // Detached nodes will fall out of scope and be collected by the browser.
        const finalHtml = html`
            <div class="shell-container spatial-viewport" data-viewport="${viewportMode}">
                <!-- Persistent Global Launcher Row -->
                <div class="top-utility-row" style="position: relative; display: flex; justify-content: space-between; width: 100%; background: var(--bg-deep); flex-shrink: 0; height: 38px; border-bottom: 1px solid var(--border); z-index: 50; padding-left: 2px; padding-right: 0; ${capacity < layoutRatios.length ? 'touch-action: pan-y; cursor: grab;' : ''}"
                    @pointerdown=${(e) => { if (capacity < layoutRatios.length) this._handleDotDragStart(e); }}>
                    ${viewportMode === 'mobile' ? html`
                        <div class="mobile-only-tools flex items-center" style="display: flex; align-items: center; height: 100%;">
                            <button class="tab-btn ${this._launcherDropdown?.isMobileTools ? 'active' : ''}" style="display: flex; align-items: center;" @click=${(e) => {
                                e.stopPropagation();
                                if (this._launcherDropdown?.isMobileTools) {
                                    this._launcherDropdown = null;
                                } else {
                                    const activeFolder = primarySlots[0] ? primarySlots[0].id : 'context';
                                    this._launcherDropdown = { isMobileTools: true, selectedFolder: activeFolder };
                                }
                                this.requestUpdate();
                            }}>
                                <yv-icon name="wrench" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 6px; color: var(--intent-primary);"></yv-icon>
                                <span>Tools</span>
                                <yv-icon name="chevron-down" stroke-width="2.5" style="width: 12px; height: 12px; margin-left: 4px; color: var(--text-muted);"></yv-icon>
                            </button>
                        </div>
                    ` : html`
                        <yenvui-scrub-track class="desktop-only-folders" @scroll=${() => { if (this._launcherDropdown) { this._launcherDropdown = null; this.requestUpdate(); } }} style="flex: 1; min-width: 0; height: 100%; background: transparent; --scrub-gap: 2px;">
                            ${primarySlots.map(tab => {
                                const children = subSlots.filter(s => (s.targetParent || '').toLowerCase() === tab.id.toLowerCase());
                                return html`
                                    <button class="tab-btn" style="--tab-intent: ${this._getPrimaryTabColor(tab)};" @click=${(e) => {
                                        if (this._launcherDropdown?.tabId === tab.id) {
                                            this._launcherDropdown = null;
                                        } else {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            // Smart alignment: If within 200px of the right edge, anchor to the right
                                            const alignRight = rect.right > window.innerWidth - 200;
                                            this._launcherDropdown = { 
                                                tabId: tab.id, 
                                                items: children, 
                                                x: alignRight ? 'auto' : rect.left + 'px',
                                                right: alignRight ? (window.innerWidth - rect.right) + 'px' : 'auto',
                                                y: rect.bottom + 5 + 'px' 
                                            };
                                        }
                                        this.requestUpdate();
                                    }}>
                                        ${this._getPrimaryTabIcon(tab)}${tab.label}
                                    </button>
                                `;
                            })}
                        </yenvui-scrub-track>
                    `}
                    <!-- Centered Dots (1-Column Mobile View) -->
                    ${capacity === 1 && capacity < layoutRatios.length ? html`
                        <div class="mobile-dots-wrapper" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            ${Array.from({ length: Math.max(1, layoutRatios.length - capacity + 1) }).map((_, i) => html`
                                <div class="pos-dot-target" @click=${(e) => { e.stopPropagation(); e.preventDefault(); }} @pointerdown=${(e) => { e.stopPropagation(); this._setViewportIndex(i); }} title="Jump to View ${i+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                    <div class="pos-dot ${mobileViewportIndex === i ? 'active' : ''}" style="width: ${mobileViewportIndex === i ? '14px' : '6px'}; height: 6px; border-radius: 9999px; background: ${mobileViewportIndex === i ? 'var(--intent-primary)' : 'var(--text-muted)'}; opacity: ${mobileViewportIndex === i ? '1' : '0.5'}; transition: all 0.2s ease;"></div>
                                </div>
                            `)}
                        </div>
                    ` : ''}

                    <!-- Top Right Utility Rail -->
                    <div style="position: absolute; right: 0; top: 0; bottom: 0; display: flex; align-items: center; gap: 6px; height: 100%; flex-shrink: 0; background: var(--bg-deep); z-index: 105; padding-right: 5px;">
                        <slot name="header-quickpack"></slot>
                        <slot name="header-actions-left"></slot>
                        ${capacity > 1 && capacity < layoutRatios.length ? html`
                            <div class="desktop-dots-wrapper" style="display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                ${Array.from({ length: Math.max(1, layoutRatios.length - capacity + 1) }).map((_, i) => html`
                                    <div class="pos-dot-target" @click=${(e) => { e.stopPropagation(); e.preventDefault(); }} @pointerdown=${(e) => { e.stopPropagation(); this._setViewportIndex(i); }} title="Jump to View ${i+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                        <div class="pos-dot ${mobileViewportIndex === i ? 'active' : ''}" style="width: ${mobileViewportIndex === i ? '14px' : '6px'}; height: 6px; border-radius: 9999px; background: ${mobileViewportIndex === i ? 'var(--intent-primary)' : 'var(--text-muted)'}; opacity: ${mobileViewportIndex === i ? '1' : '0.5'}; transition: all 0.2s ease;"></div>
                                    </div>
                                `)}
                            </div>
                        ` : ''}
                        <slot name="header-actions"></slot>
                    </div>
                </div>
                        <!-- Global Launcher Dropdown Overlay -->
                ${this._launcherDropdown ? html`
                    ${this._launcherDropdown.isMobileTools ? html`
                        <div class="global-launcher-menu mobile-tools-panel" style="position: absolute; top: 38px; left: 0; right: 0; width: 100vw; max-height: calc(100dvh - 38px); overflow-y: auto; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; padding: 12px 12px 20px 12px; box-sizing: border-box; gap: 18px;">
                            ${primarySlots.map(tab => {
                                const children = subSlots.filter(s => (s.targetParent || '').toLowerCase() === tab.id.toLowerCase());
                                if (children.length === 0) return '';
                                return html`
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${this._getPrimaryTabColor(tab)}; border-bottom: 1px solid color-mix(in srgb, ${this._getPrimaryTabColor(tab)} 30%, transparent); padding: 0 14px 4px 14px;">
                                            ${tab.label}
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                            ${children.map(child => {
                                                let existingCol = null;
                                                if (this._spatialState && this._spatialState.columns) {
                                                    for (const colId of ['left', 'center', 'right']) {
                                                        if (this._spatialState.columns[colId].pinned.some(p => p.id === child.id)) {
                                                            existingCol = colId;
                                                            break;
                                                        }
                                                    }
                                                }
                                                return html`
                                                <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: inline-flex; align-items: center; gap: 8px; width: auto; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                                    @pointerdown=${(e) => {
                                                        const layoutState = window.Sutram?.stores?.Layout?.getState();
                                                        let existingColDown = null;
                                                        if (layoutState && layoutState.columns) {
                                                            for (const colId of ['left', 'center', 'right']) {
                                                                if (layoutState.columns[colId].pinned.some(p => p.id === child.id)) {
                                                                    existingColDown = colId;
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                        this._handlePointerDown(e, child, existingColDown, 'dropdown');
                                                    }}
                                                    @click=${() => {
                                                        if (this._dragState.active) return;
                                                        const layoutState = window.Sutram?.stores?.Layout?.getState();
                                                        const { capacity, focusedColumn, mobileViewportIndex } = this._spatialState || { capacity: 3, focusedColumn: 'center', mobileViewportIndex: 1 };

                                                        let existingColClick = null;
                                                        if (layoutState && layoutState.columns) {
                                                            for (const colId of ['left', 'center', 'right']) {
                                                                if (layoutState.columns[colId].pinned.some(p => p.id === child.id)) {
                                                                    existingColClick = colId;
                                                                    break;
                                                                }
                                                            }
                                                        }

                                                        let targetCol = existingColClick;
                                                        if (!existingColClick) {
                                                            targetCol = child.preferredColumn || 'center';
                                                            if (layoutState) layoutState.pinToColumn(targetCol, child);
                                                        }
                                                        if (layoutState) {
                                                            layoutState.setFocusedColumn(targetCol);
                                                        }
                                                        this._handleSubTabClick(child.id);
                                                        this._launcherDropdown = null;
                                                        this.requestUpdate();
                                                    }}>
                                                    <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                                                        ${child.icon ? html`<yv-icon name="${child.icon}" style="width: 14px; height: 14px; color: ${existingCol ? this._getPrimaryTabColor({id: tab.id, intent: tab.intent}) : 'var(--text-muted)'};"></yv-icon>` : html`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${existingCol ? this._getPrimaryTabColor({id: tab.id, intent: tab.intent}) : 'var(--text-muted)'};"></yv-icon>`}
                                                    </div>
                                                    <span style="white-space: nowrap;">${child.label}</span>
                                                </button>
                                            `})}
                                        </div>
                                    </div>
                                `;
                            })}
                        </div>
                    ` : html`
                        <div class="global-launcher-menu" style="position: fixed; top: ${this._launcherDropdown.y}; left: ${this._launcherDropdown.x}; right:${this._launcherDropdown.right}; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 8px; padding: 8px; box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; gap: 6px; min-width: 220px; max-height: 80vh; overflow-y: auto;">
                            ${this._launcherDropdown.items.map(child => this._renderDropdownItem(child))}
                        </div>
                    `}
                ` : ''}
                <!-- Adaptive Spatial Track -->
                <div class="spatial-track capacity-${capacity}" style="${!this._isPanningTrack ? `transform: translateX(${metrics.getTrackOffset()});` : ''}">
                    ${colDefinitions.map((col, idx) => {
                        // Micro-Apps only appear in the spatial grid when explicitly launched/pinned
                        let colSubSlots = [];
                        let sourceCols = [col.id];
                        // Hydrate the column purely from the LayoutStore's pinned arrays
                        sourceCols.forEach(sourceColId => {
                            const dynamicPins = (this._spatialState.columns && this._spatialState.columns[sourceColId]?.pinned) || [];
                            dynamicPins.forEach(pin => {
                                const slotDef = subSlots.find(s => s.id === pin.id);
                                colSubSlots.push({
                                    id: pin.id,
                                    label: slotDef?.label || pin.label || pin.title || pin.id,
                                    component: slotDef?.component || pin.component,
                                    extName: pin.extName || 'fs',
                                    targetParent: pin.targetParent || sourceColId,
                                    preferredColumn: pin.preferredColumn || sourceColId,
                                    icon: slotDef?.icon || pin.icon,
                                    intent: slotDef?.intent || pin.intent,
                                    actualSourceCol: sourceColId
                                });
                            });
                        });
                        // Phase 5: Offline Mode filtering for sub-tabs
                        if (isOffline && typeof registry.getExtension === 'function') {
                            colSubSlots = colSubSlots.filter(sub => {
                                const subManifest = registry.getExtension(sub.extName);
                                return (subManifest?.offline_mode || 'none') !== 'none';
                            });
                        }
                        // Determine the active projection for this column via UDF spatial state. 
                        let activeSubInCol = null;
                        if (sourceCols.includes(this._spatialState.focusedColumn)) {
                            activeSubInCol = colSubSlots.find(s => s.id === this._spatialState.columns[this._spatialState.focusedColumn]?.active);
                        }
                        if (!activeSubInCol) {
                            for (const sCol of sourceCols) {
                                activeSubInCol = colSubSlots.find(s => s.id === this._spatialState.columns[sCol]?.active);
                                if (activeSubInCol) break;
                            }
                        }
                        if (!activeSubInCol) {
                            activeSubInCol = colSubSlots[0];
                        }
                        return html`
                        <div class="spatial-col ${focusedColumn === col.id && capacity > 1 ? 'is-focused' : ''}" data-col-id="${col.id}" style="--col-width: ${metrics.getColWidth(idx)}; --col-left: ${metrics.getColLeft(idx)};" @click=${(e) => {
                            if (this._isPanningTrack) { e.preventDefault(); e.stopPropagation(); return; }
                            const activeId = activeSubInCol ? activeSubInCol.id : (colSubSlots[0] ? colSubSlots[0].id : null);
                            const targetFocusCol = activeSubInCol ? (activeSubInCol.actualSourceCol || col.id) : col.id;
                            if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().setFocusedColumn(targetFocusCol);
                            if (activeId) this._updateUrlHash(targetFocusCol, activeId);
                        }}>
                            <!-- Local Column Header (Projection Stack) -->
                            <div class="col-header" style="justify-content: space-between; padding: 0 0 0 12px; --active-sub-intent: ${activeSubInCol && activeSubInCol.intent ? `var(--intent-${activeSubInCol.intent})` : 'var(--intent-primary)'};">
                                <yenvui-scrub-track class="sub-tabs" style="flex: 1; padding: 0; height: 100%;">
                                    ${colSubSlots.map(sub => {
                                        const isActive = activeSubInCol && activeSubInCol.id === sub.id;
                                        const intentColor = sub.intent ? `var(--intent-${sub.intent})` : 'var(--intent-primary)';
                                        const displayIcon = sub.icon || 'component';
                                        return html`
                                        <div class="sub-tab ${isActive ? 'active' : ''}"
                                                style="${isActive ? `border-bottom-color: ${intentColor}; color: var(--text);` : ''}"
                                                @pointerdown=${(e) => {
                                                    const now = Date.now();
                                                    if (this._lastTapId === sub.id && now - (this._lastTapTime || 0) < 300) {
                                                        e.stopPropagation();
                                                        const layout = window.Sutram?.stores?.Layout?.getState();
                                                        if (layout) {
                                                            layout.unpinFromColumn(sub.actualSourceCol || col.id, sub.id);
                                                            layout.openWindow(sub, col.id, 1);
                                                        }
                                                        this._lastTapTime = 0;
                                                        return;
                                                    }
                                                    this._lastTapId = sub.id;
                                                    this._lastTapTime = now;
                                                    this._handlePointerDown(e, sub, sub.actualSourceCol || col.id, 'subtab');
                                                }}
                                                @dblclick=${(e) => {
                                                    e.stopPropagation();
                                                    const layout = window.Sutram?.stores?.Layout?.getState();
                                                    if (layout) {
                                                        layout.unpinFromColumn(sub.actualSourceCol || col.id, sub.id);
                                                        layout.openWindow(sub, col.id, 1);
                                                    }
                                                }}
                                                @click=${() => {
                                                    if (this._dragState.active) return; // Ignore click if it was a drag
                                                    if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().setFocusedColumn(sub.actualSourceCol || col.id);
                                                    this._handleSubTabClick(sub.id);
                                                }}>
                                            <div class="sub-tab-icon-wrapper">
                                                <div class="default-icon-container" style="color: ${intentColor}; opacity:${isActive ? '1' : '0.5'};">
                                                    <yv-icon name="${displayIcon}" stroke-width="2.5" style="width: 14px; height: 14px;"></yv-icon>
                                                </div>
                                            </div>
                                            ${sub.label}${window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[sub.id]?.content !== window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[sub.id]?.originalContent ? '*' : ''}
                                        </div>
                                    `})}
                                </yenvui-scrub-track>
                                <!-- Projection Top Actions -->
                                <div style="display: flex; align-items: center; height: 100%;">
                                    ${activeSubInCol ? this._layoutConfig.filter(s => s.slot === 'slots:sub-navigation-actions' && s.targetSub === activeSubInCol.id).map(act => html`<div style="display: contents;" data-ext="${act.extName}">${getDynamicNode(act.component, activeSubInCol.id)}</div>`) : ''}
                                </div>
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${colSubSlots.map(sub => {
                                    const isActive = activeSubInCol && activeSubInCol.id === sub.id;
                                    const node = getDynamicNode(sub.component, sub.id);

                                    return html`
                                        <div style="display: ${isActive ? 'flex' : 'none'}; flex-direction: column; flex: 1; height: 100%; min-height: 0;" data-ext="${sub.extName}" data-offline-mode="${(typeof registry.getExtension === 'function' ? registry.getExtension(sub.extName)?.offline_mode : null) || 'none'}">
                                            ${node}
                                        </div>
                                    `;
                                })}
                                ${colSubSlots.length === 0 ? html`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${col.id} surface.
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        `;
                    })}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows || []).map(win => {
                            const colIdxMap = { left: 0, center: 1, right: 2 };
                            const colIdx = colIdxMap[win.anchorCol || 'center'] ?? 1;
                            let safeSpan = Math.min(win.span || 1, 3 - colIdx);
                            safeSpan = Math.min(safeSpan, capacity);
                            const bounds = metrics.getWinBounds(colIdx, safeSpan, layoutRatios);

                            return html`
                            <div style="position: absolute; left: ${bounds.left}; width: ${bounds.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${win.z || 1000}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${win.label || win.id}
                                    .anchorCol=${win.anchorCol || 'center'}
                                    .span=${safeSpan}
                                    .z=${win.z}
                                    .icon=${win.icon || 'component'}
                                    .intent=${win.intent || 'neutral'}
                                    @sutram-window-closed=${() => {
                                        this._safeEvict(win.id, () => {
                                            window.Sutram?.stores?.Layout?.getState().closeWindow(win.id);
                                        });
                                    }}
                                    @sutram-window-span=${(e) => window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(win.id, win.anchorCol || 'center', e.detail.span)}
                                    @sutram-window-focused=${() => window.Sutram?.stores?.Layout?.getState().focusWindow(win.id)}
                                    @sutram-window-drag-start=${(e) => this._handlePointerDown(e.detail.originalEvent, win, 'window', 'window-header')}
                                    @sutram-window-dock=${() => {
                                if (win.windowOnly) return;
                                const layout = window.Sutram?.stores?.Layout?.getState();
                                if (layout) {
                                    const destCol = win.preferredColumn || 'center';
                                    layout.closeWindow(win.id);
                                    layout.pinToColumn(destCol, win);
                                    layout.setFocusedColumn(destCol);
                                    layout.setActiveProjection(destCol, win.id);
                                    layout.setFocusedColumn(win.preferredColumn || 'center');
                                    this.requestUpdate();
                                }
                            }}>
                            ${getDynamicNode(win.component, win.id, win.props)}
                        </sutram-window>
                            </div>
                        `;})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${globalSlots.map(s => getDynamicNode(s.component))}
            </div>

            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${() => { this._dragState.active = false; this.requestUpdate(); }}>
            </sutram-drag-coordinator>
        `;
        this._activeNodes = nextNodes;
        return finalHtml;
        } catch(err) {
            console.error("[Telemetry] AppShell render error:", err);
            return html`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><yv-icon name="alert-triangle" style="width: 22px; height: 22px;"></yv-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${err.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${err.stack}</pre></div>`;
        }
    }
}

customElements.define('sutram-app-shell', SutramAppShell);