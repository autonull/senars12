import type {Task} from '../types';
import {Memory} from '../memory';
import {termsEqual} from '../terms';
import {createSecondaryTask} from '../types/core.js';

export interface Strategy {
  readonly name: string;
  selectSecondary(task: Task, memory: Memory): Task[];
}

export const BagStrategy: Strategy = {
  name: 'bag',
  selectSecondary: (task: Task, memory: Memory): Task[] =>
    memory.sample(10).filter(c => !termsEqual(c.term, task.term)).map(c => createSecondaryTask(c.term, c.priority, undefined, 'belief'))
};

export const ExhaustiveStrategy: Strategy = {
  name: 'exhaustive',
  selectSecondary: (task: Task, memory: Memory): Task[] =>
    memory.sample(100).map(c => createSecondaryTask(c.term, c.priority, undefined, 'belief'))
};

export {createStrategy, CompositeStrategy, AdaptiveStrategy, SwitchingStrategy} from './strategies/index.js';
export {createStrategy as createStrategyBase} from './strategies/base.js';