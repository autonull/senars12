import { djb2, djb2Step } from '@senars/util';
import type { JudgmentQuery } from './types.js';

export interface ScoringOptions {
  salt?: number;
  minScore?: number;
  maxScore?: number;
  embeddingSampleSize?: number;
}

const DEFAULT_OPTIONS: Required<ScoringOptions> = {
  salt: 0,
  minScore: 0.3,
  maxScore: 0.9,
  embeddingSampleSize: 64,
};

export function computeDeterministicScore(
  embedding: Float32Array,
  query: JudgmentQuery,
  options: ScoringOptions = {}
): number {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let hash = 0;

  for (let i = 0; i < Math.min(embedding.length, opts.embeddingSampleSize); i++) {
    hash = djb2Step(hash, Math.floor((embedding[i] ?? 0) * 1000 + opts.salt));
  }

  const instructionHash = djb2(query.instruction, opts.salt);

  const combined = (Math.abs(hash + instructionHash) % 10000) / 10000;
  return opts.minScore + combined * (opts.maxScore - opts.minScore);
}

export function createScorer(salt: number, minScore = 0.3, maxScore = 0.9) {
  return (embedding: Float32Array, query: JudgmentQuery) =>
    computeDeterministicScore(embedding, query, { salt, minScore, maxScore });
}

export const scorerRegistry = new Map<string, ReturnType<typeof createScorer>>();

export function getScorer(rubric: string): ReturnType<typeof createScorer> {
  let scorer = scorerRegistry.get(rubric);
  if (!scorer) {
    const salt = djb2(rubric);
    scorer = createScorer(salt);
    scorerRegistry.set(rubric, scorer);
  }
  return scorer;
}
