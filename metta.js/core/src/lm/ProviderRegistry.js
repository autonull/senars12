export class ProviderRegistry {
    #providers = new Map();
    #defaultProviderId = null;

    get providers() {
        return this.#providers;
    }

    get size() {
        return this.#providers.size;
    }

    get defaultProviderId() {
        return this.#defaultProviderId;
    }

    register(id, provider) {
        if (!id || !provider) {
            throw new Error('Provider ID and provider object are required');
        }
        this.#providers.set(id, provider);
        this.#defaultProviderId ||= id;
        return this;
    }

    get(id) {
        return this.#providers.get(id);
    }

    has(id) {
        return this.#providers.has(id);
    }

    remove(id) {
        if (this.#defaultProviderId === id) {
            this.#defaultProviderId = [...this.#providers.keys()].find(k => k !== id) ?? null;
        }
        return this.#providers.delete(id);
    }

    getAll() {
        return new Map(this.#providers);
    }

    setDefault(id) {
        if (this.#providers.has(id)) {
            this.#defaultProviderId = id;
        }
        return this;
    }
}