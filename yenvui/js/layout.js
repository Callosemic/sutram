import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';

export class YenvuiView extends YenvuiBase {
    static properties = {
        titleText: { type: String },
        descriptionText: { type: String },
        flush: { type: Boolean, reflect: true },
        compact: { type: Boolean, reflect: true },
        noScroll: { type: Boolean, reflect: true },
        zen: { type: Boolean, reflect: true },
        size: { type: String, reflect: true },
        _hasFooterSlot: { type: Boolean, state: true }
    };

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            width: 100%;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
            background: var(--bg);
            box-sizing: border-box;
            container-type: inline-size;
            position: relative;
        }
        :host([zen]) {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100dvh;
            z-index: 99999;
            background: var(--bg-deep, #05070a);
            margin: 0;
            max-width: none;
            max-height: none;
            border: none;
            padding: 0;
        }
        .zen-exit-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 100000;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--input-bg);
            color: var(--text-muted);
            border: 1px solid var(--border);
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            opacity: 0.25;
            transition: opacity 0.2s ease, color 0.2s ease, border-color 0.2s ease;
            pointer-events: auto;
        }
        @media (hover: none) {
            .zen-exit-btn { opacity: 0.65; }
        }
        :host([zen]) .zen-exit-btn {
            display: inline-flex;
        }
        :host([zen]) .zen-exit-btn:hover {
            opacity: 1;
            color: var(--intent-danger);
            border-color: var(--intent-danger);
        }
        .view-header,
        .view-toolbar,
        .view-footer {
            flex-shrink: 0;
            width: 100%;
            box-sizing: border-box;
        }
        .view-overlay {
            position: relative;
            width: 100%;
            height: 0;
            overflow: visible;
            z-index: 40;
        }
        .view-body {
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            min-width: 0;
            width: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-x: none;
            touch-action: pan-y;
            padding: var(--yv-view-padding, 16px 20px);
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
        }
        :host([flush]) .view-body {
            padding: 0 !important;
        }
        :host([no-scroll]) .view-body,
        :host([noscroll]) .view-body {
            overflow: hidden !important;
        }
        :host([compact]),
        :host([size="compact"]) { --yv-view-max-width: var(--yv-view-compact, 540px); }
        :host([size="normal"]) { --yv-view-max-width: var(--yv-view-normal, 960px); }
        :host([size="wide"]) { --yv-view-max-width: var(--yv-view-wide, 1200px); }
        :host([size="full"]) { --yv-view-max-width: none; }
        .view-title-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            padding: 8px 0 12px 0;
            margin-bottom: 12px;
            border-bottom: 1px solid var(--border);
        }
        .view-title-text {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
        }
        .view-title-text h3 {
            margin: 0;
            font-size: 1.1rem;
            color: var(--text);
        }
        .view-title-desc {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-muted);
        }
        .view-title-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .view-footer.has-direct-actions {
            padding: 10px 14px;
            gap: 8px;
            border-top: 1px solid var(--border);
            background: var(--input-bg);
            display: flex;
            align-items: center;
        }
        .view-footer.has-direct-actions ::slotted(*) {
            flex: 1 1 0%;
        }
        .view-inner {
            width: 100%;
            max-width: var(--yv-view-max-width, none);
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            flex: 0 0 auto;
            min-width: 0;
        }
        :host([no-scroll]) .view-inner,
        :host([noscroll]) .view-inner {
            flex: 1 1 0%;
            min-height: 0;
            height: 100%;
        }
        :host([no-scroll]) .view-inner > ::slotted(*),
        :host([noscroll]) .view-inner > ::slotted(*) {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 1 0% !important;
            min-height: 0 !important;
            min-width: 0 !important;
            height: 100% !important;
            width: 100% !important;
        }
        @container (max-width: 480px) {
            :host(:not([flush])) .view-body {
                padding: 0;
            }
        }
    `;

    constructor() {
        super();
        this.titleText = '';
        this.descriptionText = '';
        this.flush = false;
        this.compact = false;
        this.noScroll = false;
        this.zen = false;
        this.size = '';
        this._hasFooterSlot = false;
        this._hasDirectFooterButtons = false;
    }

    _handleFooterSlotChange(e) {
        const els = e.target.assignedElements({ flatten: true });
        this._hasFooterSlot = els.length > 0;
        this._hasDirectFooterButtons = els.some(el => {
            const tag = el.tagName?.toLowerCase() || '';
            return tag.endsWith('-btn') || tag === 'button';
        });
        this.requestUpdate();
    }

    render() {
        return html`
            <div class="view-header"><slot name="header"></slot></div>
            <div class="view-toolbar"><slot name="toolbar"></slot></div>
            <div class="view-overlay"><slot name="overlay"></slot></div>
            <div class="view-body">
                <div class="view-inner">
                    ${this.titleText ? html`
                        <div class="view-title-bar">
                            <div class="view-title-text">
                                <h3>${this.titleText}</h3>
                                ${this.descriptionText ? html`<span class="view-title-desc">${this.descriptionText}</span>` : ''}
                            </div>
                            <div class="view-title-actions">
                                <slot name="header-actions"></slot>
                            </div>
                        </div>
                    ` : ''}
                    <slot></slot>
                </div>
            </div>
            <div class="view-footer ${this._hasDirectFooterButtons ? 'has-direct-actions' : ''}"><slot name="footer" @slotchange=${this._handleFooterSlotChange}></slot></div>
            ${this.zen ? html`
                <button
                    type="button"
                    class="zen-exit-btn"
                    title="Exit Focus Mode (Esc)"
                    @click=${(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.dispatchEvent(new CustomEvent('yenvui-view-exit-zen', {
                            bubbles: true,
                            composed: true
                        }));
                    }}>
                    <yenvui-icon name="minimize-2" size="md"></yenvui-icon>
                </button>
            ` : ''}
        `;
    }
}
if (!customElements.get('yenvui-view')) customElements.define('yenvui-view', YenvuiView);

export class YenvuiStack extends YenvuiBase {
    static properties = {
        direction: { type: String, reflect: true },
        columns: { type: String, reflect: true },
        gap: { type: String, reflect: true },
        align: { type: String, reflect: true },
        justify: { type: String, reflect: true },
        padding: { type: String, reflect: true },
        compact: { type: Boolean, reflect: true },
        grow: { type: Boolean, reflect: true },
        wrap: { type: Boolean, reflect: true },
        flex: { type: Boolean, reflect: true },
        scrollable: { type: Boolean, reflect: true },
        spanFull: { type: Boolean, reflect: true }
    };

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            width: 100%;
            flex-shrink: 0;
            gap: var(--yv-stack-gap, 12px);
            box-sizing: border-box;
            min-width: 0;
        }
        :host([direction="row"]) {
            flex-direction: row !important;
            align-items: center;
            width: auto;
        }
        :host([direction="col"]),
        :host([direction="column"]) {
            flex-direction: column;
            width: 100%;
        }
        :host([direction="grid"]) {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(var(--yv-grid-min-col, var(--yv-col-normal, 240px)), 1fr));
            width: 100%;
        }
        :host([direction="grid"]) ::slotted(yenvui-textarea:not([inline])) {
            grid-column: 1 / -1;
        }
        :host([compact]),
        :host([columns="compact"]) { --yv-grid-min-col: var(--yv-col-compact, 160px); }
        :host([columns="normal"]) { --yv-grid-min-col: var(--yv-col-normal, 240px); }
        :host([columns="wide"]) { --yv-grid-min-col: var(--yv-col-wide, 320px); }

        :host([gap="none"]) { --yv-stack-gap: 0px; }
        :host([gap="xs"]) { --yv-stack-gap: 4px; }
        :host([gap="normal"]),
        :host([gap="md"]) { --yv-stack-gap: 12px; }
        :host([compact]),
        :host([gap="compact"]),
        :host([gap="sm"]) { --yv-stack-gap: 8px; }
        :host([gap="wide"]),
        :host([gap="lg"]) { --yv-stack-gap: 16px; }
        :host([gap="xl"]) { --yv-stack-gap: 24px; }

        :host([align="start"]) { align-items: flex-start; }
        :host([align="center"]) { align-items: center; }
        :host([align="end"]) { align-items: flex-end; }
        :host([align="stretch"]) { align-items: stretch; }
        :host([align="baseline"]) { align-items: baseline; }

        :host([justify="start"]) { justify-content: flex-start; }
        :host([justify="center"]) { justify-content: center; }
        :host([justify="end"]) { justify-content: flex-end; }
        :host([justify="between"]) { justify-content: space-between; }
        :host([justify="around"]) { justify-content: space-around; }

        :host([padding="none"]) { padding: 0; }
        :host([padding="xs"]) { padding: 4px 8px; }
        :host([padding="compact"]),
        :host([padding="sm"]) { padding: 8px 12px; }
        :host([padding="normal"]),
        :host([padding="md"]) { padding: 12px 16px; }
        :host([padding="wide"]),
        :host([padding="lg"]) { padding: 16px 20px; }

        :host([grow]) ::slotted(*) { flex: 1 1 0%; }
        :host([wrap]) { flex-wrap: wrap; }
        :host([flex]) { flex: 1; min-height: 0; }
        :host([scrollable]) { overflow-y: auto; max-height: var(--yv-stack-max-height, 360px); }
        :host([flex][scrollable]) { max-height: none; }
        :host([spanfull]) { grid-column: 1 / -1; }
    `;

    constructor() {
        super();
        this.direction = 'col';
        this.columns = '';
        this.gap = 'md';
        this.align = '';
        this.justify = '';
        this.padding = '';
        this.compact = false;
        this.grow = false;
        this.wrap = false;
        this.flex = false;
        this.scrollable = false;
        this.spanFull = false;
    }

    render() {
        return html`<slot></slot>`;
    }
}
if (!customElements.get('yenvui-stack')) customElements.define('yenvui-stack', YenvuiStack);

export class YenvuiSurface extends YenvuiBase {
    static properties = {
        variant: { type: String, reflect: true },
        intent: { type: String, reflect: true },
        padding: { type: String, reflect: true },
        border: { type: String, reflect: true },
        gap: { type: String, reflect: true },
        align: { type: String, reflect: true },
        justify: { type: String, reflect: true },
        compact: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true },
        flex: { type: Boolean, reflect: true },
        interactive: { type: Boolean, reflect: true }
    };

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            gap: var(--yv-surface-gap, 10px);
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: var(--yv-surface-radius, 8px);
            padding: var(--yv-surface-padding, 14px 16px);
            box-sizing: border-box;
            min-width: 0;
            color: var(--text);
            --surface-accent: var(--intent-primary);
        }

        :host([intent="primary"]) { --surface-accent: var(--intent-primary); }
        :host([intent="success"]) { --surface-accent: var(--intent-success); }
        :host([intent="warning"]) { --surface-accent: var(--intent-warning); }
        :host([intent="danger"]) { --surface-accent: var(--intent-danger); }
        :host([intent="highlight"]) { --surface-accent: var(--intent-highlight); }
        :host([intent="neutral"]) { --surface-accent: var(--intent-neutral); }

        :host([variant="panel"]) {
            background: var(--input-bg);
        }
        :host([variant="inset"]) {
            background: var(--bg);
        }
        :host([variant="tinted"]) {
            background: color-mix(in srgb, var(--surface-accent) 10%, var(--input-bg));
            border-color: color-mix(in srgb, var(--surface-accent) 35%, var(--border));
        }
        :host([variant="floating"]) {
            background: color-mix(in srgb, var(--pane-bg) 95%, transparent);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            box-shadow: var(--overlay-shadow);
        }
        :host([variant="ghost"]) {
            background: transparent;
            border-color: transparent;
        }
        :host([variant="banner"]) {
            position: fixed;
            bottom: 30px;
            left: 0;
            right: 0;
            z-index: 1000;
            background: color-mix(in srgb, var(--surface-accent) 12%, var(--pane-bg));
            border: none;
            border-top: 1px solid color-mix(in srgb, var(--surface-accent) 45%, var(--border));
            --yv-surface-radius: 0px;
            --yv-surface-padding: 6px 12px;
        }
        :host([variant="dropzone"]) {
            background: color-mix(in srgb, var(--surface-accent) 10%, var(--input-bg));
            border: 1px dashed color-mix(in srgb, var(--surface-accent) 45%, var(--border));
            min-height: var(--yv-surface-min-h-wide, 300px);
            align-items: center;
            justify-content: center;
            --yv-surface-padding: 18px 20px;
        }
        :host([variant="bubble"]) {
            max-width: var(--yv-bubble-max-width, 88%);
            align-self: flex-start;
            background: var(--input-bg);
            --yv-surface-padding: 12px 14px;
            --yv-surface-gap: 4px;
        }
        :host([variant="bubble"][intent="primary"]) {
            align-self: flex-end;
            background: color-mix(in srgb, var(--surface-accent) 12%, var(--input-bg));
            border-color: color-mix(in srgb, var(--surface-accent) 35%, var(--border));
        }

        :host([flush]),
        :host([padding="none"]) { --yv-surface-padding: 0px; }
        :host([padding="xs"]) { --yv-surface-padding: 6px 10px; }
        :host([padding="normal"]),
        :host([padding="md"]) { --yv-surface-padding: 14px 16px; }
        :host([compact]),
        :host([padding="compact"]),
        :host([padding="sm"]) { --yv-surface-padding: 8px 12px; }
        :host([padding="wide"]),
        :host([padding="lg"]) { --yv-surface-padding: 18px 20px; }

        :host([gap="none"]) { --yv-surface-gap: 0px; }
        :host([gap="xs"]) { --yv-surface-gap: 4px; }
        :host([gap="normal"]),
        :host([gap="md"]) { --yv-surface-gap: 12px; }
        :host([compact]),
        :host([gap="compact"]),
        :host([gap="sm"]) { --yv-surface-gap: 8px; }
        :host([gap="wide"]),
        :host([gap="lg"]) { --yv-surface-gap: 16px; }

        :host([border="none"]) { border: none; }
        :host([border="top"]) { border: none; border-top: 1px solid var(--border); --yv-surface-radius: 0px; }
        :host([border="bottom"]) { border: none; border-bottom: 1px solid var(--border); --yv-surface-radius: 0px; }
        :host([border="left"]) { border-left: 4px solid var(--surface-accent); }

        :host([align="start"]) { align-items: flex-start; }
        :host([align="center"]) { align-items: center; }
        :host([align="end"]) { align-items: flex-end; }
        :host([align="stretch"]) { align-items: stretch; }

        :host([justify="start"]) { justify-content: flex-start; }
        :host([justify="center"]) { justify-content: center; }
        :host([justify="end"]) { justify-content: flex-end; }
        :host([justify="between"]) { justify-content: space-between; }
        :host([flex]) { flex: 1 1 0%; min-height: 0; }
        :host([interactive]) {
            cursor: pointer;
            user-select: none;
            transition: background 0.15s ease, border-color 0.15s ease;
        }
        :host([interactive]:hover) {
            background: var(--bg-hover);
            border-color: color-mix(in srgb, var(--surface-accent) 45%, var(--border));
        }

        :host-context([data-theme="e-ink"]) {
            background: var(--bg, #ffffff) !important;
            border-color: var(--border, #000000) !important;
            backdrop-filter: none !important;
        }
        :host-context([data-theme="e-ink"]):host([variant="floating"]) {
            border-width: 2px !important;
            box-shadow: 4px 4px 0 var(--surface-accent, #000000) !important;
        }
    `;

    constructor() {
        super();
        this.variant = 'panel';
        this.intent = '';
        this.padding = 'md';
        this.border = 'all';
        this.gap = 'sm';
        this.align = '';
        this.justify = '';
        this.compact = false;
        this.flush = false;
        this.flex = false;
        this.interactive = false;
    }

    render() {
        return html`<slot></slot>`;
    }
}
if (!customElements.get('yenvui-surface')) customElements.define('yenvui-surface', YenvuiSurface);

export class YenvuiActionBar extends YenvuiBase {
    static properties = {
        collapse: { type: String, reflect: true },
        align: { type: String, reflect: true },
        gap: { type: String, reflect: true },
        nowrap: { type: Boolean, reflect: true },
        _overflowing: { type: Boolean, reflect: true, attribute: 'data-overflow' }
    };

    static styles = css`
        :host {
            display: flex;
            align-items: center;
            gap: var(--yv-action-bar-gap, 8px);
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            flex-wrap: wrap;
        }
        :host([nowrap]) {
            flex-wrap: nowrap;
            overflow-x: auto;
            scrollbar-width: none;
        }
        :host([nowrap])::-webkit-scrollbar {
            display: none;
        }
        :host([gap="none"]) { --yv-action-bar-gap: 0px; }
        :host([gap="xs"]) { --yv-action-bar-gap: 4px; }
        :host([gap="compact"]),
        :host([gap="sm"]) { --yv-action-bar-gap: 8px; }
        :host([gap="normal"]),
        :host([gap="md"]) { --yv-action-bar-gap: 12px; }
        :host([gap="wide"]),
        :host([gap="lg"]) { --yv-action-bar-gap: 16px; }

        :host([align="start"]) { justify-content: flex-start; }
        :host([align="center"]) { justify-content: center; }
        :host([align="end"]) { justify-content: flex-end; }
        :host([align="between"]) { justify-content: space-between; }

        :host([data-overflow]:not([collapse="none"])) ::slotted(*) {
            --yv-btn-label-display: none;
            --yv-btn-label-gap: 0px;
        }
    `;

    constructor() {
        super();
        this.collapse = 'auto';
        this.align = 'start';
        this.gap = 'sm';
        this.nowrap = false;
        this._overflowing = false;
        this._expandedMinWidth = 0;
        this._measuring = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => {
                this._checkOverflow();
            });
            this._resizeObserver.observe(this);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
    }

    firstUpdated() {
        this._checkOverflow(true);
    }

    _checkOverflow(forceMeasure = false) {
        if (this._measuring || this.collapse === 'none') return;
        const availableWidth = this.clientWidth;
        if (availableWidth <= 0) return;

        // Fast hysteresis check when already collapsed: only re-measure if container grew enough
        if (this._overflowing && !forceMeasure && this._expandedMinWidth > 0 && availableWidth < this._expandedMinWidth) {
            return;
        }

        this._measuring = true;
        try {
            // Temporarily un-collapse and disable wrapping synchronously before paint to measure true single-line width
            const wasOverflowing = this._overflowing;
            if (wasOverflowing) {
                this.removeAttribute('data-overflow');
            }
            const prevWrap = this.style.flexWrap;
            this.style.flexWrap = 'nowrap';

            const neededWidth = this.scrollWidth;
            this.style.flexWrap = prevWrap;

            const isOverflow = neededWidth > availableWidth + 1;
            if (isOverflow) {
                this._expandedMinWidth = neededWidth + 4;
                this._overflowing = true;
                this.setAttribute('data-overflow', '');
            } else {
                this._expandedMinWidth = neededWidth;
                this._overflowing = false;
                this.removeAttribute('data-overflow');
            }
        } finally {
            this._measuring = false;
        }
    }

    render() {
        return html`<slot @slotchange=${() => { this._expandedMinWidth = 0; this._checkOverflow(true); }}></slot>`;
    }
}
if (!customElements.get('yenvui-action-bar')) customElements.define('yenvui-action-bar', YenvuiActionBar);

export class YenvuiSidebarLayout extends YenvuiBase {
    static properties = {
        intent: { type: String, reflect: true },
        drawerOpen: { type: Boolean, reflect: true },
        collapsed: { type: Boolean, reflect: true },
        navTitle: { type: String },
        navItems: { type: Array },
        activeNavId: { type: String },
        _hasSidebarSlot: { type: Boolean, state: true }
    };

    static styles = css`
        :host {
            display: flex;
            flex: 1 1 0%;
            min-height: 0;
            min-width: 0;
            width: 100%;
            height: 100%;
            position: relative;
            overflow: hidden;
            container-type: inline-size;
            background: var(--bg);
            --sidebar-accent: var(--intent-highlight);
        }
        :host([intent="primary"]) { --sidebar-accent: var(--intent-primary); }
        :host([intent="success"]) { --sidebar-accent: var(--intent-success); }
        :host([intent="warning"]) { --sidebar-accent: var(--intent-warning); }
        :host([intent="danger"]) { --sidebar-accent: var(--intent-danger); }
        :host([intent="highlight"]) { --sidebar-accent: var(--intent-highlight); }
        :host([intent="neutral"]) { --sidebar-accent: var(--intent-neutral); }

        .sidebar-backdrop {
            display: none;
        }
        .sidebar-rail {
            width: 240px;
            border-right: 1px solid var(--border);
            background: var(--input-bg);
            display: flex;
            flex-direction: column;
            padding: 10px;
            gap: 6px;
            flex-shrink: 0;
            box-sizing: border-box;
            overflow: hidden;
            z-index: 40;
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        :host([collapsed]) .sidebar-rail {
            display: none;
        }
        @container (max-width: 45rem) {
            .sidebar-rail,
            :host([collapsed]) .sidebar-rail {
                display: flex;
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                width: 260px;
                max-width: 82%;
                background: color-mix(in srgb, var(--pane-bg) 96%, transparent);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                box-shadow: var(--overlay-shadow, 0 12px 32px rgba(0, 0, 0, 0.45));
                transform: translateX(-105%);
            }
            :host([draweropen]) .sidebar-rail {
                transform: translateX(0);
            }
            :host([draweropen]) .sidebar-backdrop {
                display: block;
                position: absolute;
                inset: 0;
                background: var(--modal-backdrop, rgba(0, 0, 0, 0.45));
                z-index: 35;
            }
        }
        .sidebar-slot-wrap {
            flex: 1 1 0%;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .sidebar-divider {
            border: none;
            border-top: 1px solid var(--border);
            margin: 6px 0;
            width: 100%;
            flex-shrink: 0;
        }
        .nav-section {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex-shrink: 0;
        }
        .nav-header {
            font-size: 0.7rem;
            font-weight: 800;
            font-family: var(--font-mono);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--sidebar-accent);
            padding: 4px 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .nav-header-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--sidebar-accent);
        }
        .nav-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--text-muted);
            background: transparent;
            border: 1px solid transparent;
            border-left: 3px solid transparent;
            user-select: none;
            transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
            text-align: left;
            width: 100%;
            box-sizing: border-box;
            font-family: inherit;
        }
        .nav-item:hover {
            background: color-mix(in srgb, var(--item-accent, var(--sidebar-accent)) 8%, var(--bg-hover));
            color: var(--text);
        }
        .nav-item.active {
            background: color-mix(in srgb, var(--item-accent, var(--sidebar-accent)) 16%, var(--bg));
            color: var(--text);
            border-color: color-mix(in srgb, var(--item-accent, var(--sidebar-accent)) 40%, var(--border));
            border-left: 3px solid var(--item-accent, var(--sidebar-accent));
        }
        .nav-item-main {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }
        .nav-badge {
            background: var(--item-accent, var(--sidebar-accent));
            color: #ffffff;
            font-size: 0.7rem;
            font-family: var(--font-mono);
            padding: 1px 6px;
            border-radius: 10px;
            line-height: 1.3;
        }
        .nav-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--item-accent, var(--sidebar-accent));
            opacity: 0.35;
        }
        .nav-item.active .nav-dot {
            opacity: 1;
        }
        .stage-pane {
            flex: 1 1 0%;
            display: flex;
            flex-direction: column;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
            background: var(--bg);
        }
    `;

    constructor() {
        super();
        this.intent = 'highlight';
        this.drawerOpen = false;
        this.collapsed = false;
        this.navTitle = '';
        this.navItems = [];
        this.activeNavId = '';
        this._hasSidebarSlot = false;
    }

    render() {
        const items = Array.isArray(this.navItems) ? this.navItems : [];
        return html`
            <div class="sidebar-backdrop" @click=${() => {
                this.dispatchEvent(new CustomEvent('yenvui-drawer-closed', {
                    bubbles: true,
                    composed: true
                }));
            }}></div>
            <aside class="sidebar-rail">
                <div class="sidebar-slot-wrap">
                    <slot name="sidebar" @slotchange=${(e) => {
                        this._hasSidebarSlot = e.target.assignedNodes({ flatten: true }).length > 0;
                    }}></slot>
                </div>
                ${this._hasSidebarSlot && items.length > 0 ? html`<hr class="sidebar-divider">` : ''}
                ${items.length > 0 ? html`
                    <nav class="nav-section">
                        ${this.navTitle ? html`
                            <div class="nav-header">
                                <span>${this.navTitle}</span>
                                <span class="nav-header-dot"></span>
                            </div>
                        ` : ''}
                        ${items.map(item => {
                            const itemId = item.id || item.rawId || '';
                            const isActive = Boolean(this.activeNavId && (this.activeNavId === itemId || this.activeNavId === item.rawId));
                            const itemIntent = item.intent || this.intent || 'highlight';
                            const itemColor = `var(--intent-${itemIntent})`;
                            return html`
                                <button
                                    type="button"
                                    class="nav-item ${isActive ? 'active' : ''}"
                                    style="--item-accent: ${itemColor};"
                                    @click=${() => {
                                        this.dispatchEvent(new CustomEvent('yenvui-nav-selected', {
                                            detail: { id: itemId, item },
                                            bubbles: true,
                                            composed: true
                                        }));
                                    }}>
                                    <span class="nav-item-main">
                                        <yenvui-icon name=${item.icon || 'component'} size="sm" intent=${itemIntent}></yenvui-icon>
                                        <span>${item.label || itemId}</span>
                                    </span>
                                    ${item.badge !== undefined && item.badge !== null && item.badge !== '' && item.badge !== 0 ? html`
                                        <span class="nav-badge">${item.badge}</span>
                                    ` : html`
                                        <span class="nav-dot"></span>
                                    `}
                                </button>
                            `;
                        })}
                    </nav>
                ` : ''}
            </aside>
            <main class="stage-pane">
                <slot></slot>
            </main>
        `;
    }
}
if (!customElements.get('yenvui-sidebar-layout')) customElements.define('yenvui-sidebar-layout', YenvuiSidebarLayout);
