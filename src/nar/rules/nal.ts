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
import {extractInhPair, matchInhPair, registerRules, rule} from './shared.js';
import {type RuleFn} from './types.js';

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
    rule('nal.deduction', 'inheritance', 'inheritance', NALRules.deduction, Truth.deduction, 1.0),
    rule('nal.induction', 'inheritance', 'inheritance', NALRules.induction, Truth.induction, 0.9),
    rule('nal.abduction', 'inheritance', 'inheritance', NALRules.abduction, Truth.abduction, 0.8),
    rule('nal.similarity', 'inheritance', 'inheritance', NALRules.similarity, Truth.resemblance, 0.95),
    rule('nal.contrapositive', 'implication', 'inheritance', NALRules.contrapositive, Truth.contraposition, 0.7),
    rule('nal.intersection', 'conjunction', 'conjunction', NALRules.intersection, Truth.intersection, 0.85),
    rule('nal.union', 'disjunction', 'disjunction', NALRules.union, Truth.union, 0.8),
    rule('nal.conjunctionIntro', 'inheritance', 'inheritance', NALRules.conjunctionIntro, Truth.intersection, 0.75),
    rule('nal.disjunctionIntro', 'atom', 'atom', NALRules.disjunctionIntro, Truth.union, 0.7),
    rule('nal.implicationIntro', 'inheritance', 'negation', NALRules.implicationIntro, Truth.deduction, 0.8),
    rule('nal.implicationElim', 'implication', 'atom', NALRules.implicationElim, Truth.deduction, 0.9),
    rule('nal.equivalenceIntro', 'implication', 'implication', NALRules.equivalenceIntro, Truth.intersection, 0.85),
    rule('nal.equivalenceElim', 'equivalence', 'atom', NALRules.equivalenceElim, Truth.deduction, 0.9),
    rule('nal.negationIntro', 'implication', 'implication', NALRules.negationIntro, Truth.deduction, 0.75),
    rule('nal.negationElim', 'negation', 'negation', NALRules.negationElim, Truth.union, 0.8),
    rule('nal.destruct', 'conjunction', 'atom', NALRules.destruct, Truth.deduction, 0.85),
    rule('nal.compose', 'inheritance', 'inheritance', NALRules.compose, Truth.deduction, 0.7),
    rule('nal.decompose', 'conjunction', 'conjunction', NALRules.decompose, Truth.deduction, 0.8),
    rule('nal.revision', 'inheritance', 'inheritance', NALRules.revision, Truth.revision, 0.6),
    rule('nal.analogy', 'inheritance', 'similarity', NALRules.analogy, Truth.analogy, 0.75),
    rule('nal.comparison', 'inheritance', 'inheritance', NALRules.comparison, Truth.sameness, 0.8),
    rule('nal.instantiation', 'inheritance', 'similarity', NALRules.instantiation, Truth.deduction, 0.85),
    rule('nal.exemplification', 'inheritance', 'inheritance', NALRules.exemplification, Truth.exemplification, 0.7),
    rule('nal.higherOrderDeduction', 'implication', 'implication', NALRules.higherOrderDeduction, Truth.deduction, 0.85),
    rule('nal.higherOrderAbduction', 'implication', 'implication', NALRules.higherOrderAbduction, Truth.abduction, 0.7),
    rule('nal.higherOrderInduction', 'implication', 'implication', NALRules.higherOrderInduction, Truth.induction, 0.75),
]);
