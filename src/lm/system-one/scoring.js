import { djb2, djb2Step } from '@senars/util/hash';
import { getOrInsert } from '@senars/util/collections';
import { LruCache } from '@senars/util/lru-cache';
import { lerp } from '@senars/util/numeric';
const DEFAULT_OPTIONS = {
    salt: 0,
    minScore: 0.3,
    maxScore: 0.9,
    embeddingSampleSize: 64,
};
export function computeDeterministicScore(embedding, query, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let hash = 0;
    for (let i = 0; i < Math.min(embedding.length, opts.embeddingSampleSize); i++) {
        hash = djb2Step(hash, Math.floor((embedding[i] ?? 0) * 1000 + opts.salt));
    }
    const instructionHash = djb2(query.instruction, opts.salt);
    const combined = (Math.abs(hash + instructionHash) % 10000) / 10000;
    return lerp(opts.minScore, opts.maxScore, combined);
}
export function createScorer(salt, minScore = 0.3, maxScore = 0.9) {
    return (embedding, query) => computeDeterministicScore(embedding, query, { salt, minScore, maxScore });
}
/** Rubric-keyed scorers are derived from the rubric name alone, so eviction is
 *  always safe — a miss just recomputes the identical closure. */
const SCORER_CACHE_MAX = 256;
const scorerRegistry = new LruCache(SCORER_CACHE_MAX);
export function getScorer(rubric) {
    return getOrInsert(scorerRegistry, rubric, () => createScorer(djb2(rubric)));
}
