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

const _safeDefine = (tag, ctor) => {
    if (typeof customElements !== 'undefined' && (!customElements.get || !customElements.get(tag))) {
        customElements.define(tag, ctor);
    }
};

export class SutramInput extends bridgeInputEvents(Input) {}
_safeDefine('sutram-input', SutramInput);

export class SutramSelect extends bridgeInputEvents(Select) {}
_safeDefine('sutram-select', SutramSelect);

export class SutramTextarea extends bridgeInputEvents(Textarea) {}
_safeDefine('sutram-textarea', SutramTextarea);

export class SutramToggle extends bridgeInputEvents(Toggle) {}
_safeDefine('sutram-toggle', SutramToggle);

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
                    <sutram-icon name="chevron-down" size="sm"></sutram-icon>
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
if (typeof customElements !== 'undefined' && !customElements.get('sutram-combobox')) customElements.define('sutram-combobox', SutramCombobox);

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
if (typeof customElements !== 'undefined' && !customElements.get('sutram-target-binding')) customElements.define('sutram-target-binding', SutramTargetBinding);

export class SutramComposer extends SutramElement {
    static properties = {
        value: { type: String },
        placeholder: { type: String },
        triggerPrefix: { type: String },
        triggers: { type: Array },
        activeTrigger: { type: Object },
        intent: { type: String, reflect: true },
        disabled: { type: Boolean, reflect: true },
        _menuOpen: { type: Boolean, state: true },
        _focused: { type: Boolean, state: true, reflect: true }
    };

    static styles = [sharedStyles, css`
        :host {
            display: block;
            width: 100%;
            box-sizing: border-box;
            --composer-accent: var(--intent-primary);
        }
        :host([intent="primary"]) { --composer-accent: var(--intent-primary); }
        :host([intent="success"]) { --composer-accent: var(--intent-success); }
        :host([intent="warning"]) { --composer-accent: var(--intent-warning); }
        :host([intent="danger"]) { --composer-accent: var(--intent-danger); }
        :host([intent="highlight"]) { --composer-accent: var(--intent-highlight); }

        .composer-shell {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px 12px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 10px;
            box-sizing: border-box;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        :host([_focused]) .composer-shell {
            border-color: var(--composer-accent);
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--composer-accent) 20%, transparent);
        }
        .composer-input-row {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            width: 100%;
            min-width: 0;
        }
        .composer-input-row > sutram-textarea {
            flex: 1 1 0%;
            min-width: 0;
            margin: 0;
        }
        .trigger-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 6px;
            background: color-mix(in srgb, var(--composer-accent) 16%, var(--bg));
            border: 1px solid color-mix(in srgb, var(--composer-accent) 45%, var(--border));
            color: var(--text);
            font-family: var(--font-mono, monospace);
            font-size: 0.78rem;
            font-weight: 700;
            cursor: pointer;
            white-space: nowrap;
            margin-top: 2px;
        }
        .trigger-pill:hover {
            border-color: var(--composer-accent);
        }
    `];

    constructor() {
        super();
        this.value = '';
        this.placeholder = 'Type a message or /command...';
        this.triggerPrefix = '/';
        this.triggers = [];
        this.activeTrigger = null;
        this.intent = 'primary';
        this.disabled = false;
        this._menuOpen = false;
        this._focused = false;
    }

    _selectTrigger(trig, remainingText = null) {
        this.activeTrigger = trig || null;
        this._menuOpen = false;
        if (remainingText !== null) {
            this.value = remainingText;
        }
        this.dispatchEvent(new CustomEvent('sutram-trigger-changed', {
            detail: { trigger: this.activeTrigger, remainingText: this.value },
            bubbles: true,
            composed: true
        }));
    }

    _handleTextInput(e) {
        let nextVal = e.detail?.value ?? '';
        const prefix = this.triggerPrefix ?? '/';
        const dd = this.shadowRoot?.querySelector('sutram-dropdown');
        if (prefix && Array.isArray(this.triggers) && this.triggers.length > 0 && nextVal.startsWith(prefix)) {
            const spaceIdx = nextVal.indexOf(' ');
            if (spaceIdx > prefix.length) {
                const candidateToken = nextVal.slice(prefix.length, spaceIdx).trim().toLowerCase();
                const matched = this.triggers.find(t => {
                    const tok = String(t.token || t.id || '').replace(/^\//, '').toLowerCase();
                    const alt = String(t.altToken || '').replace(/^\//, '').toLowerCase();
                    return tok === candidateToken || (alt && alt === candidateToken);
                });
                if (matched) {
                    nextVal = nextVal.slice(spaceIdx + 1);
                    this._selectTrigger(matched, nextVal);
                    if (dd) {
                        dd.open = false;
                        dd._searchQuery = '';
                    }
                }
            } else if (spaceIdx === -1) {
                const partialToken = nextVal.slice(prefix.length).trim();
                this._menuOpen = true;
                if (dd) {
                    dd.open = true;
                    dd._searchQuery = partialToken;
                }
            }
        } else if (this._menuOpen && dd && !nextVal.startsWith(prefix)) {
            this._menuOpen = false;
            dd.open = false;
            dd._searchQuery = '';
        }
        this.value = nextVal;
        this.dispatchEvent(new CustomEvent('sutram-input-changed', {
            detail: { value: this.value, activeTrigger: this.activeTrigger },
            bubbles: true,
            composed: true
        }));
    }

    _handleKeyDown(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!this.disabled) {
                this.dispatchEvent(new CustomEvent('sutram-composer-submit', {
                    detail: { value: this.value, activeTrigger: this.activeTrigger },
                    bubbles: true,
                    composed: true
                }));
            }
            return;
        }
        if (e.key === 'Backspace' && this.activeTrigger) {
            const innerTa = this.shadowRoot?.querySelector('sutram-textarea')?.querySelector('textarea') || e.target;
            const atStart = innerTa && innerTa.selectionStart !== undefined
                ? (innerTa.selectionStart === 0 && innerTa.selectionEnd === 0)
                : !this.value;
            if (atStart) {
                e.preventDefault();
                this._selectTrigger(null);
            }
        }
    }

    render() {
        const prefix = this.triggerPrefix ?? '/';
        const hasTriggers = Array.isArray(this.triggers) && this.triggers.length > 0;
        const menuItems = (this.triggers || []).map(t => ({
            id: t.id || t.token,
            token: t.token || t.id,
            label: t.label || `${prefix}${t.token || t.id}`,
            icon: t.icon || 'terminal',
            badge: t.badge || (t.token ? `${prefix}${t.token}` : ''),
            description: t.description || '',
            onClick: () => {
                const cleaned = (this.value || '').replace(/^\/(?:user:[a-zA-Z0-9_:-]*|[a-zA-Z0-9_:-]*)\s*/, '');
                this._selectTrigger(t, cleaned);
            }
        }));

        return html`
            <div class="composer-shell"
                @focusin=${() => { this._focused = true; }}
                @focusout=${() => { this._focused = false; }}>
                <slot name="header"></slot>
                <div class="composer-input-row">
                    <slot name="prefix">
                        ${hasTriggers ? html`
                            <sutram-dropdown
                                .items=${menuItems}
                                .open=${this._menuOpen}
                                ?searchable=${true}
                                searchPlaceholder="Search commands..."
                                direction="up"
                                align="left">
                                <button slot="trigger" type="button" class="trigger-pill" ?disabled=${this.disabled}>
                                    <sutram-icon name=${this.activeTrigger?.icon || 'terminal'} size="sm"></sutram-icon>
                                    <span>${this.activeTrigger ? (this.activeTrigger.pillLabel || this.activeTrigger.label || `${prefix}${this.activeTrigger.token || this.activeTrigger.id}`) : prefix}</span>
                                </button>
                            </sutram-dropdown>
                        ` : ''}
                    </slot>
                    <sutram-textarea
                        variant="ghost"
                        ?compact=${true}
                        ?flush=${true}
                        ?disabled=${this.disabled}
                        .value=${this.value || ''}
                        .placeholder=${this.placeholder || ''}
                        @keydown=${(e) => this._handleKeyDown(e)}
                        @sutram-input-changed=${(e) => this._handleTextInput(e)}>
                    </sutram-textarea>
                </div>
                <slot name="footer"></slot>
            </div>
        `;
    }
}
if (typeof customElements !== 'undefined' && !customElements.get('sutram-composer')) customElements.define('sutram-composer', SutramComposer);