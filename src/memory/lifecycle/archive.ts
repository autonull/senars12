import { type ContainerStats, containerStats, LruCache } from '@senars/util';
import type { Term } from '../../terms';
import type { Concept } from '../concept.js';

export interface ArchiveConfig {
  maxArchivedConcepts: number;
}

const DEFAULT_CONFIG: ArchiveConfig = {
  maxArchivedConcepts: 1000,
};

export class Archive {
  private archived: LruCache<Term, Concept>;
  private config: ArchiveConfig;

  constructor(config: ArchiveConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.archived = new LruCache({ maxSize: config.maxArchivedConcepts });
  }

  get size(): number {
    return this.archived.size();
  }

  get capacity(): number {
    return this.config.maxArchivedConcepts;
  }

  get stats(): ContainerStats {
    return containerStats(this.archived.size(), this.config.maxArchivedConcepts);
  }

  archive(concept: Concept): void {
    this.archived.set(concept.term, concept);
  }

  retrieve(term: Term): Concept | undefined {
    return this.archived.get(term);
  }

  unarchive(term: Term): Concept | undefined {
    const concept = this.archived.get(term);
    if (concept) {
      this.archived.delete(term);
    }
    return concept;
  }

  removeFromArchive(term: Term): boolean {
    return this.archived.delete(term);
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
