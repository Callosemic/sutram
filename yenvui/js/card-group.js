import { LitElement, html, css } from 'lit';
export class YenvuiCardGroup extends LitElement {
    static properties = {
        enableEdgeSelection: { type: Boolean },
        stacked: { type: Boolean, reflect: true },
        accordion: { type: Boolean, reflect: true },
        expanded: { type: Boolean, reflect: true },
        _childCount: { type: Number, state: true }
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
            gap: 8px;
            padding: 10px;
            margin-top: 0;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-top: none;
            border-radius: 0 0 8px 8px;
            cursor: pointer;
            color: var(--text-muted);
            font-size: 0.9rem;
            font-weight: bold;
            transition: background 0.2s, color 0.2s, margin-top 0.3s;
            z-index: 0;
            box-sizing: border-box;
        }
        .more-handle {
            position: relative;
            width: 96%;
            margin-top: -12px;
            margin-bottom: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
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
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            transition: background 0.2s, color 0.2s, top 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .more-handle:hover,
        .collapse-handle:hover {
            background: var(--border);
            color: var(--text);
        }
    `;
    constructor() {
        super();
        this.enableEdgeSelection = true;
        this.stacked = false;
        this.accordion = false;
        this.expanded = false;
        this._childCount = 0;
        this._touchStartX = null;
        this._touchStartY = null;
        this._swipeAxis = null;
        this._touchMoveHandler = this._handleTouchMove.bind(this);
        this._handleStackClick = this._handleStackClick.bind(this);
    }
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('touchmove', this._touchMoveHandler, { passive: false });
        this.addEventListener('click', this._handleStackClick, { capture: true });
        this._resizeObserver = new ResizeObserver(() => {
            if (this.stacked) {
                requestAnimationFrame(() => this._applyStackedZIndex());
            }
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('touchmove', this._touchMoveHandler);
        this.removeEventListener('click', this._handleStackClick, { capture: true });
        if (this._resizeObserver) this._resizeObserver.disconnect();
    }

    _handleTouchStart(e) {
        this._touchStartX = e.touches[0].clientX;
        this._touchStartY = e.touches[0].clientY;
        this._swipeAxis = null;
    }

    _handleTouchMove(e) {
        if (this._touchStartX === null) return;
        const currentX = e.changedTouches[0].clientX;
        const currentY = e.changedTouches[0].clientY;
        const dx = Math.abs(currentX - this._touchStartX);
        const dy = Math.abs(currentY - this._touchStartY);

        // Calculate the dominant axis of the gesture within the first 5px
        if (this._swipeAxis === null) {
            if (dx > 5 || dy > 5) {
                this._swipeAxis = dx > dy ? 'horizontal' : 'vertical';
            }
        }
        // If swiping horizontally, forcefully halt parent containers from rubber-banding
        // and defeat Safari's "swipe-to-go-back" exclusively within this card group
        if (this._swipeAxis === 'horizontal') {
            let shouldPrevent = true;
            const path = e.composedPath();
            const wrapper = path.find(el => el.classList && el.classList.contains('actions-wrapper'));

            if (wrapper) {
                const isRightSwipe = currentX > this._touchStartX;
                const isLeftSwipe = currentX < this._touchStartX;
                const maxScroll = Math.max(0, wrapper.scrollWidth - wrapper.clientWidth);

                if (isRightSwipe && wrapper.scrollLeft > 0) {
                    shouldPrevent = false;
                } else if (isLeftSwipe && wrapper.scrollLeft < maxScroll) {
                    shouldPrevent = false;
                }
            }

            if (shouldPrevent) {
                e.preventDefault();
            }
        }
    }

    _handleTouchEnd(e) {
        if (this._swipeAxis === 'horizontal' && this.enableEdgeSelection && this._touchStartX < 30) {
            const endX = e.changedTouches[0].clientX;
            const deltaX = endX - this._touchStartX;
            const deltaY = Math.abs(e.changedTouches[0].clientY - this._touchStartY);
            
            // Validate a clean rightward swipe originating from the extreme left edge
            if (deltaX > 30 && deltaX > deltaY) {
                const card = this._getCardFromPoint(endX, e.changedTouches[0].clientY);
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
        this._touchStartX = null;
        this._swipeAxis = null;
    }
    _getCardFromPoint(x, y) {
        // Shadow DOM piercing hit detection to resolve the exact component
        let el = document.elementFromPoint(x, y);
        while (el && el.shadowRoot) {
            const deeper = el.shadowRoot.elementFromPoint(x, y);
            if (!deeper || deeper === el) break;
            el = deeper;
        }

        // Duck-Typing: Accept any Web Component that honors the yenVUI card selection contract
        while (el) {
            if (el.tagName && el.tagName.includes('-') && 'selected' in el && 'disableSelection' in el) {
                return el;
            }
            el = el.getRootNode().host || el.parentElement;
        }
        return null;
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

        children.forEach((child, index) => {
            if (!child.style) return;

            if (index === 0) {
                parentHeight = child.offsetHeight;
            }
            child.style.position = 'relative';
            child.style.zIndex = index === 0 ? total + 2 : total - index;
            child.style.transition = 'margin-top 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s, clip-path 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            child.style.transformOrigin = 'top left';
            // Accordion Deck Physics
            const maxVisibleIndexInCollapsed = 1;
            if (this.accordion && !this.expanded && index > 0) {
                if (index <= maxVisibleIndexInCollapsed) {
                    const peekAmount = 42;
                    const childHeight = child.offsetHeight;
                    if (childHeight > 0) {
                        const pullUp = childHeight - peekAmount;
                        child.style.marginTop = `-${pullUp}px`;

                        const clipTop = Math.max(0, childHeight - parentHeight - peekAmount);
                        if (clipTop > 0) {
                            child.style.clipPath = `inset(${clipTop}px -20px -20px -20px)`;
                        } else {
                            child.style.clipPath = 'inset(0px -20px -20px -20px)';
                        }
                    }
                    const scaleVal = Math.max(0.96, 1 - (index * 0.02));
                    child.style.transform = `scale(${scaleVal})`;
                    child.style.opacity = '1';
                    child.style.pointerEvents = 'auto'; 
                    child.style.display = '';
                } else {
                    child.style.display = 'none';
                }
            } else {
                child.style.marginTop = '0px';
                child.style.transform = 'scale(1)';
                child.style.opacity = '1';
                child.style.pointerEvents = 'auto';
                child.style.display = '';
                child.style.clipPath = 'inset(0px -20px -20px -20px)';
                child.style.maxHeight = '';
                child.style.overflow = '';
            }

            if (isVisuallyStacked) {
                child.style.setProperty('--card-margin-bottom', '0px');

                const lastVisibleIndex = (this.accordion && !this.expanded) 
                    ? Math.min(maxVisibleIndexInCollapsed, total - 1) 
                    : total - 1;
                if (index === 0) {
                    child.style.setProperty('--card-border-top', '1px solid var(--border, #444)');
                    child.style.setProperty('--card-border-top-left-radius', '6px');
                    child.style.setProperty('--card-border-top-right-radius', '6px');
                    const hasBottomRadius = total === 1 || (this.accordion && !this.expanded);
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
                        child.style.setProperty('--card-border-bottom-left-radius', '6px');
                        child.style.setProperty('--card-border-bottom-right-radius', '6px');
                    } else {
                        child.style.setProperty('--card-border-bottom-left-radius', '0px');
                        child.style.setProperty('--card-border-bottom-right-radius', '0px');
                    }
                }
                if (total === 1) {
                    child.style.setProperty('--card-border-bottom-left-radius', '6px');
                    child.style.setProperty('--card-border-bottom-right-radius', '6px');
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
    }
    render() {
        const moreCount = this._childCount - 1;
        return html`
            <div @touchstart=${this._handleTouchStart} @touchend=${this._handleTouchEnd} style="display: contents;">
                <slot @slotchange=${this._handleSlotChange}></slot>
            </div>
            ${this.accordion && this.stacked && !this.expanded && this._childCount > 1 ? html`
                <div class="more-handle" @click=${() => this.expanded = true}>
                    Expand ${moreCount} nested item${moreCount !== 1 ? 's' : ''}
                </div>
            ` : ''}
            ${this.accordion && this.stacked && this.expanded ? html`
                ${this._childCount > 3 ? html`
                    <div class="collapse-handle top" @click=${() => this.expanded = false}>
                        <span style="font-size: 1.2rem; line-height: 1; transform: translateY(2px);">⌃</span> Collapse Stack
                    </div>
                ` : ''}
                ${this._childCount > 1 ? html`
                    <div class="collapse-handle bottom" @click=${() => this.expanded = false}>
                        <span style="font-size: 1.2rem; line-height: 1; transform: translateY(2px);">⌃</span> Collapse Stack
                    </div>
                ` : ''}
            ` : ''}
        `;
    }
}
customElements.define('yenvui-card-group', YenvuiCardGroup);