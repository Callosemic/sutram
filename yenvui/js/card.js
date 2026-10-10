import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
import { YenvuiGestureController } from './physics.js';

export class YenvuiCard extends YenvuiBase {
    static properties = {
        titleText: { type: String },
        detailText: { type: String },
        detailPrefix: { type: String },
        detailSuffix: { type: String },
        descriptionText: { type: String },
        statusText: { type: String },
        icon: { type: String },
        intentColor: { type: String },
        intent: { type: String },
        selected: { type: Boolean, reflect: true },
        disableSelection: { type: Boolean },
        _overlayActive: { type: Boolean, reflect: true },
        _hasActions: { type: Boolean, reflect: true, attribute: 'has-actions' },
        compact: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true },
        stale: { type: Boolean, reflect: true }
    };
    static styles = css`
        :host { display: block; margin-bottom: var(--card-margin-bottom, 12px); position: relative; touch-action: pan-x pan-y; }
        .card-wrapper {
            touch-action: pan-x pan-y;
            background: var(--bg-card, var(--input-bg));
            border: 1px solid var(--border);
            border-top: var(--card-border-top, 1px solid var(--border));
            border-top-left-radius: var(--card-border-top-left-radius, var(--card-border-radius, 8px));
            border-top-right-radius: var(--card-border-top-right-radius, var(--card-border-radius, 8px));
            border-bottom-left-radius: var(--card-border-bottom-left-radius, var(--card-border-radius, 8px));
            border-bottom-right-radius: var(--card-border-bottom-right-radius, var(--card-border-radius, 8px));
            display: flex;
            flex-direction: row;
            position: relative;
            box-sizing: border-box;
            overflow: visible;
            box-shadow: var(--card-box-shadow, 0 1px 3px rgba(0,0,0,0.05));
            transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        /* Switch to edge-to-edge flush mode when the container column becomes narrow */
        @container (max-width: 480px) {
            .card-wrapper {
                border-left-width: 0 !important;
                border-right-width: 0 !important;
                border-radius: 0 !important;
                margin-bottom: 0 !important;
                border-bottom-width: 1px !important;
                border-bottom-style: solid !important;
            }
            .selection-strip {
                border-radius: 0 !important;
            }
            .action-grip-rail {
                border-radius: 0 !important;
            }
            .actions-tray {
                border-radius: 0 !important;
            }
        }
        .selection-strip {
            width: 14px !important;
            min-width: 14px !important;
            max-width: 14px !important;
            flex-shrink: 0 !important;
            cursor: pointer;
            box-sizing: border-box !important;
            position: relative;
            background: transparent !important;
            border-left: 4px solid var(--card-intent, var(--intent-primary));
            border-right: none !important;
            border-top: none !important;
            border-bottom: none !important;
            border-top-left-radius: var(--card-border-top-left-radius, var(--card-border-radius, 8px));
            border-bottom-left-radius: var(--card-border-bottom-left-radius, var(--card-border-radius, 8px));
            opacity: var(--peek-rail-opacity, 1);
            transition: opacity 0.3s ease, border-left-width 0.15s ease, box-shadow 0.15s ease;
        }
        @media (hover: hover) {
            .selection-strip:hover {
                border-left-width: 6px;
            }
            .card-wrapper:hover {
                border-color: var(--border-hover, var(--card-intent, var(--intent-primary)));
                background: var(--bg-card-hover, var(--bg-hover));
            }
        }
        :host([selected]) .card-wrapper,
        :host([_overlayactive]) .card-wrapper {
            background: var(--bg-card-selected, color-mix(in srgb, var(--card-intent, var(--intent-primary)) var(--intent-bg-mix, 15%), var(--input-bg))) !important;
            border-color: var(--border-highlight, var(--card-intent, var(--intent-primary))) !important;
        }

        :host([selected]) .selection-strip {
            border-left-width: 14px !important;
            border-left-color: var(--card-intent, var(--intent-primary)) !important;
            box-shadow: 2px 0 10px rgba(99, 102, 241, 0.45);
        }
        :host([stale]) .card-wrapper {
            opacity: 0.6;
            pointer-events: none;
            filter: grayscale(0.3);
            border-style: dashed;
            transition: opacity 0.2s ease, filter 0.2s ease;
        }
        .content-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            padding: 12px;
            transform: translateY(var(--peek-content-y, 0px));
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 4px;
        }
        .card-title {
            font-weight: bold;
            color: var(--text, #e0e0e0);
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            gap: 8px;
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        .card-desc {
            color: var(--text-muted, #888);
            font-size: 0.8rem;
            overflow-wrap: anywhere;
            word-break: break-word;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin-bottom: 4px;
        }
        .card-body {
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-width: 0;
        }
        :host([flush]) .card-body {
            padding: 0;
        }
        ::slotted(*) {
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        ::slotted(p), ::slotted(h1), ::slotted(h2), ::slotted(h3), ::slotted(h4), ::slotted(h5), ::slotted(h6) {
            margin-block-start: 0;
            margin-block-end: 0;
        }
        .card-detail {
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            color: var(--text-muted, #888);
            opacity: 0.8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        @container (max-width: 480px) {
            .card-detail-main { display: none; }
        }
        .action-grip-rail {
            width: 26px;
            flex-shrink: 0;
            background: var(--rail-bg, rgba(255,255,255,0.02));
            border-left: 1px solid var(--border);
            border-top-right-radius: var(--card-border-top-right-radius, var(--card-border-radius, 8px));
            border-bottom-right-radius: var(--card-border-bottom-right-radius, var(--card-border-radius, 8px));
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            opacity: var(--peek-rail-opacity, 1);
            transition: opacity 0.3s ease, background 0.15s ease, color 0.15s ease;
        }
        :host([has-actions]) .action-grip-rail {
            display: flex;
        }
        .action-grip-rail i { transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        :host([_overlayactive]) .action-grip-rail i { transform: rotate(180deg); }
        .action-grip-rail:hover {
            background: var(--rail-hover, rgba(99, 102, 241, 0.22));
            color: var(--text);
        }
        .actions-tray {
            position: absolute;
            left: 0;
            right: 26px;
            top: 0;
            bottom: 0;
            background: var(--bg-card, var(--input-bg));
            background: color-mix(in srgb, var(--bg-card, var(--input-bg)) 94%, transparent);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 5px;
            padding: 4px 8px;
            opacity: 0;
            pointer-events: none;
            transform: translateX(10px);
            transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 10;
            overflow: hidden;
            border-top-left-radius: var(--card-border-top-left-radius, var(--card-border-radius, 8px));
            border-bottom-left-radius: var(--card-border-bottom-left-radius, var(--card-border-radius, 8px));
            border-top-right-radius: var(--card-border-top-right-radius, var(--card-border-radius, 8px));
            border-bottom-right-radius: var(--card-border-bottom-right-radius, var(--card-border-radius, 8px));
        }
        .actions-wrapper {
            display: flex;
            justify-content: flex-start;
            align-items: center;
            flex-wrap: nowrap;
            gap: 6px;
            overflow-x: auto;
            scrollbar-width: none;
            width: 100%;
            box-sizing: border-box;
        }
        .actions-wrapper::-webkit-scrollbar {
            display: none;
        }
        .actions-wrapper::before, .actions-wrapper::after {
            content: ''; margin: auto;
        }

        :host([_overlayactive]) .actions-tray {
            opacity: 1;
            pointer-events: auto;
            transform: translateX(0);
        }
        .tray-caption {
            font-size: 0.65rem;
            font-weight: 700;
            font-family: var(--font-mono, monospace);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            user-select: none;
            max-width: 90%;
            text-align: center;
            margin: 0;
        }
        /* Unstyled slots for host-injected buttons */
        ::slotted(button), ::slotted(sutram-btn), ::slotted(sutram-async-btn), ::slotted(yenvui-btn), ::slotted(yenvui-async-btn) {
            height: 30px;
            padding: 0 10px !important;
            font-size: 0.75rem !important;
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
            gap: 5px;
            white-space: nowrap;
            margin: 0 !important;
        }

        /* E-Ink High Contrast Overrides */
        :host-context([data-theme="e-ink"]) .card-wrapper {
            border: 2px solid var(--card-intent, #8b5cf6) !important;
            box-shadow: 3px 4px 0 #14b8a6 !important; /* Colorful Teal Bottom Shadow */
            background: #ffffff !important;
            color: #000000 !important;
            transition: none !important;
        }
        :host-context([data-theme="e-ink"]):host([selected]) .card-wrapper,
        :host-context([data-theme="e-ink"]):host([_overlayactive]) .card-wrapper {
            border: 2px solid #ec4899 !important;
            box-shadow: 3px 4px 0 #eab308 !important; /* Yellow Bottom Shadow on Selected */
        }

        :host-context([data-theme="e-ink"]) .selection-strip {
            border-left-width: 5px !important;
        }
        :host-context([data-theme="e-ink"]):host([selected]) .selection-strip,
        :host-context([data-theme="e-ink"]):host([_overlayactive]) .selection-strip {
            border-left-width: 14px !important;
            border-left-color: #ec4899 !important; /* Hot Pink thick slab */
        }

        :host-context([data-theme="e-ink"]) .action-grip-rail {
            background: #8b5cf6 !important;
            border-left: 2px solid #000000 !important;
            color: #ffffff !important;
            font-weight: 900 !important;
        }
        :host-context([data-theme="e-ink"]):host([selected]) .action-grip-rail,
        :host-context([data-theme="e-ink"]):host([_overlayactive]) .action-grip-rail {
            background: #ec4899 !important;
        }

        :host-context([data-theme="e-ink"]) .actions-tray {
            background: #ffffff !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border-right: 2px solid #000000 !important;
            transition: none !important;
            transform: none !important;
        }
        :host-context([data-theme="e-ink"]) .tray-caption,
        :host-context([data-theme="e-ink"]) .card-title {
            color: #000000 !important;
            font-weight: 900 !important;
        }
        :host-context([data-theme="e-ink"]) .card-desc,
        :host-context([data-theme="e-ink"]) .card-detail {
            color: #000000 !important;
            opacity: 1 !important;
            font-weight: 600 !important;
        }

        /* --- Compact Mode Variant --- */
        :host([compact]) {
            margin-bottom: 8px;
        }
        :host([compact]) .card-wrapper {
            align-items: center;
        }
        :host([compact]) .content-col {
            flex-direction: row;
            align-items: center;
            padding: 6px 12px;
        }
        :host([compact]) .card-header {
            margin-bottom: 0;
        }
        :host([compact]) .card-title {
            font-size: 0.85rem;
        }
        :host([compact]) .card-desc,
        :host([compact]) .card-body {
            display: none;
        }
        :host([compact]) .card-detail {
            padding: 0 0 0 10px;
            margin-left: auto;
        }
        .selection-hit-zone {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 30px;
            z-index: 5;
            cursor: pointer;
        }
        :host([_overlayactive]) .selection-hit-zone {
            display: none;
        }
        @media (hover: hover) {
            .selection-hit-zone:hover + .selection-strip {
                border-left-width: 6px;
            }
        }
    `;
    constructor() {
        super();
        this._overlayActive = false;
        this._hasActions = false;
        this.selected = false;
        this._isPanning = false;

        this._overlayListener = (e) => {
            if (e.detail.source !== this && this._overlayActive) {
                this._overlayActive = false;
            }
        };
        this._focusOutListener = (e) => {
            if (!this.contains(e.relatedTarget) && this._overlayActive) {
                this._overlayActive = false;
            }
        };
    }
    _initGestureController() {
        if (this._gestureController) return;

        this._gestureController = new YenvuiGestureController(this, {
            scrollableContainerSelector: 'actions-wrapper',
            onPanStart: (startX, startY) => {
                const rect = this.getBoundingClientRect();
                this._cardWidth = rect.width;
                this._localStartX = startX - rect.left;
                const wrapper = this.shadowRoot.querySelector('.actions-wrapper');
                this._actionsScrollLeft = wrapper ? wrapper.scrollLeft : null;
                this._initialScrollLeft = this._actionsScrollLeft;
            },
            onPanMove: (x, y, axis) => {
                if (axis !== 'horizontal') return;
                if (this._overlayActive) {
                    const deltaX = this._gestureController.startX - x;
                    const wrapper = this.shadowRoot.querySelector('.actions-wrapper');
                    if (wrapper && this._initialScrollLeft !== null) {
                        let newScroll = this._initialScrollLeft + deltaX;

                        if (this._drawerRafId) cancelAnimationFrame(this._drawerRafId);
                        this._drawerRafId = requestAnimationFrame(() => {
                            if (newScroll < 0) {
                                wrapper.style.transform = `translateX(${Math.abs(newScroll) * 0.4}px)`;
                            } else {
                                wrapper.style.transform = `translateX(0px)`;
                                wrapper.scrollLeft = newScroll;
                            }
                        });
                    }
                }
            },
            onPanEnd: (endX, endY, axis) => {
                if (axis !== 'horizontal') return;
                const deltaX = this._gestureController.startX - endX;

                if (Math.abs(deltaX) > 10) {
                    this._isPanning = true;
                    setTimeout(() => this._isPanning = false, 150);
                }

                if (this._overlayActive) {
                    const wrapper = this.shadowRoot.querySelector('.actions-wrapper');
                    if (wrapper) {
                        wrapper.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
                        wrapper.style.transform = `translateX(0px)`;
                        setTimeout(() => { wrapper.style.transition = ''; }, 200);

                        const newScroll = this._initialScrollLeft + deltaX;
                        if (newScroll < -(this._cardWidth * 0.2)) {
                            this._overlayActive = false;
                        }
                    }
                    return;
                }

                if (Math.abs(deltaX) > 30) {
                    const isLeftSwipe = deltaX > 30;
                    const isRightSwipe = deltaX < -30;

                    const isLeftSide = this._localStartX < (this._cardWidth * 0.30);
                    const isRightSide = this._localStartX > (this._cardWidth * 0.70);

                    if (isLeftSide && isRightSwipe && !this.disableSelection) {
                        this._toggleSelection();
                    } else if (isRightSide && isLeftSwipe) {
                        const hasActions = this._hasActions || !!this.querySelector('[slot="actions"]');
                        if (hasActions) {
                            this._overlayActive = true;
                        }
                    }
                }
            }
        });
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('focusout', this._focusOutListener);
        document.addEventListener('yenvui-overlay-opened', this._overlayListener);
        this.registerOutsideClick(() => {
            if (this._overlayActive) this._overlayActive = false;
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('focusout', this._focusOutListener);
        document.removeEventListener('yenvui-overlay-opened', this._overlayListener);
        if (this._gestureController && typeof this._gestureController.abort === 'function') {
            this._gestureController.abort();
        }
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('_overlayActive') && this._overlayActive) {
            this.dispatchEvent(new CustomEvent('yenvui-overlay-opened', {
                bubbles: true,
                composed: true,
                detail: { source: this }
            }));
        }
        // Self-Healing Wrapper: Reset transient overlay state if Lit recycles the DOM node for a new item
        if (changedProperties.has('entityData') || changedProperties.has('filename') || changedProperties.has('titleText')) {
            const oldFilename = changedProperties.get('filename');
            const oldTitle = changedProperties.get('titleText');

            const filenameChanged = changedProperties.has('filename') && oldFilename !== this.filename;
            const titleChanged = changedProperties.has('titleText') && oldTitle !== this.titleText;

            if (this._overlayActive && (filenameChanged || titleChanged)) {
                this._overlayActive = false;
            }
        }
    }

    _toggleSelection() {
        this.selected = !this.selected;
        this.dispatchEvent(new CustomEvent('yenvui-card-select-toggled', {
            detail: { selected: this.selected },
            bubbles: true,
            composed: true
        }));
    }
    firstUpdated() {
        this._checkActions();
    }

    _checkActions() {
        const slot = this.shadowRoot.querySelector('slot[name="actions"]');
        if (slot) {
            const elements = slot.assignedElements({ flatten: true });
            this._hasActions = elements.length > 0;
        } else {
            this._hasActions = !!this.querySelector('[slot="actions"]');
        }
    }

    _handleSlotChange(e) {
        this._checkActions();
    }
    render() {
        const isSingleRow = !this.descriptionText && !this.detailText;
        const resolvedIntent = this.intent ? `var(--intent-${this.intent})` : (this.intentColor || 'var(--intent-neutral)');
        return html`
            <div class="card-wrapper" style="--card-intent: ${resolvedIntent}"
                @mouseleave=${() => { if (window.matchMedia('(hover: hover)').matches && (!this._gestureController || !this._gestureController.active)) this._overlayActive = false; }}
                @pointerdown=${(e) => { this._initGestureController(); this._gestureController.start(e); }}>

                ${!this.disableSelection ? html`<div class="selection-hit-zone" title="Select Item" @click=${(e) => { e.stopPropagation(); this._toggleSelection(); }}></div><div class="selection-strip"></div>` : ''}
                <div class="content-col" @click=${(e) => {
                    this.dispatchEvent(new CustomEvent('yenvui-card-clicked', {
                        detail: { filename: this.filename, isSource: true },
                        bubbles: true,
                        composed: true
                    }));
                }} style="cursor: pointer; padding: 12px; min-width: 0;">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; gap: 8px;">
                        <div class="card-title" style="display: flex; align-items: center; gap: 6px; font-weight: bold; color: var(--text); font-size: 0.85rem; min-width: 0; overflow: hidden;">
                            ${this.icon && this.icon.startsWith('<i') ? html`<div style="flex-shrink: 0;" .innerHTML=${this.icon}></div>` : (this.icon ? (/^[a-zA-Z0-9-]+$/.test(this.icon) ? html`<yv-icon name="${this.icon}" style="width: 14px; height: 14px; color: var(--card-intent, var(--intent-primary)); flex-shrink: 0;"></yv-icon>` : html`<span style="flex-shrink: 0;">${this.icon}</span>`) : '')}
                            <yenvui-scrub-track style="flex: 1; min-width: 0;">
                                ${this.titleText}
                            </yenvui-scrub-track>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            ${this.statusText ? html`<span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin-right: 4px;">${this.statusText}</span>` : ''}
                            <slot name="header-actions"></slot>
                            ${this.detailSuffix ? html`
                                <div class="card-detail-suffix" style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); opacity: 0.8; flex-shrink: 0; margin-left: 8px;">
                                    ${this.detailSuffix.replace(/^[\s|]+/, '')}
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    ${this.descriptionText ? html`
                        <div class="card-desc" style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${this.descriptionText}
                        </div>
                    ` : ''}
                    ${this.detailText ? html`
                        <div class="card-detail" style="font-family: var(--font-mono); font-size: 10px; color: var(--card-intent, var(--intent-primary)); opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${this.detailPrefix || ''}${this.detailText}
                        </div>
                    ` : ''}

                    <div class="card-body">
                        <slot></slot>
                    </div>

                    <slot name="detail"></slot>
                    <slot name="inline-actions"></slot>
                </div>
                <div class="action-grip-rail"  
                    @pointerenter=${(e) => { if (e.pointerType === 'mouse') this._overlayActive = true; }}
                    @click=${(e) => { e.stopPropagation(); e.preventDefault(); this._overlayActive = !this._overlayActive; }}>
                    <yv-icon name="chevron-left" style="width: 14px; height: 14px;"></yv-icon>
                </div>
                <div class="actions-tray" @click=${{handleEvent: (e) => { 
                    if (this._isPanning) { e.stopPropagation(); e.preventDefault(); return; }

                    const path = e.composedPath ? e.composedPath() : [];
                    const isDropdownTrigger = path.some(el => el.tagName === 'SUTRAM-DROPDOWN' || el.tagName === 'YENVUI-DROPDOWN');
                    const isMenuItem = path.some(el => el.classList && el.classList.contains('menu-item'));

                    // If we clicked the dropdown trigger itself, abort so the menu can open
                    if (isDropdownTrigger && !isMenuItem) return;
                    const isActionable = path.some(el => {
                        if (!el.tagName) return false;
                        const tag = el.tagName.toUpperCase();
                        if (tag === 'BUTTON' || tag === 'SUTRAM-ASYNC-BTN' || tag === 'YENVUI-ASYNC-BTN') return true;
                        if (isMenuItem) return true;
                        return false;
                    });
                }, capture: true}}>
                    ${!isSingleRow ? html`<span class="tray-caption">${this.titleText}</span>` : ''}
                    <div class="actions-wrapper">
                        <slot name="actions" @slotchange=${this._handleSlotChange}></slot>
                    </div>
                </div>
            </div>
        `;
    }
}
customElements.define('yenvui-card', YenvuiCard);
