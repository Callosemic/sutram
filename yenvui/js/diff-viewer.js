// sutram/yenvui/js/diff-viewer.js
import { html, css } from 'lit';
import { YenvuiBase } from './yenvui-base.js';
import { parseDiffPayload } from './diff-utils.js';

export class YenvuiDiffViewer extends YenvuiBase {
    static properties = {
        diffText: { type: String },
        searchStr: { type: String },
        replaceStr: { type: String },
        searchLines: { type: Array },
        replaceLines: { type: Array },
        leftTitle: { type: String },
        rightTitle: { type: String },
        mode: { type: String, reflect: true }, // 'auto' | 'split-side' | 'split-stacked' | 'interleaved'
        activeLineIndex: { type: Number },
        _parsedData: { type: Object, state: true }
    };

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            min-width: 0;
            min-height: 0;
            background: var(--bg);
            box-sizing: border-box;
            container-type: inline-size;
            overflow: hidden;
        }

        .diff-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 12px;
            background: var(--input-bg);
            border-bottom: 1px solid var(--border);
            font-family: var(--font-mono);
            font-size: 0.75rem;
            flex-shrink: 0;
            gap: 8px;
            min-width: 0;
        }

        .toolbar-label {
            font-weight: bold;
            color: var(--text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
        }

        .mode-toggle-group {
            display: inline-flex;
            border: 1px solid var(--border);
            border-radius: 4px;
            overflow: hidden;
            flex-shrink: 0;
        }
        .mode-btn {
            background: transparent;
            color: var(--text-muted);
            border: none;
            border-right: 1px solid var(--border);
            padding: 4px 8px;
            font-size: 0.72rem;
            cursor: pointer;
            font-family: var(--font-mono);
            display: inline-flex;
            align-items: center;
            gap: 4px;
            transition: background 0.15s ease, color 0.15s ease;
        }

        .mode-text {
            display: inline;
        }

        @container (max-width: 520px) {
            .mode-text {
                display: none;
            }
            .mode-btn {
                padding: 4px 6px;
            }
        }

        .mode-btn:last-child {
            border-right: none;
        }

        .mode-btn:hover {
            background: var(--bg-hover);
            color: var(--text);
        }

        .mode-btn.active {
            background: var(--intent-primary);
            color: var(--pane-bg);
            font-weight: bold;
        }

        .diff-viewport {
            display: flex;
            flex: 1;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
            box-sizing: border-box;
        }

        .diff-split-container {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            min-width: 0;
            gap: 10px;
            padding: 10px;
            box-sizing: border-box;
            background: var(--bg);
        }

        @container (min-width: 768px) {
            :host([mode="auto"]) .diff-split-container {
                flex-direction: row !important;
            }
        }

        :host([mode="split-side"]) .diff-split-container {
            flex-direction: row !important;
        }

        :host([mode="split-stacked"]) .diff-split-container {
            flex-direction: column !important;
        }

        .diff-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--input-bg);
            overflow: hidden;
        }

        .diff-pane-header {
            padding: 6px 12px;
            font-family: var(--font-mono);
            font-size: 0.75rem;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 1px solid var(--border);
            background: var(--bg-deep);
            color: var(--text-muted);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
            min-width: 0;
        }

        .diff-box {
            flex: 1;
            overflow: auto;
            font-family: var(--font-mono);
            font-size: 0.82rem;
            white-space: pre;
            min-width: 0;
            min-height: 0;
            overscroll-behavior: contain;
        }

        .diff-track {
            display: flex;
            flex-direction: column;
            min-width: max(100%, calc(var(--diff-min-char-width, 0ch) + 64px));
            width: max-content;
        }

        .diff-line {
            display: flex;
            align-items: baseline;
            padding: 0 10px;
            height: 1.45rem;
            line-height: 1.45rem;
            cursor: pointer;
            user-select: none;
            border-left: 3px solid transparent;
            box-sizing: border-box;
            width: 100%;
        }

        .diff-line:hover {
            background: var(--bg-hover);
        }

        .line-num {
            width: 38px;
            flex-shrink: 0;
            color: var(--text-muted);
            opacity: 0.55;
            text-align: right;
            padding-right: 10px;
            margin-right: 8px;
            border-right: 1px solid var(--border);
            user-select: none;
            box-sizing: border-box;
        }

        .line-marker {
            width: 16px;
            flex-shrink: 0;
            text-align: center;
            font-weight: bold;
            user-select: none;
            color: var(--text-muted);
        }
        .line-text {
            flex: 1;
            user-select: text;
        }

        .intraline-del {
            text-decoration-line: underline;
            text-decoration-style: wavy;
            text-decoration-color: var(--intent-danger);
            text-underline-offset: 3px;
            background: color-mix(in srgb, var(--intent-danger) 24%, transparent);
            border-radius: 2px;
        }

        .intraline-ins {
            text-decoration-line: underline;
            text-decoration-style: wavy;
            text-decoration-color: var(--intent-success);
            text-underline-offset: 3px;
            background: color-mix(in srgb, var(--intent-success) 24%, transparent);
            border-radius: 2px;
        }

        .diff-line.removed {
            background: color-mix(in srgb, var(--intent-danger) 12%, transparent);
            border-left-color: var(--intent-danger);
        }

        .diff-line.removed .line-marker {
            color: var(--intent-danger);
        }

        .diff-line.added {
            background: color-mix(in srgb, var(--intent-success) 12%, transparent);
            border-left-color: var(--intent-success);
        }

        .diff-line.added .line-marker {
            color: var(--intent-success);
        }

        .diff-line.active {
            background: color-mix(in srgb, var(--intent-highlight) 25%, transparent) !important;
            border-left-color: var(--intent-highlight) !important;
        }

        .diff-line.dummy {
            background: repeating-linear-gradient(
                45deg,
                transparent,
                transparent 5px,
                color-mix(in srgb, var(--border) 45%, transparent) 5px,
                color-mix(in srgb, var(--border) 45%, transparent) 10px
            );
            opacity: 0.5;
        }

        .diff-interleaved-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            margin: 10px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--input-bg);
            overflow: hidden;
        }

        :host-context([data-theme="e-ink"]) .diff-line.active {
            background: transparent !important;
            border-top: 2px dashed var(--border) !important;
            border-bottom: 2px dashed var(--border) !important;
            font-weight: 900;
        }

        :host-context([data-theme="e-ink"]) .diff-line.removed {
            background: transparent !important;
            border-left: 3px solid var(--border) !important;
            text-decoration: line-through;
        }

        :host-context([data-theme="e-ink"]) .diff-line.added {
            background: transparent !important;
            border-left: 3px solid var(--border) !important;
            font-weight: bold;
        }
        :host-context([data-theme="e-ink"]) .diff-line.dummy {
            background: transparent !important;
            border-bottom: 1px dotted var(--border);
        }
        :host-context([data-theme="e-ink"]) .intraline-del,
        :host-context([data-theme="e-ink"]) .intraline-ins {
            background: transparent !important;
            text-decoration-line: underline !important;
            text-decoration-style: wavy !important;
            text-decoration-color: var(--border) !important;
            font-weight: 900;
        }

        .diff-box {
            cursor: grab;
        }
        .diff-box.is-panning {
            cursor: grabbing;
            user-select: none;
        }
        .diff-line.hover-sync {
            background: color-mix(in srgb, var(--intent-highlight) 10%, transparent);
        }
        .ghost-caret-marker {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 2px;
            height: 1.45rem;
            background: var(--intent-highlight);
            box-shadow: 0 0 8px var(--intent-highlight);
            pointer-events: none;
            z-index: 10;
            animation: pulse 1s infinite alternate;
        }
        @keyframes pulse {
            0% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    `;

    constructor() {
        super();
        this.diffText = '';
        this.searchStr = '';
        this.replaceStr = '';
        this.searchLines = null;
        this.replaceLines = null;
        this.leftTitle = 'SEARCH (Expected / Original)';
        this.rightTitle = 'REPLACE (Actual / Modified)';
        this.mode = 'auto';
        this.activeLineIndex = null;
        this._parsedData = { split: { searchLines: [], replaceLines: [] }, interleaved: [], maxChars: 0 };
        this._activeScrollSource = null;
        this._scrollReleaseTimer = null;
        this._hoveredLineIndex = null;
        this._activeCharCol = null;

        // Kinetic pan & throw physics
        this._isDragging = false;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragStartScrollLeft = 0;
        this._dragStartScrollTop = 0;
        this._dragSourceBox = null;
        this._historySamples = [];
        this._momentumRafId = null;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._scrollReleaseTimer) clearTimeout(this._scrollReleaseTimer);
        if (this._momentumRafId) cancelAnimationFrame(this._momentumRafId);
    }
    _handlePointerDownPan(e, boxId) {
        // Enforce desktop-only: Let native mobile touch scrolling handle mobile viewports
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        const target = e.target;
        // Allow text selection if the user explicitly clicked text inside a line
        if (target.classList.contains('line-text') && window.getSelection().toString().length > 0) return;

        const box = this.shadowRoot.getElementById(boxId);
        if (!box) return;

        if (this._momentumRafId) {
            cancelAnimationFrame(this._momentumRafId);
            this._momentumRafId = null;
        }

        this._isDragging = false;
        this._dragSourceBox = box;
        this._dragStartX = e.clientX;
        this._dragStartY = e.clientY;
        this._dragStartScrollLeft = box.scrollLeft;
        this._dragStartScrollTop = box.scrollTop;
        this._historySamples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];

        const onPointerMove = (ev) => {
            const dx = ev.clientX - this._dragStartX;
            const dy = ev.clientY - this._dragStartY;

            if (!this._isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                this._isDragging = true;
                box.classList.add('is-panning');
            }

            if (this._isDragging) {
                ev.preventDefault();
                this._claimScrollSource(boxId);

                const partnerId = boxId === 'box-a' ? 'box-b' : 'box-a';
                const partnerBox = this.shadowRoot.getElementById(partnerId);

                const nextLeft = this._dragStartScrollLeft - dx;
                const nextTop = this._dragStartScrollTop - dy;

                box.scrollLeft = nextLeft;
                box.scrollTop = nextTop;

                if (partnerBox) {
                    partnerBox.scrollLeft = nextLeft;
                    partnerBox.scrollTop = nextTop;
                }

                const now = performance.now();
                this._historySamples.push({ x: ev.clientX, y: ev.clientY, t: now });
                if (this._historySamples.length > 5) this._historySamples.shift();
            }
        };

        const onPointerUp = (ev) => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            box.classList.remove('is-panning');

            if (this._isDragging && this._historySamples.length >= 2) {
                const now = performance.now();
                const recent = this._historySamples.filter(s => now - s.t < 100);
                if (recent.length >= 2) {
                    const first = recent[0];
                    const last = recent[recent.length - 1];
                    const dt = Math.max(10, last.t - first.t);
                    let vx = (last.x - first.x) / dt; // px per ms
                    let vy = (last.y - first.y) / dt;

                    // Engage kinetic throw decay if velocity is meaningful
                    if (Math.abs(vx) > 0.15 || Math.abs(vy) > 0.15) {
                        this._executeThrow(boxId, vx * 16, vy * 16);
                    }
                }
            }
        };

        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    }

    _executeThrow(boxId, initVx, initVy) {
        let vx = initVx;
        let vy = initVy;
        const decay = 0.94;
        const partnerId = boxId === 'box-a' ? 'box-b' : 'box-a';

        const step = () => {
            vx *= decay;
            vy *= decay;

            if (Math.abs(vx) < 0.2 && Math.abs(vy) < 0.2) {
                this._momentumRafId = null;
                return;
            }

            const box = this.shadowRoot.getElementById(boxId);
            const partnerBox = this.shadowRoot.getElementById(partnerId);

            if (box) {
                this._claimScrollSource(boxId);
                box.scrollLeft -= vx;
                box.scrollTop -= vy;

                if (partnerBox) {
                    partnerBox.scrollLeft = box.scrollLeft;
                    partnerBox.scrollTop = box.scrollTop;
                }
            }

            this._momentumRafId = requestAnimationFrame(step);
        };

        this._momentumRafId = requestAnimationFrame(step);
    }
    _handleLineHover(idx, e) {
        this._hoveredLineIndex = idx;
        const lineEl = e.currentTarget;
        const textEl = lineEl ? lineEl.querySelector('.line-text') : null;
        if (lineEl && textEl) {
            const textRect = textEl.getBoundingClientRect();
            const relX = Math.max(0, e.clientX - textRect.left);
            this._activeCharCol = Math.floor(relX / 8.0); // 8.0px character width for 0.82rem JetBrains Mono
        }
        this.requestUpdate();
    }

    _clearLineHover() {
        this._hoveredLineIndex = null;
        this._activeCharCol = null;
        this.requestUpdate();
    }

    willUpdate(changedProperties) {
        if (
            changedProperties.has('diffText') ||
            changedProperties.has('searchStr') ||
            changedProperties.has('replaceStr') ||
            changedProperties.has('searchLines') ||
            changedProperties.has('replaceLines')
        ) {
            if (Array.isArray(this.searchLines) && Array.isArray(this.replaceLines)) {
                let maxChars = 0;
                const normalize = (lines, defaultType) => lines.map((l, i) => {
                    if (typeof l === 'string') {
                        return { lineNumber: i + 1, text: l, type: defaultType, isDummy: false, tokens: null };
                    }
                    return l;
                });

                const normSearch = normalize(this.searchLines, 'removed');
                const normReplace = normalize(this.replaceLines, 'added');
                const interleaved = [];

                normSearch.forEach(l => {
                    if ((l.text || '').length > maxChars) maxChars = (l.text || '').length;
                    if (!l.isDummy) interleaved.push({ oldLineNumber: l.lineNumber, newLineNumber: null, text: l.text, type: l.type || 'context', tokens: l.tokens });
                });
                normReplace.forEach(l => {
                    if ((l.text || '').length > maxChars) maxChars = (l.text || '').length;
                    if (!l.isDummy && l.type === 'added') interleaved.push({ oldLineNumber: null, newLineNumber: l.lineNumber, text: l.text, type: 'added', tokens: l.tokens });
                });
                this._parsedData = {
                    split: { searchLines: normSearch, replaceLines: normReplace },
                    interleaved,
                    maxChars
                };
            } else {
                this._parsedData = parseDiffPayload({
                    diffText: this.diffText,
                    searchStr: this.searchStr,
                    replaceStr: this.replaceStr
                });
            }
        }
    }
    _claimScrollSource(sourceId) {
        this._activeScrollSource = sourceId;
        if (this._scrollReleaseTimer) clearTimeout(this._scrollReleaseTimer);
        this._scrollReleaseTimer = setTimeout(() => {
            this._activeScrollSource = null;
        }, 160);
    }

    _handleScroll(sourceId, targetId) {
        if (this._activeScrollSource && this._activeScrollSource !== sourceId) return;
        this._claimScrollSource(sourceId);

        const sourceBox = this.shadowRoot.getElementById(sourceId);
        const targetBox = this.shadowRoot.getElementById(targetId);
        if (!sourceBox || !targetBox) return;

        const targetTop = sourceBox.scrollTop;
        const targetLeft = sourceBox.scrollLeft;

        if (targetBox.scrollTop !== targetTop) {
            targetBox.scrollTop = targetTop;
        }
        if (targetBox.scrollLeft !== targetLeft) {
            targetBox.scrollLeft = targetLeft;
        }
    }

    _setActiveLine(idx) {
        this.activeLineIndex = this.activeLineIndex === idx ? null : idx;
        this.dispatchEvent(new CustomEvent('yenvui-diff-line-selected', {
            detail: { index: this.activeLineIndex },
            bubbles: true,
            composed: true
        }));
    }
    _setMode(newMode) {
        this.mode = newMode;
        this.dispatchEvent(new CustomEvent('yenvui-diff-mode-changed', {
            detail: { mode: newMode },
            bubbles: true,
            composed: true
        }));
    }
    _renderLineContent(line, defaultRole = 'context') {
        if (!line || line.isDummy) return ' ';
        if (Array.isArray(line.tokens) && line.tokens.length > 0) {
            const isDel = defaultRole === 'removed' || line.type === 'removed';
            const spanClass = isDel ? 'intraline-del' : 'intraline-ins';
            return line.tokens.map(tok => tok.changed
                ? html`<span class="${spanClass}">${tok.text}</span>`
                : tok.text
            );
        }
        return line.text || ' ';
    }

    render() {
        const { split, interleaved, maxChars } = this._parsedData;
        const isInterleaved = this.mode === 'interleaved';
        const trackStyle = `--diff-min-char-width: ${maxChars || 0}ch;`;

        return html`
            <div class="diff-toolbar">
                <span class="toolbar-label">
                    ${isInterleaved ? `${this.leftTitle} /${this.rightTitle} (Interleaved)` : `${this.leftTitle} ⟷${this.rightTitle}`}
                </span>
                <div class="mode-toggle-group">
                    <button class="mode-btn ${this.mode === 'auto' ? 'active' : ''}" @click=${() => this._setMode('auto')} title="Responsive Container Split">
                        <yv-icon name="sparkles" style="width: 12px; height: 12px;"></yv-icon><span class="mode-text">Auto</span>
                    </button>
                    <button class="mode-btn ${this.mode === 'split-side' ? 'active' : ''}" @click=${() => this._setMode('split-side')} title="Side-by-Side Split">
                        <yv-icon name="columns" style="width: 12px; height: 12px;"></yv-icon><span class="mode-text">Side</span>
                    </button>
                    <button class="mode-btn ${this.mode === 'split-stacked' ? 'active' : ''}" @click=${() => this._setMode('split-stacked')} title="Top/Bottom Stacked Split">
                        <yv-icon name="rows" style="width: 12px; height: 12px;"></yv-icon><span class="mode-text">Stacked</span>
                    </button>
                    <button class="mode-btn ${this.mode === 'interleaved' ? 'active' : ''}" @click=${() => this._setMode('interleaved')} title="Interleaved Unified Lines">
                        <yv-icon name="align-justify" style="width: 12px; height: 12px;"></yv-icon><span class="mode-text">Unified</span>
                    </button>
                </div>
            </div>

            <div class="diff-viewport">
                ${isInterleaved ? html`
                    <div class="diff-interleaved-pane">
                        <div class="diff-pane-header">
                            <span>Unified Interleaved Stream</span>
                            <span>${interleaved.length} lines</span>
                        </div>
                        <div class="diff-box" id="box-interleaved"
                            @pointerdown=${(e) => this._handlePointerDownPan(e, 'box-interleaved')}>
                            <div class="diff-track" style="${trackStyle}">
                                ${interleaved.map((line, idx) => html`
                                    <div class="diff-line ${line.type || ''} ${this.activeLineIndex === idx ? 'active' : ''}"
                                        @pointerdown=${() => this._setActiveLine(idx)}>
                                        <span class="line-num">${line.oldLineNumber ?? ''}</span>
                                        <span class="line-num">${line.newLineNumber ?? ''}</span>
                                        <span class="line-marker">${line.type === 'added' ? '+' : (line.type === 'removed' ? '-' : ' ')}</span>
                                        <span class="line-text">${this._renderLineContent(line, line.type)}</span>
                                    </div>
                                `)}
                            </div>
                        </div>
                    </div>
                ` : html`
                    <div class="diff-split-container">
                        <div class="diff-pane">
                            <div class="diff-pane-header">
                                <span>${this.leftTitle}</span>
                                <span>${split.searchLines.filter(l => !l.isDummy).length} lines</span>
                            </div>
                            <div class="diff-box" id="box-a"
                                @pointerdown=${(e) => this._handlePointerDownPan(e, 'box-a')}
                                @wheel=${() => this._claimScrollSource('box-a')}
                                @scroll=${() => this._handleScroll('box-a', 'box-b')}>
                                <div class="diff-track" style="${trackStyle}">
                                    ${split.searchLines.map((line, idx) => html`
                                        <div class="diff-line ${line.isDummy ? 'dummy' : (line.type || '')} ${this.activeLineIndex === idx ? 'active' : ''} ${this._hoveredLineIndex === idx ? 'hover-sync' : ''}"
                                            @pointerdown=${() => this._setActiveLine(idx)}
                                            @pointerenter=${(e) => this._handleLineHover(idx, e)}
                                            @pointerleave=${() => this._clearLineHover()}
                                            style="position: relative;">
                                            <span class="line-num">${line.lineNumber ?? ''}</span>
                                            <span class="line-marker">${line.isDummy ? '' : (line.type === 'removed' ? '-' : ' ')}</span>
                                            <span class="line-text">${this._renderLineContent(line, 'removed')}</span>${this._hoveredLineIndex === idx && this._activeCharCol !== null ? html`
                                                <div class="ghost-caret-marker" style="left: ${72 + (this._activeCharCol * 8.0)}px;"></div>
                                            ` : ''}
                                        </div>
                                    `)}
                                </div>
                            </div>
                        </div>

                        <div class="diff-pane">
                            <div class="diff-pane-header">
                                <span>${this.rightTitle}</span>
                                <span>${split.replaceLines.filter(l => !l.isDummy).length} lines</span>
                            </div>
                            <div class="diff-box" id="box-b"
                                @pointerdown=${(e) => this._handlePointerDownPan(e, 'box-b')}
                                @wheel=${() => this._claimScrollSource('box-b')}
                                @scroll=${() => this._handleScroll('box-b', 'box-a')}>
                                <div class="diff-track" style="${trackStyle}">
                                    ${split.replaceLines.map((line, idx) => html`
                                        <div class="diff-line ${line.isDummy ? 'dummy' : (line.type || '')} ${this.activeLineIndex === idx ? 'active' : ''} ${this._hoveredLineIndex === idx ? 'hover-sync' : ''}"
                                            @pointerdown=${() => this._setActiveLine(idx)}
                                            @pointerenter=${(e) => this._handleLineHover(idx, e)}
                                            @pointerleave=${() => this._clearLineHover()}
                                            style="position: relative;">
                                            <span class="line-num">${line.lineNumber ?? ''}</span>
                                            <span class="line-marker">${line.isDummy ? '' : (line.type === 'added' ? '+' : ' ')}</span>
                                            <span class="line-text">${this._renderLineContent(line, 'added')}</span>${this._hoveredLineIndex === idx && this._activeCharCol !== null ? html`
                                                <div class="ghost-caret-marker" style="left: ${72 + (this._activeCharCol * 8.0)}px;"></div>
                                            ` : ''}
                                        </div>
                                    `)}
                                </div>
                            </div>
                        </div>
                    </div>
                `}
            </div>
        `;
    }
}

customElements.define('yenvui-diff-viewer', YenvuiDiffViewer);