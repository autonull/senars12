import type {Task} from '../../types';
import type {Strategy} from '../strategy.js';
import type {Concept} from '../../memory';
import {samplePremises} from '../premise/sample.js';

interface StrategyConfig {
    name: string;
    sampleSize: number;
    filter?: (concept: Concept, task: Task) => boolean;
    truthFilter?: (truth: { f: number; c: number }) => boolean;
    limit?: number;
}

export const createStrategy = (config: StrategyConfig): Strategy => {
const {name, sampleSize, filter, truthFilter, limit = 5} = config;

const strategy = {
name,
sampleSize,
limit,
selectSecondary(task, memory) {
return samplePremises(memory, task, {
  sampleSize,
  limit,
  filter,
  truthFilter
});
}
} as Strategy & {sampleSize: number; limit: number};

return strategy;
};
