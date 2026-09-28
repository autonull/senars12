import type { Concept } from '../../memory';
import type { Task } from '../../types';
import type { FilterSpec, SampleConfig } from '../../strategies/premise/primitives';
import { samplePremisesFromConfig } from '../../strategies/premise/primitives';
import type { Strategy } from '../../strategies/types.js';

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
  return {
    name,
    sampleSize,
    limit,
    selectSecondary(task, memory) {
      return samplePremisesFromConfig(memory, task, {
        ...primitives,
        sampleSize,
        limit,
        where: filter ? (_task, concept) => filter(concept, _task) : undefined,
        whereTruth: truthFilter ? (_task, truth) => truthFilter(truth, task) : undefined,
      });
    },
  } as Strategy & { sampleSize: number; limit: number };
};

export type { StrategyConfig, FilterSpec };
