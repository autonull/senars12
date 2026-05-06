import type { Task } from '../task/task.js';
import { Memory } from '../memory/memory.js';

export interface Strategy {
    name: string;
    selectSecondary(task: Task, memory: Memory): Task[];
}

export * from './strategies/index.js';

export const BagStrategy: Strategy = {
  name: 'bag',
  selectSecondary(task: Task, memory: Memory): Task[] {
    const concepts = memory.sample(10);
    return concepts
      .filter(c => c.term.hash !== task.term.hash)
      .map(c => {
        const belief = c.beliefBag.peek();
        return {
          term: c.term,
          type: 'belief' as const,
          truth: belief?.truth ?? { f: 0.5, c: 0.9 },
          budget: c.priority,
          stamp: Object.freeze({
            id: '',
            creationTime: 0,
            source: 'INPUT' as const,
            derivations: [] as readonly string[],
            depth: 0
          }),
          occurrenceTime: 0,
          derived: false
        };
      });
  }
};

export const ExhaustiveStrategy: Strategy = {
  name: 'exhaustive',
  selectSecondary(task: Task, memory: Memory): Task[] {
    return memory.sample(100).map(c => {
      const belief = c.beliefBag.peek();
      return {
        term: c.term,
        type: 'belief' as const,
        truth: belief?.truth ?? { f: 0.5, c: 0.9 },
        budget: c.priority,
        stamp: Object.freeze({
          id: '',
          creationTime: 0,
          source: 'INPUT' as const,
          derivations: [] as readonly string[],
          depth: 0
        }),
        occurrenceTime: 0,
        derived: false
      };
    });
  }
};