// sutram/sutram/js/drag-coordinator.js
import { html, css } from 'lit';
import { SutramElement } from './sutram_sdk.js';
import { DropOverlay, DropTarget } from 'sutram-chassis';
if (!customElements.get('sutram-drop-overlay')) customElements.define('sutram-drop-overlay', class extends DropOverlay {});
if (!customElements.get('sutram-drop-target')) customElements.define('sutram-drop-target', class extends DropTarget {});
export class SutramDragCoordinator extends SutramElement {
    static properties = {
        dragState: { type: Object },
        spatialState: { type: Object },
        _activeMode: { type: String, state: true }
    };

    static styles = css`
        :host {
            display: contents;
        }

        .hud-overlay {
            overflow: hidden;
            background: color-mix(in srgb, var(--bg-deep, #000000) 75%, transparent);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
        }
        .hud-hud-card {
            position: absolute;
            background: color-mix(in srgb, var(--pane-bg) 94%, transparent);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid var(--border);
            padding: 12px 16px 16px 16px;
            box-sizing: border-box;
            box-shadow: var(--overlay-shadow, 0 25px 60px rgba(0, 0, 0, 0.6));
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow-y: auto;
            color: var(--text);
            font-family: inherit;
        }

        .top-anchor-row {
            display: flex;
            justify-content: space-between;
            align-items: stretch;
            width: 100%;
            gap: 12px;
            flex-shrink: 0;
        }

        .top-third-slot {
            width: calc((100% - 24px) / 3);
            display: flex;
        }
        .middle-workspace {
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 520px;
            margin: 22px auto auto auto;
            gap: 14px;
        }

        .mode-switcher-row {
            display: flex;
            width: 100%;
            gap: 12px;
        }

        .mode-switcher-btn {
            flex: 1;
            width: 50%;
            height: 58px;
            border-radius: 10px;
            border: 2px solid var(--border);
            background: var(--input-bg);
            color: var(--text-muted);
            font-weight: 700;
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.15s ease;
            box-sizing: border-box;
        }

        .mode-switcher-btn.active-mode.tab-mode {
            border-color: var(--intent-primary);
            background: color-mix(in srgb, var(--intent-primary) 14%, var(--input-bg));
            color: var(--intent-primary);
        }

        .mode-switcher-btn.active-mode.win-mode {
            border-color: var(--intent-warning);
            background: color-mix(in srgb, var(--intent-warning) 14%, var(--input-bg));
            color: var(--intent-warning);
        }

        .mode-switcher-btn[hovered].tab-mode {
            border-color: var(--intent-primary);
            background: color-mix(in srgb, var(--intent-primary) 28%, var(--input-bg));
            color: var(--intent-primary);
            transform: scale(1.02);
        }

        .mode-switcher-btn[hovered].win-mode {
            border-color: var(--intent-warning);
            background: color-mix(in srgb, var(--intent-warning) 28%, var(--input-bg));
            color: var(--intent-warning);
            transform: scale(1.02);
        }

        .screen-drop-btn {
            flex: 1;
            height: 76px;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: var(--input-bg);
            color: var(--text);
            font-weight: 600;
            font-size: 0.85rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 10px;
            cursor: pointer;
            transition: all 0.15s ease;
            box-sizing: border-box;
        }

        .screen-drop-btn.intent-primary[hovered] {
            border-color: var(--intent-primary);
            background: color-mix(in srgb, var(--intent-primary) 22%, var(--input-bg));
            color: var(--intent-primary);
        }

        .screen-drop-btn.intent-warning[hovered] {
            border-color: var(--intent-warning);
            background: color-mix(in srgb, var(--intent-warning) 22%, var(--input-bg));
            color: var(--intent-warning);
        }

        .bottom-anchor-footer {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            margin-top: auto;
            padding-top: 12px;
            flex-shrink: 0;
        }

        .hud-header-subtitle {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--intent-primary);
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .hud-header-title {
            font-size: 1.2rem;
            font-weight: 700;
            color: var(--intent-highlight);
            margin-top: 4px;
        }

        /* Section Cards */
        .section-box {
            border-radius: 10px;
            padding: 14px;
            margin-bottom: 14px;
            border: 1px solid transparent;
        }

        .section-box.tab-pos {
            border-color: color-mix(in srgb, var(--intent-primary) 30%, transparent);
            background: color-mix(in srgb, var(--intent-primary) 5%, var(--pane-bg));
        }

        .section-box.arrange-tabs {
            border-color: color-mix(in srgb, var(--intent-highlight) 30%, transparent);
            background: color-mix(in srgb, var(--intent-highlight) 5%, var(--pane-bg));
        }

        .section-box.window-pos {
            border-color: color-mix(in srgb, var(--intent-warning) 30%, transparent);
            background: color-mix(in srgb, var(--intent-warning) 5%, var(--pane-bg));
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.8px;
        }

        .section-header.tab-pos { color: var(--intent-primary); }
        .section-header.arrange-tabs { color: var(--intent-highlight); }
        .section-header.window-pos { color: var(--intent-warning); }

        /* Drop Target Buttons */
        .drop-target-btn {
            flex: 1;
            height: 44px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: var(--input-bg);
            color: var(--text);
            font-weight: 500;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 0 10px;
            cursor: pointer;
            transition: all 0.15s ease;
            box-sizing: border-box;
        }

        .drop-target-btn.intent-primary[hovered] {
            border-color: var(--intent-primary);
            background: color-mix(in srgb, var(--intent-primary) 20%, var(--input-bg));
            color: var(--intent-primary);
        }

        .drop-target-btn.intent-highlight[hovered] {
            border-color: var(--intent-highlight);
            background: color-mix(in srgb, var(--intent-highlight) 20%, var(--input-bg));
            color: var(--intent-highlight);
        }

        .drop-target-btn.intent-warning[hovered] {
            border-color: var(--intent-warning);
            background: color-mix(in srgb, var(--intent-warning) 20%, var(--input-bg));
            color: var(--intent-warning);
        }

        .drop-target-btn.intent-danger {
            width: 100%;
            height: 48px;
            border-radius: 10px;
            border-color: color-mix(in srgb, var(--intent-danger) 40%, transparent);
            background: color-mix(in srgb, var(--intent-danger) 10%, var(--input-bg));
            color: var(--intent-danger);
        }

        .drop-target-btn.intent-danger[hovered] {
            border-color: var(--intent-danger);
            background: color-mix(in srgb, var(--intent-danger) 25%, var(--input-bg));
            color: var(--intent-danger);
        }
        /* Floating Drag Node */
        .drag-floater {
            position: fixed;
            left: 0;
            top: 0;
            pointer-events: none;
            background: var(--intent-highlight);
            color: var(--text-light, #ffffff);
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 0.9rem;
            opacity: 0.9;
            box-shadow: var(--overlay-shadow, 0 10px 25px rgba(0, 0, 0, 0.4));
            z-index: 10000;
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 8px;
            will-change: transform;
        }

        /* E-Ink High Contrast Theme Overrides */
        :host-context([data-theme="e-ink"]) .hud-overlay {
            background: var(--modal-backdrop, rgba(255, 255, 255, 0.9)) !important;
            backdrop-filter: none !important;
        }

        :host-context([data-theme="e-ink"]) .hud-hud-card {
            background: var(--bg, #ffffff) !important;
            border: 3px solid var(--border, #000000) !important;
            color: var(--text, #000000) !important;
            box-shadow: 6px 6px 0 var(--border, #000000) !important;
        }

        :host-context([data-theme="e-ink"]) .section-box {
            border: 2px solid var(--border, #000000) !important;
            background: var(--bg, #ffffff) !important;
        }

        :host-context([data-theme="e-ink"]) .section-header,
        :host-context([data-theme="e-ink"]) .hud-header-subtitle,
        :host-context([data-theme="e-ink"]) .hud-header-title {
            color: var(--text, #000000) !important;
            font-weight: 900 !important;
        }
        :host-context([data-theme="e-ink"]) .drop-target-btn,
        :host-context([data-theme="e-ink"]) .mode-switcher-btn,
        :host-context([data-theme="e-ink"]) .screen-drop-btn {
            background: var(--bg, #ffffff) !important;
            border: 2px solid var(--border, #000000) !important;
            color: var(--text, #000000) !important;
            font-weight: 800 !important;
        }

        :host-context([data-theme="e-ink"]) .mode-switcher-btn.active-mode {
            border-style: dashed !important;
            box-shadow: 3px 3px 0 var(--border, #000000) !important;
        }

        :host-context([data-theme="e-ink"]) .drop-target-btn[hovered],
        :host-context([data-theme="e-ink"]) .mode-switcher-btn[hovered],
        :host-context([data-theme="e-ink"]) .screen-drop-btn[hovered] {
            background: var(--text, #000000) !important;
            color: var(--bg, #ffffff) !important;
        }
        :host-context([data-theme="e-ink"]) .drag-floater {
            background: var(--bg, #ffffff) !important;
            color: var(--text, #000000) !important;
            border: 2px solid var(--border, #000000) !important;
            box-shadow: 4px 4px 0 var(--border, #000000) !important;
        }
    `;
    constructor() {
        super();
        this._activeMode = 'tab';
        this._lastDragActive = false;
    }

    connectedCallback() {
        super.connectedCallback();
    }
    willUpdate(changedProperties) {
        super.willUpdate(changedProperties);
        if (changedProperties.has('dragState')) {
            const isNowActive = Boolean(this.dragState?.active);
            if (isNowActive && !this._lastDragActive) {
                const entity = this.dragState?.entity;
                const sourceCol = this.dragState?.sourceCol;
                this._activeMode = (entity?.windowOnly || sourceCol === 'window') ? 'window' : 'tab';
            }
            this._lastDragActive = isNowActive;

            const cz = this.dragState?.currentZone;
            if (cz === 'mode-tab' || ['left', 'center', 'right'].includes(cz) || (cz && cz.startsWith('reorder-'))) {
                if (!this.dragState?.entity?.windowOnly && this._activeMode !== 'tab') {
                    this._activeMode = 'tab';
                }
            } else if (cz === 'mode-window' || cz === 'window' || (cz && cz.startsWith('span-'))) {
                if (this._activeMode !== 'window') {
                    this._activeMode = 'window';
                }
            }
        }
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('dragState') || changedProperties.has('_activeMode')) {
            this._dropZonesCache = null; // Invalidate cache when drag layout or active mode shifts
            if (this.dragState?.active && this.dragState.currentX !== undefined && this.dragState.currentY !== undefined) {
                this.updatePointer(this.dragState.currentX, this.dragState.currentY);
            }
        }
    }

    getHoveredZone(x, y) {
        if (!this._dropZonesCache) {
            this._dropZonesCache = Array.from(this.shadowRoot.querySelectorAll('yenvui-drop-target')).map(el => {
                const rect = el.getBoundingClientRect();
                return { zone: el.zone, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            });
        }
        const hovered = this._dropZonesCache.find(z => x >= z.left && x <= z.right && y >= z.top && y <= z.bottom);
        const zone = hovered ? hovered.zone : null;
        if (zone === 'mode-tab' && !this.dragState?.entity?.windowOnly && this._activeMode !== 'tab') {
            this._activeMode = 'tab';
            this._dropZonesCache = null;
            this.requestUpdate();
        } else if (zone === 'mode-window' && this._activeMode !== 'window') {
            this._activeMode = 'window';
            this._dropZonesCache = null;
            this.requestUpdate();
        }
        return zone;
    }

    updatePointer(x, y) {
        const floater = this.shadowRoot.querySelector('.drag-floater');
        if (floater) {
            floater.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        }
    }
    render() {
        if (!this.dragState || !this.dragState.active) {
            return html`<yenvui-drop-overlay></yenvui-drop-overlay>`;
        }

        const { entity, currentX, currentY, sourceCol, currentZone, sourceRect } = this.dragState;
        const capacity = this.spatialState?.capacity || 3;

        // Fallback rect if the source extraction failed natively
        const rect = sourceRect || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const envSupportsPopout = window.Sutram?.stores?.Layout?.getState()?.canPopout
            ? window.Sutram.stores.Layout.getState().canPopout()
            : true;
        const isPopoutable = envSupportsPopout && Boolean(
            entity?.allow_popout ||
            (entity?.id && window.ExtensionRegistry?.resolveCustomEditor?.(entity.id)) ||
            (entity?.id && window.ExtensionRegistry?.executeUIHook?.('sutram:is-popoutable', entity.id)) ||
            (entity?.id && entity.id.includes('://'))
        );
        const effectiveMode = entity?.windowOnly ? 'window' : this._activeMode;
        const cardStyle = `left: ${rect.left}px; top: ${rect.top}px; width: ${rect.width}px; height: ${rect.height}px;`;
        const floaterStyle = `transform: translate3d(${currentX || 0}px, ${currentY || 0}px, 0) translate(-50%, -50%);`;
        const tabBtnClass = `mode-switcher-btn tab-mode ${effectiveMode === 'tab' ? 'active-mode' : ''}`;
        const winBtnClass = `mode-switcher-btn win-mode ${effectiveMode === 'window' ? 'active-mode' : ''}`;
        const rightTabStyle = capacity === 2 ? 'opacity: 0.4; pointer-events: none;' : '';

        return html`
            <yenvui-drop-overlay class="hud-overlay" ?active=${true}>
                <div class="hud-hud-card" style=${cardStyle}>
                    <div class="top-anchor-row">
                        <div class="top-third-slot">
                            ${isPopoutable ? html`
                                <yenvui-drop-target zone="popout" class="drop-target-btn intent-highlight" .intent=${'highlight'} ?hovered=${currentZone === 'popout'} style="width: 100%; height: 42px;">
                                    <yv-icon name="external-link" style="width: 16px; height: 16px;"></yv-icon> Pop Out
                                </yenvui-drop-target>
                            ` : ''}
                        </div>
                        <div class="top-third-slot"></div>
                        <div class="top-third-slot">
                            <yenvui-drop-target zone="close" class="drop-target-btn intent-danger" .intent=${'danger'} ?hovered=${currentZone === 'close'} style="width: 100%; height: 42px;">
                                <yv-icon name="x" style="width: 16px; height: 16px;"></yv-icon> Close
                            </yenvui-drop-target>
                        </div>
                    </div>

                    <div class="middle-workspace">
                        <div class="mode-switcher-row">
                            ${!entity?.windowOnly ? html`
                                <yenvui-drop-target zone="mode-tab" class=${tabBtnClass} .intent=${'primary'} ?hovered=${currentZone === 'mode-tab'}>
                                    <yv-icon name="columns" style="width: 16px; height: 16px;"></yv-icon> Tab
                                </yenvui-drop-target>
                            ` : ''}
                            <yenvui-drop-target zone="mode-window" class=${winBtnClass} .intent=${'warning'} ?hovered=${currentZone === 'mode-window'}>
                                <yv-icon name="layout-grid" style="width: 16px; height: 16px;"></yv-icon> Window
                            </yenvui-drop-target>
                        </div>

                        ${effectiveMode === 'tab' && !entity?.windowOnly ? html`
                            <div class="section-box tab-pos" style="margin-bottom: 0;">
                                <div class="section-header tab-pos">
                                    <span style="display: flex; align-items: center; gap: 6px;">
                                        <yv-icon name="columns" style="width: 14px; height: 14px;"></yv-icon> TAB POSITION
                                    </span>
                                    <span style="opacity: 0.7;">Drop target column</span>
                                </div>
                                <div style="display: flex; gap: 10px;">
                                    <yenvui-drop-target zone="left" class="screen-drop-btn intent-primary" .intent=${'primary'} ?hovered=${currentZone === 'left'}>
                                        <yv-icon name="panel-left" style="width: 18px; height: 18px;"></yv-icon>
                                        <span>Left</span>
                                    </yenvui-drop-target>
                                    <yenvui-drop-target zone="center" class="screen-drop-btn intent-primary" .intent=${'primary'} ?hovered=${currentZone === 'center'}>
                                        <yv-icon name="columns" style="width: 18px; height: 18px;"></yv-icon>
                                        <span>Center</span>
                                    </yenvui-drop-target>
                                    <yenvui-drop-target zone="right" class="screen-drop-btn intent-primary" .intent=${'primary'} ?hovered=${currentZone === 'right'} style=${rightTabStyle}>
                                        <yv-icon name="panel-right" style="width: 18px; height: 18px;"></yv-icon>
                                        <span>Right</span>
                                    </yenvui-drop-target>
                                </div>
                            </div>

                            ${sourceCol && sourceCol !== 'window' && this.spatialState?.columns?.[sourceCol]?.pinned?.length > 1 ? html`
                                <div class="section-box arrange-tabs" style="margin-bottom: 0;">
                                    <div class="section-header arrange-tabs">
                                        <span style="display: flex; align-items: center; gap: 6px;">
                                            <yv-icon name="arrow-left-right" style="width: 14px; height: 14px;"></yv-icon> ARRANGE TABS
                                        </span>
                                        <span style="opacity: 0.7;">Drop to reorder</span>
                                    </div>
                                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                        ${(() => {
                                            const originalTabs = this.spatialState.columns[sourceCol].pinned;
                                            let visualTabs = [...originalTabs];
                                            const currentIndex = visualTabs.findIndex(p => p.id === entity?.id);
                                            let targetIndex = currentIndex;

                                            if (currentZone && currentZone.startsWith('reorder-')) {
                                                targetIndex = parseInt(currentZone.replace('reorder-', ''), 10);
                                            }

                                            if (currentIndex !== -1 && targetIndex !== -1 && currentIndex !== targetIndex) {
                                                const [moved] = visualTabs.splice(currentIndex, 1);
                                                visualTabs.splice(targetIndex, 0, moved);
                                            }

                                            return originalTabs.map((p, i) => {
                                                const vTab = visualTabs[i];
                                                const isHovered = currentZone === 'reorder-' + i;
                                                const zoneId = 'reorder-' + i;
                                                return html`
                                                    ${i > 0 ? html`<span style="color: var(--text-muted); font-size: 0.8rem;">•</span>` : ''}
                                                    <yenvui-drop-target zone=${zoneId} class="drop-target-btn intent-highlight" .intent=${'highlight'} ?hovered=${isHovered}>
                                                        <yv-icon name=${vTab.icon || 'component'} style="width: 14px; height: 14px;"></yv-icon>
                                                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${vTab.label || vTab.id}</span>
                                                    </yenvui-drop-target>
                                                `;
                                            });
                                        })()}
                                    </div>
                                </div>
                            ` : ''}
                        ` : html`
                            <div class="section-box window-pos" style="margin-bottom: 0;">
                                <div class="section-header window-pos">
                                    <span style="display: flex; align-items: center; gap: 6px;">
                                        <yv-icon name="layout-grid" style="width: 14px; height: 14px;"></yv-icon> WINDOW POSITION
                                    </span>
                                    <span style="opacity: 0.7;">Viewport capacity preset</span>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 10px;">
                                    <div style="display: flex; gap: 10px;">
                                        <yenvui-drop-target zone="span-1-left" class="screen-drop-btn intent-warning" .intent=${'warning'} ?hovered=${currentZone === 'span-1-left'}>
                                            <yv-icon name="panel-left" style="width: 18px; height: 18px;"></yv-icon>
                                            <span>Left</span>
                                        </yenvui-drop-target>
                                        <yenvui-drop-target zone="span-1-center" class="screen-drop-btn intent-warning" .intent=${'warning'} ?hovered=${currentZone === 'span-1-center'}>
                                            <yv-icon name="square" style="width: 18px; height: 18px;"></yv-icon>
                                            <span>Center</span>
                                        </yenvui-drop-target>
                                        ${capacity >= 3 ? html`
                                            <yenvui-drop-target zone="span-1-right" class="screen-drop-btn intent-warning" .intent=${'warning'} ?hovered=${currentZone === 'span-1-right'}>
                                                <yv-icon name="panel-right" style="width: 18px; height: 18px;"></yv-icon>
                                                <span>Right</span>
                                            </yenvui-drop-target>
                                        ` : ''}
                                    </div>

                                    ${capacity >= 2 ? html`
                                        <div style="display: flex; gap: 10px;">
                                            <yenvui-drop-target zone="span-2-left" class="screen-drop-btn intent-warning" .intent=${'warning'} ?hovered=${currentZone === 'span-2-left'}>
                                                <yv-icon name="columns" style="width: 18px; height: 18px;"></yv-icon>
                                                <span>Left + Center</span>
                                            </yenvui-drop-target>
                                            ${capacity >= 3 ? html`
                                                <yenvui-drop-target zone="span-2-center" class="screen-drop-btn intent-warning" .intent=${'warning'} ?hovered=${currentZone === 'span-2-center'}>
                                                    <yv-icon name="columns" style="width: 18px; height: 18px;"></yv-icon>
                                                    <span>Center + Right</span>
                                                </yenvui-drop-target>
                                            ` : ''}
                                        </div>
                                    ` : ''}

                                    ${capacity >= 3 ? html`
                                        <yenvui-drop-target zone="span-3-left" class="screen-drop-btn intent-warning" .intent=${'warning'} ?hovered=${currentZone === 'span-3-left'} style="height: 60px;">
                                            <yv-icon name="maximize-2" style="width: 18px; height: 18px;"></yv-icon>
                                            <span>Span Across</span>
                                        </yenvui-drop-target>
                                    ` : ''}
                                </div>
                            </div>
                        `}
                    </div>

                    <div class="bottom-anchor-footer">
                        <div class="hud-header-subtitle" style="justify-content: center;">
                            <yv-icon name="split" style="width: 14px; height: 14px;"></yv-icon> ${entity?.id || 'REPOSITION OR DOCK'}
                        </div>
                        <div class="hud-header-title">
                            ${entity?.label || entity?.id || 'Projection'}
                        </div>
                    </div>
                </div>
                <div class="drag-floater" style=${floaterStyle}>
                    <yv-icon name=${entity?.icon || 'component'} style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"></yv-icon> ${entity?.label || entity?.id || 'Dragging'}
                </div>
            </yenvui-drop-overlay>
        `;
    }
}
customElements.define('sutram-drag-coordinator', SutramDragCoordinator);