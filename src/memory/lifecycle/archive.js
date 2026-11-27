import { containerStats } from '@senars/util/collections';
import { LruCache } from '@senars/util/lru-cache';
const DEFAULT_CONFIG = {
    maxArchivedConcepts: 1000,
};
export class Archive {
    archived;
    config;
    constructor(config = DEFAULT_CONFIG) {
        this.config = config;
        this.archived = new LruCache({ maxSize: config.maxArchivedConcepts });
    }
    get size() {
        return this.archived.size();
    }
    get capacity() {
        return this.config.maxArchivedConcepts;
    }
    get stats() {
        return containerStats(this.archived.size(), this.config.maxArchivedConcepts);
    }
    archive(concept) {
        this.archived.set(concept.term, concept);
    }
    retrieve(term) {
        return this.archived.get(term);
    }
    unarchive(term) {
        const concept = this.archived.get(term);
        if (concept) {
            this.archived.delete(term);
        }
        return concept;
    }
    removeFromArchive(term) {
        return this.archived.delete(term);
    }
    search(predicate) {
        const results = [];
        for (const concept of this.archived.values()) {
            if (predicate(concept)) {
                results.push(concept);
            }
        }
        return results;
    }
    clear() {
        this.archived.clear();
    }
}
