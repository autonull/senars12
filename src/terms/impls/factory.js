import { canonicalTerm } from '../reduce';
import { containsSubterm } from './accessors';
import { atomOf, clearTerms, compoundOf, evictTerm, rawCompoundCtors, termCacheSize, } from './intern';
/**
 * Every public construction path canonicalises before it keys, so interning,
 * `termsEqual` and memory dedup agree by construction rather than by which
 * producer remembered to normalise (TODO29.a §5.12).
 */
const createCompound = (kind, args) => canonicalTerm(compoundOf(kind, args));
const negation = (term) => createCompound('negation', [term]);
const canonicalCtors = {};
for (const kind of Object.keys(rawCompoundCtors)) {
    canonicalCtors[kind] = (...args) => createCompound(kind, args);
}
export const TermBuilder = {
    atom: atomOf,
    ...canonicalCtors,
    compound: (kind, args) => createCompound(kind, args),
    // Peggy parser compatibility aliases
    create: (kind, args) => createCompound(kind, args),
    setExt: (...components) => createCompound('setExt', components),
    setInt: (...components) => createCompound('setInt', components),
    inheritance: (subj, pred) => {
        if (containsSubterm(subj, pred) || containsSubterm(pred, subj)) {
            return undefined;
        }
        return createCompound('inheritance', [subj, pred]);
    },
    negation,
    delta: negation, // Narsese's delta is a negation
    evict: evictTerm,
    clear: clearTerms,
    get size() {
        return termCacheSize();
    },
};
export const TermFactory = TermBuilder;
export const atom = TermBuilder.atom;
