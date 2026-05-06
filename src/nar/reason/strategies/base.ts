import type { Task } from '../../task/task.js';
import type { Strategy } from '../strategy.js';
import type { Concept } from '../../memory/concept.js';

interface StrategyConfig {
  name: string;
  sampleSize: number;
  filter?: (concept: Concept, task: Task) => boolean;
  truthFilter?: (truth: any) => boolean;
  limit?: number;
}

const createTaskFromConcept = (concept: Concept, priority: number): Task => {
  const belief = concept.beliefBag.peek();
  const truth = belief?.truth ?? { f: 0.5, c: 0.9 };
  
  return {
    term: concept.term,
    type: 'belief' as const,
    truth,
    budget: { priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
    stamp: Object.freeze({
      id: '',
      creationTime: 0,
      source: 'INPUT' as const,
      derivations: [],
      depth: 0
    }),
    occurrenceTime: 0,
    derived: false
  };
};

export const createStrategy = (config: StrategyConfig): Strategy => {
  const { name, sampleSize, filter, truthFilter, limit = 5 } = config;
  
  return {
    name,
    selectSecondary(task, memory) {
      const results: Task[] = [];
      const concepts = memory.sample(sampleSize);
      
      for (const concept of concepts) {
        if (filter && !filter(concept, task)) continue;
        if (concept.term.hash === task.term.hash) continue;
        
        const belief = concept.beliefBag.peek();
        if (!belief) continue;
        
        if (truthFilter && !truthFilter(belief.truth)) continue;
        
        results.push(createTaskFromConcept(concept, concept.priority));
        if (results.length >= limit) break;
      }
      
      return results;
    }
  };
};
