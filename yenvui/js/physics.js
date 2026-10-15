// sutram/yenvui/js/physics.js

/**
* Centralized event path resolution helper. Handles shadow DOM piercing,
* composedPath fallbacks, and synthetic events safely.
*/
export function getEventPath(e) {
    if (!e) return [];
    if (typeof e.composedPath === 'function') {
        const path = e.composedPath();
        if (path && path.length > 0) return path;
    }
    const path = [];
    let current = e ? e.target : null;
    while (current) {
        path.push(current);
        if (current.tagName === 'HTML') {
            path.push(document, window);
            break;
        }
        current = current.parentElement || (current.getRootNode && current.getRootNode().host) || null;
    }
    return path;
}

/**
* Traverses the event path to find the first element matching a given CSS selector.
*/
export function getEventTarget(e, selector = null) {
    const path = getEventPath(e);
    if (!selector) return path[0] || (e ? e.target : null);
    for (const el of path) {
        if (el && el.matches && el.matches(selector)) return el;
        if (el && el.closest && el.closest(selector)) return el.closest(selector);
    }
    return null;
}
/**
* Computes and applies true viewport coordinates for a #top-layer popover element.
* Supports 'menu' (floating dropdowns with auto left/right flip) and 'column-drawer'
* (full-width column filter panels aligned to the enclosing spatial column).
*/
export function anchorTopLayerPopover(triggerEl, popoverEl, options = {}) {
    if (!triggerEl || !popoverEl) return;
    const mode = options.mode || 'menu';
    const align = options.align || 'auto';
    const offset = options.offset ?? 4;

    const triggerRect = triggerEl.getBoundingClientRect();

    let curr = triggerEl;
    let colEl = null;
    let headerEl = null;

    while (curr) {
        if (curr.classList) {
            if (!headerEl && (curr.classList.contains('toolbar-row') || curr.classList.contains('sticky-header') || curr.classList.contains('col-header') || curr.classList.contains('editor-header'))) {
                headerEl = curr;
            }
            if (curr.classList.contains('spatial-col')) {
                colEl = curr;
                break;
            }
        }
        if (curr.tagName && ['SUTRAM-WINDOW', 'SUTRAM-APP-SHELL'].includes(curr.tagName.toUpperCase())) {
            if (!colEl) colEl = curr;
            break;
        }
        curr = curr.parentElement || (curr.getRootNode ? curr.getRootNode()?.host : null);
    }

    const colRect = colEl
        ? colEl.getBoundingClientRect()
        : (headerEl ? headerEl.getBoundingClientRect() : { left: 0, right: window.innerWidth, width: window.innerWidth });

    if (mode === 'column-drawer') {
        const rowBottom = headerEl ? headerEl.getBoundingClientRect().bottom : triggerRect.bottom;
        const left = Math.max(0, colRect.left);
        const right = Math.min(window.innerWidth, colRect.right);
        const width = Math.max(200, right - left);

        popoverEl.style.position = 'fixed';
        popoverEl.style.margin = '0';
        popoverEl.style.inset = 'auto';
        popoverEl.style.top = `${Math.round(rowBottom)}px`;
        popoverEl.style.left = `${Math.round(left)}px`;
        popoverEl.style.right = 'auto';
        popoverEl.style.width = `${Math.round(width)}px`;
        return;
    }

    // Floating Menu Mode ('menu')
    const maxRight = Math.min(window.innerWidth, colRect.right || window.innerWidth);
    const minLeft = Math.max(0, colRect.left || 0);
    const spaceOnRight = maxRight - triggerRect.left;
    const containerWidth = maxRight - minLeft;
    const isInRightHalf = containerWidth > 0 && (triggerRect.left - minLeft) > (containerWidth * 0.5);
    const estimatedWidth = options.estimatedWidth || 220;

    const shouldAlignRight = align === 'right' || (align === 'auto' && (spaceOnRight < estimatedWidth + 12 || isInRightHalf));

    popoverEl.style.position = 'fixed';
    popoverEl.style.margin = '0';
    popoverEl.style.inset = 'auto';
    popoverEl.style.top = `${Math.round(triggerRect.bottom + offset)}px`;

    if (shouldAlignRight) {
        const rightPx = Math.max(4, window.innerWidth - triggerRect.right);
        popoverEl.style.right = `${Math.round(rightPx)}px`;
        popoverEl.style.left = 'auto';
    } else {
        const leftPx = Math.max(4, triggerRect.left);
        popoverEl.style.left = `${Math.round(leftPx)}px`;
        popoverEl.style.right = 'auto';
    }
}

/**
* Promotes or dismisses a popover element in the browser's #top-layer and synchronizes its anchor coordinates.
*/
export function syncTopLayerPopover(triggerEl, popoverEl, isOpen, options = {}) {
    if (!popoverEl) return;
    if (isOpen) {
        if (typeof popoverEl.showPopover === 'function') {
            if (popoverEl.getAttribute('popover') !== 'manual') {
                popoverEl.setAttribute('popover', 'manual');
            }
            if (!popoverEl.matches(':popover-open')) {
                try { popoverEl.showPopover(); } catch (e) {}
            }
        }
        anchorTopLayerPopover(triggerEl, popoverEl, options);
    } else {
        if (typeof popoverEl.hidePopover === 'function' && popoverEl.matches(':popover-open')) {
            try { popoverEl.hidePopover(); } catch (e) {}
        }
    }
}

export function getDeepElementFromPoint(x, y, selector = null) {
    let el = document.elementFromPoint(x, y);
    while (el && el.shadowRoot) {
        const deeper = el.shadowRoot.elementFromPoint(x, y);
        if (!deeper || deeper === el) break;
        el = deeper;
    }
    if (!selector) return el;
    
    while (el) {
        if (el.closest && el.closest(selector)) return el.closest(selector);
        if (el.matches && el.matches(selector)) return el;
        // Duck-typing for yenVUI selection contracts
        if (el.tagName && el.tagName.includes('-') && 'selected' in el && 'disableSelection' in el) return el;
        el = el.getRootNode().host || el.parentElement;
    }
    return null;
}

/**
 * Universal Gesture Controller
 * Normalizes PointerEvents for unified desktop/mobile dragging while 
 * maintaining an invisible TouchEvent listener to defeat iOS Safari history swiping.
 */
export class YenvuiGestureController {
    constructor(host, options = {}) {
        this.host = host;
        this.lockAxis = options.lockAxis || 'both';
        this.onPanStart = options.onPanStart || (() => {});
        this.onPanMove = options.onPanMove || (() => {});
        this.onPanEnd = options.onPanEnd || (() => {});
        this.scrollableContainerSelector = options.scrollableContainerSelector || null;
        
        this.active = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.swipeAxis = null;
        this.longPressDelay = options.longPressDelay || 0;
        this.onLongPress = options.onLongPress || (() => {});
        this._dragTimer = null;

        this._boundPointerMove = this._handlePointerMove.bind(this);
        this._boundPointerUp = this._handlePointerUp.bind(this);
        this._boundTouchMove = this._handleTouchMove.bind(this);
    }
    start(e, overrides = {}) {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        this._currentLockAxis = overrides.lockAxis || this.lockAxis;
        if (this.active) {
            this._handlePointerUp(e);
        }
        this.active = true;
        this._pointerId = e.pointerId;
        // Globally disable text selection while a gesture is active
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        document.body.style.overflow = 'hidden';

        this._boundResizeAbort = () => this.abort();
        window.addEventListener('resize', this._boundResizeAbort);

        this.startX = e.clientX || (e.touches && e.touches[0].clientX);
        this.startY = e.clientY || (e.touches && e.touches[0].clientY);
        this.currentX = this.startX;
        this.currentY = this.startY;
        this.swipeAxis = null;

        // Bind via the capture phase so shadow-DOM children (like CodeMirror) cannot swallow pointermove
        window.addEventListener('pointermove', this._boundPointerMove, { capture: true });
        window.addEventListener('pointerup', this._boundPointerUp, { capture: true });
        window.addEventListener('pointercancel', this._boundPointerUp, { capture: true });

        // Safari edge-swipe defeater (passive: false required to intercept)
        this.host.addEventListener('touchmove', this._boundTouchMove, { passive: false, capture: true });

        this.onPanStart(this.startX, this.startY, e);
        if (this.longPressDelay > 0) {
            this._dragTimer = setTimeout(() => {
                this.onLongPress(this.currentX, this.currentY, e);
            }, this.longPressDelay);
        }
    }

    abort() {
        if (this.active) this._handlePointerUp(new Event('pointercancel'));
    }

    _handlePointerMove(e) {
        if (!this.active) return;
        this.currentX = e.clientX;
        this.currentY = e.clientY;
        if (!this.swipeAxis) {
            const dx = Math.abs(this.currentX - this.startX);
            const dy = Math.abs(this.currentY - this.startY);
            if (dx > 5 || dy > 5) {
                this.swipeAxis = dx > dy ? 'horizontal' : 'vertical';

                if ((this._currentLockAxis === 'horizontal' && this.swipeAxis === 'vertical') ||
                    (this._currentLockAxis === 'vertical' && this.swipeAxis === 'horizontal')) {
                    this._handlePointerUp(e);
                    return;
                }
                if (this._dragTimer) {
                    clearTimeout(this._dragTimer);
                    this._dragTimer = null;
                }

                if (this._pointerId && this.host && typeof this.host.setPointerCapture === 'function') {
                    try { this.host.setPointerCapture(this._pointerId); } catch(err) {}
                }
            }
        }

        this.onPanMove(this.currentX, this.currentY, this.swipeAxis, e);
    }
    _handlePointerUp(e) {
        if (!this.active) return;
        this.active = false;

        if (this._pointerId && this.host && typeof this.host.releasePointerCapture === 'function') {
            try { this.host.releasePointerCapture(this._pointerId); } catch(err) {}
            this._pointerId = null;
        }
        // Restore text selection
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        document.body.style.overflow = '';

        if (this._boundResizeAbort) {
            window.removeEventListener('resize', this._boundResizeAbort);
            this._boundResizeAbort = null;
        }

        if (this._dragTimer) {
            clearTimeout(this._dragTimer);
            this._dragTimer = null;
        }

        window.removeEventListener('pointermove', this._boundPointerMove, { capture: true });
        window.removeEventListener('pointerup', this._boundPointerUp, { capture: true });
        window.removeEventListener('pointercancel', this._boundPointerUp, { capture: true });
        this.host.removeEventListener('touchmove', this._boundTouchMove, { capture: true });

        this.onPanEnd(this.currentX, this.currentY, this.swipeAxis, e);
    }

    _handleTouchMove(e) {
        if (!this.active || this.swipeAxis !== 'horizontal') return;
        
        let shouldPrevent = true;
        if (this.scrollableContainerSelector) {
            const path = e.composedPath();
            const wrapper = path.find(el => el.classList && el.classList.contains(this.scrollableContainerSelector));
            
            if (wrapper) {
                const currentX = e.changedTouches[0].clientX;
                const isRightSwipe = currentX > this.startX;
                const isLeftSwipe = currentX < this.startX;
                const maxScroll = Math.max(0, wrapper.scrollWidth - wrapper.clientWidth);

                if (isRightSwipe && wrapper.scrollLeft > 0) shouldPrevent = false;
                else if (isLeftSwipe && wrapper.scrollLeft < maxScroll) shouldPrevent = false;
            }
        }

        if (shouldPrevent) {
            e.preventDefault();
        }
    }
}