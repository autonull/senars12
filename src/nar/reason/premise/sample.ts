import type {Concept, Memory} from '../../memory';
import type {Task} from '../../types';
import {createSecondaryTask} from '../../types';
import {termsEqual, extractSymbols} from '../../terms';

const MIN_SHARED_ATOMS = 1;

const hasSharedAtoms = (term1: Task['term'], term2: Task['term']): boolean => {
    const atoms1 = extractSymbols(term1);
    const atoms2 = extractSymbols(term2);
    for (const a of atoms1) { if (atoms2.has(a)) return true; }
    return false;
};

export interface PremiseFilter {
    (concept: Concept, task: Task): boolean;
}

export interface TruthPredicate {
    (truth: { f: number; c: number }): boolean;
}

export interface SampleConfig {
    sampleSize: number;
    limit: number;
    filter?: PremiseFilter;
    truthFilter?: TruthPredicate;
    skipSameTerm?: boolean;
}

const DEFAULT_CONFIG: Omit<SampleConfig, 'filter' | 'truthFilter'> & {
    filter: PremiseFilter | undefined;
    truthFilter: TruthPredicate | undefined;
} = {
    sampleSize: 20,
    limit: 10,
    filter: undefined,
    truthFilter: undefined,
    skipSameTerm: true
};

export function samplePremises(memory: Memory, task: Task, config: Partial<SampleConfig> = {}): Task[] {
    const merged = {...DEFAULT_CONFIG, ...config};
    const results: Task[] = [];
    const concepts = memory.sample(merged.sampleSize);

    for (const concept of concepts) {
        if (merged.skipSameTerm && termsEqual(concept.term, task.term)) continue;
        if (!hasSharedAtoms(concept.term, task.term)) continue;
        if (merged.filter && !merged.filter(concept, task)) continue;

        const belief = concept.beliefBag.peek();
        if (!belief?.truth) continue;
        if (merged.truthFilter && !merged.truthFilter(belief.truth)) continue;

        results.push(createSecondaryTask(concept.term, concept.priority, belief.truth));
        if (results.length >= merged.limit) break;
    }

    return results;
}
