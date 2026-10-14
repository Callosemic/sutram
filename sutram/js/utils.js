// sutram/js/utils.js
// Pure mathematical and string manipulation algorithms

export function cleanCodeArtifacts(text) {
    if (!text || typeof text !== 'string') return '';
    let result = text;
    result = result.replace(/\{\{\s*(.)\s*\*\s*(\d+)\s*\}\}/g, (_, char, count) => char.repeat(parseInt(count, 10)));
    result = result.replace(/\{\{\s*triple(.)\s*\}\}/g, (_, char) => char.repeat(3));
    result = result.replace(/_(?:[^_\n]_){3,}/g, (match) => match.replace(/_/g, ''));
    result = result.replace(/\x5b\x73\x6f\x75\x72\x63\x65:\s*\d+\x5d/gi, '');
    result = result.replace(/\x5b\x63\x69\x74\x65:\s*[\d\s,]+\x5d/gi, '');
    result = result.replace(/\x5b\x63\x69\x74\x65_start\x5d/gi, '');
    result = result.replace(/\x5b\x63\x69\x74\x65_end\x5d/gi, '');
    result = result.replace(/\x5b\x63\x69\x74\x65\x5d/gi, '');
    result = result.replace(/<\/?(?:span|cite)[^>]*>/gi, '');
    return result;
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
    let timer;
    return function(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => callback.apply(this, args), delay);
    };
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
export function slugify(str) {
    if (!str) return '';
    return normalizeAccentText(str).replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        throw new Error("Clipboard access denied");
    }
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

export function buildFileTree(files) {
    const tree = {};
    files.forEach(filepath => {
        const parts = filepath.split('/');
        let current = tree;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                current[part] = {
                    _isFile: true,
                    fullPath: filepath
                };
            } else {
                if (!current[part]) current[part] = {};
                current = current[part];
            }
        }
    });
    return tree;
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