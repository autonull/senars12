import type { ContrastiveMemory } from './contrastive.js';
import type { EmbeddingCache, EmbeddingPointer, JudgmentManifold, JudgmentQuery } from './types.js';

export interface GroundednessGateOptions {
  manifold: JudgmentManifold;
  embeddingCache: EmbeddingCache;
  threshold?: number;
  /** CLM contrastive memory: zero-shot cosine entailment when the manifold head abstains/missing. */
  contrastive?: ContrastiveMemory;
}

const S1_BUDGET = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

export function createGroundednessGate(
  options: GroundednessGateOptions
): (narration: string) => Promise<boolean> {
  const { manifold, embeddingCache, threshold = 0.7, contrastive } = options;

  return async (narration: string): Promise<boolean> => {
    const embeddingPointer = await embeddingCache.write(narration);

    const query: JudgmentQuery = {
      kind: 'evaluate',
      instruction: 'Evaluate if the narration is grounded in evidence',
      rubric: 'groundedness',
      axis: 'epistemic',
      criticality: 'standard',
    };

    try {
      const results = await manifold.judgeBatch(embeddingPointer as EmbeddingPointer, [query], S1_BUDGET);

      const result = results[0];
      if (result && !result.abstained && result.kind === 'evaluate') {
        return result.score >= threshold;
      }
    } catch {
      // Fall through to the contrastive fallback (fail-safe below if it also fails)
    }

    // CLM zero-shot entailment: contrastive score against stored
    // groundedness exemplars (positive = grounded, negative = error episodes).
    if (contrastive?.has('groundedness')) {
      const embedding = embeddingCache.read(embeddingPointer as EmbeddingPointer);
      const score = embedding && contrastive.score(embedding, 'groundedness');
      if (score !== undefined) return score >= threshold;
    }

    return false;
  };
}
