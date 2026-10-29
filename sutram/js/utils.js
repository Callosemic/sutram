// sutram/js/utils.js
// Pure mathematical and string manipulation algorithms
function _computeLcsDiffHunks(baseLines, targetLines) {
    const n = baseLines.length;
    const m = targetLines.length;
    let prefix = 0;
    while (prefix < n && prefix < m && baseLines[prefix] === targetLines[prefix]) {
        prefix++;
    }
    let bEnd = n;
    let tEnd = m;
    while (bEnd > prefix && tEnd > prefix && baseLines[bEnd - 1] === targetLines[tEnd - 1]) {
        bEnd--;
        tEnd--;
    }
    if (prefix === bEnd && prefix === tEnd) return [];

    const bMid = baseLines.slice(prefix, bEnd);
    const tMid = targetLines.slice(prefix, tEnd);
    const bLen = bMid.length;
    const tLen = tMid.length;

    // Fallback to single middle hunk if matrix exceeds interactive memory bounds
    if (bLen * tLen > 250000) {
        return [{ baseStart: prefix, baseEnd: bEnd, rep: tMid }];
    }

    const dp = Array.from({ length: bLen + 1 }, () => new Int32Array(tLen + 1));
    for (let i = bLen - 1; i >= 0; i--) {
        for (let j = tLen - 1; j >= 0; j--) {
            if (bMid[i] === tMid[j]) {
                dp[i][j] = 1 + dp[i + 1][j + 1];
            } else {
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    const hunks = [];
    let i = 0;
    let j = 0;
    while (i < bLen || j < tLen) {
        if (i < bLen && j < tLen && bMid[i] === tMid[j]) {
            i++;
            j++;
        } else {
            const hBaseStart = i;
            const hTargetStart = j;
            while (i < bLen || j < tLen) {
                if (i < bLen && j < tLen && bMid[i] === tMid[j]) break;
                if (j === tLen || (i < bLen && dp[i + 1][j] >= dp[i][j + 1])) {
                    i++;
                } else {
                    j++;
                }
            }
            hunks.push({
                baseStart: prefix + hBaseStart,
                baseEnd: prefix + i,
                rep: tMid.slice(hTargetStart, j)
            });
        }
    }
    return hunks;
}

function _isContiguousLineSubslice(needle, haystack) {
    if (!needle || needle.length === 0 || needle.length > haystack.length) return false;
    for (let idx = 0; idx <= haystack.length - needle.length; idx++) {
        let match = true;
        for (let k = 0; k < needle.length; k++) {
            if (haystack[idx + k] !== needle[k]) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }
    return false;
}
export function threeWayMergeText(baseText, localText, remoteText) {
    if (localText === remoteText) return { merged: localText, clean: true };
    if (localText === baseText) return { merged: remoteText, clean: true };
    if (remoteText === baseText) return { merged: localText, clean: true };

    const baseNorm = String(baseText ?? '').replace(/\r\n/g, '\n');
    const localNorm = String(localText ?? '').replace(/\r\n/g, '\n');
    const remoteNorm = String(remoteText ?? '').replace(/\r\n/g, '\n');

    if (localNorm === remoteNorm) return { merged: localText, clean: true };
    if (localNorm === baseNorm) return { merged: remoteText, clean: true };
    if (remoteNorm === baseNorm) return { merged: localText, clean: true };

    const baseLines = baseNorm.split('\n');
    const localLines = localNorm.split('\n');
    const remoteLines = remoteNorm.split('\n');

    const localHunks = _computeLcsDiffHunks(baseLines, localLines);
    const remoteHunks = _computeLcsDiffHunks(baseLines, remoteLines);

    // 1. Zombie-ACK Fast Path: Remote is an earlier snapshot of the same contiguous line stream in Local
    const remoteSubsumedByLocal = remoteHunks.length > 0 && remoteHunks.every(rH =>
        localHunks.some(lH =>
            lH.baseStart === rH.baseStart &&
            lH.baseEnd === rH.baseEnd &&
            ((rH.rep.length === lH.rep.length && rH.rep.every((v, idx) => v === lH.rep[idx])) ||
            _isContiguousLineSubslice(rH.rep, lH.rep))
        )
    );
    if (remoteSubsumedByLocal) {
        return { merged: localText, clean: true };
    }

    // 2. Multi-Hunk 3-Way Merger
    const outLines = [];
    let baseCursor = 0;
    let idxL = 0;
    let idxR = 0;

    while (idxL < localHunks.length || idxR < remoteHunks.length) {
        const lH = idxL < localHunks.length ? localHunks[idxL] : null;
        const rH = idxR < remoteHunks.length ? remoteHunks[idxR] : null;

        if (lH && !rH) {
            outLines.push(...baseLines.slice(baseCursor, lH.baseStart), ...lH.rep);
            baseCursor = lH.baseEnd;
            idxL++;
        } else if (rH && !lH) {
            outLines.push(...baseLines.slice(baseCursor, rH.baseStart), ...rH.rep);
            baseCursor = rH.baseEnd;
            idxR++;
        } else {
            const sameSpan = lH.baseStart === rH.baseStart && lH.baseEnd === rH.baseEnd;
            const sameRep = lH.rep.length === rH.rep.length && lH.rep.every((v, idx) => v === rH.rep[idx]);
            if (sameSpan && sameRep) {
                outLines.push(...baseLines.slice(baseCursor, lH.baseStart), ...lH.rep);
                baseCursor = lH.baseEnd;
                idxL++;
                idxR++;
            } else if (lH.baseEnd < rH.baseStart || (lH.baseEnd === rH.baseStart && lH.baseStart < lH.baseEnd && rH.baseStart < rH.baseEnd)) {
                outLines.push(...baseLines.slice(baseCursor, lH.baseStart), ...lH.rep);
                baseCursor = lH.baseEnd;
                idxL++;
            } else if (rH.baseEnd < lH.baseStart || (rH.baseEnd === lH.baseStart && rH.baseStart < rH.baseEnd && lH.baseStart < lH.baseEnd)) {
                outLines.push(...baseLines.slice(baseCursor, rH.baseStart), ...rH.rep);
                baseCursor = rH.baseEnd;
                idxR++;
            } else {
                return { merged: localText, clean: false };
            }
        }
    }

    outLines.push(...baseLines.slice(baseCursor));
    let mergedStr = outLines.join('\n');
    if (String(remoteText ?? '').includes('\r\n') && !mergedStr.includes('\r\n')) {
        mergedStr = mergedStr.replace(/\n/g, '\r\n');
    }
    return { merged: mergedStr, clean: true };
}

export function shallowEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
        return false;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!Object.is(a[i], b[i])) return false;
        }
        return true;
    }
    if (a instanceof Set && b instanceof Set) {
        if (a.size !== b.size) return false;
        for (const val of a) {
            if (!b.has(val)) return false;
        }
        return true;
    }
    if (a instanceof Map && b instanceof Map) {
        if (a.size !== b.size) return false;
        for (const [k, v] of a) {
            if (!b.has(k) || !Object.is(v, b.get(k))) return false;
        }
        return true;
    }
    if (a.constructor !== Object || b.constructor !== Object) {
        return false;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
        const key = keysA[i];
        if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
            return false;
        }
    }
    return true;
}

export function normalizeAccentText(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function fuzzyFilterObjects(items, query, getSearchString = (item) => String(item)) {
    if (!query.trim()) return items;

    const norm = normalizeAccentText;
    const queryWords = norm(query).trim().split(/\s+/).filter(t => t);

    const scoredItems = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const targetStr = norm(getSearchString(item));
        let totalScore = 0;
        let isMatch = true;

        for (let w = 0; w < queryWords.length; w++) {
            const qWord = queryWords[w];
            let wordScore = 0;

            if (targetStr.includes(qWord)) {
                wordScore = qWord.length * 50;
                if (targetStr.startsWith(qWord) || new RegExp(`[\\/\\s\\-_]${qWord}`).test(targetStr)) {
                    wordScore += 50;
                }
            } else {
                let qIdx = 0;
                let tIdx = 0;
                let prevTIdx = -1;

                while (qIdx < qWord.length && tIdx < targetStr.length) {
                    if (qWord[qIdx] === targetStr[tIdx]) {
                        if (tIdx === 0 || /[\\/\\s\\-_]/.test(targetStr[tIdx - 1])) {
                            wordScore += 10;
                        } else {
                            wordScore += 1;
                        }
                        if (prevTIdx !== -1) {
                            const gap = tIdx - prevTIdx - 1;
                            wordScore -= (gap * 1.5); 
                        }
                        prevTIdx = tIdx;
                        qIdx++;
                    }
                    tIdx++;
                }
                if (qIdx !== qWord.length || wordScore <= 0) {
                    isMatch = false; 
                    break;
                }
            }
            totalScore += wordScore;
        }
        if (isMatch) scoredItems.push({ item, score: totalScore });
    }
    return scoredItems.sort((a, b) => b.score - a.score).map(res => res.item);
}
export function debounce(callback, delay = 300) {
    let timeoutTimer = null;
    const debounced = function(...args) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        timeoutTimer = setTimeout(() => {
            timeoutTimer = null;
            callback.apply(this, args);
        }, delay);
    };
    debounced.cancel = () => {
        if (timeoutTimer) {
            clearTimeout(timeoutTimer);
            timeoutTimer = null;
        }
    };
    return debounced;
}
export function coalescedAsync(asyncFn) {
    let promise = null;
    let queued = false;
    let latestArgs = null;
    return async function(...args) {
        latestArgs = args;
        if (promise) {
            queued = true;
            return promise;
        }
        promise = (async () => {
            try {
                let result;
                do {
                    queued = false;
                    result = await asyncFn.apply(this, latestArgs);
                } while (queued);
                return result;
            } finally {
                promise = null;
            }
        })();
        return promise;
    };
}
const SLUG_CHARMAP = { 'Đ': 'D', 'đ': 'd', 'Æ': 'AE', 'æ': 'ae', 'Ø': 'O', 'ø': 'o', 'ß': 'ss' };

export function slugify(str) {
    if (!str) return '';
    const mapped = String(str).replace(/[ĐđÆæØøß]/g, ch => SLUG_CHARMAP[ch]);
    return mapped
        .normalize('NFKD')
        .replace(/[^\x00-\x7f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function truncateFilename(filename, maxLen = 24, ellipsis = '…') {
    if (!filename || typeof filename !== 'string') return '';
    const base = filename.replace(/\\/g, '/').split('/').pop() || '';
    if (base.length <= maxLen) return base;

    const lastDot = base.lastIndexOf('.');
    if (lastDot <= 0) {
        const sliceLen = Math.max(1, maxLen - ellipsis.length);
        return base.slice(0, sliceLen) + ellipsis;
    }

    const ext = base.slice(lastDot);
    if (ext.length + ellipsis.length >= maxLen) {
        const sliceLen = Math.max(1, maxLen - ellipsis.length);
        return base.slice(0, sliceLen) + ellipsis;
    }

    const frontLen = maxLen - ext.length - ellipsis.length;
    return `${base.slice(0, frontLen)}${ellipsis}${ext}`;
}
export function clone(obj) {
    if (obj === undefined || obj === null) return obj;
    try {
        return typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
    } catch (e) {
        return JSON.parse(JSON.stringify(obj));
    }
}

export function compileDagWavefronts(nodes, options = {}) {
    const { idKey = 'id', parentsKey = 'parents' } = options;
    const valid = (nodes || []).filter(n => n && n[idKey]);
    if (valid.length === 0) return [];
    const remaining = new Map(
        valid.map(n => [
            n[idKey],
            new Set((Array.isArray(n[parentsKey]) ? n[parentsKey] : []).filter(p => p && p !== n[idKey]))
        ])
    );
    const nodeById = new Map(valid.map(n => [n[idKey], n]));
    const waves = [];
    while (remaining.size > 0) {
        const readyIds = [];
        for (const [nid, deps] of remaining.entries()) {
            const unsatisfied = Array.from(deps).filter(d => remaining.has(d));
            if (unsatisfied.length === 0) readyIds.push(nid);
        }
        if (readyIds.length === 0) {
            waves.push(Array.from(remaining.keys()).map(id => nodeById.get(id)));
            break;
        }
        waves.push(readyIds.map(id => nodeById.get(id)));
        readyIds.forEach(id => remaining.delete(id));
    }
    return waves;
}
const _TEMPLATE_VAR_RE = /\{\{\s*(?:macro_)?([a-zA-Z0-9_.\[\]-]+)(?:\s*\|\s*([^{}]*?))?\s*\}\}/g;
const _INNERMOST_MUSTACHE_RE = /\{\{\s*([^{}|]+?)(?:\s*\|\s*([^{}]*?))?\s*\}\}/g;
const _DEFAULT_RESERVED_MACROS = new Set(['inputs', 'nodes', 'item', 'loop', 'global']);
const _DEFAULT_RESERVED_PREFIXES = ['wordcount_', 'nodes.', 'inputs.', 'global.', 'item.', 'loop.'];

export function extractTemplateVariables(text, options = {}) {
    if (!text || typeof text !== 'string' || !text.includes('{{')) return [];
    const reservedMacros = options.reservedMacros instanceof Set
        ? options.reservedMacros
        : (Array.isArray(options.reservedMacros) ? new Set(options.reservedMacros) : _DEFAULT_RESERVED_MACROS);
    const reservedPrefixes = Array.isArray(options.reservedPrefixes)
        ? options.reservedPrefixes
        : _DEFAULT_RESERVED_PREFIXES;
    const varsMap = new Map();
    for (const match of text.matchAll(_TEMPLATE_VAR_RE)) {
        const name = (match[1] || '').trim();
        if (
            !name ||
            name.includes('.') ||
            name.includes('[') ||
            reservedPrefixes.some(p => name.startsWith(p)) ||
            reservedMacros.has(name)
        ) {
            continue;
        }
        let defaultVal = match[2] !== undefined ? match[2].trim() : null;
        if (defaultVal && reservedPrefixes.some(p => defaultVal.startsWith(p))) {
            defaultVal = null;
        }
        if (!varsMap.has(name)) {
            varsMap.set(name, {
                name,
                default: defaultVal,
                required: defaultVal === null,
                description: `Template parameter '${name}'` + (defaultVal ? ` (default: ${defaultVal})` : '')
            });
        } else if (varsMap.get(name).default === null && defaultVal !== null) {
            const entry = varsMap.get(name);
            entry.default = defaultVal;
            entry.required = false;
            entry.description = `Template parameter '${name}' (default: ${defaultVal})`;
        }
    }
    return Array.from(varsMap.values());
}

export function interpolateTemplateVariables(text, values = {}, options = {}) {
    if (!text || typeof text !== 'string' || !text.includes('{{')) return text || '';
    const reservedMacros = options.reservedMacros instanceof Set
        ? options.reservedMacros
        : (Array.isArray(options.reservedMacros) ? new Set(options.reservedMacros) : _DEFAULT_RESERVED_MACROS);
    const reservedPrefixes = Array.isArray(options.reservedPrefixes)
        ? options.reservedPrefixes
        : _DEFAULT_RESERVED_PREFIXES;
    const normVals = {};
    Object.entries(values || {}).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        const cleanK = k.startsWith('macro_') ? k.slice(6) : k;
        normVals[cleanK] = String(v);
    });
    let current = text;
    for (let pass = 0; pass < 4; pass++) {
        if (!current.includes('{{')) break;
        const nextStr = current.replace(_INNERMOST_MUSTACHE_RE, (full, rawName, rawDef) => {
            const name = (rawName || '').trim().replace(/^macro_/, '');
            if (!name || reservedPrefixes.some(p => name.startsWith(p)) || reservedMacros.has(name) || name.includes('*')) {
                return full;
            }
            if (Object.prototype.hasOwnProperty.call(normVals, name) && normVals[name] !== '') {
                return normVals[name];
            }
            if (rawDef !== undefined) {
                const parts = rawDef.split('|').map(s => s.trim()).filter(Boolean);
                for (let i = 0; i < parts.length; i++) {
                    const cand = parts[i].replace(/^macro_/, '');
                    if (Object.prototype.hasOwnProperty.call(normVals, cand) && normVals[cand] !== '') {
                        return normVals[cand];
                    }
                    if (i === parts.length - 1) return parts[i];
                }
            }
            return full;
        });
        if (nextStr === current) break;
        current = nextStr;
    }
    return current;
}

export const HostPath = {
    split(rawPath) {
        const norm = String(rawPath || '').replace(/\\/g, '/').trim();
        const driveMatch = norm.match(/^([a-zA-Z]:)\/(.*)$/);
        if (driveMatch) {
            return { root: `${driveMatch[1]}/`, segments: driveMatch[2].split('/').filter(Boolean) };
        }
        return {
            root: norm.startsWith('/') ? '/' : '',
            segments: norm.split('/').filter(Boolean)
        };
    },
    basename(rawPath) {
        const { segments } = this.split(rawPath);
        return segments.length > 0 ? segments[segments.length - 1] : '';
    },
    join(rawPath, ...extraSegments) {
        const { root, segments } = this.split(rawPath);
        const cleanExtra = extraSegments
            .map(s => String(s || '').replace(/\\/g, '/').trim().replace(/^\/+|\/+$/g, ''))
            .filter(Boolean);
        const combined = [...segments, ...cleanExtra];
        return combined.length > 0 ? `${root}${combined.join('/')}` : (root || '/');
    },
    parent(rawPath) {
        const { root, segments } = this.split(rawPath);
        if (segments.length > 0) segments.pop();
        return segments.length > 0 ? `${root}${segments.join('/')}` : (root || '/');
    }
};
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        throw new Error("Clipboard access denied");
    }
}
export async function copyRichHtml(htmlStr, plainText = null) {
    if (!htmlStr) return false;
    const fallbackText = plainText !== null ? plainText : htmlStr;
    try {
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
            const htmlBlob = new Blob([htmlStr], { type: 'text/html' });
            const plainBlob = new Blob([fallbackText], { type: 'text/plain' });
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': htmlBlob,
                    'text/plain': plainBlob
                })
            ]);
            return true;
        }
    } catch (_) {}
    return await copyToClipboard(fallbackText);
}
export async function copyRawText(text, successCallback, errorCallback) {
    try {
        await copyToClipboard(text);
        if (successCallback) successCallback();
    } catch (e) {
        if (errorCallback) errorCallback(e);
        throw e;
    }
}
export function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}
export async function nativeShareFiles(fileObjects) {
    if (!navigator.share || !navigator.canShare) {
        throw new Error("File sharing not supported by this browser.");
    }

    const hardenedFiles = [];

    for (const fileObj of fileObjects) {
        const { blob, buffer, content, filename, type } = fileObj;
        let safeMime = type || (blob && blob.type) || 'text/plain';
        if (safeMime.includes('octet-stream') || safeMime.includes('json') || safeMime.includes('javascript') || safeMime.includes('python')) {
            safeMime = 'text/plain';
        }

        let safeName = filename;
        if (safeMime === 'text/plain' && !safeName.toLowerCase().endsWith('.txt') && !safeName.toLowerCase().endsWith('.csv')) {
            safeName += '.txt';
        }

        let fileData;
        if (content !== undefined) {
            fileData = content;
        } else if (buffer) {
            fileData = buffer;
        } else if (blob) {
            fileData = await blob.arrayBuffer();
        }

        const hardenedFile = new File([fileData], safeName, { type: safeMime, lastModified: Date.now() });
        hardenedFiles.push(hardenedFile);
    }
    // GC Protection: Shield the raw File array until the OS Clipboard successfully reads the pointers
    window._lastSharePreserver = hardenedFiles;

    // Failsafe: Some mobile browsers hang the promise if the user backgrounds the app
    const gcFallback = setTimeout(() => { window._lastSharePreserver = null; }, 60000);

    if (navigator.canShare({ files: hardenedFiles })) {
        return navigator.share({ files: hardenedFiles }).finally(() => {
            clearTimeout(gcFallback);
            window._lastSharePreserver = null;
        });
    } else {
        clearTimeout(gcFallback);
        window._lastSharePreserver = null;
        throw new Error("The OS rejected the file payload structure.");
    }
}

export async function downloadFile(fetchUrl, fallbackFilename, fetchOptions = {}) {
    const res = await fetch(fetchUrl, fetchOptions);
    if (!res.ok) throw new Error('Download failed from server.');
    const blob = await res.blob();

    let dlName = fallbackFilename;
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.indexOf('attachment') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) dlName = matches[1].replace(/['"]/g, '');
    }

    downloadBlob(blob, dlName);
}

export function bindGhostDrag(e, label, icon = '📄', payloadData = {}) {
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position: absolute; top: -1000px; left: -1000px; background: var(--pane-bg); color: var(--text); border: 1px solid var(--btn); padding: 8px 12px; border-radius: 4px; font-family: monospace; font-weight: bold; z-index: -1; box-shadow: 0 4px 10px rgba(0,0,0,0.3);';
    ghost.innerText = `${icon} ${label}`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 15, 15);

    setTimeout(() => ghost.remove(), 50);

    for (const [key, value] of Object.entries(payloadData)) {
        e.dataTransfer.setData(key, value);
    }
    e.dataTransfer.effectAllowed = 'copyMove';
}
export function buildFileTree(files, stripPrefix = '', options = {}) {
    const { defaultScheme = 'vfs', sharedScheme = 'ws' } = options;
    const root = {
        id: '',
        name: '',
        type: 'directory',
        fullPath: '',
        parentPath: '',
        children: {}
    };
    const normStrip = stripPrefix ? stripPrefix.replace(/\\/g, '/').replace(/\/+$/, '') + '/' : '';

    (files || []).forEach(rawPath => {
        if (!rawPath || typeof rawPath !== 'string') return;
        const normRaw = rawPath.replace(/\\/g, '/').trim();
        const isExplicitDir = normRaw.endsWith('/');

        let fullUri = normRaw.replace(/\/+$/, '');
        if (!fullUri.includes('://')) {
            fullUri = `${defaultScheme}://${fullUri.replace(/^\/+/, '')}`;
        }

        const isWs = Boolean(sharedScheme && fullUri.startsWith(`${sharedScheme}://`));
        let visualRel = fullUri;
        let baseAccumUri = '';

        if (normStrip && fullUri.startsWith(normStrip)) {
            visualRel = fullUri.slice(normStrip.length);
            baseAccumUri = normStrip.replace(/\/+$/, '');
        } else {
            const schemeMatch = fullUri.match(/^([a-zA-Z0-9_-]+:\/\/)(.*)$/);
            if (schemeMatch) {
                baseAccumUri = schemeMatch[1].replace(/\/+$/, '');
                visualRel = schemeMatch[2].replace(/^\/+/, '');
            }
        }

        if (!visualRel) return;
        const parts = visualRel.split('/').filter(Boolean);
        let cursor = root;
        let accumPath = baseAccumUri;
        const accumSegments = [];

        for (let i = 0; i < parts.length; i++) {
            const part = (isWs && i === 0 && !normStrip) ? `🌐 ${parts[i]}` : parts[i];
            accumSegments.push(part);
            const parentPath = accumPath;
            accumPath = accumPath.endsWith('://') ? `${accumPath}${parts[i]}` : `${accumPath}/${parts[i]}`;
            const isLast = (i === parts.length - 1);

            if (!cursor.children) {
                cursor.children = {};
            }

            if (isLast && !isExplicitDir) {
                if (!cursor.children[part]) {
                    cursor.children[part] = {
                        id: accumPath,
                        name: part,
                        type: 'file',
                        fullPath: accumPath,
                        treePath: [...accumSegments],
                        parentPath
                    };
                }
            } else {
                if (!cursor.children[part] || cursor.children[part].type !== 'directory') {
                    cursor.children[part] = {
                        id: accumPath,
                        name: part,
                        type: 'directory',
                        fullPath: accumPath,
                        treePath: [...accumSegments],
                        parentPath,
                        children: cursor.children[part]?.children || {}
                    };
                }
                cursor = cursor.children[part];
            }
        }
    });

    return root;
}

export function resolveDirectoryState(treeRoot, currentPath = [], options = {}) {
    const { hideFiles = false, ignoreDotKeep = true } = options;
    if (!treeRoot || typeof treeRoot !== 'object') {
        return { validPath: [], entries: [] };
    }

    const rootNode = treeRoot.type === 'directory' && treeRoot.children
        ? treeRoot
        : { id: '', name: '', type: 'directory', fullPath: '', parentPath: '', children: treeRoot.children || {} };

    let cursor = rootNode;
    const validPath = [];

    for (const segment of (currentPath || [])) {
        if (cursor && cursor.type === 'directory' && cursor.children && cursor.children[segment]?.type === 'directory') {
            cursor = cursor.children[segment];
            validPath.push(segment);
        } else {
            break;
        }
    }

    const rawChildren = Object.values(cursor?.children || {});
    const entries = rawChildren
        .filter(node => {
            if (!node || typeof node !== 'object' || !node.name) return false;
            if (node.type === 'file') {
                if (hideFiles) return false;
                if (ignoreDotKeep && (node.name === '.gitkeep' || node.name === '.keep')) return false;
            }
            return true;
        })
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

    return { validPath, entries };
}

export function timeAgo(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Unknown';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff} second${diff !== 1 ? 's' : ''} ago`;
    if (diff < 3600) return `${Math.floor(diff/60)} minute${Math.floor(diff/60) !== 1 ? 's' : ''} ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)} hour${Math.floor(diff/3600) !== 1 ? 's' : ''} ago`;
    return `${Math.floor(diff/86400)} day${Math.floor(diff/86400) !== 1 ? 's' : ''} ago`;
}
export function formatDate(timestamp) {
    if (!timestamp) return 'Unknown Date';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Unknown Date';
    return date.toLocaleString();
}

export function resolveSutramAsset(relativePath, fallbackMetaUrl = import.meta.url) {
    const base = (typeof window !== 'undefined' && window.SUTRAM_PUBLIC_PATH)
        ? new URL(window.SUTRAM_PUBLIC_PATH, window.location.origin).href
        : fallbackMetaUrl;
    return new URL(relativePath, base).href;
}

class SutramWorkerBroker {
    constructor() {
        this._worker = null;
        this._reqId = 0;
        this._pending = new Map();
    }

    _getWorker() {
        if (!this._worker) {
            const workerUrl = resolveSutramAsset('./workers/search-worker.js');
            this._worker = new Worker(workerUrl, { type: 'module' });
            this._worker.onmessage = (e) => {
                const { requestId, ...payload } = e.data || {};
                const resolve = this._pending.get(requestId);
                if (resolve) {
                    this._pending.delete(requestId);
                    resolve(payload);
                }
            };
            this._worker.onerror = (err) => {
                console.warn('[SutramWorker] Background worker error, falling back to main thread:', err);
            };
        }
        return this._worker;
    }
    dispatch(type, payload = {}) {
        return new Promise((resolve) => {
            if (type === 'FUZZY_SEARCH' && Array.isArray(payload.items) && payload.items.length < 500) {
                const getSearchString = (item) => typeof item === 'string' ? item : (item.label || String(item));
                resolve({ results: fuzzyFilterObjects(payload.items, payload.query || '', getSearchString) });
                return;
            }
            try {
                const worker = this._getWorker();
                const requestId = ++this._reqId;
                this._pending.set(requestId, resolve);
                worker.postMessage({ type, requestId, ...payload });
            } catch (err) {
                if (type === 'BUILD_TREE') {
                    resolve({ tree: buildFileTree(payload.items || []) });
                } else if (type === 'FUZZY_SEARCH') {
                    const getSearchString = (item) => typeof item === 'string' ? item : (item.label || String(item));
                    resolve({ results: fuzzyFilterObjects(payload.items || [], payload.query || '', getSearchString) });
                } else {
                    resolve({});
                }
            }
        });
    }
}

export const SutramWorker = new SutramWorkerBroker();