import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
export class YenvuiLabel extends YenvuiBase {
    static properties = {
        text: { type: String },
        intent: { type: String, reflect: true },
        monospace: { type: Boolean, reflect: true },
        truncate: { type: Boolean, reflect: true },
        multiline: { type: Boolean, reflect: true },
        invalid: { type: Boolean, reflect: true }
    };

    createRenderRoot() { return this; }

    constructor() {
        super();
        this.text = '';
        this.intent = '';
        this.monospace = false;
        this.truncate = false;
        this.multiline = false;
        this.invalid = false;
    }

    render() {
        const classes = [
            'yv-label',
            this.intent ? `yv-label--${this.intent}` : '',
            this.monospace ? 'yv-label--mono' : '',
            this.truncate ? 'yv-label--truncate' : '',
            this.multiline ? 'yv-label--pre-wrap' : '',
            this.invalid ? 'yv-label--strike' : ''
        ].filter(Boolean).join(' ');
        return html`<label class="${classes}">${this.text}<slot></slot></label>`;
    }
}
customElements.define('yenvui-label', YenvuiLabel);