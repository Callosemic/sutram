// sutram/sutram/js/drag-coordinator.js
import { html, css } from 'lit';
import { SutramElement } from './sutram_sdk.js';
import '../../yenvui/js/drop-zone.js';
export class SutramDragCoordinator extends SutramElement {
    static properties = {
        dragState: { type: Object },
        spatialState: { type: Object }
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
            background: var(--pane-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            box-sizing: border-box;
            box-shadow: var(--overlay-shadow, 0 25px 60px rgba(0, 0, 0, 0.6));
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow-y: auto;
            color: var(--text);
            font-family: inherit;
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
            color: #ffffff;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 0.9rem;
            opacity: 0.9;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
            z-index: 10000;
            border: 1px solid rgba(255, 255, 255, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            will-change: transform;
        }

        /* E-Ink High Contrast Theme Overrides */
        :host([data-theme="e-ink"]) .hud-overlay {
            background: rgba(255, 255, 255, 0.9) !important;
            backdrop-filter: none !important;
        }

        :host([data-theme="e-ink"]) .hud-hud-card {
            background: #ffffff !important;
            border: 3px solid #000000 !important;
            color: #000000 !important;
            box-shadow: 6px 6px 0 #000000 !important;
        }

        :host([data-theme="e-ink"]) .section-box {
            border: 2px solid #000000 !important;
            background: #ffffff !important;
        }

        :host([data-theme="e-ink"]) .section-header,
        :host([data-theme="e-ink"]) .hud-header-subtitle,
        :host([data-theme="e-ink"]) .hud-header-title {
            color: #000000 !important;
            font-weight: 900 !important;
        }

        :host([data-theme="e-ink"]) .drop-target-btn {
            background: #ffffff !important;
            border: 2px solid #000000 !important;
            color: #000000 !important;
            font-weight: 800 !important;
        }

        :host([data-theme="e-ink"]) .drop-target-btn[hovered] {
            background: #000000 !important;
            color: #ffffff !important;
        }

        :host([data-theme="e-ink"]) .drag-floater {
            background: #ffffff !important;
            color: #000000 !important;
            border: 2px solid #000000 !important;
            box-shadow: 4px 4px 0 #000000 !important;
        }
    `;

    connectedCallback() {
        super.connectedCallback();
        this.observeTheme();
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
        return html`
            <yenvui-drop-overlay class="hud-overlay" ?active=${true}>
                <!-- Localized Bounding Box HUD Container -->
                <div class="hud-hud-card" style="left: ${rect.left}px; top:${rect.top}px; width: ${rect.width}px; height:${rect.height}px;">

                    <div style="width: 100%; max-width: 500px;">
                        <!-- Header -->
                        <div style="display: flex; flex-direction: column; margin-bottom: 20px;">
                            <div class="hud-header-subtitle">
                                <yv-icon name="split" style="width: 14px; height: 14px;"></yv-icon> REPOSITION OR DOCK
                            </div>
                            <div class="hud-header-title">
                                ${entity?.label || entity?.id || 'Projection'}
                            </div>
                        </div>

                    <!-- TAB POSITION Section -->
                    <div class="section-box tab-pos">
                        <div class="section-header tab-pos">
                            <span style="display: flex; align-items: center; gap: 6px;">
                                <yv-icon name="columns" style="width: 14px; height: 14px;"></yv-icon> TAB POSITION
                            </span>
                            <span style="opacity: 0.7;">Drop target column</span>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <yenvui-drop-target zone="left" class="drop-target-btn intent-primary" .intent=${'primary'} ?hovered=${currentZone === 'left'}>
                                Left Flank
                            </yenvui-drop-target>
                            <yenvui-drop-target zone="center" class="drop-target-btn intent-primary" .intent=${'primary'} ?hovered=${currentZone === 'center'}>
                                Center Focus
                            </yenvui-drop-target>
                            <yenvui-drop-target zone="right" class="drop-target-btn intent-primary" .intent=${'primary'} ?hovered=${currentZone === 'right'} style="${capacity === 2 ? 'opacity: 0.4; pointer-events: none;' : ''}">
                                Right Flank
                            </yenvui-drop-target>
                        </div>
                    </div>

                    <!-- ARRANGE TABS Section -->
                    ${sourceCol && sourceCol !== 'window' && this.spatialState?.columns?.[sourceCol]?.pinned?.length > 1 ? html`
                        <div class="section-box arrange-tabs">
                            <div class="section-header arrange-tabs">
                                <span style="display: flex; align-items: center; gap: 6px;">
                                    <yv-icon name="arrow-left-right" style="width: 14px; height: 14px;"></yv-icon> ARRANGE TABS
                                </span>
                                <span style="opacity: 0.7;">Drop between tabs to reorder</span>
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
                                        return html`
                                            ${i > 0 ? html`<span style="color: var(--text-muted); font-size: 0.8rem;">•</span>` : ''}
                                            <yenvui-drop-target zone="reorder-${i}" class="drop-target-btn intent-highlight" .intent=${'highlight'} ?hovered=${isHovered}>
                                                <yv-icon name="${vTab.icon || 'component'}" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"></yv-icon>
                                                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${vTab.label || vTab.id}</span>
                                            </yenvui-drop-target>
                                        `;
                                    });
                                })()}
                            </div>
                        </div>
                    ` : ''}

                    <!-- WINDOW POSITION Section -->
                    <div class="section-box window-pos">
                        <div class="section-header window-pos">
                            <span style="display: flex; align-items: center; gap: 6px;">
                                <yv-icon name="layout-grid" style="width: 14px; height: 14px;"></yv-icon> WINDOW POSITION
                            </span>
                            <span style="opacity: 0.7;">Viewport capacity preset</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: flex; gap: 8px;">
                                <yenvui-drop-target zone="span-1-left" class="drop-target-btn intent-warning" .intent=${'warning'} ?hovered=${currentZone === 'span-1-left'}>
                                    Left Flank
                                </yenvui-drop-target>
                                <yenvui-drop-target zone="span-1-center" class="drop-target-btn intent-warning" .intent=${'warning'} ?hovered=${currentZone === 'span-1-center'}>
                                    Center Focus
                                </yenvui-drop-target>
                                ${capacity >= 3 ? html`
                                    <yenvui-drop-target zone="span-1-right" class="drop-target-btn intent-warning" .intent=${'warning'} ?hovered=${currentZone === 'span-1-right'}>
                                        Right Flank
                                    </yenvui-drop-target>
                                ` : ''}
                            </div>

                            ${capacity >= 2 ? html`
                                <div style="display: flex; gap: 8px;">
                                    <yenvui-drop-target zone="span-2-left" class="drop-target-btn intent-warning" .intent=${'warning'} ?hovered=${currentZone === 'span-2-left'}>
                                        Left + Center
                                    </yenvui-drop-target>
                                    ${capacity >= 3 ? html`
                                        <yenvui-drop-target zone="span-2-center" class="drop-target-btn intent-warning" .intent=${'warning'} ?hovered=${currentZone === 'span-2-center'}>
                                            Center + Right
                                        </yenvui-drop-target>
                                    ` : ''}
                                </div>
                            ` : ''}

                            ${capacity >= 3 ? html`
                                <yenvui-drop-target zone="span-3-left" class="drop-target-btn intent-warning" .intent=${'warning'} ?hovered=${currentZone === 'span-3-left'}>
                                    All 3 Columns
                                </yenvui-drop-target>
                            ` : ''}
                        </div>
                    </div>
                    <!-- Bottom Close Action -->
                    <yenvui-drop-target zone="close" class="drop-target-btn intent-danger" .intent=${'danger'} ?hovered=${currentZone === 'close'}>
                        <yv-icon name="x" style="width: 18px; height: 18px;"></yv-icon> Close
                    </yenvui-drop-target>

                </div>
                <!-- Floating Cursor Node (Hardware Accelerated) -->
                <div class="drag-floater">
                    <yv-icon name="${entity?.icon || 'component'}" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"></yv-icon> ${entity?.label || entity?.id || 'Dragging'}
                </div>
            </yenvui-drop-overlay>
        `;
    }
}
customElements.define('sutram-drag-coordinator', SutramDragCoordinator);