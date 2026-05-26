import type {Task} from '../types';
import {createSecondaryTask} from '../types';
import {Memory} from '../memory';
import {termsEqual, extractSymbols} from '../terms';
import type {ComponentMetadata} from '../strategies/types.js';

const MIN_SHARED_ATOMS = 1;
const MIN_DERIVATION_PRIORITY = 0.05;

const hasSharedAtoms = (term1: Task['term'], term2: Task['term']): boolean => {
    const atoms1 = extractSymbols(term1);
    const atoms2 = extractSymbols(term2);
    for (const a of atoms1) { if (atoms2.has(a)) return true; }
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
    metadata: { name: 'bag', description: 'Sample 10 concepts, filter by shared atoms and derivation history' },
    name: 'bag',
    selectSecondary: (task: Task, memory: Memory): Task[] =>
        memory.sample(10)
            .filter(c => !termsEqual(c.term, task.term))
            .filter(c => hasSharedAtoms(c.term, task.term))
            .filter(c => {
                const belief = c.beliefBag.peek();
                if (!belief?.stamp || !task.stamp) return true;
                if (belief.stamp.id === task.stamp.id) return false;
                const t1 = new Set(task.stamp.derivations ?? []);
                const t2 = new Set(belief.stamp.derivations ?? []);
                for (const id of t1) { if (t2.has(id)) return false; }
                return true;
            })
            .map(c => createSecondaryTask(c.term, c.priority, c.beliefBag.peek()?.truth, 'belief'))
            .filter(t => t.budget.priority >= MIN_DERIVATION_PRIORITY)
};

export const ExhaustiveStrategy: Strategy = {
    metadata: { name: 'exhaustive', description: 'Sample 100 concepts, filter by shared atoms' },
    name: 'exhaustive',
    selectSecondary: (task: Task, memory: Memory): Task[] =>
        memory.sample(100)
            .filter(c => !termsEqual(c.term, task.term))
            .filter(c => hasSharedAtoms(c.term, task.term))
            .map(c => createSecondaryTask(c.term, c.priority, c.beliefBag.peek()?.truth, 'belief'))
            .filter(t => t.budget.priority >= MIN_DERIVATION_PRIORITY)
};

export {createStrategy, CompositeStrategy, AdaptiveStrategy, SwitchingStrategy} from './strategies/index.js';