import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
export class YenvuiBtn extends YenvuiBase {
    static properties = {
        label: {},
        icon: {},
        intent: { type: String },
        variant: { type: String },
        size: { type: String },
        emphasis: { type: Boolean },
        btntype: { type: String },
        disabled: { type: Boolean },
        active: { type: Boolean }
    };

    createRenderRoot() { return this; }
    constructor() {
        super();
        this.label = '';
        this.icon = '';
        this.intent = 'primary';
        this.variant = 'tinted';
        this.emphasis = false;
        this.btntype = 'button';
        this.disabled = false;
        this.active = false;
    }

    render() {
        const renderIcon = (iconStr) => {
            if (!iconStr) return '';
            if (typeof iconStr === 'object') return iconStr;
            if (iconStr.includes('<')) return html`<span style="display: inline-flex; align-items: center; margin-right: 6px;">${iconStr}</span>`;
            if (/^[a-zA-Z0-9-]+$/.test(iconStr)) {
                return html`<yv-icon name="${iconStr}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>`;
            }
            return html`<span style="margin-right: 6px;">${iconStr}</span>`;
        };

        return html`
            <button 
                type="${this.btntype}"
                class="yv-btn yv-btn--${this.intent || 'primary'} yv-btn--${this.variant || 'tinted'} yv-btn--${this.size || 'md'} ${this.emphasis ? 'yv-btn--emphasis' : ''} ${this.active ? 'yv-btn--active' : ''}" 
                ?disabled=${this.disabled}
                @click=${(e) => {
                    if (!this.disabled) {
                        this.dispatchEvent(new CustomEvent('yv-click', { bubbles: true, composed: true, detail: { originalEvent: e } }));
                    }
                }}>
                ${renderIcon(this.icon)}${this.label}
            </button>
        `;
    }
}
customElements.define('yenvui-btn', YenvuiBtn);
export class YenvuiAsyncBtn extends YenvuiBase {
    static properties = {
        label: {},
        icon: {},
        loadingLabel: { type: String },
        successLabel: { type: String },
        errorLabel: { type: String },
        intent: { type: String },
        variant: { type: String },
        size: { type: String },
        emphasis: { type: Boolean },
        status: { type: String },
        btntype: { type: String },
        onClick: { type: Object },
        disabled: { type: Boolean },
        active: { type: Boolean },
        jobRoute: { type: String },
        jobPayload: { type: Object },
        onJobComplete: { type: Object },
        onJobProgress: { type: Object },
        onJobError: { type: Object }
    };

    createRenderRoot() { return this; }
    constructor() {
        super();
        this.label = '';
        this.icon = '';
        this.loadingLabel = '';
        this.successLabel = '';
        this.errorLabel = '';
        this.intent = 'primary';
        this.variant = 'tinted';
        this.emphasis = false;
        this.status = 'idle';
        this.btntype = 'button';
        this.disabled = false;
        this.active = false;
        this.jobRoute = '';
        this.jobPayload = null;
        this.onJobComplete = null;
        this.onJobProgress = null;
        this.onJobError = null;
    }

    async _handleClick(e) {
        if (this.disabled || this.status === 'loading') {
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }
            return;
        }

        this.dispatchEvent(new CustomEvent('yv-click', {  
            bubbles: true, 
            composed: true, 
            detail: { originalEvent: e } 
        }));

        if (this.onClick && typeof this.onClick === 'function') {
            try {
                this.status = 'loading';
                await this.onClick(e);
                this.status = 'success';
                setTimeout(() => { this.status = 'idle'; }, 2000);
            } catch (err) {
                this.status = 'error';
                console.error(err);
                setTimeout(() => { this.status = 'idle'; }, 2000);
            }
        }
    }
    render() {
        let text = this.label;
        let stateIcon = this.icon;
        if (this.status === 'loading') {
            text = this.loadingLabel || 'Working...';
            stateIcon = 'loader';
        } else if (this.status === 'success') {
            text = this.successLabel || 'Done';
            stateIcon = 'check';
        } else if (this.status === 'error') {
            text = this.errorLabel || 'Error';
            stateIcon = 'alert-triangle';
        }

        let activeIntent = this.intent;
        if (this.status === 'success') activeIntent = 'success';
        if (this.status === 'error') activeIntent = 'danger';

        const renderIcon = (iconStr) => {
            if (!iconStr) return '';
            if (typeof iconStr === 'object') return iconStr;
            if (iconStr.includes('<')) return html`<span style="display: inline-flex; align-items: center; margin-right: 6px;">${iconStr}</span>`;
            if (/^[a-zA-Z0-9-]+$/.test(iconStr)) {
                return html`<yv-icon name="${iconStr}" style="width: 14px; height: 14px; margin-right: ${text ? '6px' : '0'}; display: inline-block; vertical-align: middle;"></yv-icon>`;
            }
            return html`<span style="margin-right: ${text ? '6px' : '0'};">${iconStr}</span>`;
        };

        return html`
            <button 
                type="${this.btntype}"
                class="yv-btn yv-btn--${activeIntent || 'primary'} yv-btn--${this.variant || 'tinted'} yv-btn--${this.size || 'md'} ${this.emphasis ? 'yv-btn--emphasis' : ''} ${this.active ? 'yv-btn--active' : ''}" 
                ?disabled=${this.disabled || this.status === 'loading'}
                @click=${this._handleClick}>
                ${renderIcon(stateIcon)}${text}
            </button>
        `;
    }
}
customElements.define('yenvui-async-btn', YenvuiAsyncBtn);