// sutram-boot.js
// Stage 1 Bootloader: Vendorization & DOM Guardrails

(async function() {
    // =========================================================================
    // 1. DOM Guardrail: Prevent Duplicate Custom Element Collisions
    // =========================================================================
    const originalDefine = customElements.define.bind(customElements);
    customElements.define = function(name, constructor, options) {
        if (customElements.get(name)) {
            console.warn(`[Sutram] Soft-skipping duplicate registration for <${name}>`);
            return;
        }

        if (constructor && constructor.prototype) {
            // Intercept connectedCallback before customElements.define captures the prototype
            if (constructor.prototype.connectedCallback && !constructor.prototype._isSafeConnected) {
                const origConnected = constructor.prototype.connectedCallback;
                constructor.prototype.connectedCallback = function(...args) {
                    try {
                        origConnected.apply(this, args);
                    } catch (e) {
                        console.error(`⚠️ [Isolated Component Error] <${name}> failed in connectedCallback:`, e);
                        const toastStore = window.inSetu?.stores?.Toast;
                        if (toastStore && typeof toastStore.getState === 'function') {
                            toastStore.getState().addToast(
                                `Extension <${name}> error: ${e.message}`,
                                'danger'
                            );
                        }
                    }
                };
                constructor.prototype._isSafeConnected = true;
            }
            // Intercept render before customElements.define captures the prototype
            if (constructor.prototype.render && !constructor.prototype._isSafeRender) {
                const origRender = constructor.prototype.render;
                constructor.prototype.render = function(...args) {
                    try {
                        return origRender.apply(this, args);
                    } catch (e) {
                        console.error(`⚠️ [Isolated Component Error] <${name}> failed in render:`, e);
                        return `⚠️ Element <${name}> render error: ${e.message}`;
                    }
                };
                constructor.prototype._isSafeRender = true;
            }
        }

        return originalDefine(name, constructor, options);
    };

    // =========================================================================
    // 2. Fetch Manifests & Parse SemVer
    // =========================================================================
    // The host HTML (inSetu) passes the discovery URLs via a global array
    const manifestUrls = window.SUTRAM_MANIFEST_URLS || [];
    const packages = {}; // Tracks highest version of each specifier

    // Lightweight SemVer Comparator
    const compareSemVer = (a, b) => {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            if ((pa[i] || 0) > (pb[i] || 0)) return 1;
            if ((pa[i] || 0) < (pb[i] || 0)) return -1;
        }
        return 0;
    };

    for (const url of manifestUrls) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            
            const manifest = await res.json();
            if (!manifest.imports) continue;

            // Extract the base path of the manifest to resolve relative vendor paths
            const basePath = url.substring(0, url.lastIndexOf('/') + 1);

            Object.entries(manifest.imports).forEach(([specifier, meta]) => {
                if (!packages[specifier] || compareSemVer(meta.version, packages[specifier].version) > 0) {
                    packages[specifier] = {
                        version: meta.version,
                        // Resolve the physical absolute/relative path for the browser
                        resolvedPath: basePath + meta.path 
                    };
                }
            });
        } catch (e) {
            console.warn(`[Sutram] Failed to process vendor manifest from ${url}`, e);
        }
    }

    // =========================================================================
    // 3. Synthesize & Inject HTML5 Import Map
    // =========================================================================
    const finalImports = {};
    Object.entries(packages).forEach(([specifier, meta]) => {
        finalImports[specifier] = meta.resolvedPath;
    });

    if (Object.keys(finalImports).length > 0) {
        const script = document.createElement('script');
        script.type = 'importmap';
        script.textContent = JSON.stringify({ imports: finalImports });
        document.head.appendChild(script);
        console.log('[Sutram] Import map synthesized and injected.', finalImports);
    }

    // =========================================================================
    // 4. Trigger Stage 2
    // =========================================================================
    // Signal the host OS that it is safe to dynamically import the app modules
    window.dispatchEvent(new CustomEvent('sutram:boot-ready'));
})();