import { LitElement, html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
import { YenvuiGestureController } from './physics.js';

export class YenvuiWindow extends YenvuiBase {
    static properties = {
        titleText: { type: String },
        x: { type: Number },
        y: { type: Number },
        z: { type: Number },
        icon: { type: String },
        intent: { type: String }
    };
    static styles = css`
        :host { display: contents; }
        dialog {
            position: fixed;
            margin: 0;
            padding: 0;
            background: var(--pane-bg);
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 8px;
            box-shadow: var(--overlay-shadow);
            display: none;
            flex-direction: column;
            width: 600px;
            height: 400px;
            max-width: 90vw;
            max-height: 90vh;
            overflow: hidden;
            resize: both;
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
        .window-btn { background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px; line-height: 1; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
        .window-btn:hover { background: var(--bg-hover); color: var(--text); }
        .window-btn.close-btn:hover { color: var(--intent-danger); background: color-mix(in srgb, var(--intent-danger) 15%, transparent); }
        .body { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--bg); }
        
        :host([data-theme="e-ink"]) dialog {
            border: 2px solid #000;
            box-shadow: 4px 4px 0 var(--intent-color, #8b5cf6);
        }
    `;
    constructor() {
        super();
        this.x = 100;
        this.y = 100;
        this.z = 1000;
        this.titleText = '';
        this.icon = 'component';
        this.intent = 'primary';
    }
    connectedCallback() {
        super.connectedCallback();
        this._dragController = new YenvuiGestureController(this, {
            onPanMove: (x, y) => {
                const deltaX = x - this._dragController.startX;
                const deltaY = y - this._dragController.startY;
                this.dispatchEvent(new CustomEvent('yenvui-window-move', {
                    detail: { x: this.x + deltaX, y: this.y + deltaY },
                    bubbles: true, composed: true
                }));
                this._dragController.startX = x;
                this._dragController.startY = y;
            },
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._dragController && typeof this._dragController.abort === 'function') {
            this._dragController.abort();
        }
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        const dialog = this.shadowRoot.querySelector('dialog');
        if (dialog) {
            if (!dialog.open) dialog.show();
            dialog.style.left = `${this.x}px`;
            dialog.style.top = `${this.y}px`;
            dialog.style.zIndex = this.z;
            
            const intentColor = `var(--intent-${this.intent})`;
            dialog.style.setProperty('--intent-color', intentColor);
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: this.shadowRoot });
        }
    }
    render() {
        return html`
            <dialog @pointerdown=${() => this.dispatchEvent(new CustomEvent('yenvui-window-focus', { bubbles: true, composed: true }))}>
                <div class="header" @pointerdown=${(e) => this._dragController.start(e)}>
                    <div class="title-area">
                        <i data-lucide="${this.icon}" style="width: 14px; height: 14px; color: var(--intent-color, var(--intent-primary));"></i>
                        ${this.titleText}
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <button class="window-btn dock-btn" title="Click to dock to center, or drag to choose a tab" 
                            @pointerdown=${(e) => { e.stopPropagation(); this.dispatchEvent(new CustomEvent('yenvui-window-drag-start', { detail: { originalEvent: e }, bubbles: true, composed: true })); }}
                            @click=${() => this.dispatchEvent(new CustomEvent('yenvui-window-dock', { bubbles: true, composed: true }))}>
                            <i data-lucide="minimize-2" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button class="window-btn close-btn" title="Close" @pointerdown=${(e) => e.stopPropagation()} @click=${() => this.dispatchEvent(new CustomEvent('yenvui-window-close', { bubbles: true, composed: true }))}>
                            <i data-lucide="x" style="width: 16px; height: 16px;"></i>
                        </button>
                    </div>
                </div>
                <div class="body"><slot></slot></div>
            </dialog>
        `;
    }
}
customElements.define('yenvui-window', YenvuiWindow);