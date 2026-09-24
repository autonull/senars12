import { createDecider, type Decider } from './decide.js';
import type { EmbeddingCache, JudgmentManifold, JudgmentQuery } from './types.js';

export interface GroundednessGateOptions {
  manifold: JudgmentManifold;
  embeddingCache: EmbeddingCache;
  threshold?: number;
  /** CLM contrastive memory: zero-shot cosine entailment when the manifold head abstains/missing. */
  contrastive?: import('./contrastive.js').ContrastiveMemory;
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
): (narration: string) => Promise<boolean> {
  const { manifold, embeddingCache, threshold = 0.7, contrastive } = options;
  const decider: Decider = createDecider({
    judge: (pointer, queries, budget) => manifold.judgeBatch(pointer, queries, budget),
    embeddingCache,
    contrastive,
  });

  return async (narration: string): Promise<boolean> => {
    try {
      const result = await decider.decide({
        context: narration,
        queries: [GROUNDEDNESS_QUERY],
        budget: S1_BUDGET,
        contrastiveRubric: 'groundedness',
      });
      const proposition = result.verdicts[0]?.proposition;
      if (proposition && !proposition.abstained && proposition.kind === 'evaluate') {
        return proposition.score >= threshold;
      }
      // CLM contrastive fallback: abstained head ⇒ zero-shot entailment score.
      if (result.contrastive.score !== undefined) {
        return result.contrastive.score >= threshold;
      }
      return false;
    } catch {
      return false;
    }
  };
}
