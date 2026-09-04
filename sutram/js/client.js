// sutram/js/client.js
// Phase 0: Sutram Micro-Kernel Data Provider Interface

export class SutramDataClient {
    constructor(provider) {
        this.provider = provider;
    }

    async get(path, options = {}) {
        return this.provider.get(path, options);
    }

    async post(path, payload = {}, options = {}) {
        return this.provider.post(path, payload, options);
    }

    async delete(path, options = {}) {
        return this.provider.delete(path, options);
    }
}

export class HttpProvider {
    constructor(fetchImpl = window.fetch) {
        this.fetchImpl = fetchImpl;
    }

    async get(url, options = {}) {
        return this.fetchImpl(url, { ...options, method: 'GET' });
    }

    async post(url, payload = {}, options = {}) {
        const isFD = payload instanceof FormData;
        const headers = isFD ? (options.headers || {}) : { 'Content-Type': 'application/json', ...(options.headers || {}) };
        const body = isFD ? payload : JSON.stringify(payload);
        return this.fetchImpl(url, { ...options, method: 'POST', headers, body });
    }

    async delete(url, options = {}) {
        return this.fetchImpl(url, { ...options, method: 'DELETE' });
    }
}