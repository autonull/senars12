import { djb2, djb2Step, LruCache, lerp } from '@senars/util';
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
  return lerp(opts.minScore, opts.maxScore, combined);
}

export function createScorer(salt: number, minScore = 0.3, maxScore = 0.9) {
  return (embedding: Float32Array, query: JudgmentQuery) =>
    computeDeterministicScore(embedding, query, { salt, minScore, maxScore });
}

/** Rubric-keyed scorers are derived from the rubric name alone, so eviction is
 *  always safe — a miss just recomputes the identical closure. */
const SCORER_CACHE_MAX = 256;
const scorerRegistry = new LruCache<string, ReturnType<typeof createScorer>>(SCORER_CACHE_MAX);

export function getScorer(rubric: string): ReturnType<typeof createScorer> {
  const cached = scorerRegistry.get(rubric);
  if (cached) return cached;
  const scorer = createScorer(djb2(rubric));
  scorerRegistry.set(rubric, scorer);
  return scorer;
}
