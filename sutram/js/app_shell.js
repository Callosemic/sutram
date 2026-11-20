// sutram/js/app_shell.js (Compiled Vendor Artifact)
import { html, css } from 'lit';
import { SutramElement, ExtensionRegistry, LayoutStore, StoreRegistry, SUTRAM_COLUMN_UNIT_PX } from './sutram_sdk.js';
import { computeFitActionCount } from './primitives.js';
import { sharedStyles } from './shared_styles.js';
import { debounce } from './utils.js';
import { SutramProjectionCompiler, SutramProjectionPool } from './projection_engine.js';
import './drag-coordinator.js';
import { physics } from 'sutram-chassis';
const { YenvuiGestureController, YenvuiViewportGuard, getDeepElementFromPoint } = physics;
const getSpatialMetrics = (capacity, activeViewport, layoutRatios) => {
    const rawLayout = (Array.isArray(layoutRatios) && layoutRatios.length > 0) ? layoutRatios : [1, 1, 1];
    const layout = capacity === 1 ? rawLayout.map(() => 1) : rawLayout;
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

export const pinMatchesSlot = (pin, slotOrId) => {
    if (!pin || !slotOrId) return false;
    const targetId = typeof slotOrId === 'string' ? slotOrId : (slotOrId.id || '');
    const targetRaw = typeof slotOrId === 'object' && slotOrId.rawId
        ? slotOrId.rawId
        : (targetId.includes('://') ? targetId : (targetId.includes(':') ? targetId.split(':').slice(1).join(':') : targetId));
    const targetExt = typeof slotOrId === 'object' && slotOrId.extName
        ? slotOrId.extName
        : (!targetId.includes('://') && targetId.includes(':') ? targetId.split(':')[0] : null);

    if (pin.id === targetId) return true;
    if (pin.rawId && pin.rawId === targetRaw && (!targetExt || !pin.extName || pin.extName === targetExt)) return true;
    if (targetExt && pin.id === targetRaw && (!pin.extName || pin.extName === targetExt)) return true;
    if (pin.id && !pin.id.includes('://') && pin.id.includes(':')) {
        const [pExt, pRaw] = pin.id.split(':');
        if (pRaw === targetRaw && (!targetExt || pExt === targetExt)) return true;
    }
    if (pin.id === targetRaw && !targetExt) return true;
    return false;
};

export class SutramAppShell extends SutramElement {
    static properties = {
        variant: { type: String, reflect: true },
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
        /* Top 4px Viewport Position Bar */
        .position-bar {
            display: flex;
            width: 100%;
            height: 4px;
            flex-shrink: 0;
            background: var(--border-dim, rgba(255, 255, 255, 0.06));
            z-index: 120;
            cursor: pointer;
            touch-action: none;
            user-select: none;
            overflow: hidden;
        }
        .position-bar-segment {
            height: 100%;
            background: transparent;
            border-right: 1px solid var(--border);
            box-sizing: border-box;
            transition: background 0.2s ease, opacity 0.2s ease;
        }
        .position-bar-segment:last-child {
            border-right: none;
        }
        .position-bar-segment.on-screen {
            background: var(--seg-intent, var(--intent-primary));
        }
        :host-context([data-theme="e-ink"]) .position-bar {
            background: var(--bg, #ffffff);
            border-bottom: 1px solid var(--border, #000000);
        }
        :host-context([data-theme="e-ink"]) .position-bar-segment.on-screen {
            background: var(--text, #000000);
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
        .spatial-col.is-focused {
            z-index: 10;
        }
        .spatial-col.is-focused .col-header {
            background: color-mix(in srgb, var(--active-sub-intent, var(--intent-primary)) var(--header-bg-mix, 20%), var(--bg-deep));
        }
        .col-header {
            display: flex;
            align-items: stretch !important;
            height: var(--yv-header-height, 44px);
            min-height: 44px;
            background: var(--bg-deep);
            border-bottom: 1px solid var(--border);
            padding: 0;
            flex-shrink: 0;
            position: relative;
            z-index: 100;
            overflow: visible !important;
            touch-action: none;
            user-select: none;
            box-sizing: border-box;
        }
        .col-tabs-area {
            flex: 1 1 0%;
            min-width: 0;
            height: 100%;
            display: flex;
            align-items: stretch;
            overflow: hidden;
        }
        .active-tab-dropdown {
            display: inline-flex;
            align-items: stretch;
            height: 100%;
            min-width: 44px;
            max-width: 100%;
            flex: 0 1 auto;
            overflow: hidden;
        }
        .active-tab-trigger {
            touch-action: none;
            user-select: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 100%;
            min-height: 44px;
            min-width: 44px;
            max-width: 100%;
            padding: 0 12px;
            margin: 0;
            border: none;
            border-bottom: 2px solid var(--active-sub-intent, var(--intent-primary));
            border-radius: 0;
            background: color-mix(in srgb, var(--active-sub-intent, var(--intent-primary)) 18%, transparent);
            color: color-mix(in srgb, var(--active-sub-intent, var(--intent-primary)) 28%, var(--text));
            font-size: 0.9rem;
            font-weight: 700;
            cursor: pointer;
            box-sizing: border-box;
            overflow: hidden;
            transition: background 0.15s ease, color 0.15s ease;
        }
        .active-tab-trigger:hover {
            background: color-mix(in srgb, var(--active-sub-intent, var(--intent-primary)) 28%, var(--bg-hover));
        }
        :host-context([data-theme="e-ink"]) .active-tab-trigger {
            background: transparent;
            color: var(--text);
        }
        .active-tab-label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
        }
        .inline-tab-btn {
            touch-action: none;
            user-select: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 100%;
            min-height: 44px;
            min-width: 44px;
            padding: 0 10px;
            margin: 0;
            border: none;
            border-bottom: 2px solid transparent;
            border-radius: 0;
            background: transparent;
            color: var(--text-muted);
            font-size: 0.85rem;
            font-weight: 500;
            white-space: nowrap;
            cursor: pointer;
            flex-shrink: 0;
            box-sizing: border-box;
            transition: color 0.15s ease, background 0.15s ease;
        }
        .inline-tab-btn:hover {
            color: var(--text);
            background: var(--bg-hover);
        }
        .active-tab-trigger sutram-icon,
        .inline-tab-btn sutram-icon {
            flex-shrink: 0;
        }
        .col-globals-rail {
            display: flex;
            align-items: stretch;
            height: 100%;
            flex-shrink: 0;
            margin-left: auto;
        }
        /* A <slot> has no child nodes of its own, so :empty would hide what is assigned to it.
           Left at its default display: contents, it takes no space when nothing is pinned. */
        .projection-mount-slot > * {
            flex: 1;
            min-height: 0;
            min-width: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        }
    `];
    constructor() {
        super();
        this._layoutConfig = [];
        this._projectionPool = new SutramProjectionPool();
        this.variant = 'standard';
        this._spatialState = { capacity: 3, focusedColumn: 'center', mobileViewportIndex: 1, layoutRatios: null, columns: { left: { pinned: [] }, center: { pinned: [] }, right: { pinned: [] } } };
        this._colTabsWidths = { left: 0, center: 0, right: 0 };
        this._inlineTabClampCounts = { left: null, center: null, right: null };
        this._lastRenderedInlineCounts = { left: 0, center: 0, right: 0 };
        this._lastInlineClampKeys = { left: '', center: '', right: '' };
    }
    _safeEvict(id, executeEvict) {
        const registry = window.ExtensionRegistry || ExtensionRegistry;
        const isDirty = registry?.executeUIHook ? registry.executeUIHook('sutram:is-projection-dirty', id) : false;
        if (isDirty) {
            if (!confirm(`You have unsaved changes in ${id.split('/').pop()}.\n\nClick OK to discard changes and close, or Cancel to abort.`)) {
                return;
            }
        }
        executeEvict();
    }

    // --- PointerEvent Drag & Drop Mechanics ---
    _activateDrag() {
        if (this._dotDragController) this._dotDragController.abort();
        if (this._dragController && this._dragController._dragTimer) { 
            clearTimeout(this._dragController._dragTimer); 
            this._dragController._dragTimer = null; 
        }
        if (this._dragState && this._dragController) {
            if (this._dragController.currentX !== undefined && !isNaN(this._dragController.currentX)) {
                this._dragState.currentX = this._dragController.currentX;
            }
            if (this._dragController.currentY !== undefined && !isNaN(this._dragController.currentY)) {
                this._dragState.currentY = this._dragController.currentY;
            }
        }
        this._dragState.active = true;
        if (this.shadowRoot) {
            this.shadowRoot.querySelectorAll('.active-tab-dropdown').forEach(dd => {
                if (dd.open) dd.open = false;
            });
        }
        this.requestUpdate();
        if (navigator.vibrate) navigator.vibrate(50);
    }
    _handlePointerDown(e, entity, sourceCol, originType = 'subtab') {
        let sourceRect = null;
        const trackEl = this.shadowRoot.querySelector('.spatial-track');
        const trackRect = trackEl ? trackEl.getBoundingClientRect() : { top: 4, height: window.innerHeight - 34 };

        if (sourceCol === 'window') {
            const path = e.composedPath();
            const winNode = path.find(n => n.tagName && n.tagName.toLowerCase() === 'sutram-window');
            if (winNode && winNode.parentElement) {
                const r = winNode.parentElement.getBoundingClientRect();
                sourceRect = { left: r.left, top: r.top, width: r.width, height: r.height };
            }
        } else if (sourceCol) {
            const colNode = this.shadowRoot.querySelector(`.spatial-col[data-col-id="${sourceCol}"]`);
            if (colNode) {
                const r = colNode.getBoundingClientRect();
                sourceRect = { left: r.left, top: r.top, width: r.width, height: r.height };
            }
        }
        if (!sourceRect) {
            sourceRect = { left: 0, top: trackRect.top, width: window.innerWidth, height: trackRect.height };
        }

        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

        this._dragState = { active: false, entity, sourceCol, currentZone: null, startX: clientX, startY: clientY, currentX: clientX, currentY: clientY, originType, sourceRect };

        if (!this._dragController) {
            this._dragController = new YenvuiGestureController(this, {
                longPressDelay: 500,
                onLongPress: (lx, ly) => {
                    if (this._dragState) {
                        if (lx !== undefined && !isNaN(lx)) this._dragState.currentX = lx;
                        if (ly !== undefined && !isNaN(ly)) this._dragState.currentY = ly;
                    }
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
                            } else if (targetZone === 'popout') {
                                const targetCol = (sourceCol && sourceCol !== 'window') ? sourceCol : (layout.focusedColumn || 'center');
                                layout.popoutProjection(entity.id, { originCol: targetCol });
                            } else if (targetZone === 'window' || targetZone === 'mode-window') {
                                const targetAnchor = (sourceCol && sourceCol !== 'window') ? sourceCol : (entity.anchorCol || layout.focusedColumn || 'center');
                                if (sourceCol && sourceCol !== 'window') layout.unpinFromColumn(sourceCol, entity.id);
                                layout.openWindow(entity, targetAnchor, 1);
                            } else if (targetZone === 'mode-tab' && !entity?.windowOnly) {
                                const destCol = (sourceCol && sourceCol !== 'window') ? sourceCol : (entity.anchorCol || layout.focusedColumn || 'center');
                                if (sourceCol === 'window') layout.closeWindow(entity.id);
                                if (!layout.columns[destCol]?.pinned?.some(p => p.id === entity.id)) {
                                    layout.pinToColumn(destCol, entity);
                                }
                                layout.setActiveProjection(destCol, entity.id);
                                layout.setFocusedColumn(destCol);
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
        if (this._tabsAreaObserver) {
            this._tabsAreaObserver.disconnect();
            this._tabsAreaObserver = null;
        }

        [this._dragController, this._dotDragController].forEach(ctrl => {
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
        if (typeof ResizeObserver !== 'undefined') {
            if (!this._tabsAreaObserver) {
                this._tabsAreaObserver = new ResizeObserver((entries) => {
                    let changed = false;
                    const nextWidths = { ...this._colTabsWidths };
                    const nextClamps = { ...this._inlineTabClampCounts };
                    entries.forEach(entry => {
                        const colId = entry.target?.dataset?.colTabs;
                        const w = entry.contentRect ? entry.contentRect.width : entry.target.clientWidth;
                        if (colId && w > 0 && Math.abs((nextWidths[colId] || 0) - w) > 2) {
                            nextWidths[colId] = w;
                            nextClamps[colId] = null;
                            changed = true;
                        }
                    });
                    if (changed) {
                        this._colTabsWidths = nextWidths;
                        this._inlineTabClampCounts = nextClamps;
                        this.requestUpdate();
                    }
                });
            }
            this.shadowRoot.querySelectorAll('.col-tabs-area').forEach(el => {
                this._tabsAreaObserver.observe(el);
                const colId = el.dataset?.colTabs;
                if (colId && el.clientWidth > 0 && !this._colTabsWidths[colId]) {
                    this._colTabsWidths = { ...this._colTabsWidths, [colId]: el.clientWidth };
                }
            });
        }
        this._checkInlineTabsOverflow();
    }
    _checkInlineTabsOverflow() {
        if (!this.shadowRoot) return;
        let clampedAny = false;
        const nextClamps = { ...this._inlineTabClampCounts };
        this.shadowRoot.querySelectorAll('.col-tabs-area').forEach(areaEl => {
            const colId = areaEl.dataset?.colTabs;
            if (!colId || areaEl.clientWidth <= 0) return;
            const renderedCount = this._lastRenderedInlineCounts?.[colId] || 0;
            if (renderedCount > 0 && areaEl.scrollWidth > areaEl.clientWidth + 1) {
                nextClamps[colId] = renderedCount - 1;
                clampedAny = true;
            }
        });
        if (clampedAny) {
            this._inlineTabClampCounts = nextClamps;
            this.requestUpdate();
        }
    }
    _isProjectionDirty(subId) {
        const registry = window.ExtensionRegistry || ExtensionRegistry;
        return Boolean(subId && registry?.executeUIHook && registry.executeUIHook('sutram:is-projection-dirty', subId));
    }
    _formatTabLabel(sub) {
        if (!sub) return '';
        return `${sub.label}${this._isProjectionDirty(sub.id) ? '*' : ''}`;
    }
    connectedCallback() {
        try {
        super.connectedCallback();
        this.setAttribute('data-spatial-boundary', '');
        // Ensure Tier 0 viewport gesture & edge-swipe shield is active
        YenvuiViewportGuard.install();
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
            this.registerGlobalListener('sutram-extension-unloaded', window, (e) => {
                const unloadedExt = e.detail?.extName;
                if (unloadedExt) {
                    this._projectionPool.evictExtension(unloadedExt);
                }
                this.requestUpdate();
            });
            this.registerGlobalListener('sutram-rekey-projection', window, (e) => {
                const { oldId, newId } = e.detail || {};
                if (!oldId || !newId) return;
                this._projectionPool.rekey(oldId, newId);
                const decodedHash = decodeURIComponent(window.location.hash || '');
                if (decodedHash.includes(oldId)) {
                    const st = LayoutStore.getState();
                    const focused = st.focusedColumn || 'center';
                    if (this.variant === 'popout') {
                        const updatedHash = window.location.hash
                            .replace(encodeURIComponent(oldId), encodeURIComponent(newId))
                            .replace(oldId, newId);
                        if (updatedHash !== window.location.hash) {
                            window.history.replaceState(null, '', updatedHash);
                        }
                    } else if (st.columns?.[focused]?.active === newId) {
                        this._updateUrlHash(focused, newId);
                    }
                }
                this.requestUpdate();
            });
            const syncViewportCapacity = () => {
                const width = window.innerWidth;
                const maxCapacity = Math.min(3, Math.max(1, Math.floor(width / SUTRAM_COLUMN_UNIT_PX)));
                const storeState = LayoutStore.getState();
                if (storeState) {
                    const currentCap = storeState.capacity || 3;
                    const desiredCap = storeState.userCapacity || 3;
                    const targetCap = Math.min(desiredCap, maxCapacity);
                    const colMap = { 'left': 0, 'center': 1, 'right': 2 };
                    if (currentCap !== targetCap && typeof storeState.setCapacity === 'function') {
                        storeState.setCapacity(targetCap);
                    }
                    if ((maxCapacity === 1 || storeState.capacity === 1) && storeState.focusedColumn) {
                        const expectedIdx = colMap[storeState.focusedColumn] ?? 1;
                        if (storeState.mobileViewportIndex !== expectedIdx) {
                            storeState.setMobileViewport(expectedIdx);
                        }
                    } else if (maxCapacity === 2 && storeState.focusedColumn && currentCap !== maxCapacity) {
                        const targetIdx = colMap[storeState.focusedColumn] ?? 1;
                        const maxVpIdx = Math.max(0, (storeState.layoutRatios || [1, 1, 1]).length - maxCapacity);
                        const newViewport = targetIdx === 0 ? 0 : (targetIdx === 2 ? maxVpIdx : Math.min(storeState.mobileViewportIndex ?? 0, maxVpIdx));
                        storeState.setMobileViewport(newViewport);
                    }

                    // Enforce window visibility bounds on resize
                    const effectiveCap = Math.min(storeState.capacity || maxCapacity, maxCapacity);
                    const windows = storeState.windows || [];
                    windows.forEach(win => {
                        let newSpan = Math.min(win.span || 1, effectiveCap);
                        let newAnchor = win.anchorCol || 'center';
                        if (effectiveCap === 1) {
                            newSpan = 1;
                            newAnchor = storeState.focusedColumn || 'center';
                        } else if (effectiveCap === 2) {
                            if (newAnchor === 'right') {
                                newAnchor = newSpan === 2 ? 'left' : 'center';
                            }
                        }

                        if (newSpan !== win.span || newAnchor !== win.anchorCol) {
                            storeState.updateWindowConstraints(win.id, newAnchor, newSpan);
                        }
                    });
                }
            };
            this._handleResize = debounce(syncViewportCapacity, 100);
            window.addEventListener('resize', this._handleResize);
            this.registerGlobalListener('sutram:scope-transition-end', window, () => {
                syncViewportCapacity();
            });
            syncViewportCapacity();
        }
        // Break synchronous infinite loops by debouncing the layout compilation listener
        this._debouncedCompile = debounce(() => this._compileLayout(), 50);
        this.registerGlobalListener('sutram-layout-recompile', window, this._debouncedCompile);
        this.registerGlobalListener('sutram:scope-transition-start', window, () => {
            if (this._debouncedCompile && typeof this._debouncedCompile.cancel === 'function') {
                this._debouncedCompile.cancel();
            }
        });

        this._compileLayout();
        } catch(err) { console.error("[Telemetry] AppShell connectedCallback error:", err); }
    }
    _compileLayout() {
        try {
            this._layoutConfig = SutramProjectionCompiler.getCompiledLayout();
            // Ghost Projection Cleanup & Legacy ID Migration
            const layoutStore = window.Sutram?.stores?.Layout;
            const registry = window.ExtensionRegistry || ExtensionRegistry;
            const storeRegistry = window.Sutram?.storeRegistry || StoreRegistry;
            const isSwapping = Boolean(
                (storeRegistry && typeof storeRegistry.isTransitioning === 'function' && storeRegistry.isTransitioning()) ||
                (registry?.executeUIHook
                    ? (registry.executeUIHook('sutram:is-swapping-scope') || registry.executeUIHook('sutram:is-swapping-workspace'))
                    : false)
            );
            if (layoutStore && !registry.isBooting && !isSwapping) {
                const state = layoutStore.getState();
                let changed = false;
                const migrationMap = {};
                const newCols = { ...state.columns };
                const isExtActive = (extName) => typeof registry._filterPredicate === 'function' ? registry._filterPredicate(extName) : true;
                const subSlots = this._layoutConfig.filter(s => s.slot === 'slots:sub-navigation');

                ['left', 'center', 'right'].forEach(col => {
                    if (!newCols[col] || !newCols[col].pinned) return;
                    const validPins = newCols[col].pinned
                        .filter(p => !p.extName || isExtActive(p.extName))
                        .map(p => {
                            const slotDef = subSlots.find(s => pinMatchesSlot(p, s));

                            if (slotDef) {
                                if (p.id !== slotDef.id) {
                                    migrationMap[p.id] = slotDef.id;
                                    changed = true;
                                }
                                const needsMetadataSync = slotDef.icon !== p.icon || slotDef.label !== p.label || slotDef.intent !== p.intent || slotDef.rawId !== p.rawId || p.id !== slotDef.id;
                                if (needsMetadataSync) {
                                    changed = true;
                                    return {
                                        ...p,
                                        id: slotDef.id,
                                        rawId: slotDef.rawId || slotDef.id,
                                        extName: slotDef.extName,
                                        icon: slotDef.icon || p.icon,
                                        label: slotDef.label || p.label,
                                        intent: slotDef.intent || p.intent
                                    };
                                }
                            }
                            return p;
                        });

                    if (validPins.length !== newCols[col].pinned.length || changed) {
                        newCols[col] = { ...newCols[col], pinned: validPins };
                        if (newCols[col].active && migrationMap[newCols[col].active]) {
                            newCols[col].active = migrationMap[newCols[col].active];
                            changed = true;
                        } else if (newCols[col].active && !validPins.some(p => pinMatchesSlot(p, newCols[col].active))) {
                            newCols[col].active = validPins.length > 0 ? validPins[0].id : null;
                            changed = true;
                        }
                        if (Array.isArray(newCols[col].history)) {
                            newCols[col].history = newCols[col].history.map(h => migrationMap[h] || h);
                        }
                    }
                });
                const rawWindows = state.windows || [];
                const activeWindows = rawWindows.filter(w => !w.extName || isExtActive(w.extName));
                if (activeWindows.length !== rawWindows.length) {
                    changed = true;
                }
                let newWindows = activeWindows.map(w => {
                    const slotDef = subSlots.find(s => s.id === w.id || (w.extName && s.extName === w.extName && s.rawId === w.id));
                    if (slotDef && w.id !== slotDef.id) {
                        migrationMap[w.id] = slotDef.id;
                        changed = true;
                        return { ...w, id: slotDef.id, rawId: slotDef.rawId, extName: slotDef.extName, icon: slotDef.icon || w.icon, label: slotDef.label || w.label };
                    }
                    return w;
                });

                let newFocusHistory = (state.focusHistory || []).map(f => {
                    if (f && f.id && migrationMap[f.id]) {
                        changed = true;
                        return { ...f, id: migrationMap[f.id] };
                    }
                    return f;
                });

                if (changed) {
                    layoutStore.setState({
                        columns: newCols,
                        windows: newWindows,
                        focusHistory: newFocusHistory
                    });
                    if (Object.keys(migrationMap).length > 0) {
                        window.dispatchEvent(new CustomEvent('sutram-projections-migrated', {
                            detail: { migrationMap },
                            bubbles: true,
                            composed: true
                        }));
                    }
                }
            }

            this.requestUpdate();
        } catch(err) { console.error("[Telemetry] AppShell _compileLayout error:", err); }
    }
    _buildColumnTabDropdownItems(col, colSubSlots, activeSubInCol, primarySlots, subSlots) {
        const items = [];

        if (colSubSlots.length > 0) {
            items.push({
                sectionHeading: 'Open in this column',
                sectionSlug: '',
                pinnedTop: true,
                dividerAfter: false
            });
            colSubSlots.forEach(sub => {
                const isActive = Boolean(activeSubInCol && pinMatchesSlot(sub, activeSubInCol.id));
                const sourceCol = sub.actualSourceCol || col.id;
                items.push({
                    id: `open:${sub.id}`,
                    label: this._formatTabLabel(sub),
                    icon: sub.icon || 'component',
                    intent: sub.intent || 'primary',
                    checkable: true,
                    checked: isActive,
                    section: 'Open in this column',
                    onPointerDown: (e) => {
                        this._handlePointerDown(e, sub, sourceCol, 'dropdown');
                    },
                    onClick: () => {
                        this._handleSubTabClick(sub.id);
                    },
                    trailingButton: {
                        icon: 'x',
                        title: `Close ${sub.label}`,
                        closeMenu: false,
                        onClick: () => {
                            this._safeEvict(sub.id, () => {
                                const layout = window.Sutram?.stores?.Layout?.getState();
                                if (!layout) return;
                                layout.unpinFromColumn(sourceCol, sub.id);
                                layout.evictProjection(sub.id);
                                const updated = window.Sutram.stores.Layout.getState();
                                const nextCol = updated.focusedColumn || sourceCol || 'center';
                                const nextActive = updated.columns[nextCol]?.active || '';
                                this._updateUrlHash(nextCol, nextActive);
                                this.requestUpdate();
                            });
                        }
                    }
                });
            });
        }

        const colIconMap = { left: 'chevron-left', center: 'dot', right: 'chevron-right' };
        const colTitleMap = { left: 'Open in Left column', center: 'Open in Center column', right: 'Open in Right column' };
        primarySlots.forEach(tab => {
            const children = subSlots.filter(s => (s.targetParent || '').toLowerCase() === (tab.id || '').toLowerCase());
            if (children.length === 0) return;
            const sectionTitle = `Add a tab · ${tab.label}`;
            const catIntent = tab.intent || children[0]?.intent || '';
            items.push({ sectionHeading: sectionTitle, sectionSlug: tab.label, sectionIcon: tab.icon || 'folder', sectionIntent: catIntent });
            children.forEach(child => {
                let existingCol = null;
                if (this._spatialState && this._spatialState.columns) {
                    for (const colId of ['left', 'center', 'right']) {
                        if (this._spatialState.columns[colId]?.pinned?.some(p => pinMatchesSlot(p, child))) {
                            existingCol = colId;
                            break;
                        }
                    }
                }
                items.push({
                    id: `add:${child.id}`,
                    label: child.label,
                    icon: child.icon || 'puzzle',
                    intent: child.intent || tab.intent || 'primary',
                    badgeIcon: existingCol ? (colIconMap[existingCol] || '') : '',
                    badgeTitle: existingCol ? (colTitleMap[existingCol] || existingCol) : '',
                    section: sectionTitle,
                    onPointerDown: (e) => {
                        const layoutState = window.Sutram?.stores?.Layout?.getState();
                        let existingColDown = null;
                        if (layoutState && layoutState.columns) {
                            for (const colId of ['left', 'center', 'right']) {
                                if (layoutState.columns[colId]?.pinned?.some(p => pinMatchesSlot(p, child))) {
                                    existingColDown = colId;
                                    break;
                                }
                            }
                        }
                        this._handlePointerDown(e, child, existingColDown, 'dropdown');
                    },
                    onClick: () => {
                        const layoutState = window.Sutram?.stores?.Layout?.getState();
                        let existingColClick = null;
                        let existingPin = null;
                        if (layoutState && layoutState.columns) {
                            for (const colId of ['left', 'center', 'right']) {
                                existingPin = layoutState.columns[colId]?.pinned?.find(p => pinMatchesSlot(p, child));
                                if (existingPin) {
                                    existingColClick = colId;
                                    break;
                                }
                            }
                        }
                        if (existingColClick) {
                            this._handleSubTabClick(existingPin ? existingPin.id : child.id);
                            return;
                        }
                        const targetCol = col.id || child.preferredColumn || 'center';
                        if (layoutState) {
                            layoutState.pinToColumn(targetCol, child);
                            layoutState.setActiveProjection(targetCol, child.id);
                            layoutState.setFocusedColumn(targetCol);
                            const colIndexes = { left: 0, center: 1, right: 2 };
                            if (this._spatialState?.capacity === 1) {
                                this._setViewportIndex(colIndexes[targetCol]);
                            }
                        }
                        this.requestUpdate();
                        this._updateUrlHash(targetCol, child.id);
                    }
                });
            });
        });

        return items;
    }
    _updateUrlHash(colId, subId) {
        const registry = window.ExtensionRegistry || ExtensionRegistry;
        const customHash = registry?.executeUIHook
            ? registry.executeUIHook('sutram:resolve-route-hash', { colId, subId })
            : null;
        const fallbackScope = window.location.hash.replace(/^#\/?/, '').split('/')[0] || 'default';
        const hash = customHash || `#/${fallbackScope}/${colId}/${encodeURIComponent(subId)}`;
        if (window.location.hash !== hash) {
            window.history.replaceState(null, '', hash);
        }
    }
    _handleSubTabClick(subId) {
        let targetCol = null;
        let isAlreadyActive = false;
        let matchedPinId = subId;

        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            for (const col of ['left', 'center', 'right']) {
                const foundPin = layout.columns[col]?.pinned.find(p => pinMatchesSlot(p, subId));
                if (foundPin) {
                    targetCol = col;
                    matchedPinId = foundPin.id;
                    break;
                }
            }
            if (targetCol) {
                const wasFocusedCol = !layout.focusedColumn || layout.focusedColumn === targetCol;
                isAlreadyActive = wasFocusedCol && layout.columns[targetCol].active === matchedPinId;
                layout.setActiveProjection(targetCol, matchedPinId);
                layout.setFocusedColumn(targetCol);
                const colIndexes = { 'left': 0, 'center': 1, 'right': 2 };
                if (this._spatialState?.capacity === 1) {
                    this._setViewportIndex(colIndexes[targetCol]);
                }
            }
        }

        if (isAlreadyActive) {
            this.refreshProjection(matchedPinId);
        }

        this.requestUpdate();
        if (targetCol) this._updateUrlHash(targetCol, matchedPinId);
    }
    refreshProjection(subId, targetParent = null, emitFallback = true) {
        if (!subId) return;
        const node = this.shadowRoot?.querySelector(`[data-sub-id="${subId}"]`);
        if (node && typeof node.onForceRefresh === 'function') {
            return node.onForceRefresh();
        }
        if (emitFallback) {
            window.dispatchEvent(new CustomEvent('sutram:force-refresh', {
                detail: { parentId: targetParent, subId },
                bubbles: true,
                composed: true
            }));
        }
    }
    _isHeaderBarSurfaceEvent(e) {
        if (!e || !e.currentTarget) return false;
        const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
        for (const el of path) {
            if (el === e.currentTarget) break;
            if (!el) continue;
            if (el.hasAttribute && el.hasAttribute('popover')) return false;
            if (el.classList && (el.classList.contains('dropdown-menu') || el.classList.contains('tray-panel') || el.classList.contains('tray-overlay') || el.classList.contains('panel'))) return false;
            const tag = el.tagName ? el.tagName.toLowerCase() : '';
            if (tag === 'sutram-modal' || tag === 'yenvui-modal') return false;
        }
        const rect = e.currentTarget.getBoundingClientRect?.();
        const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : null);
        if (rect && rect.height > 0 && clientY !== null && (clientY < rect.top - 6 || clientY > rect.bottom + 6)) return false;
        return true;
    }
    _handleDotDragStart(e) {
        if (!this._dotDragController) {
            this._dotDragController = new YenvuiGestureController(this, {
                lockAxis: 'horizontal',
                onPanStart: () => {
                    this._isPanningTrack = false;
                },
                onPanMove: (x, y, axis) => {
                    if (axis !== 'horizontal') return;
                    const track = this.shadowRoot?.querySelector('.spatial-track');
                    if (!this._isPanningTrack) {
                        this._isPanningTrack = true;
                        if (track) track.style.transition = 'none';
                        if (this.shadowRoot) {
                            this.shadowRoot.querySelectorAll('.active-tab-dropdown').forEach(dd => {
                                if (dd.open) dd.open = false;
                            });
                        }
                    }
                    const deltaX = x - this._dotDragController.startX;
                    const currentIdx = this._spatialState?.mobileViewportIndex ?? 1;
                    const capacity = this._spatialState?.capacity || 3;
                    const layoutRatios = this._spatialState?.layoutRatios || [1, 1, 1];
                    const metrics = getSpatialMetrics(capacity, currentIdx, layoutRatios);
                    const baseOffset = parseFloat(metrics.getTrackOffset());

                    if (track) {
                        let dragOffset = deltaX;
                        const maxIdx = Math.max(0, layoutRatios.length - capacity);
                        const minOffsetStr = getSpatialMetrics(capacity, maxIdx, layoutRatios).getTrackOffset();
                        const minOffset = parseFloat(minOffsetStr);
                        const maxOffset = 0;

                        if ((baseOffset <= minOffset && deltaX < 0) || (baseOffset >= maxOffset && deltaX > 0)) {
                            dragOffset = deltaX * 0.2;
                        }
                        track.style.transform = `translateX(calc(${baseOffset}% + ${dragOffset}px))`;
                    }
                },
                onPanEnd: (endX, endY, axis) => {
                    if (!this._isPanningTrack) return;
                    const track = this.shadowRoot?.querySelector('.spatial-track');
                    if (track) track.style.transition = '';
                    this._isPanningTrack = false;

                    if (axis === 'horizontal') {
                        const deltaX = endX - this._dotDragController.startX;
                        const threshold = Math.min(110, Math.max(48, (window.innerWidth || 360) * 0.18));
                        const current = this._spatialState?.mobileViewportIndex ?? 1;
                        const capacity = this._spatialState?.capacity || 3;
                        const layoutRatios = this._spatialState?.layoutRatios || [1, 1, 1];
                        const maxIdx = Math.max(0, layoutRatios.length - capacity);

                        let newIdx = current;
                        if (deltaX > threshold) newIdx = Math.max(0, current - 1);
                        else if (deltaX < -threshold) newIdx = Math.min(maxIdx, current + 1);

                        if (newIdx !== current) {
                            this._setViewportIndex(newIdx);
                        } else {
                            const metrics = getSpatialMetrics(capacity, newIdx, layoutRatios);
                            if (track) track.style.transform = `translateX(${metrics.getTrackOffset()})`;
                            this.requestUpdate();
                        }
                    } else {
                        this.requestUpdate();
                    }
                }
            });
        }
        this._dotDragController.start(e, { lockAxis: 'horizontal' });
    }

    _setViewportIndex(index) {
        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            layout.setMobileViewport(index);
            const cols = ['left', 'center', 'right'];
            const targetCol = cols[index];
            if (targetCol) {
                layout.setFocusedColumn(targetCol);
                const activeInCol = layout.columns?.[targetCol]?.active || layout.columns?.[targetCol]?.pinned?.[0]?.id || '';
                if (activeInCol) this._updateUrlHash(targetCol, activeInCol);
            }
        }
    }
    render() {
        try {
        this._projectionPool.beginPass();
        const getDynamicNode = (componentTag, subId = null, props = null) =>
            this._projectionPool.resolve(componentTag, subId, props);

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
        const safeViewport = Math.max(0, Math.min(mobileViewportIndex, layoutRatios.length - capacity));
        const lastVisibleColIdx = Math.min(colDefinitions.length - 1, safeViewport + capacity - 1);
        const showPositionBar = capacity < layoutRatios.length;
        // Apply viewport to the host to ensure child elements correctly execute :host-context CSS rules
        this.dataset.viewport = viewportMode;

        // GC: Overwrite the active nodes map with only the nodes requested during this render cycle
        // Detached nodes will fall out of scope and be collected by the browser.
        const isPopout = this.variant === 'popout';
        if (isPopout) {
            const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '') : '';
            const hashParts = hash ? hash.split('/').map(decodeURIComponent) : [];
            let activeId = '';
            if (hashParts.length >= 4 && hashParts[2] === 'editor') {
                activeId = hashParts.slice(3).join('/');
            } else if (hashParts.length >= 3) {
                activeId = hashParts.slice(2).join('/');
            }

            const focusedCol = this._spatialState?.focusedColumn || 'center';
            const colState = this._spatialState?.columns?.[focusedCol];
            activeId = activeId || colState?.active || (colState?.pinned?.[0]?.id);
            let activeSlot = subSlots.find(s => s.id === activeId || (!activeId.includes(':') && s.rawId === activeId));
            let singleNode = null;

            if (activeSlot) {
                if (activeSlot.allow_popout) {
                    singleNode = getDynamicNode(activeSlot.component, activeSlot.id);
                } else {
                    singleNode = html`
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; padding: 40px; text-align: center; color: var(--text-muted); box-sizing: border-box; font-family: var(--font-mono, monospace);">
                            <sutram-icon name="alert-triangle" size="xl" intent="warning"></sutram-icon>
                            <h3 style="margin: 8px 0 0 0; color: var(--text); font-size: 1.1rem;">Unsupported Pop-Out View</h3>
                            <p style="margin: 0; max-width: 440px; font-size: 0.85rem; line-height: 1.5;">The projection <strong>${activeSlot.label || activeSlot.id}</strong> is not permitted to run in an ephemeral pop-out window.</p>
                        </div>
                    `;
                }
            } else if (activeId) {
                const customEditor = typeof registry.resolveCustomEditor === 'function'
                    ? registry.resolveCustomEditor(activeId)
                    : null;
                const hookComponent = registry?.executeUIHook
                    ? registry.executeUIHook('sutram:resolve-editor-component', activeId)
                    : null;
                const targetComponent = customEditor?.component || hookComponent || 'sutram-editor';
                singleNode = getDynamicNode(targetComponent, activeId);
            }

            const popoutHtml = html`
                <div class="shell-container" style="flex: 1; display: flex; flex-direction: column; height: 100%; width: 100%; min-height: 0; overflow: hidden; background: var(--bg);">
                    <div class="projection-mount-slot" style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                        ${singleNode || html`<div style="padding: 20px; color: var(--text-muted); font-style: italic;">Loading pop-out view...</div>`}
                    </div>
                </div>
                <!-- Global / Transient Overlays -->
                <div style="display: contents;">
                    ${globalSlots.map(s => getDynamicNode(s.component))}
                </div>
            `;
            this._projectionPool.commitPass();
            return popoutHtml;
        }

        const finalHtml = html`
            <div class="shell-container spatial-viewport" data-viewport="${viewportMode}">
                ${showPositionBar ? html`
                    <div class="position-bar" @pointerdown=${(e) => this._handleDotDragStart(e)}>
                        ${layoutRatios.map((ratio, segIdx) => {
                            const isOnScreen = segIdx >= safeViewport && segIdx < safeViewport + capacity;
                            const targetViewport = Math.max(0, Math.min(segIdx, layoutRatios.length - capacity));
                            const colId = colDefinitions[segIdx]?.id || 'center';
                            const colPins = this._spatialState?.columns?.[colId]?.pinned || [];
                            const colActId = this._spatialState?.columns?.[colId]?.active;
                            const colActPin = colPins.find(p => pinMatchesSlot(p, colActId)) || colPins[0];
                            const colSlotDef = colActPin ? subSlots.find(s => pinMatchesSlot(colActPin, s)) : null;
                            const segIntent = colSlotDef?.intent || colActPin?.intent || 'primary';
                            return html`
                                <div
                                    class="position-bar-segment ${isOnScreen ? 'on-screen' : ''}"
                                    style="flex: ${Number(ratio) || 1} 1 0%; --seg-intent: var(--intent-${segIntent});"
                                    title="${colDefinitions[segIdx]?.label || `Column ${segIdx + 1}`}"
                                    @click=${(e) => {
                                        e.stopPropagation();
                                        if (this._isPanningTrack) return;
                                        this._setViewportIndex(targetViewport);
                                        if (window.Sutram?.stores?.Layout) {
                                            window.Sutram.stores.Layout.getState().setFocusedColumn(colId);
                                        }
                                    }}>
                                </div>
                            `;
                        })}
                    </div>
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
                                const slotDef = subSlots.find(s => pinMatchesSlot(pin, s));
                                colSubSlots.push({
                                    id: slotDef?.id || pin.id,
                                    rawId: slotDef?.rawId || pin.rawId || pin.id,
                                    label: slotDef?.label || pin.label || pin.title || pin.id,
                                    component: slotDef?.component || pin.component,
                                    extName: slotDef?.extName || pin.extName || null,
                                    targetParent: slotDef?.targetParent || pin.targetParent || sourceColId,
                                    preferredColumn: slotDef?.preferredColumn || pin.preferredColumn || sourceColId,
                                    icon: slotDef?.icon || pin.icon,
                                    intent: slotDef?.intent || pin.intent,
                                    bulkActionGroup: slotDef?.bulkActionGroup || pin.bulkActionGroup || null,
                                    bulkEntityTypes: slotDef?.bulkEntityTypes || pin.bulkEntityTypes || null,
                                    menuStores: slotDef?.menuStores || pin.menuStores || null,
                                    menuActions: slotDef?.menuActions || pin.menuActions || null,
                                    headerActionComponent: slotDef?.headerActionComponent || pin.headerActionComponent || null,
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
                        const focusedCol = this._spatialState.focusedColumn;
                        const activeId = this._spatialState.columns[focusedCol]?.active;
                        if (sourceCols.includes(focusedCol)) {
                            activeSubInCol = colSubSlots.find(s => pinMatchesSlot(s, activeId));
                        }
                        if (!activeSubInCol) {
                            for (const sCol of sourceCols) {
                                const colActiveId = this._spatialState.columns[sCol]?.active;
                                activeSubInCol = colSubSlots.find(s => pinMatchesSlot(s, colActiveId));
                                if (activeSubInCol) break;
                            }
                        }
                        if (!activeSubInCol) {
                            activeSubInCol = colSubSlots[0];
                        }
                        const isLastVisibleCol = idx === lastVisibleColIdx;
                        const activeIntent = activeSubInCol?.intent || 'primary';
                        const activeIcon = activeSubInCol?.icon || 'plus';
                        const activeDisplayLabel = activeSubInCol ? this._formatTabLabel(activeSubInCol) : 'Open tab';
                        const tabDropdownItems = this._buildColumnTabDropdownItems(col, colSubSlots, activeSubInCol, primarySlots, subSlots);

                        const otherTabs = activeSubInCol
                            ? colSubSlots.filter(s => !pinMatchesSlot(s, activeSubInCol.id))
                            : [];
                        const tabsAreaWidth = this._colTabsWidths?.[col.id] || 0;
                        const activeDropdownEstWidth = activeSubInCol
                            ? Math.min(200, Math.max(88, activeDisplayLabel.length * 7.5 + 54))
                            : 112;
                        const availForInlineTabs = Math.max(0, tabsAreaWidth - activeDropdownEstWidth - 6);
                        const inlineEstimatedWidths = otherTabs.map(t => Math.max(44, this._formatTabLabel(t).length * 7.5 + 42));
                        const clampKey = `${tabsAreaWidth}:${activeDisplayLabel}:${otherTabs.map(t => `${t.id}:${this._formatTabLabel(t)}`).join(',')}`;
                        if (this._lastInlineClampKeys[col.id] !== clampKey) {
                            this._lastInlineClampKeys[col.id] = clampKey;
                            this._inlineTabClampCounts[col.id] = null;
                        }
                        const estimatedInlineFit = tabsAreaWidth > 0
                            ? computeFitActionCount(availForInlineTabs, inlineEstimatedWidths, 0, 0, false)
                            : 0;
                        const clampVal = this._inlineTabClampCounts?.[col.id];
                        const fitInlineCount = (clampVal !== null && clampVal !== undefined)
                            ? Math.min(estimatedInlineFit, clampVal)
                            : estimatedInlineFit;
                        this._lastRenderedInlineCounts[col.id] = fitInlineCount;
                        const visibleInlineTabs = otherTabs.slice(0, fitInlineCount);

                        const extraViewNodes = [];
                        if (activeSubInCol && activeSubInCol.headerActionComponent) {
                            extraViewNodes.push(getDynamicNode(activeSubInCol.headerActionComponent, activeSubInCol.id));
                        }
                        if (activeSubInCol) {
                            this._layoutConfig
                                .filter(s =>
                                    s.slot === 'slots:sub-navigation-actions' &&
                                    (s.targetSub === activeSubInCol.id || (s.extName === activeSubInCol.extName && (s.targetSub === activeSubInCol.rawId || s.targetSub === `${activeSubInCol.extName}:${activeSubInCol.rawId}`)))
                                )
                                .forEach(act => {
                                    extraViewNodes.push(getDynamicNode(act.component, activeSubInCol.id));
                                });
                        }

                        return html`
                        <div class="spatial-col ${focusedColumn === col.id ? 'is-focused' : ''}" data-col-id="${col.id}" style="--col-width: ${metrics.getColWidth(idx)}; --col-left: ${metrics.getColLeft(idx)};" @click=${(e) => {
                            if (this._isPanningTrack) { e.preventDefault(); e.stopPropagation(); return; }
                            const activeId = activeSubInCol ? activeSubInCol.id : (colSubSlots[0] ? colSubSlots[0].id : null);
                            const targetFocusCol = activeSubInCol ? (activeSubInCol.actualSourceCol || col.id) : col.id;
                            if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().setFocusedColumn(targetFocusCol);
                            if (activeId) this._updateUrlHash(targetFocusCol, activeId);
                        }}>
                            <!-- Unified Single Column Header Row -->
                            <div class="col-header" style="--active-sub-intent: var(--intent-${activeIntent});"
                                @sutram:column-jump=${(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const { colId: jumpColId, colIdx: jumpIdx } = e.detail || {};
                                    const targetVp = Math.max(0, Math.min(Number(jumpIdx) || 0, layoutRatios.length - capacity));
                                    this._setViewportIndex(targetVp);
                                    if (jumpColId && window.Sutram?.stores?.Layout) {
                                        const lSt = window.Sutram.stores.Layout.getState();
                                        lSt.setFocusedColumn(jumpColId);
                                        const actInJumpCol = lSt.columns?.[jumpColId]?.active || lSt.columns?.[jumpColId]?.pinned?.[0]?.id || '';
                                        if (actInJumpCol) this._updateUrlHash(jumpColId, actInJumpCol);
                                    }
                                }}
                                @sutram:force-refresh=${(e) => {
                                    const { subId: refSubId, parentId: refParent } = e.detail || {};
                                    if (!refSubId) return;
                                    const refNode = this.shadowRoot?.querySelector(`[data-sub-id="${refSubId}"]`);
                                    // Not mounted here: let the event reach the host's window listeners instead.
                                    if (!refNode || typeof refNode.onForceRefresh !== 'function') return;
                                    // Handled here: stop it so the host's window listener does not refresh the view a second time.
                                    e.stopPropagation();
                                    const res = this.refreshProjection(refSubId, refParent, false);
                                    if (res && e.detail) e.detail.promise = res;
                                }}
                                @pointerdown=${(e) => {
                                    if (showPositionBar && this._isHeaderBarSurfaceEvent(e)) {
                                        this._handleDotDragStart(e);
                                    }
                                }}>
                                <!-- 1. View Menu (Always First) -->
                                <sutram-subtab-menu
                                    .columnId=${col.id}
                                    .slotConfig=${activeSubInCol}
                                    .extraContentNodes=${extraViewNodes}>
                                </sutram-subtab-menu>

                                <!-- 2. Active Tab Dropdown + 3. Fitted Inline Open Tabs -->
                                <div class="col-tabs-area" data-col-tabs="${col.id}">
                                    <sutram-dropdown
                                        class="active-tab-dropdown"
                                        align="left"
                                        searchable
                                        ?chipRows=${true}
                                        searchPlaceholder="Filter tabs..."
                                        .items=${tabDropdownItems}>
                                        <button
                                            slot="trigger"
                                            type="button"
                                            class="active-tab-trigger"
                                            title=${activeDisplayLabel}
                                            @pointerdown=${(e) => {
                                                const parentDd = e.currentTarget?.closest?.('sutram-dropdown');
                                                if (activeSubInCol && !parentDd?.open) {
                                                    this._handlePointerDown(e, activeSubInCol, activeSubInCol.actualSourceCol || col.id, 'subtab');
                                                }
                                            }}
                                            @click=${() => {
                                                const targetFocusCol = activeSubInCol ? (activeSubInCol.actualSourceCol || col.id) : col.id;
                                                if (window.Sutram?.stores?.Layout) {
                                                    window.Sutram.stores.Layout.getState().setFocusedColumn(targetFocusCol);
                                                }
                                            }}>
                                            <sutram-icon name="${activeIcon}" size="sm" intent="${activeIntent}"></sutram-icon>
                                            <span class="active-tab-label">${activeDisplayLabel}</span>
                                            <sutram-icon name="chevron-down" size="xs"></sutram-icon>
                                        </button>
                                    </sutram-dropdown>

                                    ${visibleInlineTabs.map(sub => {
                                        const subIntent = sub.intent || 'primary';
                                        const subIcon = sub.icon || 'component';
                                        const subLabel = this._formatTabLabel(sub);
                                        return html`
                                            <button
                                                type="button"
                                                class="inline-tab-btn"
                                                title=${subLabel}
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
                                                @click=${(e) => {
                                                    e.stopPropagation();
                                                    if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().setFocusedColumn(sub.actualSourceCol || col.id);
                                                    this._handleSubTabClick(sub.id);
                                                }}>
                                                <sutram-icon name="${subIcon}" size="sm" intent="${subIntent}"></sutram-icon>
                                                <span>${subLabel}</span>
                                            </button>
                                        `;
                                    })}
                                </div>

                                <!-- 4. Globals on the Last Visible Column -->
                                ${isLastVisibleCol ? html`
                                    <div class="col-globals-rail" @click=${(e) => e.stopPropagation()}>
                                        <slot name="header-quickpack"></slot>
                                        <slot name="header-actions-left"></slot>
                                        <slot name="gear-pinned"></slot>
                                        <slot name="header-actions"></slot>
                                    </div>
                                ` : ''}
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${colSubSlots.map(sub => {
                                    const isActive = activeSubInCol && pinMatchesSlot(sub, activeSubInCol.id);
                                    const node = getDynamicNode(sub.component, sub.id);

                                    return html`
                                        <div class="projection-mount-slot" style="display: ${isActive ? 'flex' : 'none'}; flex-direction: column; flex: 1; height: 100%; min-height: 0; overflow: hidden;" data-ext="${sub.extName}" data-offline-mode="${(typeof registry.getExtension === 'function' ? registry.getExtension(sub.extName)?.offline_mode : null) || 'none'}">
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
                                    layout.setActiveProjection(destCol, win.id);
                                    layout.setFocusedColumn(destCol);
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
        this._projectionPool.commitPass();
        return finalHtml;
        } catch(err) {
            console.error("[Telemetry] AppShell render error:", err);
            return html`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><sutram-icon name="alert-triangle" size="lg"></sutram-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${err.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${err.stack}</pre></div>`;
        }
    }
}

customElements.define('sutram-app-shell', SutramAppShell);