import type { EpisodeType } from '@senars/types/episodic-memory';
import type { TextGenerator } from '../ports';
import type { EpisodicMemory } from './EpisodicMemory';
import type { EmbeddingGenerator } from './embedding';
export interface ConsolidationOptions {
    /** Episodes considered per consolidation pass. */
    limit?: number;
    /** Minimum LM-assigned relevance (0..1) for promotion. */
    relevanceThreshold?: number;
    /** Cosine similarity above which a candidate is considered a duplicate. */
    dedupeThreshold?: number;
    /** Only episodes of this type are considered. */
    type?: EpisodeType;
}
/**
 * What one retrieval-verified pass promoted. Named for what it reports: the
 * consolidator's own `ConsolidationResult` is a summary episode plus the ids merged
 * into it, and two results with one name in the same package meant a caller holding
 * one could not say which it had.
 */
export interface PromotionResult {
    considered: number;
    relevant: number;
    promoted: Array<{
        content: string;
        provenance: Record<string, unknown>;
    }>;
    deduped: number;
}
export interface ConsolidatorDeps {
    episodic: EpisodicMemory;
    lm: TextGenerator;
    embeddings: EmbeddingGenerator;
    /** Promote a verified belief to long-term storage. */
    promote: (content: string, provenance: Record<string, unknown>) => Promise<void> | void;
}
/**
 * Retrieval-verified long-term memory consolidation:
 * store → episodic recall → LM relevance filter (structured tier) →
 * embedding-similarity dedupe → promotion of durable semantic beliefs.
 * Provenance (episode timestamps) is logged on every promotion.
 */
export declare const consolidateEpisodes: (deps: ConsolidatorDeps, options?: Partial<ConsolidationOptions>) => Promise<PromotionResult>;
//# sourceMappingURL=retrieval-verified.d.ts.map