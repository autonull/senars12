export class ModelSelector {
    constructor(providerRegistry) {
        this.providerRegistry = providerRegistry;
        this.cache = new Map();
    }

    select(task, constraints = {}) {
        const cacheKey = `${task?.type ?? 'unknown'}_${JSON.stringify(constraints)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const availableProviders = [...this.providerRegistry.providers.keys()];
        const result = this.#selectByConstraints(availableProviders, constraints);

        this.cache.set(cacheKey, result);
        return result;
    }

    #selectByConstraints(availableProviders, constraints) {
        if (!availableProviders.length) {
            return null;
        }
        if (!Object.keys(constraints).length) {
            return this.providerRegistry.defaultProviderId ?? availableProviders[0];
        }
        return constraints.performance === 'low'
            ? availableProviders.at(-1)
            : availableProviders[0];
    }

    getAvailableModels() {
        return [...this.providerRegistry.providers.keys()];
    }

    clearCache() {
        this.cache.clear();
    }
}