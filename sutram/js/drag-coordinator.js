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

    render() {
        if (!this.dragState || !this.dragState.active) {
            return html`<yenvui-drop-overlay></yenvui-drop-overlay>`;
        }

        const { entity, currentX, currentY, sourceCol, currentZone } = this.dragState;
        const capacity = this.spatialState?.capacity || 3;

        return html`
            <yenvui-drop-overlay ?active=${true}>
                <div style="position: absolute; left: ${currentX}px; top: ${currentY}px; transform: translate(-50%, -50%); pointer-events: none; background: var(--intent-highlight); color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold; opacity: 0.95; box-shadow: 0 4px 15px rgba(0,0,0,0.5); z-index: 10000; border: 1px solid rgba(255,255,255,0.2);">
                    ${entity?.label}
                </div>
                <div style="color: var(--text); font-weight: bold; font-size: 1.1rem; margin-bottom: 10px;">
                    Moving: <span style="color: var(--intent-highlight);">${entity?.label}</span>
                </div>

                ${sourceCol && this.spatialState.columns[sourceCol]?.pinned.length > 1 ? html`
                    <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 8px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Reorder in Column</div>
                    <div style="display: flex; gap: 15px; width: 100%; max-width: 800px; padding: 0 20px; box-sizing: border-box; justify-content: center; margin-bottom: 25px; flex-wrap: wrap; align-items: center;">
                        ${this.spatialState.columns[sourceCol].pinned.map((p, i) => html`
                            <yenvui-drop-target zone="reorder-${i}" ?hovered=${currentZone === `reorder-${i}`} style="height: 40px; padding: 0 16px; width: auto; font-size: 0.9rem;">
                                ${p.id === entity?.id ? html`
                                    <div style="pointer-events: none; white-space: nowrap; color: var(--intent-primary);">
                                        ${entity?.label}
                                    </div>
                                ` : html`
                                    <div style="pointer-events: none; white-space: nowrap; opacity: 0.7;">
                                        ${p.label || p.id}
                                    </div>
                                `}
                            </yenvui-drop-target>
                        `)}
                    </div>
                ` : ''}

                <div style="display: flex; gap: 15px; width: 100%; max-width: 800px; padding: 0 20px; box-sizing: border-box; justify-content: center;">
                    <yenvui-drop-target zone="left" ?hovered=${currentZone === 'left'} intent="${sourceCol === 'left' ? 'neutral' : 'primary'}">
                        <span>Left Column</span>
                    </yenvui-drop-target>
                    <yenvui-drop-target zone="center" ?hovered=${currentZone === 'center'} intent="${sourceCol === 'center' ? 'neutral' : 'primary'}">
                        <span>Center Column</span>
                    </yenvui-drop-target>
                    <yenvui-drop-target zone="right" ?hovered=${currentZone === 'right'} intent="${sourceCol === 'right' ? 'neutral' : 'primary'}" style="${capacity === 2 ? 'opacity: 0.5; pointer-events: none;' : ''}">
                        <span>Right Column</span>
                    </yenvui-drop-target>
                </div>

                <div style="display: flex; gap: 15px; width: 100%; max-width: 800px; padding: 0 20px; box-sizing: border-box; justify-content: center; margin-top: 20px;">
                    <yenvui-drop-target zone="close" ?hovered=${currentZone === 'close'} intent="danger">
                        <span>✕ Close / Hide</span>
                    </yenvui-drop-target>
                </div>
            </yenvui-drop-overlay>
        `;
    }
}
customElements.define('sutram-drag-coordinator', SutramDragCoordinator);