import { LitElement, html, css } from 'lit';
export class YenvuiStatusBar extends LitElement {
    static properties = {
        text: { type: String },
        isError: { type: Boolean },
        syncState: { type: String }
    };
    static styles = css`
        :host { display: block; width: 100%; flex-shrink: 0; z-index: 1000; }
        .bottom-bar {
            width: 100%; box-sizing: border-box; height: 30px; 
            background: var(--bg, #121212); border-top: 1px solid var(--border, #444); 
            padding: 0 15px; font-family: var(--font-mono, monospace); 
            font-size: 0.8rem; color: var(--text, #e0e0e0); font-weight: bold; 
            line-height: 29px; white-space: nowrap; display: flex; 
            justify-content: space-between; align-items: center;
        }
        .bottom-bar.error {
            color: var(--intent-danger, #ef4444);
        }
        .text-content {
            overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;
        }
        .sync-indicator {
            flex-shrink: 0; font-weight: normal; opacity: 0.8; margin-left: 15px;
        }
    `;

    constructor() {
        super();
        this.text = '';
        this.isError = false;
        this.syncState = 'synced';
    }

    render() {
        let icon = '';
        if (this.syncState === 'pending') icon = '🟡 Pending Sync';
        if (this.syncState === 'syncing') icon = '🔄 Syncing...';
        if (this.syncState === 'synced') icon = '✅ Synced';

        return html`
            <div class="bottom-bar ${this.isError ? 'error' : ''}" title="${this.text}">
                <span class="text-content">${this.text}</span>
                <span class="sync-indicator">${icon}</span>
            </div>
        `;
    }
}
customElements.define('yenvui-status-bar', YenvuiStatusBar);