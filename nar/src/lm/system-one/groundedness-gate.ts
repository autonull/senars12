import type { EmbeddingCache, EmbeddingPointer, JudgmentManifold, JudgmentQuery } from './types.js';

export interface GroundednessGateOptions {
  manifold: JudgmentManifold;
  embeddingCache: EmbeddingCache;
  threshold?: number;
}

export function createGroundednessGate(
  options: GroundednessGateOptions
): (narration: string) => Promise<boolean> {
  const { manifold, embeddingCache, threshold = 0.7 } = options;

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
      const results = await manifold.judgeBatch(embeddingPointer as EmbeddingPointer, [query], {
        maxCycles: 100,
        maxDepth: 10,
        maxMemoryOps: 1000,
        maxLMCalls: 5,
        consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
      });

      const result = results[0];
      if (result && !result.abstained && result.kind === 'evaluate') {
        return result.score >= threshold;
      }
    } catch {
      // On error, fail-safe: reject the narration
    }

    return false;
  };
}
