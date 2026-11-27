import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { SamplingStrategy } from '../types';
export type ConceptSource = (memory: MemoryView) => Iterable<Concept>;
export type ConceptScore = (concept: Concept) => number;
export interface ScoredSamplingOptions {
    name: string;
    description: string;
    score: ConceptScore;
    source?: ConceptSource;
}
export declare const rankedSample: (concepts: Iterable<Concept>, count: number, score: ConceptScore) => Concept[];
export declare const stratifiedSample: (concepts: Iterable<Concept>, count: number, score: ConceptScore, bands?: number) => Concept[];
export declare const defineScoredSampling: ({ name, description, score, source, }: ScoredSamplingOptions) => SamplingStrategy;
//# sourceMappingURL=scored.d.ts.map