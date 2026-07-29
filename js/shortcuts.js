// sutram/js/shortcuts.js
// Centralized hierarchical shortcut router

export function initShortcutRouter(registry, getActiveContexts) {
    window.addEventListener('keydown', (e) => {
        let keyStr = e.key.toLowerCase();
        
        // Ignore lone modifier presses
        if (['control', 'meta', 'shift', 'alt'].includes(keyStr)) return;

        let prefix = '';
        if (e.ctrlKey || e.metaKey) prefix += 'ctrl+';
        if (e.shiftKey) prefix += 'shift+';
        if (e.altKey) prefix += 'alt+';

        const combo = prefix + (keyStr === ' ' ? 'space' : keyStr);
        
        // Retrieve dynamic contexts (e.g., active tabs, modals, elements) from the consumer application
        const contexts = getActiveContexts ? getActiveContexts() : ['global'];

        if (!registry || !registry.shortcuts) return;

        for (let ctx of contexts) {
            if (registry.shortcuts[ctx] && registry.shortcuts[ctx][combo]) {
                e.preventDefault();
                registry.shortcuts[ctx][combo](e);
                return;
            }
        }
    });
}