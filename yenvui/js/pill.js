import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
export class YenvuiPill extends YenvuiBase {
    static properties = {
        pillId: { type: String },
        labelText: { type: String },
        active: { type: Boolean },
        small: { type: Boolean },
        variant: { type: String } // 'standard' or 'text'
    };

    createRenderRoot() { return this; }

    constructor() {
        super();
        this.variant = 'standard';
    }
    render() {
        const activeClass = this.active ? 'yv-pill--active' : 'yv-pill--inactive';
        const smallClass = this.small ? 'yv-pill--small' : '';
        const variantClass = `yv-pill--${this.variant || 'standard'}`;
        return html`
            <button 
                class="yv-pill ${activeClass} ${smallClass} ${variantClass}"
                @click=${this._onClick}>
                ${this.labelText}
            </button>
        `;
    }
    
    _onClick(e) {
        this.dispatchEvent(new CustomEvent('yenvui-pill-toggled', {
            detail: { id: this.pillId, active: !this.active },
            bubbles: true,
            composed: true
        }));
    }
}
customElements.define('yenvui-pill', YenvuiPill);