// sutram/sutram/js/projection_engine.js
import { ExtensionRegistry } from './sutram_sdk.js';

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

export class SutramProjectionPool {
    constructor() {
        this._activeNodes = new Map();
        this._nextNodes = null;
    }

    beginPass() {
        this._nextNodes = new Map();
    }

    resolve(componentTag, subId = null, props = null) {
        if (!componentTag) return '';
        const cacheKey = subId ? `${componentTag}:${subId}` : componentTag;
        let node = this._activeNodes.get(cacheKey) || (this._nextNodes && this._nextNodes.get(cacheKey));
        if (!node) {
            try {
                node = document.createElement(componentTag);
            } catch (e) {
                node = document.createElement('div');
                node.style.cssText = "padding: 15px; color: var(--intent-danger); font-family: monospace; display: flex; align-items: center; gap: 6px;";
                const iconEl = document.createElement('yv-icon');
                iconEl.setAttribute('name', 'alert-triangle');
                iconEl.style.width = '14px';
                iconEl.style.height = '14px';
                const textEl = document.createElement('span');
                textEl.textContent = `Failed to initialize <${componentTag}>`;
                node.replaceChildren(iconEl, textEl);
            }
        }
        if (subId && node.dataset) {
            node.dataset.subId = subId;
        }
        if (props && typeof props === 'object') {
            Object.assign(node, props);
        }
        if (this._nextNodes) {
            this._nextNodes.set(cacheKey, node);
        } else {
            this._activeNodes.set(cacheKey, node);
        }
        return node;
    }

    commitPass() {
        if (this._nextNodes) {
            this._activeNodes = this._nextNodes;
            this._nextNodes = null;
        }
    }

    rekey(oldId, newId) {
        if (!oldId || !newId || oldId === newId) return false;
        let mutated = false;
        const suffix = `:${oldId}`;
        for (const [cacheKey, node] of Array.from(this._activeNodes.entries())) {
            if (cacheKey.endsWith(suffix)) {
                const tagPrefix = cacheKey.slice(0, cacheKey.length - suffix.length);
                this._activeNodes.delete(cacheKey);
                if (node && node.dataset) {
                    node.dataset.subId = newId;
                }
                this._activeNodes.set(`${tagPrefix}:${newId}`, node);
                mutated = true;
            }
        }
        return mutated;
    }

    evictExtension(unloadedExt) {
        if (!unloadedExt) return false;
        let mutated = false;
        for (const [key, node] of Array.from(this._activeNodes.entries())) {
            const nodeExt = node?.extName || node?.dataset?.ext || (node?.tagName ? node.tagName.toLowerCase().replace(/^[a-z0-9_-]+-ext-/, '') : '');
            if (nodeExt === unloadedExt || key.includes(`:${unloadedExt}:`)) {
                try { node.remove(); } catch (_) {}
                this._activeNodes.delete(key);
                mutated = true;
            }
        }
        return mutated;
    }

    clear() {
        this._activeNodes.clear();
        this._nextNodes = null;
    }
}