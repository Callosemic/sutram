import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
export class YenvuiLabel extends YenvuiBase {
    static properties = {
        text: { type: String }
    };

    createRenderRoot() { return this; }

    render() {
        return html`<label class="yv-label">${this.text}<slot></slot></label>`;
    }
}
customElements.define('yenvui-label', YenvuiLabel);