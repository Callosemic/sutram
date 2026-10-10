import { LitElement, html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
import { YenvuiGestureController } from './physics.js';

export class YenvuiWindow extends YenvuiBase {
    static properties = {
        titleText: { type: String },
        anchorCol: { type: String },
        span: { type: Number },
        z: { type: Number },
        icon: { type: String },
        intent: { type: String }
    };
    static styles = css`
        :host { display: contents; }
        dialog {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background: var(--pane-bg);
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 0;
            box-shadow: var(--overlay-shadow);
            display: none;
            flex-direction: column;
            max-width: none;
            max-height: none;
            overflow: hidden;
            resize: none;
        }
        dialog[open] { display: flex; }
        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 10px 15px; border-bottom: 1px solid var(--border);
            background: var(--input-bg); cursor: grab; user-select: none;
            border-top: 4px solid var(--intent-color, var(--intent-primary));
        }
        .header:active { cursor: grabbing; }
        .title-area { display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 0.95rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .window-btn { background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px; line-height: 1; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono, monospace); font-weight: bold; transition: all 0.15s ease; }
        .window-btn:hover { background: var(--bg-hover); color: var(--text); }
        .window-btn.active-span { background: color-mix(in srgb, var(--intent-color, var(--intent-primary)) 20%, transparent); color: var(--intent-color, var(--intent-primary)); border: 1px solid var(--intent-color, var(--intent-primary)); }
        .window-btn.close-btn:hover { color: var(--intent-danger); background: color-mix(in srgb, var(--intent-danger) 15%, transparent); }
        .body { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--bg); container-type: inline-size; }

        :host([data-theme="e-ink"]) dialog {
            border: 2px solid #000;
            box-shadow: 4px 4px 0 var(--intent-color, #8b5cf6);
        }
    `;
    constructor() {
        super();
        this.anchorCol = 'center';
        this.span = 1;
        this.z = 1000;
        this.titleText = '';
        this.icon = 'component';
        this.intent = 'primary';
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        const dialog = this.shadowRoot.querySelector('dialog');
        if (dialog) {
            if (!dialog.open) dialog.show();
            dialog.style.zIndex = this.z;

            const intentColor = `var(--intent-${this.intent})`;
            dialog.style.setProperty('--intent-color', intentColor);
        }
    }
    render() {
        return html`
            <dialog @pointerdown=${() => this.dispatchEvent(new CustomEvent('yenvui-window-focus', { bubbles: true, composed: true }))}>
                <div class="header" 
                    @dblclick=${(e) => { e.stopPropagation(); this.dispatchEvent(new CustomEvent('yenvui-window-dock', { bubbles: true, composed: true })); }}
                    @pointerdown=${(e) => { 
                        e.stopPropagation(); 
                        const now = Date.now();
                        if (now - (this._lastTapTime || 0) < 300) {
                            this.dispatchEvent(new CustomEvent('yenvui-window-dock', { bubbles: true, composed: true }));
                            this._lastTapTime = 0;
                            return;
                        }
                        this._lastTapTime = now;
                        this.dispatchEvent(new CustomEvent('yenvui-window-drag-start', { detail: { originalEvent: e }, bubbles: true, composed: true })); 
                    }}>
                    <div class="title-area">
                        <yv-icon name="${this.icon}" style="width: 14px; height: 14px; color: var(--intent-color, var(--intent-primary));"></yv-icon>
                        ${this.titleText}
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <button class="window-btn close-btn" title="Close" @pointerdown=${(e) => e.stopPropagation()} @click=${() => this.dispatchEvent(new CustomEvent('yenvui-window-close', { bubbles: true, composed: true }))}>
                            <yv-icon name="x" style="width: 16px; height: 16px;"></yv-icon>
                        </button>
                    </div>
                </div>
                <div class="body"><slot></slot></div>
            </dialog>
        `;
    }
}
customElements.define('yenvui-window', YenvuiWindow);