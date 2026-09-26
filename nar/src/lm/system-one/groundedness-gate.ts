import { createDecider, type Decider } from './decide.js';
import type { EmbeddingCache, JudgmentManifold, JudgmentQuery } from './types.js';
import type { ContrastiveMemory } from './contrastive.js';

export interface GroundednessGateOptions {
  manifold: JudgmentManifold;
  embeddingCache: EmbeddingCache;
  threshold?: number;
  /** CLM contrastive memory factory: returns per-correlationId contrastive memory for isolation. */
  getContrastive?: (correlationId: string) => ContrastiveMemory;
}

const S1_BUDGET = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const GROUNDEDNESS_QUERY: JudgmentQuery = {
  kind: 'evaluate',
  instruction: 'Evaluate if the narration is grounded in evidence',
  rubric: 'groundedness',
  axis: 'epistemic',
  criticality: 'standard',
};

/**
 * Egress gate over the unified decision facade (TODO23): one `decide()` call
 * composes the calibrated groundedness head with the CLM contrastive fallback
 * (positive = grounded, negative = error episodes).
 */
export function createGroundednessGate(
  options: GroundednessGateOptions
): (narration: string, correlationId: string) => Promise<{ grounded: boolean; score?: number }> {
  const { manifold, embeddingCache, threshold = 0.7, getContrastive } = options;

  return async (narration: string, correlationId: string): Promise<{ grounded: boolean; score?: number }> => {
    try {
      const contrastive = getContrastive?.(correlationId);
      const decider: Decider = createDecider({
        judge: (pointer, queries, budget) => manifold.judgeBatch(pointer, queries, budget),
        embeddingCache,
        contrastive,
      });
      const result = await decider.decide({
        context: narration,
        queries: [GROUNDEDNESS_QUERY],
        budget: S1_BUDGET,
        contrastiveRubric: 'groundedness',
      });
      const proposition = result.verdicts[0]?.proposition;
      if (proposition && !proposition.abstained && proposition.kind === 'evaluate') {
        return { grounded: proposition.score >= threshold, score: proposition.score };
      }
      // CLM contrastive fallback: abstained head ⇒ zero-shot entailment score.
      if (result.contrastive.score !== undefined) {
        return { grounded: result.contrastive.score >= threshold, score: result.contrastive.score };
      }
      return { grounded: false, score: 0 };
    } catch {
      return { grounded: false, score: 0 };
    }
  };
}
