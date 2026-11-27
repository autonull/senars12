import { type ContainerStats } from '@senars/util/collections';
import type { Term } from '../../terms';
import type { Concept } from '../concept';
export interface ArchiveConfig {
    maxArchivedConcepts: number;
}
export declare class Archive {
    private archived;
    private config;
    constructor(config?: ArchiveConfig);
    get size(): number;
    get capacity(): number;
    get stats(): ContainerStats;
    archive(concept: Concept): void;
    retrieve(term: Term): Concept | undefined;
    unarchive(term: Term): Concept | undefined;
    removeFromArchive(term: Term): boolean;
    search(predicate: (concept: Concept) => boolean): Concept[];
    clear(): void;
}
//# sourceMappingURL=archive.d.ts.map