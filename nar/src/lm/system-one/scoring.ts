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
    const val = embedding[i] ?? 0;
    hash = ((hash << 5) - hash + Math.floor(val * 1000 + opts.salt)) | 0;
  }

  const instructionHash = query.instruction
    .split('')
    .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0) + opts.salt) | 0, 0);

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
    const salt = rubric.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    scorer = createScorer(salt);
    scorerRegistry.set(rubric, scorer);
  }
  return scorer;
}
