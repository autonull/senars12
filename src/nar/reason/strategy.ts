import type {Task} from '../types';
import {Memory} from '../memory';
import {Stamp, termsEqual} from '../terms';

export interface Strategy {
    readonly name: string;

    selectSecondary(task: Task, memory: Memory): Task[];
}

const createSecondaryTask = (term: Task['term'], budget: number): Task => ({
    term, type: 'belief', truth: {f: 0.5, c: 0.9}, budget,
    stamp: Stamp.createInput(), occurrenceTime: 0, derived: false
});

export const BagStrategy: Strategy = {
    name: 'bag',
    selectSecondary: (task: Task, memory: Memory): Task[] =>
        memory.sample(10).filter(c => !termsEqual(c.term, task.term)).map(c => createSecondaryTask(c.term, c.priority))
};

export const ExhaustiveStrategy: Strategy = {
    name: 'exhaustive',
    selectSecondary: (task: Task, memory: Memory): Task[] =>
        memory.sample(100).map(c => createSecondaryTask(c.term, c.priority))
};

export * from './strategies/index.js';