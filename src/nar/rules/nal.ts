import type {Term} from '../terms';
import {getPredicate, getSubject, TermBuilder, termsEqual, Truth} from '../terms';
import {
    abductionLink,
    buildAbduction,
    buildDeduction,
    buildInduction,
    deductionLink,
    inductionLink,
    syllogize
} from './nal-helpers.js';
import {registerRule} from './shared.js';

export interface NALRuleMetadata {
  id: string;
  name: string;
  description: string;
  nalLevel: number;
  category: 'inference' | 'transformation' | 'comparison' | 'revision';
}

export const NALRules = {
  deduction: syllogize({
    leftKind: 'inheritance',
    rightKind: 'inheritance',
    link: deductionLink,
    build: buildDeduction
  }),

  induction: syllogize({
    leftKind: 'inheritance',
    rightKind: 'inheritance',
    link: inductionLink,
    build: buildInduction
  }),

  abduction: syllogize({
    leftKind: 'inheritance',
    rightKind: 'inheritance',
    link: abductionLink,
    build: buildAbduction
  }),

  similarity: syllogize({
    leftKind: 'inheritance',
    rightKind: 'inheritance',
    link: (l, r) => {
      const s1 = getSubject(l), p1 = getPredicate(l);
      const s2 = getSubject(r), p2 = getPredicate(r);
      if (!s1 || !p1 || !s2 || !p2) return false;
      return (termsEqual(s1, s2) && termsEqual(p1, p2)) || (termsEqual(s1, p2) && termsEqual(p1, s2));
    },
    build: (l, _r) => {
      const s1 = getSubject(l), p1 = getPredicate(l);
      return s1 && p1 ? TermBuilder.similarity(s1, p1) : undefined;
    }
  }),

  contrapositive: ([imp, inh]: [Term, Term]): Term | undefined => {
    if (imp.kind !== 'implication' || inh.kind !== 'inheritance') return undefined;
    const [ante, cons] = imp.args;
    const sub = getSubject(inh);
    if (!ante || !cons || !sub || !termsEqual(ante, sub)) return undefined;
    const consequent = inh.args[1];
    return consequent ? TermBuilder.implication(consequent, cons) : undefined;
  },

  intersection: ([c1, c2]: [Term, Term]): Term | undefined => {
    if (c1.kind !== 'conjunction' || c2.kind !== 'conjunction') return undefined;
    const shared = c1.args.filter(a1 => c2.args.some(a2 => termsEqual(a1, a2)));
    return shared.length > 0 ? TermBuilder.conjunction(...shared) : undefined;
  },

  union: ([d1, d2]: [Term, Term]): Term | undefined => {
    if (d1.kind !== 'disjunction' || d2.kind !== 'disjunction') return undefined;
    const unique = [...d1.args, ...d2.args].filter((a, i, arr) =>
      arr.findIndex(b => termsEqual(a, b)) === i
    );
    return TermBuilder.disjunction(...unique);
  },

  conjunctionIntro: ([i1, i2]: [Term, Term]): Term | undefined => {
    if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') return undefined;
    const s1 = getSubject(i1), p1 = getPredicate(i1);
    const s2 = getSubject(i2), p2 = getPredicate(i2);
    if (!s1 || !p1 || !s2 || !p2 || !termsEqual(s1, s2)) return undefined;
    return TermBuilder.conjunction(p1, p2);
  },

  disjunctionIntro: ([a1, a2]: [Term, Term]): Term | undefined =>
    a1.kind === 'atom' && a2.kind === 'atom'
      ? TermBuilder.disjunction(a1, a2)
      : undefined,

  implicationIntro: ([inh, neg]: [Term, Term]): Term | undefined => {
    if (inh.kind !== 'inheritance' || neg.kind !== 'negation') return undefined;
    const sub = getSubject(inh), pred = getPredicate(inh);
    return sub && pred ? TermBuilder.implication(sub, pred) : undefined;
  },

  implicationElim: ([imp, atm]: [Term, Term]): Term | undefined => {
    if (imp.kind !== 'implication' || atm.kind !== 'atom') return undefined;
    const [ante, cons] = imp.args;
    return ante && termsEqual(ante, atm) ? cons : undefined;
  },

  equivalenceIntro: ([imp1, imp2]: [Term, Term]): Term | undefined => {
    if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
    const [a1, c1] = imp1.args;
    const [a2, c2] = imp2.args;
    if (!a1 || !c1 || !a2 || !c2) return undefined;
    const forward = termsEqual(a1, a2) && termsEqual(c1, c2);
    const back = termsEqual(a1, c2) && termsEqual(c1, a2);
    return forward || back ? TermBuilder.equivalence(a1, c1) : undefined;
  },

  equivalenceElim: ([eq, atm]: [Term, Term]): Term | undefined => {
    if (eq.kind !== 'equivalence' || atm.kind !== 'atom') return undefined;
    const [a, c] = eq.args;
    if (!a || !c) return undefined;
    return termsEqual(a, atm) || termsEqual(c, atm) ? c : undefined;
  },

  negationIntro: ([imp1, imp2]: [Term, Term]): Term | undefined => {
    if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
    const [a1, c1] = imp1.args;
    const [a2, c2] = imp2.args;
    if (!a1 || !c1 || !a2 || !c2) return undefined;
    const isContradiction =
      termsEqual(a1, a2) &&
      c1.kind === 'atom' &&
      c2.kind === 'atom' &&
      c1.symbol === 'TRUE' &&
      c2.symbol === 'FALSE';
    return isContradiction ? TermBuilder.negation(a1) : undefined;
  },

  negationElim: ([n1, n2]: [Term, Term]): Term | undefined => {
    if (n1.kind !== 'negation' || n2.kind !== 'negation') return undefined;
    const [a1] = n1.args;
    const [a2] = n2.args;
    if (!a1 || !a2 || !termsEqual(a1, a2)) return undefined;
    return TermBuilder.atom('FALSE');
  },

  destruct: ([conj, atm]: [Term, Term]): Term | undefined =>
    conj.kind === 'conjunction' && atm.kind === 'atom'
      ? conj.args.find(a => termsEqual(a, atm))
      : undefined,

  compose: syllogize({
    leftKind: 'inheritance',
    rightKind: 'inheritance',
    link: (l, r) => {
      const p1 = getPredicate(l), s2 = getSubject(r);
      return !!(p1 && s2 && termsEqual(p1, s2));
    },
    build: (l, r) => {
      const s = getSubject(l), p = getPredicate(r);
      return s && p ? TermBuilder.inheritance(s, p) : undefined;
    }
  }),

  decompose: ([c1, c2]: [Term, Term]): Term | undefined => {
    if (c1.kind !== 'conjunction' || c2.kind !== 'conjunction') return undefined;
    const shared = c1.args.filter(a1 => c2.args.some((a2: any) => termsEqual(a1, a2)));
    return shared[0];
  },

  revision: ([i1, i2]: [Term, Term]): Term | undefined => {
    if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') return undefined;
    const s1 = getSubject(i1), p1 = getPredicate(i1);
    const s2 = getSubject(i2), p2 = getPredicate(i2);
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    return termsEqual(s1, s2) && termsEqual(p1, p2) ? i1 : undefined;
  },

  analogy: ([inh, sim]: [Term, Term]): Term | undefined => {
    if (inh.kind !== 'inheritance' || sim.kind !== 'similarity') return undefined;
    const s1 = getSubject(inh), p1 = getPredicate(inh);
    const s2 = getSubject(sim), p2 = getPredicate(sim);
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    if (!termsEqual(p1, s2)) return undefined;
    return TermBuilder.inheritance(s1, p2);
  },

  comparison: ([inh1, inh2]: [Term, Term]): Term | undefined => {
    if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
    const s1 = getSubject(inh1), p1 = getPredicate(inh1);
    const s2 = getSubject(inh2), p2 = getPredicate(inh2);
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    if (!termsEqual(s1, s2)) return undefined;
    return TermBuilder.similarity(p1, p2);
  },

  instantiation: ([inh, sim]: [Term, Term]): Term | undefined => {
    if (inh.kind !== 'inheritance' || sim.kind !== 'similarity') return undefined;
    const s1 = getSubject(inh), p1 = getPredicate(inh);
    const s2 = getSubject(sim), p2 = getPredicate(sim);
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    if (!termsEqual(p1, p2)) return undefined;
    return TermBuilder.inheritance(s1, s2);
  },

  exemplification: ([inh1, inh2]: [Term, Term]): Term | undefined => {
    if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
    const s1 = getSubject(inh1), p1 = getPredicate(inh1);
    const s2 = getSubject(inh2), p2 = getPredicate(inh2);
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    if (!termsEqual(p1, s2)) return undefined;
    return TermBuilder.inheritance(s1, p2);
  },

  higherOrderDeduction: ([imp1, imp2]: [Term, Term]): Term | undefined => {
    if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
    const [a1, c1] = imp1.args;
    const [a2, c2] = imp2.args;
    if (!a1 || !c1 || !a2 || !c2) return undefined;
    if (!termsEqual(c1, a2)) return undefined;
    return TermBuilder.implication(a1, c2);
  },

  higherOrderAbduction: ([imp1, imp2]: [Term, Term]): Term | undefined => {
    if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
    const [a1, c1] = imp1.args;
    const [a2, c2] = imp2.args;
    if (!a1 || !c1 || !a2 || !c2) return undefined;
    if (!termsEqual(c1, c2)) return undefined;
    return TermBuilder.implication(a1, a2);
  },

  higherOrderInduction: ([imp1, imp2]: [Term, Term]): Term | undefined => {
    if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
    const [a1, c1] = imp1.args;
    const [a2, c2] = imp2.args;
    if (!a1 || !c1 || !a2 || !c2) return undefined;
    if (!termsEqual(a1, a2)) return undefined;
    return TermBuilder.implication(c1, c2);
  }
};

registerRule('nal.deduction', 'inheritance', 'inheritance', NALRules.deduction, Truth.deduction, 1.0);
registerRule('nal.induction', 'inheritance', 'inheritance', NALRules.induction, Truth.induction, 0.9);
registerRule('nal.abduction', 'inheritance', 'inheritance', NALRules.abduction, Truth.abduction, 0.8);
registerRule('nal.similarity', 'inheritance', 'inheritance', NALRules.similarity, Truth.resemblance, 0.95);
registerRule('nal.contrapositive', 'implication', 'inheritance', NALRules.contrapositive, Truth.contraposition, 0.7);
registerRule('nal.intersection', 'conjunction', 'conjunction', NALRules.intersection, Truth.intersection, 0.85);
registerRule('nal.union', 'disjunction', 'disjunction', NALRules.union, Truth.union, 0.8);
registerRule('nal.conjunctionIntro', 'inheritance', 'inheritance', NALRules.conjunctionIntro, Truth.intersection, 0.75);
registerRule('nal.disjunctionIntro', 'atom', 'atom', NALRules.disjunctionIntro, Truth.union, 0.7);
registerRule('nal.implicationIntro', 'inheritance', 'negation', NALRules.implicationIntro, Truth.deduction, 0.8);
registerRule('nal.implicationElim', 'implication', 'atom', NALRules.implicationElim, Truth.deduction, 0.9);
registerRule('nal.equivalenceIntro', 'implication', 'implication', NALRules.equivalenceIntro, Truth.intersection, 0.85);
registerRule('nal.equivalenceElim', 'equivalence', 'atom', NALRules.equivalenceElim, Truth.deduction, 0.9);
registerRule('nal.negationIntro', 'implication', 'implication', NALRules.negationIntro, Truth.deduction, 0.75);
registerRule('nal.negationElim', 'negation', 'negation', NALRules.negationElim, Truth.union, 0.8);
registerRule('nal.destruct', 'conjunction', 'atom', NALRules.destruct, Truth.deduction, 0.85);
registerRule('nal.compose', 'inheritance', 'inheritance', NALRules.compose, Truth.deduction, 0.7);
registerRule('nal.decompose', 'conjunction', 'conjunction', NALRules.decompose, Truth.deduction, 0.8);
registerRule('nal.revision', 'inheritance', 'inheritance', NALRules.revision, Truth.revision, 0.6);
registerRule('nal.analogy', 'inheritance', 'similarity', NALRules.analogy, Truth.analogy, 0.75);
registerRule('nal.comparison', 'inheritance', 'inheritance', NALRules.comparison, Truth.sameness, 0.8);
registerRule('nal.instantiation', 'inheritance', 'similarity', NALRules.instantiation, Truth.deduction, 0.85);
registerRule('nal.exemplification', 'inheritance', 'inheritance', NALRules.exemplification, Truth.exemplification, 0.7);
registerRule('nal.higherOrderDeduction', 'implication', 'implication', NALRules.higherOrderDeduction, Truth.deduction, 0.85);
registerRule('nal.higherOrderAbduction', 'implication', 'implication', NALRules.higherOrderAbduction, Truth.abduction, 0.7);
registerRule('nal.higherOrderInduction', 'implication', 'implication', NALRules.higherOrderInduction, Truth.induction, 0.75);
