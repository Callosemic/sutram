// sutram/yenvui/js/physics.js

/**
* Centralized event path resolution helper. Handles shadow DOM piercing,
* composedPath fallbacks, and synthetic events safely.
*/
export const PHYSICS = Object.freeze({
    EDGE_START_BEZEL_PX: 20,
    EDGE_MOVE_BEZEL_PX: 28,
    AXIS_LOCK_THRESHOLD_PX: 5,
    TAP_SLOP_PX: 6,
    MIN_THROW_VELOCITY: 2.0,
    THROW_DECAY: 0.94,
    POPOVER_ESTIMATED_WIDTH_PX: 220
});

let _bodyOverflowLockCount = 0;
let _savedBodyOverflow = '';

export function acquireBodyScrollLock() {
    if (typeof document === 'undefined' || !document.body) return;
    if (_bodyOverflowLockCount === 0) {
        _savedBodyOverflow = document.body.style.overflow || '';
        document.body.style.overflow = 'hidden';
    }
    _bodyOverflowLockCount++;
}

export function releaseBodyScrollLock() {
    if (typeof document === 'undefined' || !document.body) return;
    if (_bodyOverflowLockCount > 0) {
        _bodyOverflowLockCount--;
        if (_bodyOverflowLockCount === 0) {
            document.body.style.overflow = _savedBodyOverflow;
        }
    }
}

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
    const direction = options.direction || 'auto';
    const maxRight = Math.min(window.innerWidth, colRect.right || window.innerWidth);
    const minLeft = Math.max(0, colRect.left || 0);
    const spaceOnRight = maxRight - triggerRect.left;
    const containerWidth = maxRight - minLeft;
    const isInRightHalf = containerWidth > 0 && (triggerRect.left - minLeft) > (containerWidth * 0.5);
    const estimatedWidth = options.estimatedWidth || 220;
    const menuHeight = popoverEl.offsetHeight || 220;
    const spaceBelow = window.innerHeight - triggerRect.bottom;

    const shouldAlignRight = align === 'right' || (align === 'auto' && (spaceOnRight < estimatedWidth + 12 || isInRightHalf));
    const shouldDropUp = direction === 'up' || (direction === 'auto' && spaceBelow < menuHeight + 16 && triggerRect.top > spaceBelow);

    popoverEl.style.position = 'fixed';
    popoverEl.style.margin = '0';
    popoverEl.style.inset = 'auto';
    if (shouldDropUp) {
        const bottomPx = Math.max(4, window.innerHeight - triggerRect.top + offset);
        popoverEl.style.bottom = `${Math.round(bottomPx)}px`;
        popoverEl.style.top = 'auto';
    } else {
        popoverEl.style.top = `${Math.round(triggerRect.bottom + offset)}px`;
        popoverEl.style.bottom = 'auto';
    }

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
/**
* 60fps Inertial Momentum Throw Engine
* Applies exponential decay (0.94 friction) to a scroll container's scrollLeft/scrollTop
* based on recent pointer/touch velocity samples.
*/
export function startKineticThrow(scrollEl, samples, { axis = 'y', decay = 0.94 } = {}) {
    if (!scrollEl || !Array.isArray(samples) || samples.length < 2) return null;
    const now = performance.now();
    const recent = samples.filter(s => (now - s.t) < 100);
    if (recent.length < 2) return null;

    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = Math.max(8, last.t - first.t);

    let vx = ((last.x - first.x) / dt) * 16;
    let vy = ((last.y - first.y) / dt) * 16;

    if (axis === 'x' && Math.abs(vx) < 2.0) return null;
    if (axis === 'y' && Math.abs(vy) < 2.0) return null;

    let rafId = null;
    const step = () => {
        vx *= decay;
        vy *= decay;

        if ((axis === 'x' && Math.abs(vx) < 0.25) || (axis === 'y' && Math.abs(vy) < 0.25)) {
            return;
        }

        if (axis === 'x') {
            const prev = scrollEl.scrollLeft;
            scrollEl.scrollLeft -= vx;
            if (scrollEl.scrollLeft === prev) return; // Hit scroll boundary
        } else {
            const prev = scrollEl.scrollTop;
            scrollEl.scrollTop -= vy;
            if (scrollEl.scrollTop === prev) return; // Hit scroll boundary
        }

        rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
        if (rafId) cancelAnimationFrame(rafId);
    };
}

/**
* Singleton Root Viewport Physics Guard (Tier 0 Chassis)
* Centralizes iOS Safari edge-swipe history navigation prevention across the entire
* document (including empty spaces between cards, virtual lists, and top-layer modals)
* while preserving vertical scrolling and tap-to-click responsiveness.
*/
export class YenvuiViewportGuard {
    static install() {
        if (typeof window === 'undefined' || this._installed) return;
        this._installed = true;

        this._startX = 0;
        this._startY = 0;
        this._lastY = 0;
        this._isEdgeTouch = false;
        this._touchCanceledOnStart = false;
        this._touchMoved = false;
        this._scrollTarget = null;
        this._velocitySamples = [];
        this._cancelMomentum = null;
        const isIOSWebKit = typeof navigator !== 'undefined' && (
            /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        );

        const findScrollableAncestor = (startEl) => {
            let curr = startEl;
            while (curr && curr !== document.body && curr !== document.documentElement) {
                if (curr instanceof Element) {
                    if (curr.tagName === 'SUTRAM-VIRTUAL-LIST' && curr.shadowRoot) {
                        const virt = curr.shadowRoot.querySelector('lit-virtualizer');
                        if (virt && virt.scrollHeight > virt.clientHeight) return virt;
                    }
                    const style = window.getComputedStyle(curr);
                    const overflowY = style.overflowY;
                    if ((overflowY === 'auto' || overflowY === 'scroll') && curr.scrollHeight > curr.clientHeight) {
                        return curr;
                    }
                }
                curr = curr.parentElement || (curr.getRootNode && curr.getRootNode().host) || null;
            }
            return null;
        };

        window.addEventListener('touchstart', (e) => {
            if (this._cancelMomentum) {
                this._cancelMomentum();
                this._cancelMomentum = null;
            }
            if (!e.touches || e.touches.length !== 1) {
                this._isEdgeTouch = false;
                this._touchCanceledOnStart = false;
                this._scrollTarget = null;
                this._velocitySamples = [];
                return;
            }
            const touch = e.touches[0];
            const x = touch.clientX;
            const y = touch.clientY;
            const pageX = touch.pageX !== undefined ? touch.pageX : x;
            this._startX = x;
            this._startY = y;
            this._lastY = y;
            this._touchMoved = false;
            this._velocitySamples = [{ x, y, t: performance.now() }];
            const startBezel = 20;
            const moveBezel = 28;
            const vw = window.innerWidth || document.documentElement.clientWidth;
            this._isEdgeTouch = (x <= moveBezel || x >= (vw - moveBezel) || pageX <= moveBezel || pageX >= (vw - moveBezel));
            const isHardEdge = (x <= startBezel || x >= (vw - startBezel) || pageX <= startBezel || pageX >= (vw - startBezel));

            // Only iOS/iPadOS WebKit requires synchronous touchstart cancellation in the 20px hardware bezel
            // to defeat UIScreenEdgePanGestureRecognizer.
            if (isIOSWebKit && isHardEdge && e.cancelable) {
                const deepTarget = getDeepElementFromPoint(x, y) || e.target;
                this._touchCanceledOnStart = true;
                this._scrollTarget = findScrollableAncestor(deepTarget);
                e.preventDefault();
                return;
            }
            this._touchCanceledOnStart = false;
            this._scrollTarget = null;
        }, { passive: false, capture: true });

        window.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            const touch = e.touches[0];
            const x = touch.clientX;
            const y = touch.clientY;
            const dx = Math.abs(x - this._startX);
            const dy = Math.abs(y - this._startY);

            if (dx > 6 || dy > 6) {
                this._touchMoved = true;
            }
            if (this._isEdgeTouch) {
                if (this._touchCanceledOnStart) {
                    if (e.cancelable) e.preventDefault();
                    // Preserve vertical scrolling and record velocity samples if the user pans vertically in the bezel
                    if (this._scrollTarget && dy >= dx) {
                        const stepY = this._lastY - y;
                        this._scrollTarget.scrollTop += stepY;
                        this._velocitySamples.push({ x, y, t: performance.now() });
                        if (this._velocitySamples.length > 6) this._velocitySamples.shift();
                    }
                } else if (dx > dy && dx >= 2 && e.cancelable) {
                    // For Android or editable surfaces on iOS, only cancel touchmove when panning horizontally
                    e.preventDefault();
                }
            }
            this._lastY = y;
        }, { passive: false, capture: true });

        window.addEventListener('touchend', (e) => {
            if (!this._touchCanceledOnStart) return;
            const wasTap = !this._touchMoved;
            const scrollEl = this._scrollTarget;
            const samples = this._velocitySamples;

            this._touchCanceledOnStart = false;
            this._isEdgeTouch = false;
            this._touchMoved = false;
            this._scrollTarget = null;
            this._velocitySamples = [];

            if (!wasTap && scrollEl && samples.length >= 2) {
                this._cancelMomentum = startKineticThrow(scrollEl, samples, { axis: 'y' });
                return;
            }

            if (wasTap && e.changedTouches && e.changedTouches.length === 1) {
                const touch = e.changedTouches[0];
                const rawTarget = getDeepElementFromPoint(touch.clientX, touch.clientY) || e.target;
                const target = (rawTarget && rawTarget.closest)
                    ? (rawTarget.closest('button, a, input, select, textarea, label, [role="button"], .tab-btn, .sub-tab, .pos-dot-target, .selection-hit-zone, .selection-strip, .action-grip-rail, .yv-interactive-row') || rawTarget)
                    : rawTarget;
                if (target && typeof target.dispatchEvent === 'function') {
                    if (typeof target.focus === 'function' && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
                        try { target.focus(); } catch (_) {}
                    }
                    target.dispatchEvent(new MouseEvent('click', {
                        bubbles: true,
                        composed: true,
                        cancelable: true,
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        view: window
                    }));
                }
            }
        }, { passive: true, capture: true });
        this._onTouchCancel = () => {
            if (this._cancelMomentum) {
                this._cancelMomentum();
                this._cancelMomentum = null;
            }
            this._isEdgeTouch = false;
            this._touchCanceledOnStart = false;
            this._touchMoved = false;
            this._scrollTarget = null;
            this._velocitySamples = [];
        };
        window.addEventListener('touchcancel', this._onTouchCancel, { passive: true, capture: true });
    }
}

if (typeof window !== 'undefined' && typeof customElements !== 'undefined' && !customElements.get('yenvui-viewport')) {
    class YenvuiViewport extends HTMLElement {
        connectedCallback() {
            YenvuiViewportGuard.install();
            this.style.display = 'contents';
        }
    }
    customElements.define('yenvui-viewport', YenvuiViewport);
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
        acquireBodyScrollLock();

        this._boundResizeAbort = () => this.abort();
        window.addEventListener('resize', this._boundResizeAbort);

        this.startX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        this.startY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
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
        releaseBodyScrollLock();

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