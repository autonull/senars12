import type { Term } from '../terms/types.js';
import type { Truth } from '../terms/truth.js';
import type { Stamp } from '../terms/stamp.js';

export type TaskType = 'belief' | 'goal' | 'question' | 'command';

export interface Budget {
  readonly priority: number;
  readonly durability: number;
  readonly quality: number;
  readonly cycles: number;
  readonly depth: number;
}

export interface Task {
  readonly term: Term;
  readonly type: TaskType;
  readonly truth: Truth;
  readonly budget: Budget | number;
  readonly stamp: Stamp;
  readonly occurrenceTime: number;
  readonly derived: boolean;
}

export const createBudget = (priority: number, durability = 0.8, quality = 0.9, cycles = 0, depth = 0): Budget =>
  Object.freeze({ priority, durability, quality, cycles, depth });

export const isBudget = (b: Budget | number): b is Budget => typeof b === 'object' && 'priority' in b;

export const getBudgetValue = (b: Budget | number): number => typeof b === 'number' ? b : b.priority;

export const createTask = (
  term: Term,
  type: TaskType,
  truth: Truth,
  budget: Budget | number = 0.9,
  derivations: readonly string[] = []
): Task => {
  const now = Date.now();
  return {
    term,
    type,
    truth,
    budget,
    stamp: Object.freeze({
      id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
      creationTime: now,
      source: 'INPUT' as const,
      derivations,
      depth: 0
    }),
    occurrenceTime: now,
    derived: false
  };
};