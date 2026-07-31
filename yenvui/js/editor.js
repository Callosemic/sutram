import { LitElement, html, css } from 'lit';

async function loadLanguageExtension(lang) {
    try {
        if (lang === 'python') return (await import('https://esm.sh/@codemirror/lang-python')).python();
        if (lang === 'json') return (await import('https://esm.sh/@codemirror/lang-json')).json();
        if (lang === 'javascript' || lang === 'ts') return (await import('https://esm.sh/@codemirror/lang-javascript')).javascript();
        if (lang === 'yaml' || lang === 'yml') return (await import('https://esm.sh/@codemirror/lang-yaml')).yaml();
        if (lang === 'html' || lang === 'htm') return (await import('https://esm.sh/@codemirror/lang-html')).html();
        if (lang === 'css') return (await import('https://esm.sh/@codemirror/lang-css')).css();
        if (lang === 'rust') return (await import('https://esm.sh/@codemirror/lang-rust')).rust();
        if (lang === 'go') return (await import('https://esm.sh/@codemirror/lang-go')).go();

        // Default fallback
        return (await import('https://esm.sh/@codemirror/lang-markdown')).markdown();
    } catch (e) {
        console.warn(`[yenVUI] Failed to dynamically load language: ${lang}`, e);
        return [];
    }
}

export class YenvuiEditor extends LitElement {
    static properties = {
        value: { type: String },
        readOnly: { type: Boolean },
        language: { type: String },
        customExtensions: { type: Array } // Accepts an array of CodeMirror extensions from the host
    };

    static styles = css`
        :host { 
            display: flex; 
            flex-direction: column; 
            flex: 1; 
            min-height: 0; 
            height: 100%; 
        }
        .cm-editor { 
            height: 100%; 
            background: transparent;
        }
        .cm-scroller { 
            overflow: auto; 
            font-family: var(--font-mono, monospace); 
        }
    `;

    constructor() {
        super();
        this.value = '';
        this.readOnly = false;
        this.language = 'markdown';
        this.customExtensions = [];
        this._view = null;
        this._EditorView = null;
        this._initializingEditor = false;
        
        // Compartments for dynamic reconfiguration
        this.languageConf = null;
        this.readOnlyConf = null;
        this.customConf = null;
    }

    connectedCallback() {
        super.connectedCallback();
        
        // Standard yenVUI Theme Observation Protocol
        this._themeObserver = new MutationObserver(() => {
            const theme = document.body.getAttribute('data-theme') || 'dark';
            this.setAttribute('data-theme', theme);
            this._updateTheme();
        });
        this._themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
        this.setAttribute('data-theme', document.body.getAttribute('data-theme') || 'dark');

        setTimeout(() => this._initEditor(), 0);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._themeObserver) this._themeObserver.disconnect();
        if (this._view) {
            this._view.destroy();
            this._view = null;
        }
    }

    updated(changedProperties) {
        if (this._view && this._EditorView) {
            if (changedProperties.has('value')) {
                const currentDoc = this._view.state.doc.toString();
                if (currentDoc !== this.value) {
                    this._view.dispatch({
                        changes: { from: 0, to: currentDoc.length, insert: this.value || '' }
                    });
                }
            }
            if (changedProperties.has('readOnly') && this.readOnlyConf) {
                this._view.dispatch({
                    effects: this.readOnlyConf.reconfigure(this._EditorView.editable.of(!this.readOnly))
                });
            }
            if (changedProperties.has('language') && this.languageConf) {
                loadLanguageExtension(this.language).then(ext => {
                    if (this._view) {
                        this._view.dispatch({ effects: this.languageConf.reconfigure(ext) });
                    }
                });
            }
            if (changedProperties.has('customExtensions') && this.customConf) {
                this._view.dispatch({
                    effects: this.customConf.reconfigure(this.customExtensions || [])
                });
            }
        }
    }

    _updateTheme() {
        // Trigger a force update if the view exists to allow CodeMirror to redraw custom classes
        if (this._view) this.requestUpdate();
    }

    async _initEditor() {
        if (this._view || this._initializingEditor) return;
        this._initializingEditor = true;

        const [
            { EditorState, Compartment },
            { EditorView, basicSetup }
        ] = await Promise.all([
            import('https://esm.sh/@codemirror/state'),
            import('https://esm.sh/codemirror'),
            import('https://esm.sh/@codemirror/view')
        ]);

        this.languageConf = new Compartment();
        this.readOnlyConf = new Compartment();
        this.customConf = new Compartment();
        this._EditorView = EditorView;

        // Base theme matching the yenVUI CSS tokens
        const baseTheme = EditorView.theme({
            "&": { backgroundColor: "transparent", color: "var(--text)" },
            ".cm-gutters": { 
                backgroundColor: "var(--pane-bg)", 
                color: "var(--text-muted)", 
                borderRight: "1px solid var(--border)" 
            },
            ".cm-content": { fontFamily: "var(--font-mono, monospace)", fontSize: "13px" },
            "&.cm-focused .cm-cursor": { borderLeftColor: "var(--text)" },
            "&.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "rgba(59, 130, 246, 0.3)" }
        });

        // Optimistically boot with the markdown fallback, then lazily swap it
        let initialLangExt = [];
        loadLanguageExtension(this.language).then(ext => {
            if (this._view) this._view.dispatch({ effects: this.languageConf.reconfigure(ext) });
        });

        if (!this.isConnected) {
            this._initializingEditor = false;
            return;
        }

        this._view = new EditorView({
            state: EditorState.create({
                doc: this.value || '',
                extensions: [
                    basicSetup,
                    baseTheme,
                    EditorView.lineWrapping,
                    this.languageConf.of(initialLangExt),
                    this.readOnlyConf.of(EditorView.editable.of(!this.readOnly)),
                    this.customConf.of(this.customExtensions || []),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            const newVal = update.state.doc.toString();
                            this.value = newVal;
                            this.dispatchEvent(new CustomEvent('yenvui-editor-changed', {
                                detail: { value: newVal },
                                bubbles: true,
                                composed: true
                            }));
                        }
                    })
                ]
            }),
            parent: this.renderRoot,
            root: this.renderRoot
        });

        this._initializingEditor = false;
    }

    getCursor() { return this._view ? this._view.state.selection.main.head : 0; }
    
    insertAtCursor(text) {
        if (this._view) {
            const pos = this.getCursor();
            this._view.dispatch({
                changes: { from: pos, insert: text },
                selection: { anchor: pos + text.length },
                scrollIntoView: true
            });
        }
    }
}
customElements.define('yenvui-editor', YenvuiEditor);