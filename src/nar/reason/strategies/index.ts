import type { Strategy } from '../strategy.js';
import { createStrategy } from './base.js';

export const PrologStrategy: Strategy = createStrategy({
  name: 'prolog',
  sampleSize: 20,
  limit: 5
});

export const ResolutionStrategy: Strategy = createStrategy({
  name: 'resolution',
  sampleSize: 15,
  filter: (c) => c.term.kind === 'inheritance',
  limit: 5
});

export const GoalDrivenStrategy: Strategy = createStrategy({
  name: 'goal-driven',
  sampleSize: 20,
  truthFilter: (t) => t?.f > 0.7,
  limit: 5
});

export const AnalogicalStrategy: Strategy = createStrategy({
  name: 'analogical',
  sampleSize: 15,
  filter: (c) => c.term.kind === 'inheritance',
  limit: 3
});

export const TermLinkStrategy: Strategy = createStrategy({
  name: 'term-link',
  sampleSize: 25,
  limit: 10
});

export const TaskMatchStrategy: Strategy = createStrategy({
  name: 'task-match',
  sampleSize: 20,
  limit: 5
});

export const DecompositionStrategy: Strategy = {
  name: 'decomposition',
  selectSecondary(task, memory) {
    const results: any[] = [];
    if (task.term.kind !== 'conjunction') return results;
    
    for (const arg of task.term.args) {
      const concept = memory.getConcept(arg);
      if (!concept) continue;
      const belief = concept.beliefBag.peek();
      if (!belief) continue;
      
      results.push({
        term: arg,
        type: 'belief' as const,
        truth: belief.truth ?? { f: 0.5, c: 0.9 },
        budget: { priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
        stamp: Object.freeze({ id: '', creationTime: 0, source: 'INPUT' as const, derivations: [], depth: 0 }),
        occurrenceTime: 0,
        derived: false
      });
    }
    return results;
  }
};

export const DefaultFormationStrategy: Strategy = createStrategy({
  name: 'default-formation',
  sampleSize: 10,
  limit: 5
});
