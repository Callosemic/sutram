import { fuzzyFilterObjects, buildFileTree } from '../utils.js';

self.addEventListener('message', (e) => {
    const { type, requestId, items, query } = e.data;
    
    if (type === 'FUZZY_SEARCH') {
        const getSearchString = (item) => typeof item === 'string' ? item : (item.label || String(item));
        const results = fuzzyFilterObjects(items, query, getSearchString);
        self.postMessage({ requestId, results });
    } else if (type === 'BUILD_TREE') {
        const tree = buildFileTree(items);
        self.postMessage({ requestId, tree });
    }
});