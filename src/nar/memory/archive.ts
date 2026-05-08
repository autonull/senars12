import type {Concept} from './concept.js';

export interface ArchiveConfig {
    maxArchivedConcepts: number;
    archiveThreshold: number;
}

const DEFAULT_CONFIG: ArchiveConfig = {
    maxArchivedConcepts: 1000,
    archiveThreshold: 0.2
};

export class Archive {
    private archived: Map<number, Concept>;
    private config: ArchiveConfig;

    constructor(config: ArchiveConfig = DEFAULT_CONFIG) {
        this.config = config;
        this.archived = new Map();
    }

    get size(): number {
        return this.archived.size;
    }

    get capacity(): number {
        return this.config.maxArchivedConcepts;
    }

    get stats(): {
        size: number;
        capacity: number;
        utilization: number;
    } {
        return {
            size: this.size,
            capacity: this.capacity,
            utilization: this.size / this.capacity
        };
    }

    archive(concept: Concept): void {
        if (concept.priority < this.config.archiveThreshold) {
            if (this.archived.size >= this.config.maxArchivedConcepts) {
                const oldest = this.archived.values().next().value;
                if (oldest) {
                    this.archived.delete(oldest.term.hash);
                }
            }
            this.archived.set(concept.term.hash, concept);
        }
    }

    retrieve(hash: number): Concept | undefined {
        return this.archived.get(hash);
    }

  unarchive(hash: number): Concept | undefined {
    const concept = this.archived.get(hash);
    if (concept) {
      this.archived.delete(hash);
    }
    return concept;
  }

    removeFromArchive(hash: number): boolean {
        return this.archived.delete(hash);
    }

    search(predicate: (concept: Concept) => boolean): Concept[] {
        const results: Concept[] = [];
        for (const concept of this.archived.values()) {
            if (predicate(concept)) {
                results.push(concept);
            }
        }
        return results;
    }

    clear(): void {
        this.archived.clear();
    }
}


