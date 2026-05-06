import type { Term } from '../terms/index.js';
import { RuleRegistry, createRulePattern } from './types.js';
import { getSubject, getPredicate, sameHash } from '../terms/accessors.js';

const makeInh = (s: Term, p: Term): Term =>
  ({ kind: 'inheritance', args: [s, p], hash: 0 } as Term);

export const NALRules = {
  deduction: ([aToM, mToB]: [Term, Term]): Term | undefined => {
    if (aToM.kind !== 'inheritance' || mToB.kind !== 'inheritance') return undefined;
    const middleA = getSubject(mToB);
    const middleB = getPredicate(aToM);
    if (!middleA || !middleB || !sameHash(middleA, middleB)) return undefined;
    const s = getSubject(aToM);
    const p = getPredicate(mToB);
    return s && p ? makeInh(s, p) : undefined;
  },

  induction: ([sToM, mToB]: [Term, Term]): Term | undefined => {
    if (sToM.kind !== 'inheritance' || mToB.kind !== 'inheritance') return undefined;
    const middleS = getPredicate(sToM);
    const middleM = getSubject(mToB);
    if (!middleS || !middleM || !sameHash(middleS, middleM)) return undefined;
    const s = getSubject(sToM);
    const p = getPredicate(mToB);
    return s && p ? makeInh(s, p) : undefined;
  },

  abduction: ([aToM, sToB]: [Term, Term]): Term | undefined => {
    if (aToM.kind !== 'inheritance' || sToB.kind !== 'inheritance') return undefined;
    const middleA = getSubject(aToM);
    const middleS = getSubject(sToB);
    if (!middleA || !middleS || !sameHash(middleA, middleS)) return undefined;
    const p = getPredicate(aToM);
    const s = getSubject(sToB);
    return p && s ? makeInh(s, p) : undefined;
  },

  similarity: ([aToB, bToA]: [Term, Term]): Term | undefined => {
    if (aToB.kind !== 'inheritance' || bToA.kind !== 'inheritance') return undefined;
    const s1 = getSubject(aToB), p1 = getPredicate(aToB);
    const s2 = getSubject(bToA), p2 = getPredicate(bToA);
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    const sim = (sameHash(s1, s2) && sameHash(p1, p2)) || (sameHash(s1, p2) && sameHash(p1, s2));
    return sim ? { kind: 'similarity', args: [s1, p1], hash: 0 } as Term : undefined;
  },

  contrapositive: ([imp, inh]: [Term, Term]): Term | undefined => {
    if (imp.kind !== 'implication' || inh.kind !== 'inheritance') return undefined;
    const [ante, cons] = imp.args;
    const sub = getSubject(inh);
    if (!ante || !cons || !sub || !sameHash(ante, sub)) return undefined;
    const consequent = inh.args[1];
    return consequent ? { kind: 'implication', args: [consequent, cons], hash: 0 } as Term : undefined;
  },

  intersection: ([c1, c2]: [Term, Term]): Term | undefined => {
    if (c1.kind !== 'conjunction' || c2.kind !== 'conjunction') return undefined;
    const shared = c1.args.filter(a1 => c2.args.some(a2 => sameHash(a1, a2)));
    return shared.length > 0 ? { kind: 'conjunction', args: shared, hash: 0 } as Term : undefined;
  },

  union: ([d1, d2]: [Term, Term]): Term | undefined => {
    if (d1.kind !== 'disjunction' || d2.kind !== 'disjunction') return undefined;
    const unique = [...d1.args, ...d2.args].filter((a, i, arr) =>
      arr.findIndex(b => sameHash(a, b)) === i
    );
    return { kind: 'disjunction', args: unique, hash: 0 } as Term;
  },

  conjunctionIntro: ([i1, i2]: [Term, Term]): Term | undefined => {
    if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') return undefined;
    const s1 = getSubject(i1), p1 = getPredicate(i1);
    const s2 = getSubject(i2), p2 = getPredicate(i2);
    if (!s1 || !p1 || !s2 || !p2 || !sameHash(s1, s2)) return undefined;
    return { kind: 'conjunction', args: [p1, p2], hash: 0 } as Term;
  },

  disjunctionIntro: ([a1, a2]: [Term, Term]): Term | undefined =>
    a1.kind === 'atom' && a2.kind === 'atom'
      ? { kind: 'disjunction', args: [a1, a2], hash: 0 } as Term
      : undefined,

  implicationIntro: ([inh, neg]: [Term, Term]): Term | undefined => {
    if (inh.kind !== 'inheritance' || neg.kind !== 'negation') return undefined;
    const sub = getSubject(inh), pred = getPredicate(inh);
    return sub && pred ? { kind: 'implication', args: [sub, pred], hash: 0 } as Term : undefined;
  },

  implicationElim: ([imp, atm]: [Term, Term]): Term | undefined => {
    if (imp.kind !== 'implication' || atm.kind !== 'atom') return undefined;
    const [ante, cons] = imp.args;
    return ante && sameHash(ante, atm) ? cons : undefined;
  },

  equivalenceIntro: ([imp1, imp2]: [Term, Term]): Term | undefined => {
    if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
    const [a1, c1] = imp1.args;
    const [a2, c2] = imp2.args;
    if (!a1 || !c1 || !a2 || !c2) return undefined;
    const forward = sameHash(a1, a2) && sameHash(c1, c2);
    const back = sameHash(a1, c2) && sameHash(c1, a2);
    return forward || back ? { kind: 'equivalence', args: [a1, c1], hash: 0 } as Term : undefined;
  },

  equivalenceElim: ([eq, atm]: [Term, Term]): Term | undefined => {
    if (eq.kind !== 'equivalence' || atm.kind !== 'atom') return undefined;
    const [a, c] = eq.args;
    if (!a || !c) return undefined;
    return sameHash(a, atm) || sameHash(c, atm) ? c : undefined;
  },

  negationIntro: ([imp1, imp2]: [Term, Term]): Term | undefined => {
    if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
    const [a1, c1] = imp1.args;
    const [a2, c2] = imp2.args;
    if (!a1 || !c1 || !a2 || !c2) return undefined;
    const isContradiction =
      sameHash(a1, a2) &&
      c1.kind === 'atom' &&
      c2.kind === 'atom' &&
      c1.symbol === 'TRUE' &&
      c2.symbol === 'FALSE';
    return isContradiction ? { kind: 'negation', args: [a1], hash: 0 } as Term : undefined;
  },

  negationElim: ([n1, n2]: [Term, Term]): Term | undefined => {
    if (n1.kind !== 'negation' || n2.kind !== 'negation') return undefined;
    const [a1] = n1.args;
    const [a2] = n2.args;
    if (!a1 || !a2 || !sameHash(a1, a2)) return undefined;
    return { kind: 'atom', symbol: 'FALSE', hash: 0 } as Term;
  },

  destruct: ([conj, atm]: [Term, Term]): Term | undefined =>
    conj.kind === 'conjunction' && atm.kind === 'atom'
      ? conj.args.find(a => sameHash(a, atm))
      : undefined,

  compose: ([i1, i2]: [Term, Term]): Term | undefined => {
    if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') return undefined;
    const p1 = getPredicate(i1), s2 = getSubject(i2);
    if (!p1 || !s2 || !sameHash(p1, s2)) return undefined;
    const s = getSubject(i1), p = getPredicate(i2);
    return s && p ? makeInh(s, p) : undefined;
  },

  decompose: ([c1, c2]: [Term, Term]): Term | undefined => {
    if (c1.kind !== 'conjunction' || c2.kind !== 'conjunction') return undefined;
    const shared = c1.args.filter(a1 => c2.args.some(a2 => sameHash(a1, a2)));
    return shared[0];
  },

  revision: ([i1, i2]: [Term, Term]): Term | undefined => {
    if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') return undefined;
    const s1 = getSubject(i1), p1 = getPredicate(i1);
    const s2 = getSubject(i2), p2 = getPredicate(i2);
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    return sameHash(s1, s2) && sameHash(p1, p2) ? i1 : undefined;
  }
};

const registerRule = (id: string, left: string, right: string, fn: any, priority: number) =>
  RuleRegistry.register({ id, pattern: createRulePattern(left, right), apply: fn as any, sync: true, priority });

registerRule('nal.deduction', 'inheritance', 'inheritance', NALRules.deduction, 1.0);
registerRule('nal.induction', 'inheritance', 'inheritance', NALRules.induction, 0.9);
registerRule('nal.abduction', 'inheritance', 'inheritance', NALRules.abduction, 0.8);
registerRule('nal.similarity', 'inheritance', 'inheritance', NALRules.similarity, 0.95);
registerRule('nal.contrapositive', 'implication', 'inheritance', NALRules.contrapositive, 0.7);
registerRule('nal.intersection', 'conjunction', 'conjunction', NALRules.intersection, 0.85);
registerRule('nal.union', 'disjunction', 'disjunction', NALRules.union, 0.8);
registerRule('nal.conjunctionIntro', 'inheritance', 'inheritance', NALRules.conjunctionIntro, 0.75);
registerRule('nal.disjunctionIntro', 'atom', 'atom', NALRules.disjunctionIntro, 0.7);
registerRule('nal.implicationIntro', 'inheritance', 'negation', NALRules.implicationIntro, 0.8);
registerRule('nal.implicationElim', 'implication', 'atom', NALRules.implicationElim, 0.9);
registerRule('nal.equivalenceIntro', 'implication', 'implication', NALRules.equivalenceIntro, 0.85);
registerRule('nal.equivalenceElim', 'equivalence', 'atom', NALRules.equivalenceElim, 0.9);
registerRule('nal.negationIntro', 'implication', 'implication', NALRules.negationIntro, 0.75);
registerRule('nal.negationElim', 'negation', 'negation', NALRules.negationElim, 0.8);
registerRule('nal.destruct', 'conjunction', 'atom', NALRules.destruct, 0.85);
registerRule('nal.compose', 'inheritance', 'inheritance', NALRules.compose, 0.7);
registerRule('nal.decompose', 'conjunction', 'conjunction', NALRules.decompose, 0.8);
registerRule('nal.revision', 'inheritance', 'inheritance', NALRules.revision, 0.6);