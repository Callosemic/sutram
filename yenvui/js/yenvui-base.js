import { LitElement, html, css } from 'lit';
import { YenvuiGestureController } from './physics.js';

let globalThemeObserver = null;
const themeSubscribers = new Set();

function subscribeToTheme(element) {
    themeSubscribers.add(element);
    element.setAttribute('data-theme', document.body.getAttribute('data-theme') || 'dark');
    if (!globalThemeObserver) {
        globalThemeObserver = new MutationObserver(() => {
            const theme = document.body.getAttribute('data-theme') || 'dark';
            themeSubscribers.forEach(el => el.setAttribute('data-theme', theme));
        });
        globalThemeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    }
}

function unsubscribeFromTheme(element) {
    themeSubscribers.delete(element);
}
export class YenvuiBase extends LitElement {
    connectedCallback() {
        super.connectedCallback();
        subscribeToTheme(this);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        unsubscribeFromTheme(this);
        if (this._managedListeners) {
            this._managedListeners.forEach(m => m.target.removeEventListener(m.type, m.listener));
            this._managedListeners = [];
        }
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: this.shadowRoot });
        }
    }

    registerOutsideClick(callback) {
        const listener = (e) => {
            if (!e.composedPath().includes(this)) callback(e);
        };
        document.addEventListener('click', listener);
        if (!this._managedListeners) this._managedListeners = [];
        this._managedListeners.push({ type: 'click', target: document, listener });
    }
}
export class YenvuiScrubTrack extends YenvuiBase {
    static styles = css`
        :host { 
            display: block; 
            width: 100%; 
            overflow: hidden; 
            touch-action: pan-x;
        }
        .scrub-container {
            display: flex;
            align-items: center;
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            overscroll-behavior: none;
            touch-action: pan-x;
            scrollbar-width: none;
            white-space: nowrap;
            cursor: grab;
            box-sizing: border-box;
        }
        .scrub-container::-webkit-scrollbar { display: none; }
        .scrub-container:active { cursor: grabbing; }
    `;
    constructor() {
        super();
        this._isSwiping = false;
        this._rafId = null;
        this._containerNode = null;
        this._gestureController = new YenvuiGestureController(this, {
            onPanStart: () => {
                const container = this._getContainer();
                if (!container) return;
                this._startScroll = container.scrollLeft;
                this._isSwiping = false;
                if (this._rafId) cancelAnimationFrame(this._rafId);
            },
            onPanMove: (x, y, axis) => {
                if (axis === 'horizontal') {
                    const deltaX = x - this._gestureController.startX;
                    if (Math.abs(deltaX) > 5) this._isSwiping = true;

                    // RAF debounce to align layout writes with browser paint cycles
                    if (this._rafId) cancelAnimationFrame(this._rafId);
                    this._rafId = requestAnimationFrame(() => {
                        const container = this._getContainer();
                        if (container) {
                            container.scrollLeft = this._startScroll - deltaX;
                        }
                    });
                }
            },
            onPanEnd: () => {
                if (this._rafId) cancelAnimationFrame(this._rafId);
            }
        });
    }

    _getContainer() {
        if (!this._containerNode) {
            this._containerNode = this.shadowRoot.querySelector('.scrub-container');
        }
        return this._containerNode;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._rafId) cancelAnimationFrame(this._rafId);
        // Force teardown to cleanly unbind global window listeners if unmounted mid-drag
        if (this._gestureController && this._gestureController.active) {
            this._gestureController._handlePointerUp(new Event('pointerup'));
        }
    }

    render() {
        return html`
            <div class="scrub-container" 
                @pointerdown=${(e) => this._gestureController.start(e, { lockAxis: 'horizontal' })}
                @click=${(e) => {
                    if (this._isSwiping) {
                        e.stopPropagation();
                        e.preventDefault();
                        this._isSwiping = false;
                    }
                }}>
                <slot></slot>
            </div>
        `;
    }
}
customElements.define('yenvui-scrub-track', YenvuiScrubTrack);