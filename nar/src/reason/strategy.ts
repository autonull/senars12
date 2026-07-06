import type { Memory } from '../memory';
import type { ComponentMetadata } from '../strategies';
import { extractSymbols, termsEqual } from '../terms';
import { Stamp } from '../terms/stamp.js';
import type { Task } from '../types';
import { createSecondaryTask } from '../types';

const MIN_DERIVATION_PRIORITY = 0.05;

const hasSharedAtoms = (term1: Task['term'], term2: Task['term']): boolean => {
  const atoms1 = extractSymbols(term1);
  const atoms2 = extractSymbols(term2);
  for (const a of atoms1) {
    if (atoms2.has(a)) return true;
  }
  return false;
};

export interface Strategy {
  readonly metadata?: ComponentMetadata;
  readonly name: string;
  readonly sampleSize?: number;
  readonly limit?: number;

  selectSecondary(task: Task, memory: Memory): Task[];
}

export const BagStrategy: Strategy = {
  metadata: {
    name: 'bag',
    description: 'Sample 10 concepts, filter by shared atoms and derivation history',
  },
  name: 'bag',
  selectSecondary: (task: Task, memory: Memory): Task[] =>
    memory
      .sample(10)
      .filter((c) => !termsEqual(c.term, task.term))
      .filter((c) => hasSharedAtoms(c.term, task.term))
      .filter((c) => {
        const belief = c.beliefBag.peek();
        if (!belief?.stamp || !task.stamp) return true;
        return !Stamp.overlaps(belief.stamp, task.stamp);
      })
      .map((c) => createSecondaryTask(c.term, c.priority, c.beliefBag.peek()?.truth, 'belief'))
      .filter((t) => t.budget.priority >= MIN_DERIVATION_PRIORITY),
};

export const ExhaustiveStrategy: Strategy = {
  metadata: { name: 'exhaustive', description: 'Sample 100 concepts, filter by shared atoms' },
  name: 'exhaustive',
  selectSecondary: (task: Task, memory: Memory): Task[] =>
    memory
      .sample(100)
      .filter((c) => !termsEqual(c.term, task.term))
      .filter((c) => hasSharedAtoms(c.term, task.term))
      .map((c) => createSecondaryTask(c.term, c.priority, c.beliefBag.peek()?.truth, 'belief'))
      .filter((t) => t.budget.priority >= MIN_DERIVATION_PRIORITY),
};

export {
  createStrategy,
  CompositeStrategy,
  AdaptiveStrategy,
  SwitchingStrategy,
} from './strategies/index.js';
