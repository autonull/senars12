/**
 * Episodic Fold — log replay and projection building.
 */
import type { BeliefTruth } from '@senars/types/truth';
import { Stamp, type Term, Truth } from '../../terms';
import type { Budget } from '../../types';
import { Concept, type ConceptTaskType, type TaskData } from '../concept';
import { type ResolvedMemoryConfig } from '../config';
import { type EmbeddingGenerator } from '../embedding';
import { Focus } from '../focus';
import { EpisodicMemory } from '../EpisodicMemory';
import type { Episode } from '@senars/types/episodic-memory';
/** Episode type for concept/task operations in the log metadata. */
declare const FOLD_OP_TYPES: readonly ['concept_added', 'task_admitted', 'concept_removed', 'concept_archived', 'link_added', 'link_removed', 'revision_recorded', 'consolidation_run', 'eviction_run'];
type FoldOpType = (typeof FOLD_OP_TYPES)[number];
/** Extended episode with fold operation payload in metadata. */
interface FoldEpisode extends Episode {
    metadata: Episode['metadata'] & {
        foldOp?: FoldOpType;
        conceptTerm?: string;
        taskType?: ConceptTaskType;
        truth?: Truth;
        budget?: Budget;
        stamp?: Stamp;
        linkSource?: string;
        linkTarget?: string;
        linkLayer?: string;
        linkPriority?: number;
        revisionTermKey?: string;
        revisionTruth?: BeliefTruth;
        revisionStampId?: string;
        consolidationCycles?: number;
        evictionReason?: string;
    };
}
/** Concept projection derived from the log. */
export interface ConceptProjection {
    concept: Concept;
    lastSeen: number;
    isArchived: boolean;
}
/** Task projection derived from the log. */
export interface TaskProjection {
    conceptTerm: string;
    task: TaskData;
    admittedAt: number;
}
/** Link projection derived from the log. */
interface LinkProjection {
    source: string;
    target: string;
    layer: string;
    priority: number;
    lastUpdated: number;
}
/** Revision projection derived from the log. */
interface RevisionProjection {
    termKey: string;
    truth: BeliefTruth;
    stampId: string;
    timestamp: number;
    source: 'input' | 'derivation' | 'revision' | 'inference';
}
/** Archive projection derived from the log. */
interface ArchiveProjection {
    conceptTerm: string;
    archivedAt: number;
    reason: string;
}
/** Build initial projections from episodes. */
export declare function buildProjectionsFromLog(episodes: Episode[], config: ResolvedMemoryConfig & {
    embeddingGenerator?: EmbeddingGenerator;
}): {
    concepts: Map<string, ConceptProjection>;
    tasks: Map<string, TaskProjection[]>;
    links: Map<string, LinkProjection[]>;
    revisions: RevisionProjection[];
    archiveLog: ArchiveProjection[];
};
/** Create a FoldEpisode append function. */
export declare function createFoldAppender(log: EpisodicMemory): (foldOp: FoldOpType, payload: FoldEpisode['metadata']) => Promise<void>;
/** Log a concept addition. */
export declare function logConceptAdded(log: EpisodicMemory, term: Term): () => Promise<void>;
/** Log a task admission. */
export declare function logTaskAdmitted(log: EpisodicMemory, term: Term, type: ConceptTaskType, truth?: Truth, budget?: Budget, stamp?: Stamp): () => Promise<void>;
/** Log a concept removal. */
export declare function logConceptRemoved(log: EpisodicMemory, term: Term): () => Promise<void>;
/** Log a concept archival. */
export declare function logConceptArchived(log: EpisodicMemory, term: Term): () => Promise<void>;
/** Log a link addition. */
export declare function logLinkAdded(log: EpisodicMemory, source: Term, target: Term, layer: string, priority: number): () => Promise<void>;
/** Log a link removal. */
export declare function logLinkRemoved(log: EpisodicMemory, source: Term, target: Term, layer: string): () => Promise<void>;
/** Log a revision. */
export declare function logRevision(log: EpisodicMemory, termKeyStr: string, truth: BeliefTruth, stampId: string, source: 'input' | 'derivation' | 'revision' | 'inference'): () => Promise<void>;
/** Log a consolidation run. */
export declare function logConsolidation(log: EpisodicMemory, cycles: number): () => Promise<void>;
/** Log an eviction run. */
export declare function logEviction(log: EpisodicMemory, reason: string): () => Promise<void>;
/** Rebuild focus from current concepts. */
export declare function rebuildFocus(focus: Focus, concepts: Map<string, ConceptProjection>, focusMaxConcepts: number): void;
export {};
//# sourceMappingURL=episodic.d.ts.map