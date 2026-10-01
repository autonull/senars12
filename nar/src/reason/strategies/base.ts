import type { Concept } from '../../memory/concept.js';
import type { FilterSpec, SampleConfig } from '../../strategies/premise/primitives';
import { samplePremisesFromConfig } from '../../strategies/premise/primitives';
import type { Strategy } from '../../strategies/types.js';
import type { Task } from '../../types';

type StrategyConfig = Pick<
  SampleConfig,
  'source' | 'scorer' | 'filters' | 'minScore' | 'skipSameTerm'
> & {
  name: string;
  sampleSize: number;
  limit?: number;
  /** One-off concept predicate, composed with `filters`. */
  filter?: (concept: Concept, task: Task) => boolean;
  /** One-off truth predicate, composed with the pipeline. */
  truthFilter?: (truth: { f: number; c: number }, task: Task) => boolean;
};

/** Named premise strategies are compositions of the source/scorer/filter primitives. */
export const createStrategy = (config: StrategyConfig): Strategy => {
  const { name, sampleSize, limit = 5, filter, truthFilter, ...primitives } = config;
  // Built once, not per `selectSecondary` call: the config is the identity
  // `samplePremisesFromConfig` keys its merged config and bound filters on, so
  // rebuilding it every cycle meant re-resolving the pipeline every cycle. The
  // escape hatches forward the pipeline's own task, which is the one
  // `selectSecondary` passed in.
  const sample: SampleConfig = {
    ...primitives,
    sampleSize,
    limit,
    where: filter ? (t, concept) => filter(concept, t) : undefined,
    whereTruth: truthFilter ? (t, truth) => truthFilter(truth, t) : undefined,
  };
  return {
    name,
    sampleSize,
    limit,
    selectSecondary(task, memory) {
      return samplePremisesFromConfig(memory, task, sample);
    },
  } as Strategy & { sampleSize: number; limit: number };
};

export type { FilterSpec, StrategyConfig };
