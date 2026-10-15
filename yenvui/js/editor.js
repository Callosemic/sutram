import { LitElement, html, css } from 'lit';
async function loadLanguageExtension(lang) {
    try {
        const cm = await import('codemirror-core');
        if (lang === 'python') return cm.python();
        if (lang === 'json') return cm.json();
        if (lang === 'javascript' || lang === 'ts') return cm.javascript();
        if (lang === 'yaml' || lang === 'yml') return cm.yaml();
        if (lang === 'html' || lang === 'htm') return cm.htmlLang();
        if (lang === 'css') return cm.cssLang();
        if (lang === 'markdown' || lang === 'md') return cm.markdown();

        // Stage A (ADR 0032): Attempt importmap resolution first
        try {
            const langMod = await import(/* webpackIgnore: true */ `@codemirror/lang-${lang}`);
            const fn = langMod[lang] || langMod.default;
            if (typeof fn === 'function') return fn();
        } catch (importErr) {
            // Stage A Fallback: Trigger host-injected JIT vendorization provider
            if (typeof window.Sutram?.vendorizeLanguage === 'function') {
                try {
                    const vendorPath = await window.Sutram.vendorizeLanguage(lang);
                    if (vendorPath) {
                        const staticMod = await import(/* webpackIgnore: true */ vendorPath);
                        const fn = staticMod[lang] || staticMod.default;
                        if (typeof fn === 'function') return fn();
                    }
                } catch (vendorErr) {
                    console.warn(`[yenVUI] JIT vendorization failed for '${lang}':`, vendorErr);
                }
            }
        }

        // Default fallback
        return cm.markdown();
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

        /* Legacy CodeMirror & Dialog Fallbacks */
        .CodeMirror-dialog {
            background: var(--input-bg) !important;
            color: var(--text) !important;
            border-bottom: 1px solid var(--border) !important;
            padding: 8px 10px !important;
        }
        .CodeMirror-dialog input {
            background: var(--bg) !important;
            color: var(--text) !important;
            border: 1px solid var(--border) !important;
            border-radius: 4px;
            padding: 4px 8px !important;
            font-family: var(--font-mono, monospace);
            outline: none;
        }
        .CodeMirror-dialog input:focus {
            border-color: var(--intent-primary) !important;
        }
        .CodeMirror-search-match { background: #f59e0b; color: #000; }
        .CodeMirror-search-hint { color: #888; font-style: italic; }

        .EasyMDEContainer { flex: 1; display: flex; flex-direction: column; min-height: 0; }
        .EasyMDEContainer .CodeMirror {
            background: var(--input-bg);
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 4px;
            font-family: var(--font-mono, monospace) !important;
            font-size: 13px;
            line-height: 1.5;
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        .EasyMDEContainer .CodeMirror-scroll { flex: 1; min-height: 100%; }
        .EasyMDEContainer .CodeMirror .cm-header-1 { font-size: 1.25em; line-height: 1.3; }
        .EasyMDEContainer .CodeMirror .cm-header-2 { font-size: 1.15em; line-height: 1.3; }
        .EasyMDEContainer .CodeMirror .cm-header-3 { font-size: 1.05em; line-height: 1.3; }
        .EasyMDEContainer .CodeMirror .cm-header-4,
        .EasyMDEContainer .CodeMirror .cm-header-5,
        .EasyMDEContainer .CodeMirror .cm-header-6 { font-size: 1em; line-height: 1.3; }
        .editor-preview { background: var(--input-bg); color: var(--text); }
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
        this.attributesConf = null;
    }
    connectedCallback() {
        super.connectedCallback();

        this._themeListener = () => {
            const theme = document.body.getAttribute('data-theme') || 'dark';
            if (this.getAttribute('data-theme') !== theme) {
                this.setAttribute('data-theme', theme);
                this._updateTheme();
            }
        };
        window.addEventListener('yenvui-theme-changed', this._themeListener);
        if (typeof MutationObserver !== 'undefined' && document.body) {
            this._themeObserver = new MutationObserver(() => this._themeListener());
            this._themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
        }
        this.setAttribute('data-theme', document.body.getAttribute('data-theme') || 'dark');

        setTimeout(() => this._initEditor(), 0);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._themeListener) window.removeEventListener('yenvui-theme-changed', this._themeListener);
        if (this._themeObserver) {
            this._themeObserver.disconnect();
            this._themeObserver = null;
        }
        if (this._view) {
            this._view.destroy();
            this._view = null;
        }
    }
    updated(changedProperties) {
        if (this._view && this._EditorView) {
            if (changedProperties.has('value')) {
                const currentDoc = this._view.state.doc.toString();
                const targetValue = this.value || '\n';
                if (currentDoc !== this.value && currentDoc !== targetValue) {
                    this._view.dispatch({
                        changes: { from: 0, to: currentDoc.length, insert: targetValue }
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
                    padding: "30px 10px 80px 10px"
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
                effects: [
                    this.writingModeConf.reconfigure([writingTheme, markdownShortcuts]),
                    this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({ spellcheck: "true", autocorrect: "on", autocapitalize: "on" }))
                ]
            });
        } else {
            this._view.dispatch({
                effects: [
                    this.writingModeConf.reconfigure([]),
                    this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({ spellcheck: "false", autocorrect: "off", autocapitalize: "off" }))
                ]
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
        this.attributesConf = new Compartment();
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
                doc: this.value || '\n',
                extensions: [
                    basicSetup,
                    baseTheme,
                    EditorView.lineWrapping,
                    this.attributesConf.of(EditorView.contentAttributes.of(this.writingMode ? { spellcheck: "true", autocorrect: "on", autocapitalize: "on" } : { spellcheck: "false", autocorrect: "off", autocapitalize: "off" })),
                    EditorView.exceptionSink.of((err) => console.warn("[CodeMirror] Suppressed internal plugin crash:", err)),
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
                        if (update.selectionSet) {
                            this.dispatchEvent(new CustomEvent('yenvui-editor-selection', {
                                detail: { cursor: update.state.selection.main.head },
                                bubbles: true,
                                composed: true
                            }));
                        }
                    }),
                    EditorView.domEventHandlers({
                        scroll: (e, view) => {
                            this.dispatchEvent(new CustomEvent('yenvui-editor-scroll', {
                                detail: { top: view.scrollDOM.scrollTop },
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
        if (this._pendingCursor !== undefined) {
            this.setCursor(this._pendingCursor);
            this._pendingCursor = undefined;
        }
        if (this._pendingScrollTop !== undefined) {
            this.setScrollInfo(this._pendingScrollTop);
            this._pendingScrollTop = undefined;
        }
        if (this.writingMode) {
            this._updateWritingMode();
        }
    }
    getCursor() { return this._view ? this._view.state.selection.main.head : (this._pendingCursor || 0); }

    setCursor(pos) {
        if (this._view && pos !== undefined) {
            this._view.dispatch({ selection: { anchor: pos } });
        } else if (pos !== undefined) {
            this._pendingCursor = pos;
        }
    }

    getScrollInfo() {
        return this._view ? this._view.scrollDOM.scrollTop : (this._pendingScrollTop || 0);
    }

    setScrollInfo(top) {
        if (this._view && top !== undefined) {
            requestAnimationFrame(() => {
                if (this._view) this._view.scrollDOM.scrollTop = top;
            });
        } else if (top !== undefined) {
            this._pendingScrollTop = top;
        }
    }
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

    transformContent(transformFn) {
        if (!this._view || typeof transformFn !== 'function') return false;
        const { state, dispatch } = this._view;
        const selection = state.selection.main;
        if (selection.empty) {
            const original = state.doc.toString();
            const transformed = transformFn(original);
            if (transformed !== original) {
                dispatch({
                    changes: { from: 0, to: original.length, insert: transformed }
                });
                return true;
            }
        } else {
            const selectedText = state.sliceDoc(selection.from, selection.to);
            const transformed = transformFn(selectedText);
            if (transformed !== selectedText) {
                dispatch({
                    changes: { from: selection.from, to: selection.to, insert: transformed }
                });
                return true;
            }
        }
        return false;
    }
}
customElements.define('yenvui-editor', YenvuiEditor);