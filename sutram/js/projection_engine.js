// sutram/sutram/js/projection_engine.js
import { ExtensionRegistry } from './sdk.js';

export class SutramDOMPool {
    constructor() {
        this._cache = new Map();
        
        // Passive Reactivity: Listen for global eviction and purge nodes. 
        // The AppShell is responsible for calling requestUpdate() after this event.
        window.addEventListener('sutram-evict-projection', (e) => {
            const id = e.detail?.id;
            if (!id) return;
            for (const [cacheKey, node] of this._cache.entries()) {
                if (cacheKey.endsWith(`-${id}`) || cacheKey === id) {
                    if (node.parentNode) node.parentNode.removeChild(node);
                    this._cache.delete(cacheKey);
                }
            }
        });
    }

    get(componentTag, subId = null) {
        if (!componentTag) return '';
        const cacheKey = componentTag + (subId ? '-' + subId : '');
        if (!this._cache.has(cacheKey)) {
            try {
                const el = document.createElement(componentTag);
                if (subId) el.dataset.subId = subId;
                this._cache.set(cacheKey, el);
            } catch (e) {
                console.error(`[SutramDOMPool] Failed to create component <${componentTag}>:`, e);
                const fallback = document.createElement('div');
                fallback.style.cssText = "padding: 15px; color: var(--intent-danger); font-family: monospace;";
                fallback.innerText = `⚠️ Failed to initialize <${componentTag}>`;
                return fallback;
            }
        }
        return this._cache.get(cacheKey);
    }
}

export class SutramProjectionCompiler {
    static getCompiledLayout() {
        const registry = window.ExtensionRegistry || ExtensionRegistry;
        const slots = typeof registry.getLayoutSlots === 'function' ? registry.getLayoutSlots() : [];

        const primarySlotsMap = new Map();
        const finalSlots = [];

        slots.forEach(s => {
            if (s.slot === 'slots:primary-navigation') {
                const normId = (s.id || '').toLowerCase();
                if (!normId) return;
                
                if (!primarySlotsMap.has(normId)) {
                    primarySlotsMap.set(normId, s);
                } else {
                    const existing = primarySlotsMap.get(normId);
                    if ((s.order || 99) < (existing.order || 99)) {
                        existing.order = s.order;
                        existing.label = s.label; 
                    }
                }
            } else {
                finalSlots.push(s);
            }
        });

        // Auto-infer missing primary tabs
        finalSlots.filter(s => s.slot === 'slots:sub-navigation').forEach(s => {
            if (s.targetParent) {
                const normId = s.targetParent.toLowerCase();
                if (!primarySlotsMap.has(normId)) {
                    primarySlotsMap.set(normId, {
                        slot: 'slots:primary-navigation',
                        id: normId,
                        label: s.targetParent.charAt(0).toUpperCase() + s.targetParent.slice(1),
                        order: 50
                    });
                }
            }
        });

        const combinedSlots = finalSlots.filter(s => s.slot !== 'slots:primary-navigation');
        combinedSlots.push(...primarySlotsMap.values());

        const tabOrder = registry.tabOrder || [];
        return combinedSlots.sort((a, b) => {
            if (a.slot === 'slots:primary-navigation' && b.slot === 'slots:primary-navigation') {
                let idxA = tabOrder.findIndex(t => t.toLowerCase() === (a.id || '').toLowerCase());
                let idxB = tabOrder.findIndex(t => t.toLowerCase() === (b.id || '').toLowerCase());
                if (idxA === -1) idxA = 999;
                if (idxB === -1) idxB = 999;
                if (idxA !== idxB) return idxA - idxB;
                return (a.order || 99) - (b.order || 99);
            }
            if (a.slot === 'slots:primary-navigation') return -1;
            if (b.slot === 'slots:primary-navigation') return 1;
            return (a.order || 99) - (b.order || 99);
        });
    }
}