// sutram/yenvui/js/diff-utils.js
// Zero-dependency diff parsing and 1:1 line alignment utility (Tier 0)
export function computeIntraLineTokens(oldText = '', newText = '') {
    if (oldText === newText) {
        return { oldTokens: null, newTokens: null };
    }

    const tokenize = (str) => str.match(/(\s+|\w+|[^\s\w]+)/g) || [];
    const sTokens = tokenize(oldText);
    const rTokens = tokenize(newText);

    const m = sTokens.length;
    const n = rTokens.length;

    // Guardrail against pathological ultra-long minified lines
    if (m * n > 40000) {
        return {
            oldTokens: [{ text: oldText, changed: true }],
            newTokens: [{ text: newText, changed: true }]
        };
    }

    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            if (sTokens[i] === rTokens[j]) {
                dp[i + 1][j + 1] = dp[i][j] + 1;
            } else {
                dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    let i = m;
    let j = n;
    const rawOld = [];
    const rawNew = [];

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && sTokens[i - 1] === rTokens[j - 1]) {
            rawOld.push({ text: sTokens[i - 1], changed: false });
            rawNew.push({ text: rTokens[j - 1], changed: false });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            rawNew.push({ text: rTokens[j - 1], changed: true });
            j--;
        } else {
            rawOld.push({ text: sTokens[i - 1], changed: true });
            i--;
        }
    }

    rawOld.reverse();
    rawNew.reverse();

    const mergeAdjacent = (arr) => {
        const merged = [];
        for (const item of arr) {
            if (merged.length > 0 && merged[merged.length - 1].changed === item.changed) {
                merged[merged.length - 1].text += item.text;
            } else {
                merged.push({ ...item });
            }
        }
        return merged;
    };

    return {
        oldTokens: mergeAdjacent(rawOld),
        newTokens: mergeAdjacent(rawNew)
    };
}

function computeMaxChars(searchLines, replaceLines, interleaved) {
    let max = 0;
    for (let i = 0; i < searchLines.length; i++) {
        const len = (searchLines[i].text || '').length;
        if (len > max) max = len;
    }
    for (let i = 0; i < replaceLines.length; i++) {
        const len = (replaceLines[i].text || '').length;
        if (len > max) max = len;
    }
    for (let i = 0; i < interleaved.length; i++) {
        const len = (interleaved[i].text || '').length;
        if (len > max) max = len;
    }
    return max;
}

export function parseRawHunks(searchStr = '', replaceStr = '') {
    const sClean = (searchStr || '').replace(/\r\n/g, '\n');
    const rClean = (replaceStr || '').replace(/\r\n/g, '\n');

    const sLines = sClean ? sClean.split('\n') : [];
    const rLines = rClean ? rClean.split('\n') : [];

    const m = sLines.length;
    const n = rLines.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    const linesMatch = (a, b) => a === b || (a.trim() !== '' && a.trim() === b.trim());

    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            if (linesMatch(sLines[i], rLines[j])) {
                dp[i + 1][j + 1] = dp[i][j] + 1;
            } else {
                dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    let i = m;
    let j = n;
    const rawOps = [];

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && linesMatch(sLines[i - 1], rLines[j - 1])) {
            rawOps.push({ op: 'equal', sLine: sLines[i - 1], rLine: rLines[j - 1], sNum: i, rNum: j });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            rawOps.push({ op: 'insert', rLine: rLines[j - 1], rNum: j });
            j--;
        } else {
            rawOps.push({ op: 'delete', sLine: sLines[i - 1], sNum: i });
            i--;
        }
    }
    rawOps.reverse();

    const alignedSearch = [];
    const alignedReplace = [];
    const interleaved = [];

    let idx = 0;
    while (idx < rawOps.length) {
        if (rawOps[idx].op === 'equal') {
            const item = rawOps[idx];
            const { oldTokens, newTokens } = computeIntraLineTokens(item.sLine, item.rLine);
            alignedSearch.push({ lineNumber: item.sNum, text: item.sLine, tokens: oldTokens, type: 'context', isDummy: false });
            alignedReplace.push({ lineNumber: item.rNum, text: item.rLine, tokens: newTokens, type: 'context', isDummy: false });
            interleaved.push({ oldLineNumber: item.sNum, newLineNumber: item.rNum, text: item.rLine, tokens: newTokens, type: 'context' });
            idx++;
        } else {
            const dels = [];
            const ins = [];
            while (idx < rawOps.length && rawOps[idx].op !== 'equal') {
                if (rawOps[idx].op === 'delete') dels.push(rawOps[idx]);
                else if (rawOps[idx].op === 'insert') ins.push(rawOps[idx]);
                idx++;
            }
            const maxHunk = Math.max(dels.length, ins.length);
            for (let k = 0; k < maxHunk; k++) {
                const hasDel = k < dels.length;
                const hasIns = k < ins.length;
                let oldTokens = null;
                let newTokens = null;

                if (hasDel && hasIns) {
                    const tok = computeIntraLineTokens(dels[k].sLine, ins[k].rLine);
                    oldTokens = tok.oldTokens;
                    newTokens = tok.newTokens;
                    dels[k].tokens = oldTokens;
                    ins[k].tokens = newTokens;
                }

                if (hasDel) {
                    alignedSearch.push({ lineNumber: dels[k].sNum, text: dels[k].sLine, tokens: oldTokens, type: 'removed', isDummy: false });
                } else {
                    alignedSearch.push({ lineNumber: null, text: '', tokens: null, type: 'dummy', isDummy: true });
                }

                if (hasIns) {
                    alignedReplace.push({ lineNumber: ins[k].rNum, text: ins[k].rLine, tokens: newTokens, type: 'added', isDummy: false });
                } else {
                    alignedReplace.push({ lineNumber: null, text: '', tokens: null, type: 'dummy', isDummy: true });
                }
            }
            for (const d of dels) {
                interleaved.push({ oldLineNumber: d.sNum, newLineNumber: null, text: d.sLine, tokens: d.tokens || null, type: 'removed' });
            }
            for (const a of ins) {
                interleaved.push({ oldLineNumber: null, newLineNumber: a.rNum, text: a.rLine, tokens: a.tokens || null, type: 'added' });
            }
        }
    }

    return {
        split: { searchLines: alignedSearch, replaceLines: alignedReplace },
        interleaved,
        maxChars: computeMaxChars(alignedSearch, alignedReplace, interleaved)
    };
}

export function parseNdiff(diffStr = '') {
    const lines = (diffStr || '').replace(/\r\n/g, '\n').split('\n');
    const searchLines = [];
    const replaceLines = [];
    const interleaved = [];

    let oldLine = 1;
    let newLine = 1;
    let idx = 0;

    while (idx < lines.length) {
        const raw = lines[idx];
        if (raw.startsWith('? ')) {
            idx++;
            continue;
        }
        if (raw.startsWith('  ')) {
            const text = raw.slice(2);
            searchLines.push({ lineNumber: oldLine, text, type: 'context', isDummy: false });
            replaceLines.push({ lineNumber: newLine, text, type: 'context', isDummy: false });
            interleaved.push({ oldLineNumber: oldLine, newLineNumber: newLine, text, type: 'context' });
            oldLine++;
            newLine++;
            idx++;
        } else if (raw.startsWith('- ') || raw.startsWith('+ ')) {
            const dels = [];
            const ins = [];
            while (idx < lines.length && (lines[idx].startsWith('- ') || lines[idx].startsWith('+ ') || lines[idx].startsWith('? '))) {
                const cur = lines[idx];
                if (cur.startsWith('- ')) {
                    dels.push({ lineNumber: oldLine++, text: cur.slice(2) });
                } else if (cur.startsWith('+ ')) {
                    ins.push({ lineNumber: newLine++, text: cur.slice(2) });
                }
                idx++;
            }
            const maxHunk = Math.max(dels.length, ins.length);
            for (let k = 0; k < maxHunk; k++) {
                const hasDel = k < dels.length;
                const hasIns = k < ins.length;
                let oldTokens = null;
                let newTokens = null;

                if (hasDel && hasIns) {
                    const tok = computeIntraLineTokens(dels[k].text, ins[k].text);
                    oldTokens = tok.oldTokens;
                    newTokens = tok.newTokens;
                    dels[k].tokens = oldTokens;
                    ins[k].tokens = newTokens;
                }

                if (hasDel) {
                    searchLines.push({ lineNumber: dels[k].lineNumber, text: dels[k].text, tokens: oldTokens, type: 'removed', isDummy: false });
                } else {
                    searchLines.push({ lineNumber: null, text: '', tokens: null, type: 'dummy', isDummy: true });
                }
                if (hasIns) {
                    replaceLines.push({ lineNumber: ins[k].lineNumber, text: ins[k].text, tokens: newTokens, type: 'added', isDummy: false });
                } else {
                    replaceLines.push({ lineNumber: null, text: '', tokens: null, type: 'dummy', isDummy: true });
                }
            }
            for (const d of dels) {
                interleaved.push({ oldLineNumber: d.lineNumber, newLineNumber: null, text: d.text, tokens: d.tokens || null, type: 'removed' });
            }
            for (const a of ins) {
                interleaved.push({ oldLineNumber: null, newLineNumber: a.lineNumber, text: a.text, tokens: a.tokens || null, type: 'added' });
            }
        } else {
            const text = raw;
            searchLines.push({ lineNumber: oldLine, text, type: 'context', isDummy: false });
            replaceLines.push({ lineNumber: newLine, text, type: 'context', isDummy: false });
            interleaved.push({ oldLineNumber: oldLine, newLineNumber: newLine, text, type: 'context' });
            oldLine++;
            newLine++;
            idx++;
        }
    }

    return {
        split: { searchLines, replaceLines },
        interleaved,
        maxChars: computeMaxChars(searchLines, replaceLines, interleaved)
    };
}

export function parseUnifiedDiff(diffStr = '') {
    const clean = (diffStr || '').replace(/\r\n/g, '\n');
    const lines = clean.split('\n');

    // Auto-detect Python difflib.ndiff format if no unified headers exist
    const hasUnifiedHeaders = lines.some(l => l.startsWith('@@') || l.startsWith('---') || l.startsWith('+++'));
    const hasNdiffPrefixes = lines.some(l => l.startsWith('- ') || l.startsWith('+ ') || l.startsWith('? '));
    if (!hasUnifiedHeaders && hasNdiffPrefixes) {
        return parseNdiff(clean);
    }

    const searchLines = [];
    const replaceLines = [];
    const interleaved = [];

    let oldLine = 1;
    let newLine = 1;
    let i = 0;

    while (i < lines.length) {
        const rawLine = lines[i];
        if (rawLine.startsWith('---') || rawLine.startsWith('+++')) {
            i++;
            continue;
        }

        if (rawLine.startsWith('@@')) {
            const match = rawLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
            if (match) {
                oldLine = parseInt(match[1], 10);
                newLine = parseInt(match[2], 10);
            }
            i++;
            continue;
        }

        const marker = rawLine.charAt(0);
        if (marker === '-' || marker === '+') {
            const dels = [];
            const ins = [];
            while (i < lines.length) {
                const cur = lines[i];
                if (cur.startsWith('---') || cur.startsWith('+++') || cur.startsWith('@@')) break;
                const m = cur.charAt(0);
                if (m === '-') {
                    dels.push({ lineNumber: oldLine++, text: cur.slice(1) });
                    i++;
                } else if (m === '+') {
                    ins.push({ lineNumber: newLine++, text: cur.slice(1) });
                    i++;
                } else {
                    break;
                }
            }
            const maxHunk = Math.max(dels.length, ins.length);
            for (let k = 0; k < maxHunk; k++) {
                const hasDel = k < dels.length;
                const hasIns = k < ins.length;
                let oldTokens = null;
                let newTokens = null;

                if (hasDel && hasIns) {
                    const tok = computeIntraLineTokens(dels[k].text, ins[k].text);
                    oldTokens = tok.oldTokens;
                    newTokens = tok.newTokens;
                    dels[k].tokens = oldTokens;
                    ins[k].tokens = newTokens;
                }

                if (hasDel) {
                    searchLines.push({ lineNumber: dels[k].lineNumber, text: dels[k].text, tokens: oldTokens, type: 'removed', isDummy: false });
                } else {
                    searchLines.push({ lineNumber: null, text: '', tokens: null, type: 'dummy', isDummy: true });
                }
                if (hasIns) {
                    replaceLines.push({ lineNumber: ins[k].lineNumber, text: ins[k].text, tokens: newTokens, type: 'added', isDummy: false });
                } else {
                    replaceLines.push({ lineNumber: null, text: '', tokens: null, type: 'dummy', isDummy: true });
                }
            }
            for (const d of dels) {
                interleaved.push({ oldLineNumber: d.lineNumber, newLineNumber: null, text: d.text, tokens: d.tokens || null, type: 'removed' });
            }
            for (const a of ins) {
                interleaved.push({ oldLineNumber: null, newLineNumber: a.lineNumber, text: a.text, tokens: a.tokens || null, type: 'added' });
            }
        } else {
            const text = marker === ' ' ? rawLine.slice(1) : rawLine;
            searchLines.push({ lineNumber: oldLine, text, type: 'context', isDummy: false });
            replaceLines.push({ lineNumber: newLine, text, type: 'context', isDummy: false });
            interleaved.push({ oldLineNumber: oldLine, newLineNumber: newLine, text, type: 'context' });
            oldLine++;
            newLine++;
            i++;
        }
    }

    return {
        split: { searchLines, replaceLines },
        interleaved,
        maxChars: computeMaxChars(searchLines, replaceLines, interleaved)
    };
}

export function parseDiffPayload({ diffText = '', searchStr = '', replaceStr = '' } = {}) {
    if (diffText && diffText.trim()) {
        return parseUnifiedDiff(diffText);
    }
    return parseRawHunks(searchStr, replaceStr);
}