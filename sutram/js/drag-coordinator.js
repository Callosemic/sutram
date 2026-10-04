// sutram/sutram/js/drag-coordinator.js
import { html, css } from 'lit';
import { SutramElement } from './sdk.js';
import '../../yenvui/js/drop-zone.js';

export class SutramDragCoordinator extends SutramElement {
    static properties = {
        dragState: { type: Object },
        spatialState: { type: Object }
    };

    static styles = css`:host { display: contents; }`;
    updated(changedProperties) {
        super.updated(changedProperties);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: this.shadowRoot });
        }
    }
    render() {
        if (!this.dragState || !this.dragState.active) {
            return html`<yenvui-drop-overlay></yenvui-drop-overlay>`;
        }

        const { entity, currentX, currentY, sourceCol, currentZone } = this.dragState;
        const capacity = this.spatialState?.capacity || 3;
        return html`
            <yenvui-drop-overlay ?active=${true} style="overflow: hidden;">
                <div style="position: absolute; left: ${currentX}px; top:${currentY}px; transform: translate(-50%, -50%); pointer-events: none; background: var(--intent-highlight); color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold; opacity: 0.65; box-shadow: 0 4px 15px rgba(0,0,0,0.5); z-index: 10000; border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="${entity?.icon || 'component'}" style="width: 16px; height: 16px;"></i> ${entity?.label}
                </div>

                <!-- View Section -->
                <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 8px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">View:</div>
                <div style="display: flex; gap: 15px; width: 100%; max-width: 600px; padding: 0 20px; box-sizing: border-box; justify-content: center; margin-bottom: 15px;">
                    <yenvui-drop-target zone="left" ?hovered=${currentZone === 'left'} intent="${sourceCol === 'left' ? 'neutral' : 'primary'}" style="height: 60px;">
                        <span><i data-lucide="panel-left" style="vertical-align: middle; margin-right: 6px;"></i> Left</span>
                    </yenvui-drop-target>
                    <yenvui-drop-target zone="center" ?hovered=${currentZone === 'center'} intent="${sourceCol === 'center' ? 'neutral' : 'primary'}" style="height: 60px;">
                        <span><i data-lucide="layout" style="vertical-align: middle; margin-right: 6px;"></i> Center</span>
                    </yenvui-drop-target>
                    <yenvui-drop-target zone="right" ?hovered=${currentZone === 'right'} intent="${sourceCol === 'right' ? 'neutral' : 'primary'}" style="height: 60px; ${capacity === 2 ? 'opacity: 0.5; pointer-events: none;' : ''}">
                        <span><i data-lucide="panel-right" style="vertical-align: middle; margin-right: 6px;"></i> Right</span>
                    </yenvui-drop-target>
                </div>

                <div style="display: flex; gap: 15px; width: 100%; max-width: 600px; padding: 0 20px; box-sizing: border-box; justify-content: center; margin-bottom: 25px;">
                    <yenvui-drop-target zone="window" ?hovered=${currentZone === 'window'} intent="highlight" style="height: 60px; flex: 1; border-style: dotted;">
                        <span><i data-lucide="external-link" style="vertical-align: middle; margin-right: 6px;"></i> Window</span>
                    </yenvui-drop-target>
                    <yenvui-drop-target zone="close" ?hovered=${currentZone === 'close'} intent="danger" style="height: 60px; flex: 1;">
                        <span><i data-lucide="x" style="vertical-align: middle; margin-right: 6px;"></i> Close</span>
                    </yenvui-drop-target>
                </div>

                <!-- Tab Order Section -->
                ${sourceCol && sourceCol !== 'window' && this.spatialState.columns[sourceCol]?.pinned.length > 1 ? html`
                    <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 8px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Tab Order:</div>
                    <div style="display: flex; gap: 5px; width: 100%; max-width: 800px; padding: 0 20px; box-sizing: border-box; justify-content: center; flex-wrap: wrap; align-items: center;">
                        ${this.spatialState.columns[sourceCol].pinned.map((p, i) => html`
                            <yenvui-drop-target zone="reorder-${i}" ?hovered=${currentZone === 'reorder-' + i} style="height: 40px; width: 40px; min-width: 40px; padding: 0; background: transparent; border: 2px dashed ${currentZone === 'reorder-' + i ? 'var(--intent-success)' : 'var(--border)'};">
                                <i data-lucide="arrow-down" style="width: 14px; height: 14px; color: ${currentZone === 'reorder-' + i ? 'var(--intent-success)' : 'transparent'};"></i>
                            </yenvui-drop-target>
                            ${p.id === entity?.id ? html`
                                <div style="padding: 6px 12px; background: color-mix(in srgb, var(--intent-primary) 20%, var(--bg)); color: var(--intent-primary); border: 1px solid var(--intent-primary); border-radius: 4px; font-size: 0.85rem; font-weight: bold;">
                                    ${entity?.label}
                                </div>
                            ` : html`
                                <div style="padding: 6px 12px; background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); border-radius: 4px; font-size: 0.85rem;">
                                    ${p.label || p.id}
                                </div>
                            `}
                        `)}
                        <yenvui-drop-target zone="reorder-${this.spatialState.columns[sourceCol].pinned.length}" ?hovered=${currentZone === 'reorder-' + this.spatialState.columns[sourceCol].pinned.length} style="height: 40px; width: 40px; min-width: 40px; padding: 0; background: transparent; border: 2px dashed ${currentZone === 'reorder-' + this.spatialState.columns[sourceCol].pinned.length ? 'var(--intent-success)' : 'var(--border)'};">
                            <i data-lucide="arrow-down" style="width: 14px; height: 14px; color: ${currentZone === 'reorder-' + this.spatialState.columns[sourceCol].pinned.length ? 'var(--intent-success)' : 'transparent'};"></i>
                        </yenvui-drop-target>
                    </div>
                ` : ''}
            </yenvui-drop-overlay>
        `;
    }
}
customElements.define('sutram-drag-coordinator', SutramDragCoordinator);