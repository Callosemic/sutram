import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
export class YenvuiTag extends YenvuiBase {
    static properties = {
        text: { type: String },
        intent: { type: String }
    };

    createRenderRoot() { return this; }

    render() {
        const intentClass = this.intent ? `yv-tag--${this.intent}` : '';
        return html`<span class="yv-tag ${intentClass}">${this.text}<slot></slot></span>`;
    }
}
customElements.define('yenvui-tag', YenvuiTag);