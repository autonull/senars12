import type {Term} from '../terms';
import type {Concept} from './concept.js';
import {TermMap} from '../terms/term-map.js';

// Helpers specialized for Concept maps keyed by Term
export function getConceptFromMap(map: TermMap<Concept>, term: Term): Concept | undefined {
    return map.get(term);
}

export function addConceptToMap(map: TermMap<Concept>, term: Term, factory?: () => Concept): Concept {
    const existing = map.get(term);
    if (existing) return existing;

    const make = factory ?? (() => (new (require('./concept.js').Concept)(term)));
    const concept = make();
    map.set(term, concept);
    return concept;
}
