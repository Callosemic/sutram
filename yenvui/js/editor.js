import { LitElement, html, css } from 'lit';
async function loadLanguageExtension(lang) {
    try {
        if (lang === 'python') return (await import('@codemirror/lang-python')).python();
        if (lang === 'json') return (await import('@codemirror/lang-json')).json();
        if (lang === 'javascript' || lang === 'ts') return (await import('@codemirror/lang-javascript')).javascript();
        if (lang === 'yaml' || lang === 'yml') return (await import('@codemirror/lang-yaml')).yaml();
        if (lang === 'html' || lang === 'htm') return (await import('@codemirror/lang-html')).html();
        if (lang === 'css') return (await import('@codemirror/lang-css')).css();
        if (lang === 'rust') return (await import('@codemirror/lang-rust')).rust();
        if (lang === 'go') return (await import('@codemirror/lang-go')).go();

        // Default fallback
        return (await import('@codemirror/lang-markdown')).markdown();
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
        writingMode: { type: Boolean },
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
        this.writingMode = false;
        this.customExtensions = [];
        this._view = null;
        this._EditorView = null;
        this._initializingEditor = false;

        // Compartments for dynamic reconfiguration
        this.languageConf = null;
        this.readOnlyConf = null;
        this.writingModeConf = null;
        this.customConf = null;
        this.themeConf = null;
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
            if (changedProperties.has('writingMode') && this.writingModeConf) {
                this._updateWritingMode();
            }
        }
    }

    async _updateWritingMode() {
        if (!this._view || !this.writingModeConf) return;
        if (this.writingMode) {
            const { EditorView, keymap, EditorSelection } = await import('codemirror-core');
            const toggleWrap = (view, symbol) => {
                const { state, dispatch } = view;
                const changes = state.changeByRange(range => {
                    const sel = state.sliceDoc(range.from, range.to);
                    if (sel.startsWith(symbol) && sel.endsWith(symbol) && sel.length >= symbol.length * 2) {
                        const unwrapped = sel.slice(symbol.length, -symbol.length);
                        return {
                            changes: { from: range.from, to: range.to, insert: unwrapped },
                            range: EditorSelection.range(range.from, range.from + unwrapped.length)
                        };
                    } else {
                        const wrapped = `${symbol}${sel}${symbol}`;
                        const offset = range.empty ? symbol.length : wrapped.length;
                        return {
                            changes: { from: range.from, to: range.to, insert: wrapped },
                            range: EditorSelection.range(range.from + offset, range.from + offset)
                        };
                    }
                });
                dispatch(changes);
                return true;
            };
            const writingTheme = EditorView.theme({
                ".cm-scroller .cm-content": {
                    fontFamily: "var(--font-serif, 'Georgia', 'Cambria', 'Times New Roman', 'Source Serif Pro', serif) !important",
                    fontSize: "1.1rem",
                    lineHeight: "1.8",
                    maxWidth: "720px",
                    margin: "0 auto",
                    padding: "100px 10px 80px 10px"
                },
                ".cm-scroller .cm-line": { maxWidth: "720px" },
                ".cm-gutters": { display: "none" }
            });

            const markdownShortcuts = keymap.of([
                { key: "Mod-b", run: (v) => toggleWrap(v, "**") },
                { key: "Mod-i", run: (v) => toggleWrap(v, "*") },
                { key: "Mod-`", run: (v) => toggleWrap(v, "`") }
            ]);

            this._view.dispatch({
                effects: this.writingModeConf.reconfigure([writingTheme, markdownShortcuts])
            });
        } else {
            this._view.dispatch({
                effects: this.writingModeConf.reconfigure([])
            });
        }
    }
    async _updateTheme() {
        if (this._view && this.themeConf) {
            const theme = document.body.getAttribute('data-theme') || 'dark';
            try {
                const { oneDarkHighlightStyle, syntaxHighlighting } = await import('codemirror-core');
                this._view.dispatch({ 
                    effects: this.themeConf.reconfigure(theme !== 'light' ? syntaxHighlighting(oneDarkHighlightStyle) : []) 
                });
            } catch(e) {
                console.warn('[yenVUI] Failed to update CodeMirror theme', e);
            }
        }
        if (this._view) this.requestUpdate();
    }
    render() {
        return html`<div id="cm-container" style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%;"></div>`;
    }

    async _initEditor() {
        if (this._view || this._initializingEditor) return;
        this._initializingEditor = true;
        const { 
            EditorState, Compartment, 
            basicSetup, 
            EditorView, 
            oneDarkHighlightStyle, 
            syntaxHighlighting 
        } = await import('codemirror-core');
        this.languageConf = new Compartment();
        this.readOnlyConf = new Compartment();
        this.writingModeConf = new Compartment();
        this.customConf = new Compartment();
        this.themeConf = new Compartment();
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
            "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "rgba(56, 189, 248, 0.35) !important" },
            ".cm-searchMatch": { backgroundColor: "rgba(234, 179, 8, 0.4)" },
            ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.04)" },
            ".cm-selectionMatch": { backgroundColor: "rgba(255, 255, 255, 0.1)" }
        });

        // Await the language pack to prevent Lezer tree reconfiguration race conditions 
        // with the autocomplete worker during the initial EditorView boot.
        let initialLangExt = await loadLanguageExtension(this.language);

        if (!this.isConnected) {
            this._initializingEditor = false;
            return;
        }
        const container = this.shadowRoot.getElementById('cm-container');
        if (!container) {
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
                    EditorView.contentAttributes.of({ spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
                    this.languageConf.of(initialLangExt),
                    this.writingModeConf.of([]),
                    this.themeConf.of(document.body.getAttribute('data-theme') !== 'light' ? syntaxHighlighting(oneDarkHighlightStyle) : []),
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
            parent: container,
            root: this.shadowRoot
        });
        this._initializingEditor = false;
        if (this.writingMode) {
            this._updateWritingMode();
        }
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