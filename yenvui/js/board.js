import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';

export class YenvuiBoard extends YenvuiBase {
    static styles = css`
        :host { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr);
            align-items: start;
            gap: 15px; 
            width: 100%; 
        }
        @container (max-width: 1100px) {
            :host { 
                grid-template-columns: repeat(2, 1fr); 
            }
        }
        @container (max-width: 700px) {
            :host { 
                grid-template-columns: 1fr; 
                gap: 25px; 
            }
        }
    `;

    render() {
        return html`<slot></slot>`;
    }
}
customElements.define('yenvui-board', YenvuiBoard);
export class YenvuiColumn extends YenvuiBase {
    static properties = {
        titleText: { type: String },
        intentColor: { type: String }
    };

    static styles = css`
        :host { 
            min-width: 0; 
            background: var(--input-bg, #2d2d2d); 
            padding: 10px; 
            border-radius: 6px; 
            display: flex; 
            flex-direction: column; 
            gap: 10px; 
        }
        .header { 
            margin-top: 0; 
            font-size: 1.1rem; 
            font-weight: bold; 
            margin-bottom: 10px; 
            color: var(--text, #e0e0e0); 
        }
        @container (max-width: 700px) {
            :host { 
                background: transparent; 
                padding: 0; 
            }
            .header { 
                font-size: 1.2rem; 
                border-bottom: 1px solid var(--border, #444); 
                padding-bottom: 5px; 
                margin-bottom: 15px; 
            }
        }
    `;

    constructor() {
        super();
        this.titleText = '';
        this.intentColor = '';
    }
    render() {
        return html`
            ${this.titleText ? html`<div class="header" style="color: ${this.intentColor || 'var(--text, #e0e0e0)'};">${this.titleText}</div>` : ''}
            <slot></slot>
        `;
    }
}
customElements.define('yenvui-column', YenvuiColumn);