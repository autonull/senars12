import type { JudgmentQuery } from './types';
export interface ScoringOptions {
    salt?: number;
    minScore?: number;
    maxScore?: number;
    embeddingSampleSize?: number;
}
export declare function computeDeterministicScore(embedding: Float32Array, query: JudgmentQuery, options?: ScoringOptions): number;
export declare function createScorer(salt: number, minScore?: number, maxScore?: number): (embedding: Float32Array, query: JudgmentQuery) => number;
export declare function getScorer(rubric: string): ReturnType<typeof createScorer>;
//# sourceMappingURL=scoring.d.ts.map