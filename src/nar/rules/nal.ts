import type {Term} from '../terms';
import {getPredicate, getSubject, TermBuilder, termsEqual, Truth} from '../terms';
import {
    abductionLink,
    buildAbduction,
    buildDeduction,
    buildHigherOrderRule,
    buildInduction,
    deductionLink,
    inductionLink,
    syllogize
} from './nal-helpers.js';
import {extractInhPair, matchInhPair, registerRules} from './shared.js';
import {type RuleFn} from './types.js';

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
        const shared = c1.args.filter(a1 => c2.args.some(a2 => termsEqual(a1, a2)));
        return shared[0];
    },

revision: ([i1, i2]: [Term, Term]) => {
        if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') return undefined;
        return matchInhPair((s1, p1, s2, p2) =>
            termsEqual(s1, s2) && termsEqual(p1, p2) ? i1 : undefined
        )([i1, i2]);
    },

    analogy: ([inh, sim]: [Term, Term]) => {
        if (inh.kind !== 'inheritance' || sim.kind !== 'similarity') return undefined;
        return matchInhPair((s1, p1, s2, p2) =>
            termsEqual(p1, s2) ? TermBuilder.inheritance(s1, p2) : undefined
        )([inh, sim]);
    },

    comparison: matchInhPair((s1, p1, s2, p2) =>
        termsEqual(s1, s2) ? TermBuilder.similarity(p1, p2) : undefined
    ) as RuleFn,

    instantiation: ([inh, sim]: [Term, Term]) => {
        if (inh.kind !== 'inheritance' || sim.kind !== 'similarity') return undefined;
        return matchInhPair((s1, p1, s2, p2) =>
            termsEqual(p1, p2) ? TermBuilder.inheritance(s1, s2) : undefined
        )([inh, sim]);
    },

    exemplification: matchInhPair((s1, p1, s2, p2) =>
        termsEqual(p1, s2) ? TermBuilder.inheritance(s1, p2) : undefined
    ) as RuleFn,

    higherOrderDeduction: buildHigherOrderRule(
        (a1, c1, a2, c2) => termsEqual(c1, a2),
        (a1, c1, a2, c2) => TermBuilder.implication(a1, c2)
    ),

    higherOrderAbduction: buildHigherOrderRule(
        (a1, c1, a2, c2) => termsEqual(c1, c2),
        (a1, c1, a2, c2) => TermBuilder.implication(a1, a2)
    ),

    higherOrderInduction: buildHigherOrderRule(
        (a1, c1, a2, c2) => termsEqual(a1, a2),
        (a1, c1, a2, c2) => TermBuilder.implication(c1, c2)
    )
};

registerRules([
    {id: 'nal.deduction', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALRules.deduction, truthFn: Truth.deduction, priority: 1.0},
    {id: 'nal.induction', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALRules.induction, truthFn: Truth.induction, priority: 0.9},
    {id: 'nal.abduction', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALRules.abduction, truthFn: Truth.abduction, priority: 0.8},
    {id: 'nal.similarity', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALRules.similarity, truthFn: Truth.resemblance, priority: 0.95},
    {id: 'nal.contrapositive', leftKind: 'implication', rightKind: 'inheritance', apply: NALRules.contrapositive, truthFn: Truth.contraposition, priority: 0.7},
    {id: 'nal.intersection', leftKind: 'conjunction', rightKind: 'conjunction', apply: NALRules.intersection, truthFn: Truth.intersection, priority: 0.85},
    {id: 'nal.union', leftKind: 'disjunction', rightKind: 'disjunction', apply: NALRules.union, truthFn: Truth.union, priority: 0.8},
    {id: 'nal.conjunctionIntro', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALRules.conjunctionIntro, truthFn: Truth.intersection, priority: 0.75},
    {id: 'nal.disjunctionIntro', leftKind: 'atom', rightKind: 'atom', apply: NALRules.disjunctionIntro, truthFn: Truth.union, priority: 0.7},
    {id: 'nal.implicationIntro', leftKind: 'inheritance', rightKind: 'negation', apply: NALRules.implicationIntro, truthFn: Truth.deduction, priority: 0.8},
    {id: 'nal.implicationElim', leftKind: 'implication', rightKind: 'atom', apply: NALRules.implicationElim, truthFn: Truth.deduction, priority: 0.9},
    {id: 'nal.equivalenceIntro', leftKind: 'implication', rightKind: 'implication', apply: NALRules.equivalenceIntro, truthFn: Truth.intersection, priority: 0.85},
    {id: 'nal.equivalenceElim', leftKind: 'equivalence', rightKind: 'atom', apply: NALRules.equivalenceElim, truthFn: Truth.deduction, priority: 0.9},
    {id: 'nal.negationIntro', leftKind: 'implication', rightKind: 'implication', apply: NALRules.negationIntro, truthFn: Truth.deduction, priority: 0.75},
    {id: 'nal.negationElim', leftKind: 'negation', rightKind: 'negation', apply: NALRules.negationElim, truthFn: Truth.union, priority: 0.8},
    {id: 'nal.destruct', leftKind: 'conjunction', rightKind: 'atom', apply: NALRules.destruct, truthFn: Truth.deduction, priority: 0.85},
    {id: 'nal.compose', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALRules.compose, truthFn: Truth.deduction, priority: 0.7},
    {id: 'nal.decompose', leftKind: 'conjunction', rightKind: 'conjunction', apply: NALRules.decompose, truthFn: Truth.deduction, priority: 0.8},
    {id: 'nal.revision', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALRules.revision, truthFn: Truth.revision, priority: 0.6},
    {id: 'nal.analogy', leftKind: 'inheritance', rightKind: 'similarity', apply: NALRules.analogy, truthFn: Truth.analogy, priority: 0.75},
    {id: 'nal.comparison', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALRules.comparison, truthFn: Truth.sameness, priority: 0.8},
    {id: 'nal.instantiation', leftKind: 'inheritance', rightKind: 'similarity', apply: NALRules.instantiation, truthFn: Truth.deduction, priority: 0.85},
    {id: 'nal.exemplification', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALRules.exemplification, truthFn: Truth.exemplification, priority: 0.7},
    {id: 'nal.higherOrderDeduction', leftKind: 'implication', rightKind: 'implication', apply: NALRules.higherOrderDeduction, truthFn: Truth.deduction, priority: 0.85},
    {id: 'nal.higherOrderAbduction', leftKind: 'implication', rightKind: 'implication', apply: NALRules.higherOrderAbduction, truthFn: Truth.abduction, priority: 0.7},
    {id: 'nal.higherOrderInduction', leftKind: 'implication', rightKind: 'implication', apply: NALRules.higherOrderInduction, truthFn: Truth.induction, priority: 0.75},
]);
