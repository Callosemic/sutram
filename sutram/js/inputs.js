import { Input, Select, Textarea, Toggle } from 'sutram-chassis';

const bridgeInputEvents = (BaseClass) => class extends BaseClass {
    connectedCallback() {
        super.connectedCallback();
        if (!this._sutramInputBridged) {
            this._sutramInputBridged = true;
            this.addEventListener('yenvui-input-changed', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('sutram-input-changed', {
                    detail: e.detail,
                    bubbles: true,
                    composed: true
                }));
            });
        }
    }
};

export class SutramInput extends bridgeInputEvents(Input) {}
if (!customElements.get('sutram-input')) customElements.define('sutram-input', SutramInput);

export class SutramSelect extends bridgeInputEvents(Select) {}
if (!customElements.get('sutram-select')) customElements.define('sutram-select', SutramSelect);

export class SutramTextarea extends bridgeInputEvents(Textarea) {}
if (!customElements.get('sutram-textarea')) customElements.define('sutram-textarea', SutramTextarea);

export class SutramToggle extends bridgeInputEvents(Toggle) {}
if (!customElements.get('sutram-toggle')) customElements.define('sutram-toggle', SutramToggle);