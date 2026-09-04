/**
 * Rule result builders shared across NAL rule definitions.
 */
import type { Term } from '../terms';
import { getPredicate, getSubject, TermBuilder, termsEqual } from '../terms';
import { ID, sameSubject } from './extractors.js';
import { buildBinaryInhRule, buildInhRule } from './rule-builder.js';
import type { RuleFn } from './types.js';

export const buildDeduction = (left: Term, right: Term): Term | undefined => {
  const s = getSubject(left),
    p = getPredicate(right);
  if (!s || !p) return undefined;
  const result = TermBuilder.inheritance(s, p);
  return result ?? undefined;
};

export const buildInduction = (left: Term, right: Term): Term | undefined => {
  const p1 = getPredicate(left),
    p2 = getPredicate(right);
  if (!p1 || !p2) return undefined;
  const result = TermBuilder.inheritance(p1, p2);
  return result ?? undefined;
};

export const buildAbduction = (left: Term, right: Term): Term | undefined => {
  const s1 = getSubject(left),
    s2 = getSubject(right);
  if (!s1 || !s2) return undefined;
  const result = TermBuilder.inheritance(s1, s2);
  return result ?? undefined;
};

export const buildHigherOrderRule =
  (
    linkValidator: (a1: Term, c1: Term, a2: Term, c2: Term) => boolean,
    resultBuilder: (a1: Term, c1: Term, a2: Term, c2: Term) => Term | undefined
  ): RuleFn =>
  ([imp1, imp2]) => {
    if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
    const [a1, c1] = imp1.args,
      [a2, c2] = imp2.args;
    if (!a1 || !c1 || !a2 || !c2) return undefined;
    return linkValidator(a1, c1, a2, c2) ? resultBuilder(a1, c1, a2, c2) : undefined;
  };

export const foldNary = (
  kind: Term['kind'],
  eq: (a1: Term, a2: Term) => boolean,
  unique = false
): RuleFn => {
  return ([t1, t2]: [Term, Term]): Term | undefined => {
    if (t1.kind !== kind || t2.kind !== kind) return undefined;
    const a1 = t1.args!,
      a2 = t2.args!;
    const args = unique
      ? [...a1, ...a2].filter((a, i, arr) => arr.findIndex((b) => eq(a, b)) === i)
      : a1.filter((x) => a2.some((y) => eq(x, y)));
    return args.length > 0
      ? kind === 'conjunction'
        ? TermBuilder.conjunction(...args)
        : TermBuilder.disjunction(...args)
      : undefined;
  };
};

export const conversionRule = (wrap: (t: Term) => Term) =>
  buildInhRule(ID, (inh) => {
    const s = getSubject(inh),
      p = getPredicate(inh);
    return s && p ? TermBuilder.inheritance(wrap(s), wrap(p)) : undefined;
  });

export const buildSequenceRule = (builder: (p1: Term, p2: Term) => Term) =>
  buildBinaryInhRule(sameSubject, (inh1, inh2) => {
    const s = getSubject(inh1);
    const p1 = getPredicate(inh1),
      p2 = getPredicate(inh2);
    return s && p1 && p2 ? TermBuilder.inheritance(s, builder(p1, p2)) : undefined;
  });

export const deductionFromType =
  (typeKind: 'instance' | 'property', matchOn: 'subject' | 'predicate') =>
  ([inh, term]: [Term, Term]): Term | undefined => {
    if (inh.kind !== 'inheritance' || term.kind !== typeKind) return undefined;
    const s = getSubject(inh),
      p = getPredicate(inh);
    const arg = term.args[0];
    if (!s || !p || !arg) return undefined;
    return termsEqual(matchOn === 'subject' ? s : p, arg)
      ? TermBuilder.inheritance(matchOn === 'subject' ? arg : s, matchOn === 'subject' ? p : arg)
      : undefined;
  };
