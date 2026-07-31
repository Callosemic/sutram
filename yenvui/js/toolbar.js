import { LitElement, html, css } from 'lit';
import './search-bar.js';
import './dropdown.js';

export class YenvuiToolbar extends LitElement {
    static properties = {
        searchQuery: { type: String },
        searchPlaceholder: { type: String },
        enableFilterDropdown: { type: Boolean },
        filterText: { type: String },
        activeFilters: { type: Array },
        hasFiltersOverride: { type: Boolean },
        bottomBorder: { type: Boolean }
    };
    
    static styles = css`
        :host { display: contents; }
        .sticky-header {
            position: relative;
            flex-shrink: 0;
            padding: 0;
            background: var(--bg, #121212);
            z-index: 10;
            border-bottom: 1px solid var(--border, #444);
            display: flex;
            flex-direction: column;
        }
        .toolbar-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 5px 15px;
            height: 44px;
            box-sizing: border-box;
        }
        .bottom-border { border-bottom: 1px solid var(--border, #444); }
    `;

    constructor() {
        super();
        this.searchQuery = '';
        this.searchPlaceholder = 'Search...';
        this.enableFilterDropdown = false;
        this.filterText = '';
        this.activeFilters = [];
        this.hasFiltersOverride = false;
        this.bottomBorder = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this._themeObserver = new MutationObserver(() => {
            this.setAttribute('data-theme', document.body.getAttribute('data-theme') || 'dark');
        });
        this._themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
        this.setAttribute('data-theme', document.body.getAttribute('data-theme') || 'dark');
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._themeObserver) this._themeObserver.disconnect();
    }

    render() {
        let btnText = this.filterText;
        let hasF = this.hasFiltersOverride || false;
        if (!btnText && this.activeFilters) {
            const active = this.activeFilters.filter(r => r !== 'ALL');
            if (active.length > 0) {
                btnText = `Filters: ${active.slice(0, 2).join(', ')}${active.length > 2 ? '...' : ''}`;
                hasF = true;
            } else {
                btnText = 'Filters';
            }
        }

        return html`
            <div class="sticky-header">
                <div class="toolbar-row ${this.bottomBorder ? 'bottom-border' : ''}">
                    <yenvui-search-bar 
                        style="flex: 1;"
                        .placeholder=${this.searchPlaceholder} 
                        .value=${this.searchQuery} 
                        @yenvui-search-changed=${(e) => this.dispatchEvent(new CustomEvent('search-changed', { detail: e.detail, bubbles: true, composed: true }))}>
                    </yenvui-search-bar>
                    ${this.enableFilterDropdown ? html`
                        <yenvui-filter-dropdown filterText=${btnText} .hasFilters=${hasF}>
                            <slot name="filters"></slot>
                        </yenvui-filter-dropdown>
                    ` : ''}
                </div>
                <slot name="bottom-row"></slot>
            </div>
        `;
    }
}
customElements.define('yenvui-toolbar', YenvuiToolbar);