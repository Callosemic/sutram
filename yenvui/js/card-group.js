import { LitElement, html, css } from 'lit';
export class YenvuiCardGroup extends LitElement {
    static properties = {
        enableEdgeSelection: { type: Boolean },
        stacked: { type: Boolean, reflect: true }
    };
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            position: relative;
            touch-action: pan-y; /* Natively locks the browser from horizontal scrolling */
        }
    `;

    constructor() {
        super();
        this.enableEdgeSelection = true;
        this.stacked = false;
        this._touchStartX = null;
        this._touchStartY = null;
        this._swipeAxis = null;
        this._touchMoveHandler = this._handleTouchMove.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        // Bind { passive: false } explicitly to allow e.preventDefault() during touchmove
        this.addEventListener('touchmove', this._touchMoveHandler, { passive: false });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('touchmove', this._touchMoveHandler);
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
            e.preventDefault();
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
        // Shadow DOM piercing hit detection to resolve the exact card component
        let el = document.elementFromPoint(x, y);
        while (el && el.shadowRoot) {
            const deeper = el.shadowRoot.elementFromPoint(x, y);
            if (!deeper || deeper === el) break;
            el = deeper;
        }
        while (el) {
            if (el.tagName && (el.tagName.toLowerCase() === 'yenvui-card' || el.tagName.toLowerCase() === 'insetu-card')) return el;
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
        if (changedProperties.has('stacked')) {
            this._applyStackedZIndex();
        }
    }

    _handleSlotChange() {
        if (this.stacked) {
            this._applyStackedZIndex();
        }
    }
    _applyStackedZIndex() {
        const slot = this.shadowRoot.querySelector('slot');
        if (!slot) return;
        const children = slot.assignedElements({ flatten: true });
        const total = children.length;
        children.forEach((child, index) => {
            if (!child.style) return;
            child.style.position = 'relative';
            child.style.zIndex = total - index;

            if (this.stacked) {
                child.style.setProperty('--card-margin-bottom', '0px');
                if (index === 0) {
                    child.style.setProperty('--card-border-top', '1px solid var(--border, #444)');
                    child.style.setProperty('--card-border-top-left-radius', '6px');
                    child.style.setProperty('--card-border-top-right-radius', '6px');
                    child.style.setProperty('--card-border-bottom-left-radius', '0px');
                    child.style.setProperty('--card-border-bottom-right-radius', '0px');
                    child.style.setProperty('--card-top-shadow', 'none');
                } else {
                    child.style.setProperty('--card-border-top', 'none');
                    child.style.setProperty('--card-border-top-left-radius', '0px');
                    child.style.setProperty('--card-border-top-right-radius', '0px');
                    child.style.setProperty('--card-top-shadow', 'linear-gradient(to bottom, rgba(0, 0, 0, 0.25), transparent)');
                    if (index === total - 1) {
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
    }

    render() {
        return html`
            <div @touchstart=${this._handleTouchStart} @touchend=${this._handleTouchEnd} style="display: contents;">
                <slot @slotchange=${this._handleSlotChange}></slot>
            </div>
        `;
    }
}
customElements.define('yenvui-card-group', YenvuiCardGroup);