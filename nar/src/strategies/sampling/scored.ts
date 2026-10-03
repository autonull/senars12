import { selectTopN, sortBy } from '@senars/util';
import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { SamplingStrategy } from '../types.js';

export type ConceptSource = (memory: MemoryView) => Iterable<Concept>;
export type ConceptScore = (concept: Concept) => number;

export interface ScoredSamplingOptions {
  name: string;
  description: string;
  score: ConceptScore;
  source?: ConceptSource;
}

const defaultSource: ConceptSource = (memory) => memory.conceptValues();

export const rankedSample = (
  concepts: Iterable<Concept>,
  count: number,
  score: ConceptScore
): Concept[] => selectTopN(concepts, count, score);

export const stratifiedSample = (
  concepts: Iterable<Concept>,
  count: number,
  score: ConceptScore,
  bands = 4
): Concept[] => {
  if (count <= 0) return [];
  const sorted = sortBy(concepts, score);
  const perBand = Math.max(1, Math.ceil(count / bands));
  const bandSize = Math.max(1, Math.floor(sorted.length / bands));
  const result: Concept[] = [];
  for (let b = 0; b < bands; b++)
    result.push(...sorted.slice(b * bandSize, b * bandSize + bandSize).slice(0, perBand));
  return result.slice(0, count);
};

export const defineScoredSampling = ({
  name,
  description,
  score,
  source = defaultSource,
}: ScoredSamplingOptions): SamplingStrategy => ({
  metadata: { name, description },
  sample: (memory, count) => rankedSample(source(memory), count, score),
});
