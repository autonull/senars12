import type {Term} from '../terms';
import {getPredicate, getSubject, TermBuilder, termsEqual, Truth} from '../terms';
import {
    abductionLink, buildAbduction, buildDeduction, buildHigherOrderRule,
    buildInduction, deductionLink, inductionLink, syllogize
} from './nal-helpers.js';
import {matchInhPair, registerRules, rule} from './shared.js';
import {type RuleFn} from './types.js';

const syl = (leftKind: Term['kind'], rightKind: Term['kind'], link: (l: Term, r: Term) => boolean, build: (l: Term, r: Term) => Term | undefined) =>
    syllogize({leftKind, rightKind, link, build});

export const NALRules = {
    deduction: syl('inheritance', 'inheritance', deductionLink, buildDeduction),
    induction: syl('inheritance', 'inheritance', inductionLink, buildInduction),
    abduction: syl('inheritance', 'inheritance', abductionLink, buildAbduction),
    similarity: syl('inheritance', 'inheritance', (l, r) => {
        const s1 = getSubject(l), p1 = getPredicate(l), s2 = getSubject(r), p2 = getPredicate(r);
        if (!s1 || !p1 || !s2 || !p2) return false;
        return (termsEqual(s1, s2) && termsEqual(p1, p2)) || (termsEqual(s1, p2) && termsEqual(p1, s2));
    }, (l) => { const s = getSubject(l), p = getPredicate(l); return s && p ? TermBuilder.similarity(s, p) : undefined; }),

    contrapositive: ([imp, inh]: [Term, Term]): Term | undefined => {
        if (imp.kind !== 'implication' || inh.kind !== 'inheritance') return undefined;
        const [ante, cons] = imp.args;
        const sub = getSubject(inh);
        if (!ante || !cons || !sub || !termsEqual(ante, sub)) return undefined;
        const consequent = inh.args[1];
        return consequent ? TermBuilder.implication(consequent, cons) : undefined;
    },

    intersection: foldNary('conjunction', (a1, a2) => termsEqual(a1, a2)),
    union: foldNary('disjunction', (a1, a2) => termsEqual(a1, a2), true),
    decompose: ([c1, c2]: [Term, Term]): Term | undefined => {
        if (c1.kind !== 'conjunction' || c2.kind !== 'conjunction') return undefined;
        return c1.args.find(a1 => c2.args.some(a2 => termsEqual(a1, a2)));
    },

    conjunctionIntro: ([i1, i2]: [Term, Term]): Term | undefined => {
        if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') return undefined;
        const s1 = getSubject(i1), p1 = getPredicate(i1), s2 = getSubject(i2), p2 = getPredicate(i2);
        if (!s1 || !p1 || !s2 || !p2 || !termsEqual(s1, s2)) return undefined;
        return TermBuilder.conjunction(p1, p2);
    },

    disjunctionIntro: ([a1, a2]: [Term, Term]): Term | undefined =>
        a1.kind === 'atom' && a2.kind === 'atom' ? TermBuilder.disjunction(a1, a2) : undefined,

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
        const [a1, c1] = imp1.args, [a2, c2] = imp2.args;
        if (!a1 || !c1 || !a2 || !c2) return undefined;
        const match = (termsEqual(a1, a2) && termsEqual(c1, c2)) || (termsEqual(a1, c2) && termsEqual(c1, a2));
        return match ? TermBuilder.equivalence(a1, c1) : undefined;
    },

    equivalenceElim: ([eq, atm]: [Term, Term]): Term | undefined => {
        if (eq.kind !== 'equivalence' || atm.kind !== 'atom') return undefined;
        const [a, c] = eq.args;
        if (!a || !c) return undefined;
        return termsEqual(a, atm) || termsEqual(c, atm) ? c : undefined;
    },

    negationIntro: ([imp1, imp2]: [Term, Term]): Term | undefined => {
        if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
        const [a1, c1] = imp1.args, [a2, c2] = imp2.args;
        if (!a1 || !c1 || !a2 || !c2) return undefined;
        return (termsEqual(a1, a2) && c1.kind === 'atom' && c2.kind === 'atom' && c1.symbol === 'TRUE' && c2.symbol === 'FALSE')
            ? TermBuilder.negation(a1) : undefined;
    },

    negationElim: ([n1, n2]: [Term, Term]): Term | undefined => {
        if (n1.kind !== 'negation' || n2.kind !== 'negation') return undefined;
        const [a1] = n1.args, [a2] = n2.args;
        return a1 && a2 && termsEqual(a1, a2) ? TermBuilder.atom('FALSE') : undefined;
    },

    destruct: ([conj, atm]: [Term, Term]): Term | undefined =>
        conj.kind === 'conjunction' && atm.kind === 'atom' ? conj.args.find(a => termsEqual(a, atm)) : undefined,

    compose: syl('inheritance', 'inheritance', (l, r) => {
        const p1 = getPredicate(l), s2 = getSubject(r);
        return !!(p1 && s2 && termsEqual(p1, s2));
    }, (l, r) => { const s = getSubject(l), p = getPredicate(r); return s && p ? TermBuilder.inheritance(s, p) : undefined; }),

    revision: ([i1, i2]: [Term, Term]) => {
        if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') return undefined;
        return matchInhPair((s1, p1, s2, p2) => termsEqual(s1, s2) && termsEqual(p1, p2) ? i1 : undefined)([i1, i2]);
    },

    analogy: ([inh, sim]: [Term, Term]) => {
        if (inh.kind !== 'inheritance' || sim.kind !== 'similarity') return undefined;
        return matchInhPair((s1, p1, s2, p2) => termsEqual(p1, s2) ? TermBuilder.inheritance(s1, p2) : undefined)([inh, sim]);
    },

    comparison: matchInhPair((s1, p1, s2, p2) => termsEqual(s1, s2) ? TermBuilder.similarity(p1, p2) : undefined) as RuleFn,

    instantiation: ([inh, sim]: [Term, Term]) => {
        if (inh.kind !== 'inheritance' || sim.kind !== 'similarity') return undefined;
        return matchInhPair((s1, p1, s2, p2) => termsEqual(p1, p2) ? TermBuilder.inheritance(s1, s2) : undefined)([inh, sim]);
    },

    exemplification: matchInhPair((s1, p1, s2, p2) => termsEqual(p1, s2) ? TermBuilder.inheritance(s1, p2) : undefined) as RuleFn,

    higherOrderDeduction: buildHigherOrderRule((_a1, c1, a2, _c2) => termsEqual(c1, a2), (a1, _c1, _a2, c2) => TermBuilder.implication(a1, c2)),
    higherOrderAbduction: buildHigherOrderRule((_a1, c1, _a2, c2) => termsEqual(c1, c2), (a1, _c1, a2, _c2) => TermBuilder.implication(a1, a2)),
    higherOrderInduction: buildHigherOrderRule((a1, _c1, a2, _c2) => termsEqual(a1, a2), (_a1, c1, _a2, c2) => TermBuilder.implication(c1, c2))
};

function foldNary(kind: Term['kind'], eq: (a1: Term, a2: Term) => boolean, unique = false): RuleFn {
    return ([t1, t2]: [Term, Term]): Term | undefined => {
        if (t1.kind !== kind || t2.kind !== kind) return undefined;
        const a1 = t1.args!, a2 = t2.args!;
        const args = unique
            ? [...a1, ...a2].filter((a, i, arr) => arr.findIndex(b => eq(a, b)) === i)
            : a1.filter(x => a2.some(y => eq(x, y)));
        return args.length > 0 ? (kind === 'conjunction' ? TermBuilder.conjunction(...args) : TermBuilder.disjunction(...args)) : undefined;
    };
}

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
