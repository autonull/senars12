import { type EqualityDialect } from '@senars/util/unify';
import type { AtomicTerm, CompoundTerm, OperatorKey, Term } from '../types.ts';
import { type OPERATORS } from '../types.ts';
export declare const isType: <K extends OperatorKey>(k: K, t: Term) => t is CompoundTerm<K>;
export declare const isInheritance: (t: Term) => t is CompoundTerm<"inheritance">;
export declare const isSimilarity: (t: Term) => t is CompoundTerm<"similarity">;
export declare const isImplication: (t: Term) => t is CompoundTerm<"implication">;
export declare const isEquivalence: (t: Term) => t is CompoundTerm<"equivalence">;
export declare const isConjunction: (t: Term) => t is CompoundTerm<"conjunction">;
export declare const isDisjunction: (t: Term) => t is CompoundTerm<"disjunction">;
export declare const isNegation: (t: Term) => t is CompoundTerm<"negation">;
export declare const isSequence: (t: Term) => t is CompoundTerm<"sequence">;
export declare const isPredictive: (t: Term) => t is CompoundTerm<"predictive">;
export declare const isSetExt: (t: Term) => t is CompoundTerm<"setExt">;
export declare const isSetInt: (t: Term) => t is CompoundTerm<"setInt">;
export declare const isOperation: (t: Term) => t is CompoundTerm<"operation">;
/**
 * The kinds whose argument list is exactly a pair, derived from the operator
 * table rather than listed here — a second list of binary kinds is a list that
 * does not learn about a new operator.
 */
export type BinaryKind = {
    [K in OperatorKey]: (typeof OPERATORS)[K]['arity'] extends 2 ? K : never;
}[OperatorKey];
/**
 * A unary term's own argument, or `undefined` when `term` is not `kind`.
 *
 * The {@link binaryOf} counterpart, for the same reason: `isNegation(t)` says
 * the kind and `t.args[0]` says the argument, and a rule that needs both wrote
 * the first as a guard for the second. A negation built outside the factory can
 * carry no argument at all, so the arity check is real.
 */
export declare const unaryOf: <K extends UnaryKind>(kind: K, term: Term) => Term | undefined;
/** An unpacked binary term: argument zero, then argument one. */
export type TermPair = readonly [Term, Term];
/** The kinds whose argument list is exactly one, from the same operator table. */
export type UnaryKind = {
    [K in OperatorKey]: (typeof OPERATORS)[K]['arity'] extends 1 ? K : never;
}[OperatorKey];
/**
 * A term's arguments, for a term that is not known to be a compound.
 *
 * The one place `kind === 'atom' ? … : term.args` is spelled. It was spelled three
 * ways — as `getTermArgs`, as `getArgs`, as `reduce.ts`'s `argsOf` — plus a dozen
 * inline copies, and the three disagreed about what an atom has: `undefined`,
 * the empty list, or a *fresh* empty list allocated per call, which every
 * reducer asking an atom for its arguments paid for. An atom has no arguments,
 * so the empty list is the whole answer, and a frozen singleton says so.
 */
export declare const getArgs: (term: Term) => readonly Term[];
/**
 * A binary term's own argument list as a pair, or `undefined` when `term` is not
 * `kind` or does not carry both arguments.
 *
 * The kind guard, the arity check and the unpack, once. Reading a binary term
 * positionally is otherwise three statements — `if (t.kind !== 'implication')`,
 * `const [a, c] = t.args`, `if (!a || !c)` — and the third restates the first: a
 * term that passed the kind guard still has to be *known* to hold two arguments,
 * because `Term` admits an `args` of any length and only the factory enforces
 * the operator's arity.
 *
 * Returns the list itself rather than a fresh object, so the per-premise-pair
 * path allocates nothing. For an inheritance the pair reads `(subject,
 * predicate)` and for an implication `(antecedent, consequent)`; the role
 * accessors below name the same two slots one at a time.
 */
export declare const binaryOf: <K extends BinaryKind>(kind: K, term: Term) => TermPair | undefined;
export declare const getSubject: (term: Term) => Term | undefined;
export declare const getPredicate: (term: Term) => Term | undefined;
export declare const getAntecedent: (term: Term) => Term | undefined;
export declare const getConsequent: (term: Term) => Term | undefined;
/**
 * `term`'s subject and predicate together — the pair form of {@link getSubject}
 * and {@link getPredicate}, over the two kinds that carry both roles.
 *
 * The pair, not the accessors, because a rule that matches on *both* roles used
 * to read them one at a time and then check both were present, which is the same
 * guard spelled twice. It is also the only reader that cannot guess wrong about
 * kind: the dispatch cell for these rules is `inheritance`/`similarity`, so the
 * same body serves `S--P, P<->Q` and `S--P, P--Q` without naming which kind the
 * second premise was.
 */
export declare const rolePair: (term: Term) => TermPair | undefined;
export declare const sameKind: (a: Term, b: Term) => boolean;
/** How a structural comparison reads a Narsese term. */
export declare const TERM_EQUALITY: EqualityDialect<Term>;
/**
 * Structural term equality. `undefined` is accepted so optional-arg probes need no guard.
 *
 * Terms are interned, so this is usually the identity test one line up; the walk
 * exists for the terms that were built outside the factory.
 */
export declare const termsEqual: (a: Term | undefined, b: Term | undefined) => boolean;
export type TermWalkOrder = 'pre-order' | 'post-order';
/**
 * The single term-tree walk. `fn` receives depth from the root and may return
 * `false` to prune that node's subtree; `'post-order'` visits children first.
 */
export declare const walkTerms: (term: Term, fn: (t: Term, depth: number) => boolean | void, order?: TermWalkOrder, depth?: number) => void;
export declare const visitTerms: (term: Term, fn: (t: Term) => void) => void;
/** Depth-first pre-order fold in visit order. */
export declare const foldTerm: <T>(term: Term, fn: (acc: T, t: Term) => T, initial: T) => T;
/** Deepest nesting below the root; a bare atom has depth 0. */
export declare const termDepth: (term: Term) => number;
/** Node count including the root. */
export declare const termSize: (term: Term) => number;
/** An atom's key without building the term — the read side of `termKey` for callers holding a symbol. */
export declare const atomKey: (symbol: string) => string;
/** Canonical structural key for a term — the single identity used for maps, memoization, and link ids. */
export declare const termKey: (term: Term) => string;
export declare const atomicSymbols: (term: Term) => ReadonlySet<string>;
export declare const atomicTerms: (term: Term) => readonly AtomicTerm[];
export declare const containsSubterm: (term: Term, target: Term) => boolean;
export declare const sharesSymbol: (a: Term, b: Term) => boolean;
export declare const mentionsSymbol: (term: Term, symbol: string) => boolean;
export declare const hasRepeatedArgs: (term: Term) => boolean;
export declare const hasNegatedPair: (term: Term) => boolean;
export declare const hasVariable: (term: Term) => boolean;
/** The two symbols of a bare `a --> b` pair. */
export interface BareInheritance {
    readonly subject: string;
    readonly predicate: string;
}
export declare const bareInheritancePair: (term: Term) => BareInheritance | null;
/** True when the two terms mention a bare inheritance pair sharing an end. */
export declare const sharesInheritanceEnd: (a: Term, b: Term) => boolean;
//# sourceMappingURL=accessors.d.ts.map