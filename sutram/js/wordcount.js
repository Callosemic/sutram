// sutram/js/wordcount.js
// Ephemeral Word Count Decoration Plugin for CodeMirror 6
import { WidgetType, StateField, Decoration, RangeSetBuilder, EditorView, EditorState } from 'codemirror-core';

class WordCountWidget extends WidgetType {
    constructor(count) {
        super();
        this.count = count;
    }

    eq(other) {
        return other.count === this.count;
    }

    toDOM() {
        const wrap = document.createElement("span");
        // Adhering strictly to the CSS Vacuum: relying on semantic intent tokens
        wrap.style.cssText = "background: var(--intent-highlight, #8b5cf6); color: #ffffff; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; margin-left: 8px; font-weight: bold; font-family: var(--font-mono, monospace); user-select: none;";
        wrap.innerText = `${this.count} words`;
        return wrap;
    }
}
const wordCountField = StateField.define({
    create(state) {
        return buildDecorations(state);
    },
    update(decorations, tr) {
        // Optimize layout thrashing by only recalculating if the document text physically mutated
        if (tr.docChanged) return buildDecorations(tr.state);
        return decorations.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f)
});

function buildDecorations(state) {
    const builder = new RangeSetBuilder();
    const docText = state.doc.toString();
    // Global calculations: strip all markers to ensure we only count organic content
    const strippedText = docText.replace(/{{wordcount_(start|stop|all|sum)}}/g, '');
    const totalWords = (strippedText.match(/\S+/g) || []).length;

    const regex = /{{wordcount_(start|stop|all|sum)}}/g;
    const matches = [];
    let m;

    // Pass 1: Extract all marker coordinates sequentially
    while ((m = regex.exec(docText)) !== null) {
        matches.push({ type: m[1], start: m.index, end: m.index + m[0].length });
    }

    let summedWords = 0;
    let currentStart = null;

    // Pass 2: Calculate individual blocks and aggregate the total sum
    for (const match of matches) {
        if (match.type === 'start') {
            currentStart = match.end;
        } else if (match.type === 'stop' && currentStart !== null) {
            const blockText = docText.slice(currentStart, match.start);
            const blockWords = (blockText.match(/\S+/g) || []).length;
            match.count = blockWords;
            summedWords += blockWords;
            currentStart = null;
        }
    }

    // Pass 3: Register decorations in strict document position order (CodeMirror Requirement)
    for (const match of matches) {
        let countToDisplay = null;
        if (match.type === 'stop' && match.count !== undefined) {
            countToDisplay = match.count;
        } else if (match.type === 'all') {
            countToDisplay = totalWords;
        } else if (match.type === 'sum') {
            countToDisplay = summedWords;
        }
        if (countToDisplay !== null) {
            builder.add(match.end, match.end, Decoration.widget({
                widget: new WordCountWidget(countToDisplay),
                side: 1 // Renders immediately to the right of the marker
            }));
        }
    }

    return builder.finish();
}

// ----------------------------------------------------------------------
// Editor Physics: Auto-Close Tag Injection
// ----------------------------------------------------------------------
const autoCloseWordcount = EditorState.transactionFilter.of(tr => {
    // Intercept only organic user typing to prevent infinite loops
    if (!tr.docChanged || !tr.isUserEvent("input.type")) return tr;

    let appendTransactions = [];

    tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        const insertedText = inserted.toString();

        // Trigger the check only when the user types the final closing bracket
        if (insertedText === "}") {
            const line = tr.newDoc.lineAt(toB).text;
            const lineUpToCursor = line.slice(0, toB - tr.newDoc.lineAt(toB).from);

            // If they just completed the start tag, calculate the injection payload
            if (lineUpToCursor.endsWith("{{wordcount_start}}")) {
                appendTransactions.push({
                    changes: { from: toB, insert: "\n\n{{wordcount_stop}}" },
                    selection: { anchor: toB + 1 } // Place cursor in the empty space between tags
                });
            }
        }
    });

    // If a transaction payload was built, push it into the editor's execution stack
    if (appendTransactions.length > 0) {
        return [tr, ...appendTransactions];
    }
    return tr;
});

export const wordCountPlugin = [wordCountField, autoCloseWordcount];