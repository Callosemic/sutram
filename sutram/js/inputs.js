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

import { html, css } from 'lit';
import { SutramElement } from './sutram_sdk.js';
import { sharedStyles } from './shared_styles.js';

export class SutramCombobox extends SutramElement {
    static properties = {
        label: { type: String },
        value: { type: String },
        placeholder: { type: String },
        options: { type: Array },
        disabled: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true },
        inline: { type: Boolean, reflect: true },
        _open: { type: Boolean, state: true },
        _highlightedIndex: { type: Number, state: true },
        _filterText: { type: String, state: true }
    };

    static styles = [sharedStyles, css`
        :host {
            display: block;
            margin-bottom: 15px;
            font-family: inherit;
            position: relative;
            width: 100%;
            box-sizing: border-box;
        }
        :host([flush]), :host([inline]) {
            margin-bottom: 0 !important;
        }
        .combo-label {
            display: block;
            font-size: 0.78rem;
            font-weight: 700;
            color: var(--text-muted);
            margin-bottom: 4px;
        }
        .combo-wrap {
            position: relative;
            display: flex;
            align-items: center;
            width: 100%;
        }
        .combo-input {
            width: 100%;
            background: var(--bg-input, var(--input-bg));
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 8px 30px 8px 10px;
            font-size: 0.85rem;
            font-family: var(--font-mono, inherit);
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.15s ease;
        }
        .combo-input:focus {
            border-color: var(--intent-primary);
        }
        .combo-input:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .combo-chevron {
            position: absolute;
            right: 6px;
            top: 50%;
            transform: translateY(-50%);
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .combo-menu {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            max-height: 220px;
            overflow-y: auto;
            background: var(--pane-bg, var(--bg));
            border: 1px solid var(--border);
            border-radius: 6px;
            box-shadow: var(--overlay-shadow, 0 10px 25px rgba(0, 0, 0, 0.45));
            z-index: 3500;
            padding: 4px;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .combo-option {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 6px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.82rem;
            color: var(--text);
            text-align: left;
            background: transparent;
            border: none;
            width: 100%;
            box-sizing: border-box;
        }
        .combo-option:hover, .combo-option.highlighted {
            background: color-mix(in srgb, var(--intent-primary) 18%, var(--input-bg));
            color: var(--text);
        }
        .combo-option-main {
            font-family: var(--font-mono, inherit);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .combo-option-badge {
            font-size: 0.7rem;
            font-family: var(--font-mono, monospace);
            color: var(--text-muted);
            background: var(--bg);
            border: 1px solid var(--border);
            padding: 1px 6px;
            border-radius: 4px;
            flex-shrink: 0;
        }
    `];

    constructor() {
        super();
        this.label = '';
        this.value = '';
        this.placeholder = '';
        this.options = [];
        this.disabled = false;
        this.flush = false;
        this.inline = false;
        this._open = false;
        this._highlightedIndex = -1;
        this._filterText = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.registerOutsideClick(() => {
            if (this._open) {
                this._open = false;
                this._filterText = null;
            }
        });
    }

    _getNormalizedOptions() {
        return (this.options || []).map(opt => {
            if (typeof opt === 'object' && opt !== null) {
                return {
                    value: String(opt.value !== undefined ? opt.value : (opt.id || opt.label || '')),
                    label: String(opt.label || opt.name || opt.value || ''),
                    badge: opt.badge || opt.detail || ''
                };
            }
            return { value: String(opt), label: String(opt), badge: '' };
        });
    }

    _getFilteredOptions() {
        const all = this._getNormalizedOptions();
        const q = (this._filterText !== null ? this._filterText : '').trim().toLowerCase();
        if (!q) return all.slice(0, 60);
        return all.filter(o =>
            o.value.toLowerCase().includes(q) ||
            o.label.toLowerCase().includes(q) ||
            (o.badge && o.badge.toLowerCase().includes(q))
        ).slice(0, 60);
    }

    _commitValue(nextVal, closeMenu = true) {
        this.value = nextVal;
        if (closeMenu) {
            this._open = false;
            this._filterText = null;
            this._highlightedIndex = -1;
        }
        this.dispatchEvent(new CustomEvent('sutram-input-changed', {
            detail: { value: nextVal },
            bubbles: true,
            composed: true
        }));
    }

    _handleKeyDown(e) {
        const filtered = this._getFilteredOptions();
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!this._open) this._open = true;
            this._highlightedIndex = filtered.length > 0 ? (this._highlightedIndex + 1) % filtered.length : -1;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!this._open) this._open = true;
            this._highlightedIndex = filtered.length > 0 ? (this._highlightedIndex - 1 + filtered.length) % filtered.length : -1;
        } else if (e.key === 'Enter' && this._open && this._highlightedIndex >= 0 && filtered[this._highlightedIndex]) {
            e.preventDefault();
            this._commitValue(filtered[this._highlightedIndex].value, true);
        } else if (e.key === 'Escape' && this._open) {
            e.preventDefault();
            this._open = false;
            this._filterText = null;
        }
    }

    render() {
        const filtered = this._open ? this._getFilteredOptions() : [];
        return html`
            ${this.label ? html`<label class="combo-label">${this.label}</label>` : ''}
            <div class="combo-wrap">
                <input
                    class="combo-input"
                    type="text"
                    .value=${this.value ?? ''}
                    placeholder=${this.placeholder || ''}
                    ?disabled=${this.disabled}
                    @focus=${() => {
                        if (!this.disabled) {
                            this._open = true;
                            this._filterText = '';
                        }
                    }}
                    @input=${(e) => {
                        const v = e.target.value;
                        this._filterText = v;
                        this._open = true;
                        this._highlightedIndex = 0;
                        this._commitValue(v, false);
                    }}
                    @keydown=${(e) => this._handleKeyDown(e)}
                />
                <button
                    type="button"
                    class="combo-chevron"
                    tabindex="-1"
                    ?disabled=${this.disabled}
                    @click=${(e) => {
                        e.stopPropagation();
                        if (this.disabled) return;
                        this._open = !this._open;
                        this._filterText = '';
                    }}>
                    <yv-icon name="chevron-down" style="width: 14px; height: 14px;"></yv-icon>
                </button>
            </div>
            ${this._open && filtered.length > 0 ? html`
                <div class="combo-menu">
                    ${filtered.map((opt, idx) => html`
                        <button
                            type="button"
                            class="combo-option ${idx === this._highlightedIndex ? 'highlighted' : ''}"
                            @pointerdown=${(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                this._commitValue(opt.value, true);
                            }}>
                            <span class="combo-option-main">${opt.label}</span>
                            ${opt.badge ? html`<span class="combo-option-badge">${opt.badge}</span>` : ''}
                        </button>
                    `)}
                </div>
            ` : ''}
        `;
    }
}
if (!customElements.get('sutram-combobox')) customElements.define('sutram-combobox', SutramCombobox);

export class SutramTargetBinding extends SutramElement {
    static properties = {
        label: { type: String },
        value: { type: Object },
        endpoints: { type: Array },
        models: { type: Array },
        endpointKey: { type: String },
        modelKey: { type: String },
        endpointPlaceholder: { type: String },
        modelPlaceholder: { type: String },
        allowEmptyEndpoint: { type: Boolean },
        disabled: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true }
    };

    static styles = [sharedStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            gap: 4px;
            width: 100%;
            box-sizing: border-box;
        }
        .binding-label {
            font-size: 0.78rem;
            font-weight: 700;
            color: var(--text-muted);
        }
        .binding-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
            gap: 10px;
            align-items: center;
            width: 100%;
            min-width: 0;
        }
        .binding-grid > * {
            min-width: 0;
            width: 100%;
        }
        @media (max-width: 520px) {
            .binding-grid {
                grid-template-columns: 1fr;
            }
        }
    `];

    constructor() {
        super();
        this.label = '';
        this.value = { endpoint: '', model: '' };
        this.endpoints = [];
        this.models = [];
        this.endpointKey = 'endpoint';
        this.modelKey = 'model';
        this.endpointPlaceholder = 'Select endpoint...';
        this.modelPlaceholder = 'Select or type model...';
        this.allowEmptyEndpoint = false;
        this.disabled = false;
        this.flush = false;
    }

    _normalizeValue() {
        const epKey = this.endpointKey || 'endpoint';
        const modKey = this.modelKey || 'model';
        const raw = this.value;
        if (typeof raw === 'string') {
            if (raw.includes('::')) {
                const [ep, mod] = raw.split('::');
                return { [epKey]: ep.trim(), [modKey]: mod.trim() };
            }
            return { [epKey]: '', [modKey]: raw.trim() };
        }
        if (raw && typeof raw === 'object') {
            return {
                [epKey]: String(raw[epKey] || raw.endpoint_id || ''),
                [modKey]: String(raw[modKey] || '')
            };
        }
        return { [epKey]: '', [modKey]: '' };
    }

    _emitBinding(nextObj) {
        this.value = nextObj;
        this.dispatchEvent(new CustomEvent('sutram-input-changed', {
            detail: { value: nextObj },
            bubbles: true,
            composed: true
        }));
    }

    render() {
        const epKey = this.endpointKey || 'endpoint';
        const modKey = this.modelKey || 'model';
        const cur = this._normalizeValue();
        const epOptions = [];
        if (this.allowEmptyEndpoint) {
            epOptions.push({ value: '', label: this.endpointPlaceholder || 'Fallback / None' });
        }
        (this.endpoints || []).forEach(ep => {
            if (typeof ep === 'object' && ep !== null) {
                const val = String(ep.value !== undefined ? ep.value : (ep.id || ''));
                const lbl = String(ep.label || ep.title || val);
                if (val) epOptions.push({ value: val, label: lbl });
            } else if (ep) {
                epOptions.push({ value: String(ep), label: String(ep) });
            }
        });
        const selectedEp = cur[epKey] || (!this.allowEmptyEndpoint && epOptions[0]?.value) || '';
        const candidateModels = typeof this.models === 'function'
            ? this.models(selectedEp)
            : (Array.isArray(this.models) ? this.models : []);

        return html`
            ${this.label ? html`<span class="binding-label">${this.label}</span>` : ''}
            <div class="binding-grid">
                <sutram-select
                    ?flush=${true}
                    ?disabled=${this.disabled}
                    .value=${selectedEp}
                    .options=${epOptions}
                    @sutram-input-changed=${(e) => {
                        const nextEp = e.detail.value;
                        const nextModels = typeof this.models === 'function' ? this.models(nextEp) : (this.models || []);
                        const firstMod = nextModels[0] ? (typeof nextModels[0] === 'object' ? nextModels[0].value : nextModels[0]) : '';
                        const nextMod = nextEp ? (cur[modKey] || firstMod || '') : '';
                        this._emitBinding({ [epKey]: nextEp, [modKey]: nextMod });
                    }}>
                </sutram-select>
                <sutram-combobox
                    ?flush=${true}
                    ?disabled=${this.disabled || (!selectedEp && this.allowEmptyEndpoint)}
                    .value=${cur[modKey] || ''}
                    .placeholder=${this.modelPlaceholder || 'Select or type model...'}
                    .options=${candidateModels}
                    @sutram-input-changed=${(e) => {
                        this._emitBinding({ [epKey]: selectedEp, [modKey]: e.detail.value });
                    }}>
                </sutram-combobox>
            </div>
        `;
    }
}
if (!customElements.get('sutram-target-binding')) customElements.define('sutram-target-binding', SutramTargetBinding);