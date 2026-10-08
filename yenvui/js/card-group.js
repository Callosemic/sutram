import { LitElement, html, css } from 'lit';
import { YenvuiGestureController, getDeepElementFromPoint } from './physics.js';

export class YenvuiCardGroup extends LitElement {
    static properties = {
        enableEdgeSelection: { type: Boolean },
        stacked: { type: Boolean, reflect: true },
        accordion: { type: Boolean, reflect: true },
        expanded: { type: Boolean, reflect: true },
        _childCount: { type: Number, state: true },
        _exceedsViewport: { type: Boolean, state: true }
    };
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            position: relative;
            touch-action: pan-x pan-y;
        }
        :host([stacked]) {
            gap: 0;
        }
        .more-handle,
        .collapse-handle {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 6px 10px;
            margin-top: 0;
            background: color-mix(in srgb, var(--intent-primary) 8%, var(--input-bg));
            border: 1px solid var(--border);
            border-top: none;
            border-radius: 0 0 6px 6px;
            cursor: pointer;
            color: color-mix(in srgb, var(--intent-primary) 70%, var(--text-muted));
            font-size: 0.75rem;
            font-weight: 700;
            font-family: var(--font-mono);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            transition: background 0.2s, color 0.2s, margin-top 0.3s;
            z-index: 0;
            box-sizing: border-box;
        }
        .more-handle {
            position: relative;
            width: 100%;
            margin-top: -4px;
            margin-bottom: 10px;
            box-shadow: var(--overlay-shadow, 0 4px 12px rgba(0,0,0,0.15));
        }
        .collapse-handle.top {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            z-index: 1;
            border-top: none;
            border-bottom: 1px solid var(--border);
            border-radius: 0;
            margin-top: 0;
            box-shadow: var(--overlay-shadow, 0 4px 12px rgba(0,0,0,0.1));
            transition: background 0.2s, color 0.2s, top 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .more-handle:hover,
        .collapse-handle:hover {
            background: color-mix(in srgb, var(--intent-primary) 15%, var(--input-bg));
            color: var(--intent-primary);
        }
        @container (max-width: 480px) {
            .more-handle,
            .collapse-handle {
                width: 100% !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
                border-radius: 0 !important;
                border-left: none !important;
                border-right: none !important;
            }
        }
    `;
    constructor() {
        super();
        this.enableEdgeSelection = true;
        this.stacked = false;
        this.accordion = false;
        this.expanded = false;
        this._childCount = 0;
        this._handleStackClick = this._handleStackClick.bind(this);

        this._gestureController = new YenvuiGestureController(this, {
            scrollableContainerSelector: 'actions-wrapper',
            onPanEnd: (endX, endY, axis) => {
                if (axis === 'horizontal' && this.enableEdgeSelection && this._gestureController.startX < 30) {
                    const deltaX = endX - this._gestureController.startX;
                    const deltaY = Math.abs(endY - this._gestureController.startY);

                    if (deltaX > 30 && deltaX > deltaY) {
                        const card = getDeepElementFromPoint(endX, endY, 'yenvui-card');
                        if (card && !card.disableSelection) {
                            card.selected = !card.selected;
                            card.dispatchEvent(new CustomEvent('yenvui-card-select-toggled', {
                                detail: { selected: card.selected },
                                bubbles: true,
                                composed: true
                            }));
                        }
                    }
                }
            }
        });
    }
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('click', this._handleStackClick, { capture: true });
        this._resizeObserver = new ResizeObserver(() => {
            if (this.stacked) {
                requestAnimationFrame(() => this._applyStackedZIndex());
            }
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('click', this._handleStackClick, { capture: true });
        if (this._resizeObserver) this._resizeObserver.disconnect();
        if (this._gestureController && typeof this._gestureController.abort === 'function') {
            this._gestureController.abort();
        }
    }
    firstUpdated() {
        if (this.stacked) {
            this._applyStackedZIndex();
        }
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('stacked') || changedProperties.has('expanded')) {
            requestAnimationFrame(() => this._applyStackedZIndex());
        }
    }
    _handleSlotChange() {
        const slot = this.shadowRoot.querySelector('slot');
        if (slot) {
            const children = slot.assignedElements({ flatten: true });
            this._childCount = children.length;
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
                children.forEach(c => this._resizeObserver.observe(c));
            }
        }
        if (this.stacked) {
            requestAnimationFrame(() => this._applyStackedZIndex());
        }
    }

    _handleStackClick(e) {
        if (!this.stacked || !this.accordion || this._childCount <= 1) return;
        const path = e.composedPath();
        const isActionClick = path.some(el => {
            if (!el || !el.tagName) return false;
            if (el._overlayActive) return true;
            const tag = el.tagName.toLowerCase();
            if (tag === 'button' || tag === 'sutram-async-btn' || tag === 'yenvui-async-btn' || tag === 'sutram-entity-actions') return true;
            if (el.classList && (el.classList.contains('actions-tray') || el.classList.contains('trigger-bar') || el.classList.contains('actions-wrapper') || el.classList.contains('selection-gutter'))) return true;
            return false;
        });

        if (isActionClick) return;

        const slot = this.shadowRoot.querySelector('slot');
        if (!slot) return;
        const nodes = slot.assignedElements({ flatten: true });
        if (nodes.length === 0) return;

        const topCard = nodes[0];

        if (!this.expanded) {
            // Intercept clicks on peeking children to expand the stack
            if (!path.includes(topCard)) {
                this.expanded = true;
                e.stopPropagation();
            }
        }
        // If expanded, do nothing to the event. Clicks propagate natively to trigger entity actions.
    }

    _applyStackedZIndex() {
        const slot = this.shadowRoot.querySelector('slot');
        if (!slot) return;
        const children = slot.assignedElements({ flatten: true });
        const total = children.length;
        const isVisuallyStacked = this.stacked;
        let parentHeight = 0;
        let totalHeight = 0;

        // Batch DOM reads to prevent forced synchronous layout thrashing (O(1) instead of O(N))
        const cachedHeights = children.map(c => c.offsetHeight || 0);

        children.forEach((child, index) => {
            if (!child.style) return;

            const childHeight = cachedHeights[index];
            totalHeight += childHeight;

            if (index === 0) {
                parentHeight = childHeight;
            }
            child.style.position = 'relative';
            child.style.zIndex = index === 0 ? total + 2 : total - index;
            child.style.transition = 'margin-top 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s, filter 0.3s, clip-path 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            child.style.transformOrigin = 'top left';
            // Accordion Deck Physics
            const maxVisibleIndexInCollapsed = 1;
            if (this.accordion && !this.expanded && index > 0) {
                if (index <= maxVisibleIndexInCollapsed) {
                    const peekAmount = 26; // Tighter bottom framing
                    if (childHeight > 0) {
                        const pullUp = Math.max(0, childHeight - peekAmount);
                        child.style.marginTop = `-${pullUp}px`;

                        const clipTop = pullUp;
                        child.style.clipPath = clipTop > 0 ? `inset(${clipTop}px -20px -20px -20px)` : 'inset(0px -20px -20px -20px)';
                    }
                    child.style.transform = 'scale(1)';
                    child.style.filter = 'brightness(0.7)';
                    child.style.opacity = '1';
                    child.style.setProperty('--peek-rail-opacity', '0');
                    child.style.setProperty('--peek-content-y', '7px');
                    child.style.pointerEvents = 'auto';
                    child.style.display = '';
                } else {
                    child.style.display = 'none';
                }
            } else {
                child.style.marginTop = '0px';
                child.style.transform = 'scale(1)';
                child.style.filter = '';
                child.style.opacity = '1';
                child.style.removeProperty('--peek-rail-opacity');
                child.style.removeProperty('--peek-content-y');
                child.style.pointerEvents = 'auto';
                child.style.display = '';
                child.style.clipPath = 'inset(0px -20px -20px -20px)';
                child.style.maxHeight = '';
                child.style.overflow = '';
            }

            if (isVisuallyStacked) {
                child.style.setProperty('--card-margin-bottom', '0px');

                const lastVisibleIndex = (this.accordion && !this.expanded) 
                    ? Math.min(1, total - 1) 
                    : total - 1;

                const hasMoreHandle = (this.accordion && !this.expanded && total > 2);

                if (index === 0) {
                    child.style.setProperty('--card-border-top', '1px solid var(--border, #444)');
                    child.style.setProperty('--card-border-top-left-radius', '6px');
                    child.style.setProperty('--card-border-top-right-radius', '6px');
                    const hasBottomRadius = (total === 1);
                    child.style.setProperty('--card-border-bottom-left-radius', hasBottomRadius ? '6px' : '0px');
                    child.style.setProperty('--card-border-bottom-right-radius', hasBottomRadius ? '6px' : '0px');
                    child.style.setProperty('--card-top-shadow', 'none');
                } else {
                    child.style.setProperty('--card-border-top', 'none');
                    child.style.setProperty('--card-border-top-left-radius', '0px');
                    child.style.setProperty('--card-border-top-right-radius', '0px');
                    child.style.setProperty('--card-top-shadow', 'none');

                    const isLastVisible = (index === lastVisibleIndex);

                    if (isLastVisible) {
                        const radius = (hasMoreHandle || (this.accordion && this.expanded)) ? '0px' : '6px';
                        child.style.setProperty('--card-border-bottom-left-radius', radius);
                        child.style.setProperty('--card-border-bottom-right-radius', radius);
                    } else {
                        child.style.setProperty('--card-border-bottom-left-radius', '0px');
                        child.style.setProperty('--card-border-bottom-right-radius', '0px');
                    }
                }
            } else {
                child.style.removeProperty('--card-margin-bottom');
                child.style.removeProperty('--card-border-top');
                child.style.removeProperty('--card-border-top-left-radius');
                child.style.removeProperty('--card-border-top-right-radius');
                child.style.removeProperty('--card-border-bottom-left-radius');
                child.style.removeProperty('--card-border-bottom-right-radius');
                child.style.removeProperty('--card-top-shadow');
            }
        });
        if (this.accordion && this.expanded && total > 1) {
            const topHandle = this.shadowRoot.querySelector('.collapse-handle.top');
            if (topHandle) {
                topHandle.style.zIndex = total + 1;
                topHandle.style.top = `${parentHeight}px`;
                if (children[1]) {
                    children[1].style.marginTop = `${topHandle.offsetHeight}px`;
                }
            }
        }

        if (this.accordion) {
            const exceeds = totalHeight > (window.innerHeight * 0.75);
            if (this._exceedsViewport !== exceeds) {
                this._exceedsViewport = exceeds;
                this.requestUpdate();
            }
        }
    }
    render() {
        const hiddenCount = this._childCount - 1;
        return html`
            <div @pointerdown=${(e) => this._gestureController.start(e)} style="display: contents;">
                <slot @slotchange=${this._handleSlotChange}></slot>
            </div>
            ${this.accordion && this.stacked && !this.expanded && hiddenCount > 0 ? html`
                <div class="more-handle" @click=${() => this.expanded = true}>
                    <span>Expand ${hiddenCount} item${hiddenCount !== 1 ? 's' : ''}</span>
                    <span style="font-size: 0.65rem; margin-top: 1px; opacity: 0.8;">▼</span>
                </div>
            ` : ''}
            ${this.accordion && this.stacked && this.expanded && this._childCount > 1 ? html`
                ${this._exceedsViewport ? html`
                    <div class="collapse-handle top" @click=${() => this.expanded = false}>
                        <span style="font-size: 0.65rem; margin-top: 1px; opacity: 0.8; transform: rotate(180deg);">▼</span>
                        <span>Collapse Stack</span>
                    </div>
                ` : ''}
                <div class="collapse-handle bottom" @click=${() => this.expanded = false}>
                    <span style="font-size: 0.65rem; margin-top: 1px; opacity: 0.8; transform: rotate(180deg);">▼</span>
                    <span>Collapse Stack</span>
                </div>
            ` : ''}
        `;
    }
}
customElements.define('yenvui-card-group', YenvuiCardGroup);