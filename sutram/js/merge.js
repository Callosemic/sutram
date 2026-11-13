// Three-way text merge. This algorithm exists twice and must stay identical, statement for statement:
//   Python      akasa/merge.py          three_way_merge_text   (the server merges on save)
//   JavaScript  sutram/js/merge.js      threeWayMergeText      (the browser merges offline)
// A parity test in the host application runs both on the same inputs. Change one side only with the other.
//
// How it works: each side is diffed against the base into hunks [baseStart, baseEnd, replacement lines], and the
// two hunk lists are replayed over the base in order. Hunks that overlap are a conflict. Hunks that only touch are
// merged when their order is unambiguous: two edits of neighbouring lines, or an insertion next to an edit; two
// different insertions at the same point are a conflict.
//
// The diff: trim the common prefix and suffix, anchor on lines that occur exactly once on both sides (kept in an
// increasing run), and diff the gaps between anchors the same way. A gap with no such line is solved exactly
// with a longest-common-subsequence table when it is small, and treated as one replaced block when it is not.
const _MERGE_LCS_CELL_LIMIT = 250000;

// Exact diff of baseLines[bLo:bHi] against targetLines[tLo:tHi] by a longest-common-subsequence table.
function _mergeLcsHunks(baseLines, bLo, bHi, targetLines, tLo, tHi, hunks) {
    const bLen = bHi - bLo;
    const tLen = tHi - tLo;
    if (bLen * tLen > _MERGE_LCS_CELL_LIMIT) {
        hunks.push([bLo, bHi, targetLines.slice(tLo, tHi)]);
        return;
    }
    const table = Array.from({ length: bLen + 1 }, () => new Int32Array(tLen + 1));
    for (let i = bLen - 1; i >= 0; i--) {
        const row = table[i];
        const below = table[i + 1];
        const baseLine = baseLines[bLo + i];
        for (let j = tLen - 1; j >= 0; j--) {
            if (baseLine === targetLines[tLo + j]) {
                row[j] = 1 + below[j + 1];
            } else if (below[j] >= row[j + 1]) {
                row[j] = below[j];
            } else {
                row[j] = row[j + 1];
            }
        }
    }
    let i = 0;
    let j = 0;
    while (i < bLen || j < tLen) {
        if (i < bLen && j < tLen && baseLines[bLo + i] === targetLines[tLo + j]) {
            i += 1;
            j += 1;
            continue;
        }
        const startI = i;
        const startJ = j;
        while (i < bLen || j < tLen) {
            if (i < bLen && j < tLen && baseLines[bLo + i] === targetLines[tLo + j]) {
                break;
            }
            if (j === tLen || (i < bLen && table[i + 1][j] >= table[i][j + 1])) {
                i += 1;
            } else {
                j += 1;
            }
        }
        hunks.push([bLo + startI, bLo + i, targetLines.slice(tLo + startJ, tLo + j)]);
    }
}

// Pairs [base index, target index] of lines that occur exactly once in each range, as the longest run increasing on both sides.
function _mergeUniqueAnchors(baseLines, bLo, bHi, targetLines, tLo, tHi) {
    const baseSeen = new Map();
    for (let i = bLo; i < bHi; i++) {
        const line = baseLines[i];
        baseSeen.set(line, baseSeen.has(line) ? -1 : i);
    }
    const targetSeen = new Map();
    for (let j = tLo; j < tHi; j++) {
        const line = targetLines[j];
        targetSeen.set(line, targetSeen.has(line) ? -1 : j);
    }
    const pairs = [];
    for (let i = bLo; i < bHi; i++) {
        const line = baseLines[i];
        if (baseSeen.get(line) === i) {
            const j = targetSeen.has(line) ? targetSeen.get(line) : -1;
            if (j >= 0) {
                pairs.push([i, j]);
            }
        }
    }
    // Longest increasing run of target indexes (patience sorting); pairs are already in base order.
    const pileTops = [];
    const previous = [];
    for (let index = 0; index < pairs.length; index++) {
        const targetIndex = pairs[index][1];
        let lo = 0;
        let hi = pileTops.length;
        while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (pairs[pileTops[mid]][1] < targetIndex) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        previous.push(lo > 0 ? pileTops[lo - 1] : -1);
        if (lo === pileTops.length) {
            pileTops.push(index);
        } else {
            pileTops[lo] = index;
        }
    }
    const anchors = [];
    let index = pileTops.length > 0 ? pileTops[pileTops.length - 1] : -1;
    while (index >= 0) {
        anchors.push(pairs[index]);
        index = previous[index];
    }
    anchors.reverse();
    return anchors;
}

// Hunks [baseStart, baseEnd, replacementLines], in base order, that turn baseLines into targetLines.
function _mergeDiffHunks(baseLines, targetLines) {
    const hunks = [];
    const pending = [[0, baseLines.length, 0, targetLines.length]];
    while (pending.length > 0) {
        let [bLo, bHi, tLo, tHi] = pending.pop();
        while (bLo < bHi && tLo < tHi && baseLines[bLo] === targetLines[tLo]) {
            bLo += 1;
            tLo += 1;
        }
        while (bHi > bLo && tHi > tLo && baseLines[bHi - 1] === targetLines[tHi - 1]) {
            bHi -= 1;
            tHi -= 1;
        }
        if (bLo === bHi && tLo === tHi) {
            continue;
        }
        if (bLo === bHi || tLo === tHi) {
            hunks.push([bLo, bHi, targetLines.slice(tLo, tHi)]);
            continue;
        }
        const anchors = _mergeUniqueAnchors(baseLines, bLo, bHi, targetLines, tLo, tHi);
        if (anchors.length === 0) {
            _mergeLcsHunks(baseLines, bLo, bHi, targetLines, tLo, tHi, hunks);
            continue;
        }
        // Gaps are pushed last to first, so they are popped, and their hunks appended, in base order.
        const gaps = [];
        let gapB = bLo;
        let gapT = tLo;
        for (const [anchorB, anchorT] of anchors) {
            gaps.push([gapB, anchorB, gapT, anchorT]);
            gapB = anchorB + 1;
            gapT = anchorT + 1;
        }
        gaps.push([gapB, bHi, gapT, tHi]);
        for (let index = gaps.length - 1; index >= 0; index--) {
            pending.push(gaps[index]);
        }
    }
    return hunks;
}

function _mergeSameLines(a, b) {
    if (a.length !== b.length) return false;
    for (let k = 0; k < a.length; k++) {
        if (a[k] !== b[k]) return false;
    }
    return true;
}

// True when the lines of needle appear in haystack as one unbroken run.
function _mergeContainsRun(needle, haystack) {
    if (needle.length === 0 || needle.length > haystack.length) {
        return false;
    }
    for (let start = 0; start <= haystack.length - needle.length; start++) {
        if (_mergeSameLines(haystack.slice(start, start + needle.length), needle)) {
            return true;
        }
    }
    return false;
}

// True when hunk `first` lies wholly before hunk `second`: a gap between them, or touching with an unambiguous order.
function _mergeGoesFirst(first, second) {
    if (first[1] < second[0]) {
        return true;
    }
    return first[1] === second[0] && (first[0] < first[1] || second[0] < second[1]);
}

/**
 * Deterministic three-way text merge of two edits of baseText: the local one and the remote one.
 * Returns { merged, clean }; on a conflict, { merged: localText, clean: false }.
 * In the Python twin, local is "incoming" and remote is "disk".
 */
export function threeWayMergeText(baseText, localText, remoteText) {
    if (remoteText === localText) return { merged: localText, clean: true };
    if (remoteText === baseText) return { merged: localText, clean: true };
    if (localText === baseText) return { merged: remoteText, clean: true };

    const baseNorm = String(baseText ?? '').replace(/\r\n/g, '\n');
    const remoteNorm = String(remoteText ?? '').replace(/\r\n/g, '\n');
    const localNorm = String(localText ?? '').replace(/\r\n/g, '\n');

    if (remoteNorm === localNorm) return { merged: localText, clean: true };
    if (remoteNorm === baseNorm) return { merged: localText, clean: true };
    if (localNorm === baseNorm) return { merged: remoteText, clean: true };

    const baseLines = baseNorm.split('\n');
    const remoteHunks = _mergeDiffHunks(baseLines, remoteNorm.split('\n'));
    const localHunks = _mergeDiffHunks(baseLines, localNorm.split('\n'));

    // 1. Late acknowledgement: remote holds an earlier save of the same edits (each of its hunks is, on the same base
    //    lines, equal to or an unbroken run inside a local hunk), so local already contains it.
    let remoteInsideLocal = true;
    for (const rHunk of remoteHunks) {
        let found = false;
        for (const lHunk of localHunks) {
            if (lHunk[0] === rHunk[0] && lHunk[1] === rHunk[1] && (_mergeSameLines(rHunk[2], lHunk[2]) || _mergeContainsRun(rHunk[2], lHunk[2]))) {
                found = true;
                break;
            }
        }
        if (!found) {
            remoteInsideLocal = false;
            break;
        }
    }
    if (remoteInsideLocal) {
        return { merged: localText, clean: true };
    }

    // 2. Replay both hunk lists over the base in order.
    const outLines = [];
    let baseCursor = 0;
    let idxR = 0;
    let idxL = 0;
    while (idxR < remoteHunks.length || idxL < localHunks.length) {
        const rHunk = idxR < remoteHunks.length ? remoteHunks[idxR] : null;
        const lHunk = idxL < localHunks.length ? localHunks[idxL] : null;
        let chosen;
        if (rHunk !== null && lHunk !== null && rHunk[0] === lHunk[0] && rHunk[1] === lHunk[1] && _mergeSameLines(rHunk[2], lHunk[2])) {
            chosen = rHunk;
            idxR += 1;
            idxL += 1;
        } else if (lHunk === null || (rHunk !== null && _mergeGoesFirst(rHunk, lHunk))) {
            chosen = rHunk;
            idxR += 1;
        } else if (rHunk === null || _mergeGoesFirst(lHunk, rHunk)) {
            chosen = lHunk;
            idxL += 1;
        } else {
            return { merged: localText, clean: false };
        }
        for (let k = baseCursor; k < chosen[0]; k++) outLines.push(baseLines[k]);
        for (let k = 0; k < chosen[2].length; k++) outLines.push(chosen[2][k]);
        baseCursor = chosen[1];
    }
    for (let k = baseCursor; k < baseLines.length; k++) outLines.push(baseLines[k]);
    let mergedText = outLines.join('\n');
    if (String(remoteText ?? '').includes('\r\n') && !mergedText.includes('\r\n')) {
        mergedText = mergedText.replace(/\n/g, '\r\n');
    }
    return { merged: mergedText, clean: true };
}
