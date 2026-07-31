import { LitElement, html, css } from 'lit';
import './pill.js';

export class YenvuiFilterGroup extends LitElement {
    static properties = {
        label: { type: String },
        items: { type: Array }, // [{id, label}]
        activeItems: { type: Array },
        allowAll: { type: Boolean }
    };

    static styles = css`
        .wrap { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
        .label { font-size: 0.85rem; font-weight: bold; color: var(--text, #e0e0e0); opacity: 0.8; margin-right: 5px; white-space: nowrap; user-select: none; }
    `;

    _handleToggle(e) {
        const { id, active } = e.detail;
        let newSet = new Set(this.activeItems);
        
        if (this.allowAll && id === 'ALL') {
            newSet.clear();
            newSet.add('ALL');
        } else {
            newSet.delete('ALL');
            if (active) newSet.add(id);
            else newSet.delete(id);
            if (newSet.size === 0 && this.allowAll) newSet.add('ALL');
        }
        
        this.dispatchEvent(new CustomEvent('yenvui-filter-changed', {
            detail: { activeItems: Array.from(newSet) },
            bubbles: true,
            composed: true
        }));
    }

    render() {
        const activeSet = new Set(this.activeItems);
        const visibleItems = this.items || [];
        const showAllPill = this.allowAll;

        return html`
            <div class="wrap" @yenvui-pill-toggled=${this._handleToggle}>
                ${this.label ? html`<span class="label">${this.label}</span>` : ''}
                ${showAllPill ? html`<yenvui-pill pillId="ALL" labelText="All" ?active=${activeSet.has('ALL')}></yenvui-pill>` : ''}
                ${visibleItems.map(item => html`
                    <yenvui-pill 
                        pillId=${item.id} 
                        labelText=${item.label} 
                        ?active=${activeSet.has(item.id)}>
                    </yenvui-pill>
                `)}
            </div>
        `;
    }
}
customElements.define('yenvui-filter-group', YenvuiFilterGroup);