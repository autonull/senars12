import type {Concept, Memory} from '../../memory';
import type {Task} from '../../types';
import {createSecondaryTask} from '../../types';
import type {Term} from '../../terms';
import {termsEqual} from '../../terms';

export interface PremiseFilter {
    (concept: Concept, task: Task): boolean;
}

export interface TruthFilter {
    (truth: { f: number; c: number }): boolean;
}

export interface SampleConfig {
    sampleSize: number;
    limit: number;
    filter?: PremiseFilter;
    truthFilter?: TruthFilter;
    skipSameTerm?: boolean;
}

const DEFAULT_CONFIG: Omit<SampleConfig, 'filter' | 'truthFilter'> & {
    filter: PremiseFilter | undefined;
    truthFilter: TruthFilter | undefined;
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
        if (merged.filter && !merged.filter(concept, task)) continue;

        const belief = concept.beliefBag.peek();
        if (!belief?.truth) continue;
        if (merged.truthFilter && !merged.truthFilter(belief.truth)) continue;

        results.push(createSecondaryTask(concept.term, concept.priority, belief.truth));
        if (results.length >= merged.limit) break;
    }

    return results;
}

export function samplePremisesFromTerms(
    memory: Memory,
    terms: Term[],
    config: Partial<Omit<SampleConfig, 'sampleSize'>> = {}
): Task[] {
    const merged = {...DEFAULT_CONFIG, ...config};
    const results: Task[] = [];

    for (const term of terms) {
        const concept = memory.getConcept(term);
        if (!concept) continue;
        if (merged.filter && !merged.filter(concept, null as any)) continue;

        const belief = concept.beliefBag.peek();
        if (!belief?.truth) continue;
        if (merged.truthFilter && !merged.truthFilter(belief.truth)) continue;

        results.push(createSecondaryTask(term, concept.priority, belief.truth));
        if (results.length >= merged.limit) break;
    }

    return results;
}
