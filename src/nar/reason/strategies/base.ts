import type {Task} from '../../types';
import {createSecondaryTask} from '../../types';
import type {Strategy} from '../strategy.js';
import type {Concept} from '../../memory';
import {termsEqual} from '../../terms';

interface StrategyConfig {
  name: string;
  sampleSize: number;
  filter?: (concept: Concept, task: Task) => boolean;
  truthFilter?: (truth: any) => boolean;
  limit?: number;
}

export const createStrategy = (config: StrategyConfig): Strategy => {
    const {name, sampleSize, filter, truthFilter, limit = 5} = config;

    return {
        name,
        selectSecondary(task, memory) {
            const results: Task[] = [];
            const concepts = memory.sample(sampleSize);

            for (const concept of concepts) {
                if (filter && !filter(concept, task)) continue;
                if (termsEqual(concept.term, task.term)) continue;

                const belief = concept.beliefBag.peek();
                if (!belief) continue;

                if (truthFilter && !truthFilter(belief.truth)) continue;

    results.push(createSecondaryTask(concept.term, concept.priority));
    if (results.length >= limit) break;
            }

            return results;
        }
    };
};
