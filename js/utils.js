// sutram/js/utils.js
// Pure mathematical and string manipulation algorithms

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

export function slugify(str) {
    if (!str) return '';
    return normalizeAccentText(str).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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