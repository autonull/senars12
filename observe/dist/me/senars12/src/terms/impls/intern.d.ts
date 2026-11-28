import type { AtomicTerm, OperatorKey, Term } from '../types.ts';
export declare const atomOf: (symbol: string) => AtomicTerm;
export declare const isBoolAtom: (term: Term) => boolean;
/**
 * The interning constructor, deliberately **raw**: it sorts, collapses and keys,
 * and it does not canonicalise. Canonicalisation lives one level up in
 * `factory.ts`, so a reducer can rebuild its own output here without re-entering
 * the reducer pipeline — a cycle the fixpoint in `canonicalTerm` cannot survive.
 */
export declare const compoundOf: (kind: OperatorKey, args: Term[]) => Term;
export declare const rawCompoundCtors: Record<"conjunction" | "disjunction" | "equivalence" | "implication" | "inheritance" | "negation" | "operation" | "parallel" | "predictive" | "product" | "retrospective" | "sequence" | "setExt" | "setInt" | "similarity", (...args: Term[]) => Term>;
export declare const evictTerm: (key: string) => boolean;
export declare const clearTerms: () => void;
export declare const termCacheSize: () => number;
//# sourceMappingURL=intern.d.ts.map