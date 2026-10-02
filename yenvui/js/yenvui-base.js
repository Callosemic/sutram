import { LitElement } from 'lit';

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

    registerOutsideClick(callback) {
        const listener = (e) => {
            if (!e.composedPath().includes(this)) callback(e);
        };
        document.addEventListener('click', listener);
        if (!this._managedListeners) this._managedListeners = [];
        this._managedListeners.push({ type: 'click', target: document, listener });
    }
}