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
            width: 100%; box-sizing: border-box; height: 28px; 
            background: var(--bg-deep, #05070a); border-top: 1px solid var(--border, #444); 
            padding: 0 12px; font-family: var(--font-mono, monospace); 
            font-size: 11px; color: var(--text-muted, #94a3b8); font-weight: normal; 
            line-height: 27px; white-space: nowrap; display: flex; 
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
        if (this.syncState === 'offline') icon = '⚡ Offline';
        if (this.syncState === 'reconciling') icon = '🌩️ Reconciling...';
        if (this.syncState === 'error') icon = '❌ Sync Error';

        return html`
            <div class="bottom-bar ${this.isError ? 'error' : ''}" title="${this.text}">
                <span class="text-content">${this.text}</span>
                <span class="sync-indicator">${icon}</span>
            </div>
        `;
    }
}
customElements.define('yenvui-status-bar', YenvuiStatusBar);