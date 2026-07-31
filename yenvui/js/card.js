import { LitElement, html, css } from 'lit';
export class YenvuiCard extends LitElement {
    static properties = {
        titleText: { type: String },
        detailText: { type: String },
        descriptionText: { type: String },
        icon: { type: String },
        intentColor: { type: String },
        selected: { type: Boolean, reflect: true },
        disableSelection: { type: Boolean },
        _overlayActive: { type: Boolean, reflect: true },
        _hasActions: { type: Boolean, reflect: true, attribute: 'has-actions' },
        compact: { type: Boolean, reflect: true }
    };
    static styles = css`
        :host { display: block; margin-bottom: 12px; position: relative; touch-action: pan-y; }
        .selection-gutter {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 20px;
            z-index: 5;
            cursor: pointer;
            touch-action: pan-y;
        }
        .card-wrapper {
            touch-action: pan-y;
            background: var(--input-bg, #2d2d2d);
            border: 1px solid var(--border, #444);
            border-left: 4px solid var(--card-intent, #64748b);
            padding-left: 10px;
            border-radius: 6px;
            display: flex;
            flex-direction: row;
            position: relative;
            box-sizing: border-box;
            transition: border-color 0.2s, box-shadow 0.2s, border-left-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @media (hover: hover) {
            .selection-gutter:hover + .card-wrapper {
                border-left-width: 14px;
                padding-left: 0px;
                border-color: var(--card-intent, #3b82f6);
            }
            .card-wrapper:hover {
                border-color: var(--card-intent, #3b82f6);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
        }
        :host([_overlayactive]) {
            z-index: 10;
        }
        :host([_overlayactive]) .card-wrapper {
            border-color: var(--card-intent, #3b82f6);
        }
        :host([selected]) .card-wrapper {
            border-left-width: 14px;
            padding-left: 0px;
            border-color: var(--card-intent, #3b82f6);
            box-shadow: 0 0 0 2px var(--card-intent, #3b82f6);
        }
        .content-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 12px 15px 8px 15px;
        }
        .card-title {
            font-weight: bold;
            color: var(--text, #e0e0e0);
            font-size: 1.05rem;
            display: flex;
            align-items: center;
            gap: 8px;
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        .card-desc {
            padding: 0 15px 8px 15px;
            color: var(--text-muted, #888);
            font-size: 0.9rem;
            overflow-wrap: anywhere;
            word-break: break-word;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .card-body {
            padding: 0 15px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        ::slotted(*) {
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        .card-detail {
            padding: 8px 15px 12px 15px;
            font-family: var(--font-mono, monospace);
            font-size: 0.75rem;
            color: var(--text-muted, #888);
            opacity: 0.8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .trigger-bar {
            width: 22px;
            flex-shrink: 0;
            background: var(--card-intent, var(--intent-neutral, #64748b));
            cursor: pointer;
            transition: filter 0.2s;
            display: none;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 1.2rem;
            line-height: 1;
            user-select: none;
            border-radius: 0 5px 5px 0;
        }
        :host([has-actions]) .trigger-bar {
            display: flex;
        }
        .trigger-bar:hover {
            filter: brightness(1.2);
        }
        .trigger-icon {
            transition: transform 0.2s ease;
            margin-top: -2px;
        }
        :host([_overlayactive]) .trigger-icon {
            transform: rotate(180deg);
        }
        .actions-tray {
            position: absolute;
            left: -1px;
            right: 21px;
            top: -1px;
            min-height: calc(100% + 2px);
            box-sizing: border-box;
            background: var(--input-bg, #2d2d2d);
            border: 1px solid var(--border, #444);
            border-right: none;
            display: flex;
            flex-direction: column;
            justify-content: center;
            /* Pass CSS variables to penetrate slotted async buttons */
            --btn-padding: 6px 12px;
            --btn-font-size: 0.85rem;
            padding: 6px 10px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 10;
            border-radius: 6px 0 0 6px;
            transform: scale(0.98);
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        }
        .actions-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 14px; /* Ensure buttons don't clip the absolute caption */
        }
        :host([_overlayactive]) .actions-tray {
            opacity: 1;
            pointer-events: auto;
            transform: scale(1);
        }
        .tray-caption {
            position: absolute;
            top: 4px;
            left: 10px;
            right: 10px;
            font-size: 0.65rem;
            font-weight: bold;
            color: var(--text-muted, #888);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-align: center;
            pointer-events: none;
        }
        :host([data-theme="light"]) .actions-tray {
            background: #ffffff;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }
        :host([data-theme="e-ink"]) .actions-tray {
            background: #ffffff;
            border: 2px solid #000000;
            border-right: none;
            box-shadow: 4px 4px 0 #14b8a6;
        }
        /* Unstyled slots for host-injected buttons */
        ::slotted(button) {
            background: var(--input-bg);
            color: var(--text);
            border: 1px solid var(--border);
            padding: var(--btn-padding) !important;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: var(--btn-font-size) !important;
            transition: all 0.2s;
            box-sizing: border-box;
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
            margin: 0 !important;
        }
        ::slotted(button:hover) {
            background: var(--bg-hover);
        }
        /* E-Ink High Contrast Overrides */
        :host([data-theme="e-ink"]) .card-wrapper {
            border: 2px solid #8b5cf6 !important;
            box-shadow: 4px 4px 0 #14b8a6 !important;
            background: #ffffff !important;
            color: #000000 !important;
            transition: none !important;
        }
        :host([selected][data-theme="e-ink"]) .card-wrapper {
            border-left-width: 14px !important;
            padding-left: 0px !important;
        }
        :host([data-theme="e-ink"]) .actions-tray {
            transition: none !important;
            transform: none !important;
        }
        :host([data-theme="e-ink"]) .card-title {
            color: #000000 !important;
            font-weight: 900 !important;
        }
        :host([data-theme="e-ink"]) .card-desc,
        :host([data-theme="e-ink"]) .card-detail {
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
            padding: 0;
        }
        :host([compact]) .card-title {
            font-size: 0.95rem;
        }
        :host([compact]) .card-desc,
        :host([compact]) .card-body {
            display: none;
        }
        :host([compact]) .card-detail {
            padding: 0 0 0 10px;
            margin-left: auto;
        }
    `;
    constructor() {
        super();
        this._overlayActive = false;
        this._hasActions = false;
        this._touchStartX = null;
        this._touchStartY = null;
        this._isSwipingHorizontal = null;
        this.selected = false;
        this._docClickListener = this._handleDocumentClick.bind(this);
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
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('focusout', this._focusOutListener);
        document.addEventListener('click', this._docClickListener);
        document.addEventListener('yenvui-overlay-opened', this._overlayListener);
        // Native Edge-Swipe Navigation Defeater
        this._touchMoveListener = (e) => {
            if (this._touchStartX === null) return;
            const currentX = e.changedTouches[0].clientX;
            const currentY = e.changedTouches[0].clientY;
            const diffX = Math.abs(this._touchStartX - currentX);
            const diffY = Math.abs(this._touchStartY - currentY);

            // Lock the gesture axis upon initial 5px of movement
            if (this._isSwipingHorizontal === null) {
                if (diffX > 5 || diffY > 5) {
                    this._isSwipingHorizontal = diffX > diffY;
                }
            }

            // If the gesture is horizontal, forcefully intercept the touch event
            // to prevent the mobile browser from triggering "Swipe to Go Back"
            if (this._isSwipingHorizontal) {
                e.preventDefault();
            }
        };
        this.addEventListener('touchmove', this._touchMoveListener, { passive: false });

        this._themeObserver = new MutationObserver(() => {
            this.setAttribute('data-theme', document.body.getAttribute('data-theme') || 'dark');
        });
        this._themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
        this.setAttribute('data-theme', document.body.getAttribute('data-theme') || 'dark');
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('touchmove', this._touchMoveListener);
        this.removeEventListener('focusout', this._focusOutListener);
        document.removeEventListener('click', this._docClickListener);
        document.removeEventListener('yenvui-overlay-opened', this._overlayListener);
        if (this._themeObserver) this._themeObserver.disconnect();
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
    }

    _handleDocumentClick(e) {
        const path = e.composedPath();
        if (!path.includes(this) && this._overlayActive) {
            this._overlayActive = false;
        }
    }
    _handleTouchStart(e) {
        this._touchStartX = e.changedTouches[0].clientX;
        this._touchStartY = e.changedTouches[0].clientY;
        const rect = this.getBoundingClientRect();
        this._cardWidth = rect.width;
        this._localStartX = this._touchStartX - rect.left;
        this._isSwipingHorizontal = null;
    }

    _toggleSelection() {
        this.selected = !this.selected;
        this.dispatchEvent(new CustomEvent('yenvui-card-select-toggled', {
            detail: { selected: this.selected },
            bubbles: true,
            composed: true
        }));
    }
    _handleTouchEnd(e) {
        if (this._touchStartX === null) return;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = this._touchStartX - touchEndX;
        const deltaY = this._touchStartY - touchEndY;

        // Ensure horizontal swipe is dominant to prevent accidental triggers during vertical scrolling
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
            const isLeftSwipe = deltaX > 30;   // Right-to-Left
            const isRightSwipe = deltaX < -30; // Left-to-Right
            // Widen the hit target to 25% for better ergonomics, and guarantee at least 70px
            const isLeftSide = this._localStartX < Math.max((this._cardWidth * 0.25), 70);

            if (isLeftSide) {
                if (isRightSwipe && !this.disableSelection) {
                    this._toggleSelection();
                }
            } else {
                const hasActions = this._hasActions || !!this.querySelector('[slot="actions"]');
                if (hasActions) {
                    if (isLeftSwipe) {
                        this._overlayActive = true;
                    } else if (isRightSwipe) {
                        this._overlayActive = false;
                    }
                }
            }
        }

        this._touchStartX = null;
        this._touchStartY = null;
        this._isSwipingHorizontal = null;
    }

    _handlePointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        this._longPressTimer = setTimeout(() => {
            this._justLongPressed = true;
            this._toggleSelection();
            this._longPressTimer = null;
        }, 500);
    }

    _handlePointerCancel() {
        if (this._longPressTimer) {
            clearTimeout(this._longPressTimer);
            this._longPressTimer = null;
        }
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
        return html`
            ${!this.disableSelection ? html`<div class="selection-gutter" title="Select Item" @click=${(e) => { e.stopPropagation(); this._toggleSelection(); }}></div>` : ''}
            <div class="card-wrapper" style="--card-intent: ${this.intentColor || 'var(--intent-neutral)'}"
                @mouseleave=${() => { if (window.matchMedia('(hover: hover)').matches) this._overlayActive = false; }}
                @touchstart=${this._handleTouchStart}
                @touchend=${this._handleTouchEnd}
                @pointerdown=${this._handlePointerDown}
                @pointerup=${this._handlePointerCancel}
                @pointermove=${this._handlePointerCancel}
                @pointercancel=${this._handlePointerCancel}
                @click=${(e) => { 
                    if (this._justLongPressed) {
                        this._justLongPressed = false;
                        e.stopPropagation();
                        e.preventDefault();
                    }
                }}>

                <div class="content-col">
                    <div class="card-header">
                        <div class="card-title">
                            ${this.icon ? html`<span>${this.icon}</span>` : ''}
                            ${this.titleText}
                        </div>
                    </div>
                    ${this.descriptionText ? html`<div class="card-desc">${this.descriptionText}</div>` : ''}
                    <div class="card-body">
                        <slot></slot>
                    </div>
                    ${this.detailText ? html`<div class="card-detail">${this.detailText}</div>` : ''}
                    <slot name="inline-actions"></slot>
                </div>

                <div class="trigger-bar"  
                    @pointerenter=${(e) => { if (e.pointerType === 'mouse') this._overlayActive = true; }}
                    @click=${(e) => { e.stopPropagation(); e.preventDefault(); this._overlayActive = !this._overlayActive; }}>
                    <span class="trigger-icon">‹</span>
                </div>
                <div class="actions-tray" @click=${(e) => { if(e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName.includes('YENVUI')) this._overlayActive = false; }}>
                    <span class="tray-caption">${this.titleText}</span>
                    <div class="actions-wrapper">
                        <slot name="actions" @slotchange=${this._handleSlotChange}></slot>
                    </div>
                </div>
            </div>
        `;
    }
}
customElements.define('yenvui-card', YenvuiCard);

// ============================================================================
// GLOBAL EDGE-SWIPE COORDINATOR (Module Scope)
// ============================================================================
// Safari ignores CSS overscroll-behavior for extreme edge swipes. 
// We lock the OS gesture natively at the document level and resolve the 
// drop target to allow global card selection without requiring a DOM wrapper.
let _edgeSwipeStartX = null;
let _edgeSwipeStartY = null;
let _isEdgeSwipe = false;
let _globalSwipeAxis = null;

function getDeepClosestFromPoint(x, y, selector) {
    let el = document.elementFromPoint(x, y);
    while (el && el.shadowRoot) {
        const deeper = el.shadowRoot.elementFromPoint(x, y);
        if (!deeper || deeper === el) break;
        el = deeper;
    }
    while (el) {
        if (el.closest && el.closest(selector)) return el.closest(selector);
        el = el.getRootNode().host;
    }
    return null;
}

function isElementInside(el, selector) {
    while (el) {
        if (el.closest && el.closest(selector)) return true;
        el = el.getRootNode().host;
    }
    return false;
}
document.addEventListener('touchstart', (e) => {
    if (e.touches[0].clientX < 30) {
        _isEdgeSwipe = true;
        _edgeSwipeStartX = e.touches[0].clientX;
        _edgeSwipeStartY = e.touches[0].clientY;
        _globalSwipeAxis = null;
    } else {
        _isEdgeSwipe = false;
    }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (_isEdgeSwipe && _edgeSwipeStartX !== null) {
        // Wait for 5px of movement to mathematically lock the axis
        if (_globalSwipeAxis === null) {
            const dx = Math.abs(e.changedTouches[0].clientX - _edgeSwipeStartX);
            const dy = Math.abs(e.changedTouches[0].clientY - _edgeSwipeStartY);
            if (dx > 5 || dy > 5) {
                _globalSwipeAxis = dx > dy ? 'horizontal' : 'vertical';
            }
        }

        if (_globalSwipeAxis === 'horizontal') {
            e.preventDefault(); // Kills Safari back-navigation & locks vertical drift
        } else if (_globalSwipeAxis === 'vertical') {
            _isEdgeSwipe = false; // Releases the lock to allow native vertical scrolling
        }
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (_isEdgeSwipe && _edgeSwipeStartX !== null) {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const deltaX = endX - _edgeSwipeStartX;
        const deltaY = Math.abs(endY - _edgeSwipeStartY);

        // Only intervene if the swipe started on the background padding/gutter.
        const startedOnCard = isElementInside(e.target, 'yenvui-card');

        // If it was a clean rightward swipe from the background
        if (!startedOnCard && deltaX > 30 && deltaX > deltaY) {
            const card = getDeepClosestFromPoint(endX, endY, 'yenvui-card');
            if (card && !card.disableSelection) {
                card.selected = !card.selected;
                card.dispatchEvent(new CustomEvent('yenvui-card-select-toggled', {
                    detail: { selected: card.selected },
                    bubbles: true,
                    composed: true
                }));
            }
        }
        _isEdgeSwipe = false;
        _edgeSwipeStartX = null;
    }
});