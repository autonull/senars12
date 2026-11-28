import type { ContrastiveMemory } from './contrastive';
import type { EmbeddingCache, JudgmentManifold } from './types';
import type { EgressVerdict } from '@senars/types/cognitive';
export interface GroundednessGateOptions {
    manifold: JudgmentManifold;
    embeddingCache: EmbeddingCache;
    threshold?: number;
    /** CLM contrastive memory factory: returns per-correlationId contrastive memory for isolation. */
    getContrastive?: (correlationId: string) => ContrastiveMemory;
}
/**
 * Egress gate over the unified decision facade (TODO23): one `decide()` call
 * composes the calibrated groundedness head with the CLM contrastive fallback
 * (positive = grounded, negative = error episodes).
 */
export declare function createGroundednessGate(options: GroundednessGateOptions): (narration: string, correlationId: string) => Promise<EgressVerdict>;
//# sourceMappingURL=groundedness-gate.d.ts.map