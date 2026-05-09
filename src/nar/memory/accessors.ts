import type {Term} from '../terms';
import type {Concept} from './concept.js';
import {getOrInsert} from '../utils/collections.js';

// Helpers specialized for Concept maps keyed by term.hash
export function getConceptFromMap(map: Map<number, Concept>, term: Term): Concept | undefined {
    return map.get(term.hash);
}

export function addConceptToMap(map: Map<number, Concept>, term: Term, factory?: () => Concept): Concept {
    // factory allows callers to construct the Concept in their own module to avoid circular import issues
    const make = factory ?? (() => (new (require('./concept.js').Concept)(term)));
    return getOrInsert(map, term.hash, make as unknown as () => Concept);
}
