import type { Concept } from '../../memory';
import type { Task } from '../../types';
import { samplePremises } from '../premise/sample.js';
import type { Strategy } from '../strategy.js';

interface StrategyConfig {
  name: string;
  sampleSize: number;
  filter?: (concept: Concept, task: Task) => boolean;
  truthFilter?: (truth: { f: number; c: number }) => boolean;
  limit?: number;
}

export const createStrategy = (config: StrategyConfig): Strategy => {
  const { name, sampleSize, filter, truthFilter, limit = 5 } = config;
  return {
    name,
    sampleSize,
    limit,
    selectSecondary(task, memory) {
      return samplePremises(memory, task, {
        sampleSize,
        limit,
        filter,
        truthFilter,
      });
    },
  } as Strategy & { sampleSize: number; limit: number };
};
