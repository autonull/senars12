/**
 * Rule result builders shared across NAL rule definitions.
 */
import { uniqueBy } from '@senars/util';
import type { Term } from '../../terms';
import {
  binaryOf,
  getArgs,
  TermBuilder,
  type TermPair,
  TermSet,
  termKey,
  termsEqual,
  unaryOf,
} from '../../terms';
import type { RuleFn } from '../types.js';
import { buildBinaryInhRule, buildInhRule } from './rule-builder.js';

/**
 * A rule over two implications, handed their four ends.
 *
 * One callback, not a validator and a builder: the higher-order rules differ
 * only in *which* end pair has to match, so each of the three bodies below reads
 * as the one equation it is.
 */
export const buildImplicationPairRule =
  (derive: (left: TermPair, right: TermPair) => Term | undefined): RuleFn =>
  ([imp1, imp2]) => {
    const left = binaryOf('implication', imp1);
    const right = binaryOf('implication', imp2);
    return left && right ? derive(left, right) : undefined;
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
  (typeKind: 'setExt' | 'setInt', matchOn: 'subject' | 'predicate') =>
  ([inh, term]: [Term, Term]): Term | undefined => {
    const ends = binaryOf('inheritance', inh);
    if (!ends) return undefined;
    const [subject, predicate] = ends;
    const member = unaryOf(typeKind, term);
    if (!member || !termsEqual(matchOn === 'subject' ? subject : predicate, member))
      return undefined;
    return matchOn === 'subject'
      ? TermBuilder.inheritance(member, predicate)
      : TermBuilder.inheritance(subject, member);
  };
