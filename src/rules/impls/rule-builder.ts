/**
 * The rule builders a NAL body is written in: premise unpacking, the n-ary fold,
 * and the two conversions.
 *
 * One module because they are one vocabulary. They were split across `builders.ts`
 * and `rule-builder.ts` by which rule file happened to need them first, so a rule
 * that unpacked two implications had to know that the implication builder lived
 * under the other name.
 */
import { uniqueBy } from '@senars/util';
import type { Term } from '../../terms';
import {
  type BinaryKind,
  binaryOf,
  getArgs,
  isAtomic,
  rolePair,
  TermBuilder,
  type TermPair,
  TermSet,
  termKey,
  termsEqual,
  unaryOf,
  walkTerms,
} from '../../terms';
import type { RuleFn, RuleInput } from '../types.js';

/** What a two-premise body concludes from: each premise's roles, then the inputs. */
export type PairDerive = (
  left: TermPair,
  right: TermPair,
  inputs?: [RuleInput, RuleInput]
) => Term | undefined;

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
export const buildPairRule =
  ([leftKind, rightKind]: [BinaryKind, BinaryKind], derive: PairDerive): RuleFn =>
  ([t1, t2], inputs) => {
    const left = binaryOf(leftKind, t1);
    const right = binaryOf(rightKind, t2);
    return left && right ? derive(left, right, inputs) : undefined;
  };

/**
 * A rule over two premises whose kinds the dispatch cell does not pin — the
 * `inheritance`-or-`similarity` role pair. Both premise guards happen here, so a
 * body reads as its equation; `rolePair` is the terms package's own answer to
 * which kinds carry both roles.
 */
export const buildRolePairRule =
  (derive: (left: TermPair, right: TermPair) => Term | undefined): RuleFn =>
  ([t1, t2]) => {
    const left = rolePair(t1);
    const right = rolePair(t2);
    return left && right ? derive(left, right) : undefined;
  };

/** A binary inheritance rule: one function over the two premises' subject and predicate. */
export const buildBinaryInhRule = (derive: PairDerive): RuleFn =>
  buildPairRule(['inheritance', 'inheritance'], derive);

/** A unary inheritance rule, over the one premise's subject and predicate. */
export const buildInhRule =
  (derive: (pair: TermPair) => Term | undefined): RuleFn =>
  ([term]) => {
    const pair = binaryOf('inheritance', term);
    return pair ? derive(pair) : undefined;
  };

/**
 * A rule over two implications, handed their four ends.
 *
 * One callback, not a validator and a builder: the higher-order rules differ
 * only in *which* end pair has to match, so each of the three bodies below reads
 * as the one equation it is.
 */
export const buildImplicationPairRule =
  (derive: (left: TermPair, right: TermPair) => Term | undefined): RuleFn =>
  buildPairRule(['implication', 'implication'], derive);

/**
 * A rule pairing one premise's role pair with the other's single argument — an
 * inheritance against a one-argument set. The two guards are different shapes
 * (`binaryOf` on the left, `unaryOf` on the right), so this is the one pair shape
 * {@link buildPairRule} cannot express; the duplication it removes is the same
 * `if (!ends) … if (!member) …` preamble the two instance/property rules shared.
 */
export const buildSetMemberRule =
  (typeKind: 'setExt' | 'setInt') =>
  (derive: (ends: TermPair, member: Term) => Term | undefined): RuleFn =>
  ([inh, term]) => {
    const ends = binaryOf('inheritance', inh);
    const member = unaryOf(typeKind, term);
    return ends && member ? derive(ends, member) : undefined;
  };

/**
 * Intersect (`unique: false`) or union (`unique: true`) the argument lists of two
 * same-kind n-ary terms. Membership and dedup go through `termKey`, the
 * canonical structural identity — an O(n+m) keyed fold instead of a quadratic
 * structural comparison on the per-pair derivation path. The serialized form
 * cannot stand in for it: `serializeTerm` collapses a 1-argument n-ary term to
 * its argument, so `(a ,/)` and `a` share a `toString()` and one argument of the
 * union would be dropped.
 */
export const foldNary = (kind: Term['kind'], unique = false): RuleFn => {
  return ([t1, t2]: [Term, Term]): Term | undefined => {
    if (t1.kind !== kind || t2.kind !== kind) return undefined;
    const a1 = getArgs(t1);
    const a2 = getArgs(t2);
    let args: Term[];
    if (unique) {
      args = uniqueBy([...a1, ...a2], termKey);
    } else {
      const rhs = new TermSet();
      for (const arg of a2) rhs.add(arg);
      args = a1.filter((x) => rhs.has(x));
    }
    return args.length > 0
      ? kind === 'conjunction'
        ? TermBuilder.conjunction(...args)
        : TermBuilder.disjunction(...args)
      : undefined;
  };
};

export const conversionRule = (wrap: (t: Term) => Term) =>
  buildInhRule(([subject, predicate]) => TermBuilder.inheritance(wrap(subject), wrap(predicate)));

export const buildSequenceRule = (builder: (p1: Term, p2: Term) => Term) =>
  buildBinaryInhRule(([s1, p1], [s2, p2], inputs) => {
    if (inputs && inputs[0].occurrenceTime >= inputs[1].occurrenceTime) return undefined;
    return termsEqual(s1, s2) ? TermBuilder.inheritance(s1, builder(p1, p2)) : undefined;
  });

/**
 * `S--P` against a one-argument set, converting the matched end and swapping it
 * into the position the set occupies — `{P} ⊢ S--P` for `matchOn: 'predicate'`.
 */
export const deductionFromType =
  (typeKind: 'setExt' | 'setInt', matchOn: 'subject' | 'predicate'): RuleFn =>
  buildSetMemberRule(typeKind)(([subject, predicate], member) => {
    if (!termsEqual(matchOn === 'subject' ? subject : predicate, member)) return undefined;
    return matchOn === 'subject'
      ? TermBuilder.inheritance(member, predicate)
      : TermBuilder.inheritance(subject, member);
  });

/**
 * Every variable atom in the term's subtree, in pre-order.
 *
 * The walk is `walkTerms` — the single term traversal — rather than a private
 * recursion, so a new `Term` kind is covered here the moment the accessor
 * covers it instead of silently falling out of this walk.
 */
export const getVars = (term: Term): Term[] => {
  const vars: Term[] = [];
  walkTerms(term, (t) => {
    if (isAtomic(t) && t.isVariable) vars.push(t);
  });
  return vars;
};

/**
 * The NAL rules' short names for the per-kind guards — renamed re-exports, not a
 * second table. These eleven were built by a local `termGuard` narrowing with
 * `Extract<Term, {kind: K}>`; the rules read the short names in a rule pattern,
 * so the spelling stays and the guard is the terms package's.
 */
export {
  isConjunction as conj,
  isDisjunction as disj,
  isImplication as imp,
  isInheritance as inh,
  isNegation as neg,
  isOperation as op,
  isPredictive as pred,
  isSequence as seq,
  isSetExt as setExt,
  isSetInt as setInt,
  isSimilarity as sim,
} from '../../terms';

export const builders = {
  unary:
    <T>(guard: (t: Term) => boolean, transform: (t: Term) => T | undefined) =>
    (term: Term): T | undefined =>
      guard(term) ? transform(term) : undefined,

  binary:
    <T>(guard: (t1: Term, t2: Term) => boolean, transform: (t1: Term, t2: Term) => T | undefined) =>
    (t1: Term, t2: Term): T | undefined =>
      guard(t1, t2) ? transform(t1, t2) : undefined,

  chain:
    <T>(...fns: ((t: Term) => T | undefined)[]) =>
    (term: Term): T | undefined =>
      fns.reduce((acc, fn) => acc ?? fn(term), undefined as T | undefined),
} as const;
