import type { Term } from '../../terms';
import { type BinaryKind, type TermPair } from '../../terms';
import type { RuleFn, RuleInput } from '../types';
/** What a two-premise body concludes from: each premise's roles, then the inputs. */
export type PairDerive = (left: TermPair, right: TermPair, inputs?: [RuleInput, RuleInput]) => Term | undefined;
/**
 * A rule over two premises of *declared* kinds, handed their role pairs.
 *
 * The one place a rule body is unpacked. Every NAL rule that reads both premises
 * as a subject/predicate pair went through this, written four times over
 * (`buildBinaryInhRule` for two inheritances, `buildImplicationPairRule` for two
 * implications, and the `binaryOf`-pair preamble inlined by the sequence,
 * operation, predictive, equivalence and propositional bodies). Each copy opened
 * with the same kind guard and the same `if (!left || !right) return undefined`,
 * which is a body stating what it concludes having first re-asked whether its
 * premises were the shape it was already dispatched for.
 *
 * The kinds are parameters rather than four names because a body that says
 * `['sequence', 'operation']` says what its premises are, where `buildSequenceOpRule`
 * would say it in the name and hide the kinds from the reader. The three wrappers
 * below are the readings that recur; anything else names its kinds.
 */
export declare const buildPairRule: ([leftKind, rightKind]: [BinaryKind, BinaryKind], derive: PairDerive) => RuleFn;
/**
 * A rule over two premises whose kinds the dispatch cell does not pin — the
 * `inheritance`-or-`similarity` role pair. Both premise guards happen here, so a
 * body reads as its equation; `rolePair` is the terms package's own answer to
 * which kinds carry both roles.
 */
export declare const buildRolePairRule: (derive: (left: TermPair, right: TermPair) => Term | undefined) => RuleFn;
/** A binary inheritance rule: one function over the two premises' subject and predicate. */
export declare const buildBinaryInhRule: (derive: PairDerive) => RuleFn;
/** A unary inheritance rule, over the one premise's subject and predicate. */
export declare const buildInhRule: (derive: (pair: TermPair) => Term | undefined) => RuleFn;
/**
 * A rule over two implications, handed their four ends.
 *
 * One callback, not a validator and a builder: the higher-order rules differ
 * only in *which* end pair has to match, so each of the three bodies below reads
 * as the one equation it is.
 */
export declare const buildImplicationPairRule: (derive: (left: TermPair, right: TermPair) => Term | undefined) => RuleFn;
/**
 * A rule pairing one premise's role pair with the other's single argument — an
 * inheritance against a one-argument set. The two guards are different shapes
 * (`binaryOf` on the left, `unaryOf` on the right), so this is the one pair shape
 * {@link buildPairRule} cannot express; the duplication it removes is the same
 * `if (!ends) … if (!member) …` preamble the two instance/property rules shared.
 */
export declare const buildSetMemberRule: (typeKind: 'setExt' | 'setInt') => (derive: (ends: TermPair, member: Term) => Term | undefined) => RuleFn;
/**
 * Intersect (`unique: false`) or union (`unique: true`) the argument lists of two
 * same-kind n-ary terms. Membership and dedup go through `termKey`, the
 * canonical structural identity — an O(n+m) keyed fold instead of a quadratic
 * structural comparison on the per-pair derivation path. The serialized form
 * cannot stand in for it: `serializeTerm` collapses a 1-argument n-ary term to
 * its argument, so `(a ,/)` and `a` share a `toString()` and one argument of the
 * union would be dropped.
 */
export declare const foldNary: (kind: Term['kind'], unique?: boolean) => RuleFn;
export declare const conversionRule: (wrap: (t: Term) => Term) => RuleFn;
export declare const buildSequenceRule: (builder: (p1: Term, p2: Term) => Term) => RuleFn;
/**
 * `S--P` against a one-argument set, converting the matched end and swapping it
 * into the position the set occupies — `{P} ⊢ S--P` for `matchOn: 'predicate'`.
 */
export declare const deductionFromType: (typeKind: 'setExt' | 'setInt', matchOn: 'subject' | 'predicate') => RuleFn;
/**
 * Every variable atom in the term's subtree, in pre-order.
 *
 * The walk is `walkTerms` — the single term traversal — rather than a private
 * recursion, so a new `Term` kind is covered here the moment the accessor
 * covers it instead of silently falling out of this walk.
 */
export declare const getVars: (term: Term) => Term[];
/**
 * The NAL rules' short names for the per-kind guards — renamed re-exports, not a
 * second table. These eleven were built by a local `termGuard` narrowing with
 * `Extract<Term, {kind: K}>`; the rules read the short names in a rule pattern,
 * so the spelling stays and the guard is the terms package's.
 */
export { isConjunction as conj, isDisjunction as disj, isImplication as imp, isInheritance as inh, isNegation as neg, isOperation as op, isPredictive as pred, isSequence as seq, isSetExt as setExt, isSetInt as setInt, isSimilarity as sim, } from '../../terms';
export declare const builders: {
    readonly unary: <T>(guard: (t: Term) => boolean, transform: (t: Term) => T | undefined) => (term: Term) => T | undefined;
    readonly binary: <T>(guard: (t1: Term, t2: Term) => boolean, transform: (t1: Term, t2: Term) => T | undefined) => (t1: Term, t2: Term) => T | undefined;
    readonly chain: <T>(...fns: ((t: Term) => T | undefined)[]) => (term: Term) => T | undefined;
};
//# sourceMappingURL=rule-builder.d.ts.map