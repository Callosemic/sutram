// sutram/js/chassis_adapter.js
// Composite DAG Tree & Corner-Pinned Floating Telemetry HUD Primitives
import { html, css } from 'lit';
import { SutramElement } from './sutram_sdk.js';
import { sharedStyles } from './shared_styles.js';

export class SutramDagTree extends SutramElement {
    static properties = {
        stages: { type: Array },
        rootNode: { type: Object },
        nodes: { type: Array },
        renderNode: { type: Object },
        compact: { type: Boolean, reflect: true }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; gap: 14px; width: 100%; box-sizing: border-box; }
        .wavefront-stage { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; background: var(--input-bg); border: 1px solid var(--border); border-left: 4px solid var(--stage-accent, var(--intent-primary)); border-radius: 8px; position: relative; }
        .wavefront-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        .wavefront-title { font-family: var(--font-mono); font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text); display: inline-flex; align-items: center; gap: 6px; }
        .wavefront-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
        .stage-connector { display: flex; align-items: center; justify-content: center; height: 14px; margin: -7px 0; color: var(--text-muted); font-size: 0.75rem; user-select: none; }
        .dag-node-card { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease; }
        .dag-node-card:hover { border-color: var(--intent-primary); background: var(--bg-hover); }
        .tree-branch { position: relative; display: flex; flex-direction: column; padding-left: var(--branch-indent, 0px); }
        .tree-line-v { position: absolute; left: 10px; top: -12px; bottom: 0; width: 2px; background: var(--border); z-index: 1; }
        .tree-line-v.last { bottom: auto; height: 44px; }
        .tree-line-h { position: absolute; left: 10px; top: 30px; width: 18px; height: 2px; background: var(--border); z-index: 1; }
    `];

    constructor() {
        super();
        this.stages = [];
        this.rootNode = null;
        this.nodes = [];
        this.renderNode = null;
        this.compact = false;
    }

    _renderDefaultStageNode(node, stageIdx) {
        if (typeof this.renderNode === 'function') return this.renderNode(node, stageIdx);
        const nodeTitle = typeof node === 'string' ? node : (node.title || node.label || node.id || node.name || 'node');
        const badges = (typeof node === 'object' && Array.isArray(node.badges)) ? node.badges : [];
        const subtitle = (typeof node === 'object' && node.subtitle) ? String(node.subtitle) : '';
        const parents = (typeof node === 'object' && Array.isArray(node.parents)) ? node.parents : [];
        return html`
            <div class="dag-node-card" @click=${() => this.dispatch('sutram-dag-node-clicked', { node, stageIdx })}>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                    <span style="font-weight: bold; font-family: var(--font-mono); font-size: 0.85rem; color: var(--text);">${nodeTitle}</span>
                    ${badges.length > 0 ? html`
                        <div style="display: inline-flex; gap: 4px; align-items: center;">
                            ${badges.map(b => {
                                const text = typeof b === 'string' ? b : (b?.text || '');
                                const intent = (typeof b === 'object' && b?.intent) ? b.intent : 'primary';
                                return text ? html`<sutram-tag text=${text} intent=${intent}></sutram-tag>` : '';
                            })}
                        </div>
                    ` : ''}
                </div>
                ${subtitle ? html`<div style="font-size: 0.72rem; font-family: var(--font-mono); color: var(--intent-warning);">${subtitle}</div>` : ''}
                ${parents.length > 0 ? html`
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center; margin-top: 2px;">
                        <span style="font-size: 0.7rem; color: var(--text-muted);">🔗 Parents:</span>
                        ${parents.map(p => html`<span style="font-size: 0.7rem; font-family: var(--font-mono); background: var(--input-bg); border: 1px solid var(--border); padding: 1px 6px; border-radius: 4px;">${p}</span>`)}
                    </div>
                ` : ''}
            </div>
        `;
    }

    _renderHierarchyBranch(node, childMap, depth = 0, isLast = true) {
        if (!node) return '';
        const children = childMap[node.id] || [];
        return html`
            <div class="tree-branch" style="--branch-indent: ${depth > 0 ? '28px' : '0px'};">
                ${depth > 0 ? html`<div class="tree-line-v ${isLast ? 'last' : ''}"></div><div class="tree-line-h"></div>` : ''}
                ${typeof this.renderNode === 'function' ? this.renderNode(node, depth) : this._renderDefaultStageNode(node, depth)}
                ${children.length > 0 ? html`
                    <div style="display: flex; flex-direction: column; margin-left: ${depth === 0 ? '8px' : '0px'};">
                        ${children.map((c, idx) => this._renderHierarchyBranch(c, childMap, depth + 1, idx === children.length - 1))}
                    </div>
                ` : ''}
            </div>
        `;
    }

    render() {
        if (Array.isArray(this.stages) && this.stages.length > 0) {
            return html`
                ${this.stages.map((stageNodes, sIdx) => {
                    const list = Array.isArray(stageNodes) ? stageNodes : [stageNodes];
                    const isParallel = list.length > 1;
                    const stageIntent = isParallel ? 'highlight' : (sIdx === 0 ? 'primary' : 'success');
                    const accent = `var(--intent-${stageIntent})`;
                    return html`
                        ${sIdx > 0 ? html`<div class="stage-connector">↓</div>` : ''}
                        <div class="wavefront-stage" style="--stage-accent: ${accent};">
                            <div class="wavefront-header">
                                <span class="wavefront-title">
                                    <sutram-icon name=${isParallel ? 'git-branch' : 'layers'} size="sm" intent=${stageIntent}></sutram-icon>
                                    <span>Wavefront Stage ${sIdx + 1}${sIdx === 0 ? ' (Root)' : ''}</span>
                                </span>
                                <sutram-tag text=${isParallel ? `∥ Parallel Stage (${list.length} branches)` : 'Sequential Step'} intent=${isParallel ? 'highlight' : 'neutral'}></sutram-tag>
                            </div>
                            <div class="wavefront-grid">${list.map(n => this._renderDefaultStageNode(n, sIdx))}</div>
                        </div>
                    `;
                })}
            `;
        }
        if (this.rootNode) {
            const childMap = (Array.isArray(this.nodes) ? this.nodes : []).reduce((acc, item) => {
                const pid = item.parentId || item.parent_id;
                if (pid) (acc[pid] = acc[pid] || []).push(item);
                return acc;
            }, {});
            return html`${this._renderHierarchyBranch(this.rootNode, childMap, 0, true)}`;
        }
        return html`<slot></slot>`;
    }
}
if (!customElements.get('sutram-dag-tree')) customElements.define('sutram-dag-tree', SutramDagTree);

export class SutramFloatingHud extends SutramElement {
    static properties = {
        position: { type: String, reflect: true },
        icon: { type: String },
        badgeText: { type: String },
        titleText: { type: String },
        intent: { type: String, reflect: true },
        open: { type: Boolean, reflect: true }
    };
    static styles = [sharedStyles, css`
        :host { position: absolute; z-index: 60; display: inline-flex; flex-direction: column; pointer-events: auto; max-width: calc(100% - 24px); box-sizing: border-box; --hud-accent: var(--intent-primary); }
        :host([position="top-right"]), :host(:not([position])) { top: 12px; right: 16px; align-items: flex-end; }
        :host([position="top-left"]) { top: 12px; left: 16px; align-items: flex-start; }
        :host([position="bottom-right"]) { bottom: 12px; right: 16px; align-items: flex-end; }
        :host([position="bottom-left"]) { bottom: 12px; left: 16px; align-items: flex-start; }
        :host([intent="primary"]) { --hud-accent: var(--intent-primary); }
        :host([intent="success"]) { --hud-accent: var(--intent-success); }
        :host([intent="warning"]) { --hud-accent: var(--intent-warning); }
        :host([intent="danger"]) { --hud-accent: var(--intent-danger); }
        :host([intent="highlight"]) { --hud-accent: var(--intent-highlight); }
        :host([intent="neutral"]) { --hud-accent: var(--intent-neutral); }
        .hud-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; background: color-mix(in srgb, var(--pane-bg) 92%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid color-mix(in srgb, var(--hud-accent) 45%, var(--border)); color: var(--text); font-family: var(--font-mono, monospace); font-size: 0.75rem; font-weight: 700; cursor: pointer; box-shadow: var(--overlay-shadow); user-select: none; transition: border-color 0.15s ease, transform 0.1s ease; }
        .hud-pill:hover { border-color: var(--hud-accent); }
        .hud-drawer { margin-top: 6px; width: 340px; max-width: calc(100vw - 24px); max-height: min(68dvh, 480px); overflow-y: auto; overflow-x: hidden; }
        .hud-title { font-weight: 700; font-size: 0.8rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `];

    constructor() {
        super();
        this.position = 'top-right';
        this.icon = 'activity';
        this.badgeText = '';
        this.titleText = '';
        this.intent = 'primary';
        this.open = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this.registerOutsideClick(() => {
            if (this.open) {
                this.open = false;
                this.dispatch('sutram-hud-toggled', { open: false });
            }
        });
    }

    _toggleHud(e) {
        if (e) e.stopPropagation();
        this.open = !this.open;
        this.dispatch('sutram-hud-toggled', { open: this.open });
    }

    render() {
        return html`
            <button type="button" class="hud-pill" @click=${(e) => this._toggleHud(e)}>
                ${this.icon ? html`<sutram-icon name=${this.icon} size="sm" intent=${this.intent || 'primary'}></sutram-icon>` : ''}
                ${this.badgeText ? html`<span>${this.badgeText}</span>` : ''}
                <sutram-icon name=${this.open ? 'chevron-up' : 'chevron-down'} size="xs" intent="muted"></sutram-icon>
            </button>
            ${this.open ? html`
                <sutram-surface class="hud-drawer" variant="floating" .intent=${this.intent || 'primary'} padding="sm" gap="xs" @click=${(e) => e.stopPropagation()}>
                    <sutram-stack direction="row" justify="between" align="center" gap="xs">
                        <sutram-stack direction="row" align="center" gap="xs">
                            ${this.icon ? html`<sutram-icon name=${this.icon} size="sm" intent=${this.intent || 'primary'}></sutram-icon>` : ''}
                            <span class="hud-title" title=${this.titleText || this.badgeText || 'Status'}>${this.titleText || this.badgeText || 'Status'}</span>
                        </sutram-stack>
                        <slot name="header"></slot>
                    </sutram-stack>
                    <slot></slot>
                    <slot name="footer"></slot>
                </sutram-surface>
            ` : ''}
        `;
    }
}
if (!customElements.get('sutram-floating-hud')) customElements.define('sutram-floating-hud', SutramFloatingHud);
