// sutram/js/app_shell.js (Compiled Vendor Artifact)
import { html, css } from 'lit';
import { SutramElement, ExtensionRegistry, LayoutStore } from './sdk.js';
import { sharedStyles } from './shared_styles.js';
import { debounce } from './utils.js';
import { SutramProjectionCompiler, SutramDOMPool } from './projection_engine.js';
import './drag-coordinator.js';
import '../../yenvui/js/tabs.js';
import { YenvuiGestureController, getDeepElementFromPoint } from '../../yenvui/js/physics.js';

export class SutramAppShell extends SutramElement {
    static properties = {
        activeTab: { type: String },
        activeSubTabs: { type: Object },
        _layoutConfig: { type: Array },
        _spatialState: { type: Object }
    };
    static styles = [sharedStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            height: calc(100dvh - 30px); /* Account for global status bar */
            width: 100vw;
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
            padding: 6px 10px;
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
            display: flex;
            flex: 1;
            min-height: 0;
            transition: transform 0.32s cubic-bezier(0.2, 0.9, 0.2, 1);
            width: 100%;
        }

        /* Responsive Viewport States */
        :host([data-viewport="mobile"]) .spatial-track, [data-viewport="mobile"] .spatial-track {
            width: 300% !important;
        }
        :host([data-viewport="mobile"]) .spatial-col, [data-viewport="mobile"] .spatial-col {
            width: 33.333333% !important;
            min-width: 33.333333% !important;
            max-width: 33.333333% !important;
            flex-shrink: 0 !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            border-right: none;
        }

        :host([data-viewport="tablet"]) .spatial-track, [data-viewport="tablet"] .spatial-track {
            width: 150% !important;
        }
        :host([data-viewport="tablet"]) .spatial-col, [data-viewport="tablet"] .spatial-col {
            width: 33.333333% !important;
            min-width: 33.333333% !important;
            max-width: 33.333333% !important;
            flex-shrink: 0 !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            border-right: 1px solid var(--border);
        }

        :host([data-viewport="desktop"]) .spatial-track, [data-viewport="desktop"] .spatial-track {
            width: 100% !important;
            transform: translateX(0) !important;
        }
        :host([data-viewport="desktop"]) .spatial-col, [data-viewport="desktop"] .spatial-col {
            flex: 1 !important;
            width: 33.333333% !important;
            min-width: 0 !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            border-right: 1px solid var(--border);
        }
        .spatial-col {
            container-type: inline-size;
            overscroll-behavior-x: none;
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
            padding-right: 0 !important;
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
        :host([data-viewport="mobile"]) .mobile-dots-wrapper, [data-viewport="mobile"] .mobile-dots-wrapper { display: flex !important; }
        :host([data-viewport="desktop"]) .desktop-only-folders, :host([data-viewport="tablet"]) .desktop-only-folders,
        [data-viewport="desktop"] .desktop-only-folders, [data-viewport="tablet"] .desktop-only-folders { display: flex !important; }
        :host([data-viewport="desktop"]) .mobile-only-tools, :host([data-viewport="tablet"]) .mobile-only-tools,
        [data-viewport="desktop"] .mobile-only-tools, [data-viewport="tablet"] .mobile-only-tools { display: none !important; }
        :host([data-viewport="desktop"]) .mobile-dots-wrapper, :host([data-viewport="tablet"]) .mobile-dots-wrapper,
        [data-viewport="desktop"] .mobile-dots-wrapper, [data-viewport="tablet"] .mobile-dots-wrapper { display: none !important; }
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
            padding-left: 2px;
            padding-right: 0;
            flex-shrink: 0;
            position: relative;
        }
        .pan-handle {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 29px;
            min-width: 29px;
            max-width: 29px;
            padding: 0;
            box-sizing: border-box;
            background: color-mix(in srgb, var(--intent-primary) 20%, var(--bg-deep));
            border: none;
            color: var(--intent-primary);
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            z-index: 10;
            touch-action: none;
            transition: all 0.2s ease;
        }
        .pan-handle:hover {
            background: color-mix(in srgb, var(--intent-primary) 40%, var(--bg-deep));
            color: var(--text);
        }
        .pan-handle:active {
            cursor: grabbing;
            background: var(--intent-primary);
            color: var(--text-light, #fff);
        }
        .pan-handle.left { left: 0; }
        .pan-handle.right { right: 0; }

        /* Spatial Drop-Zone Overlay */
        .drop-zone-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 20px;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
        }
        .drop-zone-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }
        .drop-row {
            display: flex;
            gap: 15px;
            width: 100%;
            max-width: 800px;
            padding: 0 20px;
            box-sizing: border-box;
            justify-content: center;
        }
        .drop-target {
            flex: 1;
            height: 120px;
            border: 2px dashed var(--border);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            font-size: 1.2rem;
            font-weight: bold;
            transition: all 0.2s ease;
            background: var(--pane-bg);
        }
        .drop-target.hovered {
            border: 2px solid var(--intent-primary);
            background: color-mix(in srgb, var(--intent-primary) 20%, var(--pane-bg));
            color: var(--text);
            transform: scale(1.05);
        }
        .drop-target.source {
            border: 2px dashed var(--intent-neutral);
            background: color-mix(in srgb, var(--intent-neutral) 15%, var(--pane-bg));
            color: var(--text);
        }
        .drop-target.close-zone {
            height: 80px;
            max-width: 400px;
            border-color: var(--intent-danger);
            color: var(--intent-danger);
        }
        .drop-target.close-zone.hovered {
            background: color-mix(in srgb, var(--intent-danger) 20%, var(--pane-bg));
            color: white;
        }
        /* Draggable Tab Enhancements */
        .sub-tab {
            touch-action: none; user-select: none; display: flex; align-items: center;
            cursor: pointer; padding: 0 3px; margin-right: 12px; font-size: 0.9rem; font-weight: 500; 
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
        .sub-tab-icon-wrapper .default-icon-container { display: flex; transition: opacity 0.2s; }
        .sub-tab-icon-wrapper .close-icon { display: none; position: absolute; }
        .sub-tab-icon-wrapper:hover {
            background: color-mix(in srgb, var(--intent-danger) 15%, transparent);
        }
        .sub-tab:hover .default-icon-container { display: none; }
        .sub-tab:hover .close-icon { display: block; }
    `];
    constructor() {
        super();
        this.activeTab = '';
        this.activeSubTabs = {};
        this._layoutConfig = [];
        this._domPool = new SutramDOMPool();
        this._spatialState = { capacity: 3, focusedColumn: 'center', mobileViewportIndex: 1, columns: { left: { pinned: [] }, center: { pinned: [] }, right: { pinned: [] } } };
        // PointerEvent Drag State
        this._dragState = { active: false, entity: null, sourceCol: null, currentZone: null, startX: 0, startY: 0, currentX: 0, currentY: 0 };

        this._colActiveTabs = { left: null, center: null, right: null };

        // Custom Overlay State for Launcher Folders
        this._launcherDropdown = null;
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
        this._dragState = { active: false, entity, sourceCol, currentZone: null, startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY, originType };

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

                    // Throttle the heavy DOM piercing to ~20fps (50ms) for drop zone detection
                    const now = Date.now();
                    if (!this._lastDropCheck || now - this._lastDropCheck > 50) {
                        this._lastDropCheck = now;
                        const dropTarget = getDeepElementFromPoint(x, y, 'yenvui-drop-target');
                        const newZone = dropTarget ? dropTarget.zone : null;
                        if (this._dragState.currentZone !== newZone) {
                            this._dragState.currentZone = newZone;
                        }
                    }

                    // PERFORMANCE OPTIMIZATION: Bypass the heavy AppShell render cycle (O(N) layout nodes) 
                    // and write coordinates directly to the isolated DragCoordinator component at 60fps.
                    const coordinator = this.shadowRoot.querySelector('sutram-drag-coordinator');
                    if (coordinator) {
                        coordinator.dragState = { ...this._dragState };
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
                                if (sourceCol === 'window') layout.closeWindow(entity.id);
                                else if (sourceCol) layout.unpinFromColumn(sourceCol, entity.id);
                                layout.evictProjection(entity.id);
                            } else if (targetZone === 'window') {
                                if (sourceCol === 'window') layout.closeWindow(entity.id);
                                else if (sourceCol) layout.unpinFromColumn(sourceCol, entity.id);
                                layout.openWindow(entity, endX - 300, endY - 200);
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
                            } else if (['left', 'center', 'right'].includes(targetZone) && targetZone !== sourceCol) {
                                const destCol = targetZone;
                                if (sourceCol === 'window') layout.closeWindow(entity.id);
                                else if (sourceCol) layout.unpinFromColumn(sourceCol, entity.id);

                                layout.pinToColumn(destCol, entity);
                                layout.setFocusedColumn(destCol);
                                this._colActiveTabs[destCol] = entity.id;

                                const colIndexes = { 'left': 0, 'center': 1, 'right': 2 };
                                if (this._spatialState?.capacity === 1) {
                                    this._setViewportIndex(colIndexes[destCol]);
                                }

                                window.dispatchEvent(new CustomEvent('shell-subtab-changed', {
                                    detail: { tabId: destCol, subId: entity.id, isAlreadyActive: false },
                                    bubbles: true, composed: true
                                }));
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
                    columns: safeState.columns || { left: { pinned: [] }, center: { pinned: [] }, right: { pinned: [] } },
                    windows: safeState.windows || []
                };
                this.requestUpdate();
            });
            // Garbage Collection: SutramDOMPool handles node eviction; trigger shell re-render
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
                        }
                    }
                }
            }, 100);
            window.addEventListener('resize', this._handleResize);
            this._handleResize();
        }
        // Break synchronous infinite loops by debouncing the layout compilation listener
        this._debouncedCompile = debounce(() => this._compileLayout(), 50);
        this.registerGlobalListener('sutram-layout-recompile', window, this._debouncedCompile);
        this.registerGlobalListener('sutram-route-changed', window, (e) => {
            this.activeTab = e.detail?.tab || '';
            this.activeSubTabs = e.detail?.subTabs || {};
        });

        // Catch external file-open events (like clicking cards in Gather) and pull them to the foreground
        this.registerGlobalListener('shell-subtab-changed', window, (e) => {
            const { subId, background } = e.detail || {};
            // Respect intentional background opening (Ctrl-Click), otherwise force foreground
            if (subId && !background && window.Sutram?.stores?.Layout) {
                const layout = window.Sutram.stores.Layout.getState();
                for (const col of ['left', 'center', 'right']) {
                    if (layout.columns[col]?.pinned.some(p => p.id === subId)) {
                        this._colActiveTabs[col] = subId;
                        this.requestUpdate();
                        break;
                    }
                }
            }
        });

        this._compileLayout();
        } catch(err) { console.error("[Telemetry] AppShell connectedCallback error:", err); }
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: this.shadowRoot });
        }
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
            return html`<i data-lucide="${tab.icon}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${color};"></i>`;
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
        return html`<i data-lucide="${icon}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${color};"></i>`;
    }
    _compileLayout() {
        try {
            this._layoutConfig = SutramProjectionCompiler.getCompiledLayout();
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
            <button style="background: var(--input-bg); color: var(--text); text-align: left; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; box-sizing: border-box; touch-action: none; user-select: none; transition: background 0.2s, border-color 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                onmouseover="this.style.background='var(--bg)'; this.style.borderColor='${this._getPrimaryTabColor({id: child.targetParent, intent: child.intent})}';"
                onmouseout="this.style.background='var(--input-bg)'; this.style.borderColor='var(--border)';"
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
                        let visibleCols = ['left', 'center', 'right'];
                        if (capacity === 1) {
                            const colMap = ['left', 'center', 'right'];
                            visibleCols = [colMap[mobileViewportIndex] || focusedColumn || 'center'];
                        } else if (capacity === 2) {
                            if (focusedColumn === 'right' || mobileViewportIndex === 2) {
                                visibleCols = ['center', 'right'];
                            } else {
                                visibleCols = ['left', 'center'];
                            }
                        }

                        if (!visibleCols.includes(targetCol)) {
                            targetCol = capacity === 1 ? visibleCols[0] : focusedColumn;
                        }
                        if (layoutState) layoutState.pinToColumn(targetCol, child);
                    }
                    if (layoutState) {
                        layoutState.setFocusedColumn(targetCol);
                        if (capacity === 1) {
                            const colIndexes = { 'left': 0, 'center': 1, 'right': 2 };
                            this._setViewportIndex(colIndexes[targetCol]);
                        }
                    }
                    this._colActiveTabs[targetCol] = child.id;
                    this._handleTabClick(child.targetParent);
                    this._handleSubTabClick(child.targetParent, child.id);
                    this._launcherDropdown = null;
                    this.requestUpdate();
                }}>
                <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                    ${child.icon ? html`<i data-lucide="${child.icon}" style="width: 14px; height: 14px; color: ${existingCol ? this._getPrimaryTabColor({id: child.targetParent, intent: child.intent}) : 'var(--text-muted)'};"></i>` : html`<i data-lucide="puzzle" style="width: 14px; height: 14px; color: ${existingCol ? this._getPrimaryTabColor({id: child.targetParent, intent: child.intent}) : 'var(--text-muted)'};"></i>`}
                </div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${child.label}</span>
            </button>
        `;
    }

    _getCachedComponent(componentTag, subId = null) {
        return this._domPool.get(componentTag, subId);
    }

    _handleTabClick(tabId) {
        const isAlreadyActive = this.activeTab === tabId;
        this.dispatchEvent(new CustomEvent('shell-tab-changed', { detail: { tabId, isAlreadyActive }, bubbles: true, composed: true }));
    }
    _updateUrlHash(colId, subId) {
        const activeWs = window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default';
        const hash = `#/${activeWs}/${colId}/${subId}`;
        if (window.location.hash !== hash) {
            window.history.replaceState(null, '', hash);
        }
    }
    _handleSubTabClick(tabId, subId) {
        const isAlreadyActive = this.activeSubTabs[tabId] === subId;
        this.activeSubTabs = { ...this.activeSubTabs, [tabId]: subId };

        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            let targetCol = null;
            for (const col of ['left', 'center', 'right']) {
                if (layout.columns[col]?.pinned.some(p => p.id === subId)) {
                    targetCol = col;
                    break;
                }
            }
            if (targetCol) {
                this._colActiveTabs[targetCol] = subId;
                layout.setFocusedColumn(targetCol);
                const colIndexes = { 'left': 0, 'center': 1, 'right': 2 };
                if (this._spatialState?.capacity === 1) {
                    this._setViewportIndex(colIndexes[targetCol]);
                }
            }
        }

        this.dispatchEvent(new CustomEvent('shell-subtab-changed', { detail: { tabId, subId, isAlreadyActive }, bubbles: true, composed: true }));
        this.requestUpdate();
        this._updateUrlHash(tabId, subId);
    }
    _handleFolderDragStart(e) {
        // Only hijack mouse events; touch devices can use their native momentum scrolling
        if (e.pointerType !== 'mouse') return;

        if (!this._folderDragController) {
            this._folderDragController = new YenvuiGestureController(this, {
                onPanStart: () => {
                    const row = this.shadowRoot.querySelector('.folder-tabs-row');
                    if (row) {
                        this._folderStartScroll = row.scrollLeft;
                        row.style.scrollBehavior = 'auto'; // Disable smooth scroll during live drag
                        row.style.cursor = 'grabbing';
                    }
                },
                onPanMove: (x, y, axis) => {
                    if (axis === 'horizontal') {
                        const row = this.shadowRoot.querySelector('.folder-tabs-row');
                        if (row) {
                            const deltaX = x - this._folderDragController.startX;
                            row.scrollLeft = this._folderStartScroll - deltaX;
                        }
                    }
                },
                onPanEnd: () => {
                    const row = this.shadowRoot.querySelector('.folder-tabs-row');
                    if (row) {
                        row.style.scrollBehavior = '';
                        row.style.cursor = 'grab';
                    }
                }
            });
        }
        this._folderDragController.start(e);
    }

    _handleDotDragStart(e) {
        if (!this._dotDragController) {
            this._dotDragController = new YenvuiGestureController(this, {
                onPanStart: () => {
                    const track = this.shadowRoot.querySelector('.spatial-track');
                    if (track) track.style.transition = 'none'; // Disable CSS snapping animation during active drag
                },
                onPanMove: (x, y, axis) => {
                    if (axis === 'horizontal') {
                        const deltaX = x - this._dotDragController.startX;
                        const currentIdx = this._spatialState?.mobileViewportIndex ?? 1;
                        const track = this.shadowRoot.querySelector('.spatial-track');

                        if (track) {
                            let dragOffset = deltaX;
                            // Apply a heavy rubber-band friction effect if dragging past the absolute edges
                            if ((currentIdx === 0 && deltaX > 0) || (currentIdx === 2 && deltaX < 0)) {
                                dragOffset = deltaX * 0.2; 
                            }
                            // Direct DOM manipulation for buttery 60fps tracking without triggering Lit renders
                            track.style.transform = `translateX(calc(${currentIdx * -100}vw + ${dragOffset}px))`;
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
                        let newIdx = current;

                        if (deltaX > threshold) {
                            newIdx = Math.max(0, current - 1);
                        } else if (deltaX < -threshold) {
                            newIdx = Math.min(2, current + 1);
                        }

                        if (newIdx !== current) {
                            this._setViewportIndex(newIdx);
                        }

                        // Synchronously apply the exact mathematical transform so the CSS transition handles the snap 
                        // back from the rubber-band offset, avoiding single-frame visual flashes from Lit's async render queue.
                        if (track) {
                            track.style.transform = `translateX(${newIdx * -100}vw)`;
                        }
                        this.requestUpdate(); // Sync Lit's internal state
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
        // Viewport translation math for mobile and split-screen states
        let translateX = 'translateX(0vw)';
        let gridWidth = '100%'; 
        if (capacity === 1) {
            const baseOffset = mobileViewportIndex * -100;
            translateX = `translateX(${baseOffset}vw)`;
            gridWidth = '300%';
        } else if (capacity === 2) {
            // Right-flank affinity memory: Shift left if the right column has focus or was explicitly navigated to
            if (focusedColumn === 'right' || mobileViewportIndex === 2) {
                translateX = 'translateX(-50vw)';
            } else {
                translateX = 'translateX(0vw)';
            }
            gridWidth = '150%';
        }

        // Apply viewport to the host to ensure child elements correctly execute :host-context CSS rules
        this.dataset.viewport = viewportMode;
        return html`
            <div class="shell-container spatial-viewport" data-viewport="${viewportMode}">
                <!-- Persistent Global Launcher Row -->
                <div class="top-utility-row" style="position: relative; display: flex; justify-content: space-between; width: 100%; background: var(--bg-deep); flex-shrink: 0; height: 38px; border-bottom: 1px solid var(--border); z-index: 50; padding-left: 2px; padding-right: 0;">
                    ${viewportMode === 'mobile' ? html`
                        <div class="mobile-only-tools flex items-center" style="display: flex; align-items: center;">
                            <button class="tab-btn ${this._launcherDropdown?.isMobileTools ? 'active' : ''}" style="display: flex; align-items: center;" @click=${(e) => {
                                e.stopPropagation();
                                if (this._launcherDropdown?.isMobileTools) {
                                    this._launcherDropdown = null;
                                } else {
                                    const activeFolder = this.activeTab || (primarySlots[0] ? primarySlots[0].id : 'context');
                                    this._launcherDropdown = { isMobileTools: true, selectedFolder: activeFolder };
                                }
                                this.requestUpdate();
                            }}>
                                <i data-lucide="wrench" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 6px; color: var(--intent-primary);"></i>
                                <span>Tools</span>
                                <i data-lucide="chevron-down" stroke-width="2.5" style="width: 12px; height: 12px; margin-left: 4px; color: var(--text-muted);"></i>
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
                    <!-- Mathematically Centered Mobile Dots -->
                    ${viewportMode === 'mobile' ? html`
                        <div class="mobile-dots-wrapper" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.05); touch-action: pan-y; cursor: grab;" @pointerdown=${(e) => this._handleDotDragStart(e)}>
                            ${colDefinitions.map((c, i) => html`
                                <div class="pos-dot-target" @click=${() => this._setViewportIndex(i)} title="Jump to ${c.label}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                    <div class="pos-dot ${mobileViewportIndex === i ? 'active' : ''}" style="width: ${mobileViewportIndex === i ? '14px' : '6px'}; height: 6px; border-radius: 9999px; background: ${mobileViewportIndex === i ? 'var(--intent-primary)' : 'var(--text-muted)'}; opacity: ${mobileViewportIndex === i ? '1' : '0.5'}; transition: all 0.2s ease;"></div>
                                </div>
                            `)}
                        </div>
                    ` : ''}

                    <div style="display: flex; align-items: center; height: 100%; flex-shrink: 0; position: relative;">
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
                                                <button style="background: var(--input-bg); color: var(--text); padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: inline-flex; align-items: center; gap: 8px; width: auto; box-sizing: border-box; touch-action: none; user-select: none; transition: background 0.2s, border-color 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                                    onmouseover="this.style.background='var(--bg)'; this.style.borderColor='${this._getPrimaryTabColor(tab)}';"
                                                    onmouseout="this.style.background='var(--input-bg)'; this.style.borderColor='var(--border)';"
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
                                                            let visibleCols = ['left', 'center', 'right'];
                                                            if (capacity === 1) {
                                                                const colMap = ['left', 'center', 'right'];
                                                                visibleCols = [colMap[mobileViewportIndex] || focusedColumn || 'center'];
                                                            } else if (capacity === 2) {
                                                                if (focusedColumn === 'right' || mobileViewportIndex === 2) {
                                                                    visibleCols = ['center', 'right'];
                                                                } else {
                                                                    visibleCols = ['left', 'center'];
                                                                }
                                                            }

                                                            if (!visibleCols.includes(targetCol)) {
                                                                targetCol = capacity === 1 ? visibleCols[0] : focusedColumn;
                                                            }
                                                            if (layoutState) layoutState.pinToColumn(targetCol, child);
                                                        }
                                                        if (layoutState) {
                                                            layoutState.setFocusedColumn(targetCol);
                                                            if (capacity === 1) {
                                                                const colIndexes = { 'left': 0, 'center': 1, 'right': 2 };
                                                                this._setViewportIndex(colIndexes[targetCol]);
                                                            }
                                                        }
                                                        this._colActiveTabs[targetCol] = child.id;
                                                        this._handleTabClick(child.targetParent);
                                                        this._handleSubTabClick(child.targetParent, child.id);
                                                        this._launcherDropdown = null;
                                                        this.requestUpdate();
                                                    }}>
                                                    <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                                                        ${child.icon ? html`<i data-lucide="${child.icon}" style="width: 14px; height: 14px; color: ${existingCol ? this._getPrimaryTabColor({id: tab.id, intent: tab.intent}) : 'var(--text-muted)'};"></i>` : html`<i data-lucide="puzzle" style="width: 14px; height: 14px; color: ${existingCol ? this._getPrimaryTabColor({id: tab.id, intent: tab.intent}) : 'var(--text-muted)'};"></i>`}
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
                <div class="spatial-track capacity-${capacity}" style="width: ${gridWidth}; transform:${translateX};">
                    ${colDefinitions.map((col, idx) => {
                        // Micro-Apps only appear in the spatial grid when explicitly launched/pinned
                        let colSubSlots = [];
                        let sourceCols = [col.id];
                        // Flank Affinity Memory: In 2-column mode, collapse the off-screen flank into the visible flank
                        if (capacity === 2) {
                            const isShiftedLeft = focusedColumn === 'right' || mobileViewportIndex === 2;
                            if (col.id === 'left' && !isShiftedLeft) sourceCols = ['left', 'right'];
                            else if (col.id === 'right' && !isShiftedLeft) sourceCols = []; // Prevent DOM stealing by the hidden column
                            else if (col.id === 'right' && isShiftedLeft) sourceCols = ['right', 'left'];
                            else if (col.id === 'left' && isShiftedLeft) sourceCols = [];
                        }
                        // Hydrate the column purely from the LayoutStore's pinned arrays
                        sourceCols.forEach(sourceColId => {
                            const dynamicPins = (this._spatialState.columns && this._spatialState.columns[sourceColId]?.pinned) || [];
                            dynamicPins.forEach(pin => {
                                colSubSlots.push({
                                    id: pin.id,
                                    label: pin.label || pin.title || pin.id,
                                    component: pin.component,
                                    extName: pin.extName || 'fs',
                                    targetParent: pin.targetParent || sourceColId,
                                    preferredColumn: pin.preferredColumn || sourceColId,
                                    icon: pin.icon,
                                    intent: pin.intent
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

                        // Determine the active projection for this column. 
                        let activeSubInCol = colSubSlots.find(s => s.id === this._colActiveTabs[col.id]);
                        if (!activeSubInCol) {
                            const safeSubTabs = this.activeSubTabs || {};
                            activeSubInCol = colSubSlots.find(s => safeSubTabs[s.targetParent] === s.id) || colSubSlots[0];
                        }
                        return html`
                        <div class="spatial-col ${focusedColumn === col.id && capacity > 1 ? 'is-focused' : ''}" data-col-id="${col.id}" @click=${() => {
                            if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().setFocusedColumn(col.id);
                            const subId = this._colActiveTabs[col.id];
                            if (subId) this._updateUrlHash(col.id, subId);
                        }}>
                            <!-- Local Column Header (Projection Stack) -->
                            <div class="col-header" style="justify-content: space-between; padding-left: 2px; --active-sub-intent: ${activeSubInCol && activeSubInCol.intent ? `var(--intent-${activeSubInCol.intent})` : 'var(--intent-primary)'};">
                                <yenvui-scrub-track class="sub-tabs" style="flex: 1; padding-left: 7px;">
                                    ${colSubSlots.map(sub => {
                                        const isActive = activeSubInCol && activeSubInCol.id === sub.id;
                                        const intentColor = sub.intent ? `var(--intent-${sub.intent})` : 'var(--intent-primary)';
                                        const displayIcon = sub.icon || 'component';
                                        return html`
                                        <div class="sub-tab ${isActive ? 'active' : ''}"
                                                style="${isActive ? `border-bottom-color: ${intentColor}; color: var(--text);` : ''}"
                                                @pointerdown=${(e) => this._handlePointerDown(e, sub, col.id, 'subtab')}
                                                @click=${() => {
                                                    if (this._dragState.active) return; // Ignore click if it was a drag
                                                    if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().setFocusedColumn(col.id);
                                                    this._colActiveTabs[col.id] = sub.id;
                                                    this._handleSubTabClick(sub.targetParent, sub.id);
                                                }}>
                                            <div class="sub-tab-icon-wrapper" @pointerdown=${(e) => e.stopPropagation()} @click=${(e) => {
                                                e.stopPropagation();
                                                const layout = window.Sutram?.stores?.Layout?.getState();
                                                if (layout) {
                                                    layout.unpinFromColumn(col.id, sub.id);
                                                    layout.evictProjection(sub.id);
                                                }
                                            }}>
                                                <div class="default-icon-container" style="color: ${intentColor}; opacity: ${isActive ? '1' : '0.5'};">
                                                    <i data-lucide="${displayIcon}" stroke-width="2.5" style="width: 14px; height: 14px;"></i>
                                                </div>
                                                <i data-lucide="x" class="close-icon" stroke-width="2.5" style="width: 14px; height: 14px; color: var(--intent-danger);"></i>
                                            </div>
                                            ${sub.label}
                                        </div>
                                    `})}
                                </yenvui-scrub-track>
                                <!-- Projection Top Actions -->
                                <div style="display: flex; align-items: center; height: 100%;">
                                    ${activeSubInCol ? this._layoutConfig.filter(s => s.slot === 'slots:sub-navigation-actions' && s.targetSub === activeSubInCol.id).map(act => html`<div style="display: contents;" data-ext="${act.extName}">${this._getCachedComponent(act.component, activeSubInCol.id)}</div>`) : ''}
                                </div>
                            </div>

                            <!-- Shadow DOM Projection Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${colSubSlots.map(sub => {
                                    const isActive = activeSubInCol && activeSubInCol.id === sub.id;
                                    const extMode = registry.getExtension(sub.extName)?.offline_mode || 'none';
                                    const node = this._getCachedComponent(sub.component, sub.id);

                                    // Non-destructive DOM routing: Toggle visibility without unmounting to preserve buffer states
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
                </div>
            </div>

            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${globalSlots.map(s => this._getCachedComponent(s.component))}
            </div>
            <!-- Spatial Drop-Zone Overlay -->
            <!-- Floating Window Projection Layer -->
            <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                ${(this._spatialState.windows || []).map(win => html`
                    <div style="pointer-events: auto;">
                        <sutram-window
                            .titleText=${win.label || win.id}
                            .x=${win.x} .y=${win.y} .z=${win.z}
                            .icon=${win.icon || 'component'}
                            .intent=${win.intent || 'neutral'}
                            @sutram-window-closed=${() => window.Sutram?.stores?.Layout?.getState().closeWindow(win.id)}
                            @sutram-window-moved=${(e) => window.Sutram?.stores?.Layout?.getState().updateWindowPosition(win.id, e.detail.x, e.detail.y)}
                            @sutram-window-focused=${() => window.Sutram?.stores?.Layout?.getState().focusWindow(win.id)}
                            @sutram-window-drag-start=${(e) => this._handlePointerDown(e.detail.originalEvent, win, 'window', 'window-header')}
                            @sutram-window-dock=${() => {
                                const layout = window.Sutram?.stores?.Layout?.getState();
                                if (layout) {
                                    layout.closeWindow(win.id);
                                    layout.pinToColumn(win.preferredColumn || 'center', win);
                                    layout.setFocusedColumn(win.preferredColumn || 'center');
                                    this._colActiveTabs[win.preferredColumn || 'center'] = win.id;

                                    const colIndexes = { 'left': 0, 'center': 1, 'right': 2 };
                                    if (this._spatialState?.capacity === 1) {
                                        this._setViewportIndex(colIndexes[win.preferredColumn || 'center']);
                                    }

                                    window.dispatchEvent(new CustomEvent('shell-subtab-changed', {
                                        detail: { tabId: win.preferredColumn || 'center', subId: win.id, isAlreadyActive: false },
                                        bubbles: true, composed: true
                                    }));
                                    this.requestUpdate();
                                }
                            }}>
                            ${this._getCachedComponent(win.component, win.id)}
                        </sutram-window>
                    </div>
                `)}
            </div>

            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator 
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${() => { this._dragState.active = false; this.requestUpdate(); }}>
            </sutram-drag-coordinator>
        `;
        } catch(err) {
            console.error("[Telemetry] AppShell render error:", err);
            return html`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2>⚠️ AppShell Render Error</h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${err.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${err.stack}</pre></div>`;
        }
    }
}

customElements.define('sutram-app-shell', SutramAppShell);