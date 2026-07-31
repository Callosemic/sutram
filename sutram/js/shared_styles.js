// sutram/js/shared_styles.js
// Pure CSS Intent Tokens & Dumb Presentation Primitives

import { css } from 'lit';
export const sharedStyles = css`
    /* CodeMirror & Editor Engine Overrides */
    .cm-editor { height: 100%; }
    .cm-scroller { overflow: auto; font-family: var(--font-mono); }

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
        font-family: var(--font-mono);
        outline: none;
    }
    .CodeMirror-dialog input:focus {
        border-color: var(--btn) !important;
    }
    .CodeMirror-search-match { background: #f59e0b; color: #000; }
    .CodeMirror-search-hint { color: #888; font-style: italic; }

    .EasyMDEContainer { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    .EasyMDEContainer .CodeMirror {
        background: var(--input-bg);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 4px;
        font-family: var(--font-mono) !important;
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

    /* Global Reset for Components */
    * { box-sizing: border-box; }

    /* Component-Specific Input Enhancements (Base resets inherited from yenVUI theme-tokens.css) */
    textarea:focus, input:focus, select:focus {
        border-color: var(--btn);
    }

    /* Buttons */
    button {
        background: var(--btn);
        color: white;
        border: none;
        padding: 10px 20px;
        font-size: 16px;
        font-weight: bold;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
    }
    button:hover { background: var(--btn-hover); }
    .btn-sm {
        margin: 0;
        padding: 8px 14px;
        font-size: 14px;
    }

    /* Sub-Tabs (Inherited for Shadow DOM components) */
    .sub-tabs-bar { position: relative; display: flex; justify-content: space-between; align-items: center; background: var(--bg); z-index: 99; border-bottom: 1px solid var(--border); padding: 0 20px; height: 44px; box-sizing: border-box; }
    .sub-tabs-actions:empty { display: none !important; }
    .sub-tabs { display: flex; gap: 8px; margin: 0; padding: 0; overflow-x: auto; align-items: center; height: 100%; scrollbar-width: none; }
    .system-action-btn { background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; font-weight: bold; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; padding: 0; font-size: 1.1rem; transition: background 0.2s; margin: 0; box-sizing: border-box; }
    .system-action-btn:hover { background: var(--input-bg); }
    yenvui-dropdown { display: inline-flex; align-items: center; }
    .sub-tab { cursor: pointer; padding: 0 12px; font-size: 0.9rem; font-weight: bold; color: var(--text-muted); white-space: nowrap; transition: all 0.2s; height: 100%; display: flex; align-items: center; border-top: 2px solid transparent; border-bottom: 2px solid transparent; box-sizing: border-box; outline: none; }
    .sub-tab:hover { color: var(--text); }
    .sub-tab.active { color: var(--text); border-bottom: 2px solid var(--btn); }

    :host-context([data-theme="e-ink"]) .sub-tab {
        transition: none !important;
    }
    :host-context([data-theme="e-ink"]) .sub-tab:hover {
        color: var(--text-muted);
    }
    :host-context([data-theme="e-ink"]) .sub-tab.active {
        color: var(--text) !important;
    }

    .sticky-header { position: relative; flex-shrink: 0; padding: 0; background: var(--bg); z-index: 10; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; }
    .toolbar-row { display: flex; align-items: center; gap: 10px; padding: 5px 20px; height: 44px; box-sizing: border-box; }
    
    @container (max-width: 50rem) {
        .toolbar-row { padding: 5px 10px; }
    }

    /* Utilities */
    .spinner {
        display: none;
        margin-top: 20px;
        font-style: italic;
        color: #888;
    }
    .folder-label {
        font-weight: bold;
        font-family: monospace;
        color: #facc15;
        font-size: 1.1rem;
    }

    /* Light Theme Overrides */
    :host-context([data-theme="light"]) h1, 
    :host-context([data-theme="light"]) h2, 
    :host-context([data-theme="light"]) h3, 
    :host-context([data-theme="light"]) h4, 
    :host-context([data-theme="light"]) h5, 
    :host-context([data-theme="light"]) h6 { 
        color: var(--text) !important;
    }
    :host-context([data-theme="light"]) textarea, 
    :host-context([data-theme="light"]) input,
    :host-context([data-theme="light"]) select {
        background: #f1f5f9;
        color: #0f172a;
        border: 1px solid #cbd5e1;
    }
    :host-context([data-theme="light"]) .folder-label {
        color: #b45309;
    }

    /* E-Ink Theme Overrides */
    :host-context([data-theme="e-ink"]) h1, 
    :host-context([data-theme="e-ink"]) h2, 
    :host-context([data-theme="e-ink"]) h3, 
    :host-context([data-theme="e-ink"]) h4, 
    :host-context([data-theme="e-ink"]) h5, 
    :host-context([data-theme="e-ink"]) h6,
    :host-context([data-theme="e-ink"]) .folder-label { 
        color: #000000 !important;
        font-weight: 900;
    }
    :host-context([data-theme="e-ink"]) button {
        background: #ffffff !important;
        color: #000000 !important;
        font-weight: 900 !important;
        border: 2px solid #ec4899 !important;
        box-shadow: 3px 3px 0 #eab308 !important;
    }
    :host-context([data-theme="e-ink"]) button:hover {
        background: #f1f5f9 !important;
    }
    :host-context([data-theme="e-ink"]) textarea, 
    :host-context([data-theme="e-ink"]) input, 
    :host-context([data-theme="e-ink"]) select {
        border: 2px solid #0ea5e9 !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-weight: 600;
    }
`;