import type {Term} from '../terms';
import {getPredicate, getSubject, sameHash, TermBuilder} from '../terms';
import {createRulePattern, RuleRegistry, type RuleFn, type TruthFn} from './types.js';
import {Truth} from '../terms';

export interface NALRuleMetadata {
    id: string;
    name: string;
    description: string;
    nalLevel: number;
    category: 'inference' | 'transformation' | 'comparison' | 'revision';
}

const matchInh = (t: Term) => t.kind === 'inheritance';
const matchImp = (t: Term) => t.kind === 'implication';
const matchConj = (t: Term) => t.kind === 'conjunction';
const matchDisj = (t: Term) => t.kind === 'disjunction';
const matchNeg = (t: Term) => t.kind === 'negation';
const matchSim = (t: Term) => t.kind === 'similarity';
const matchEq = (t: Term) => t.kind === 'equivalence';
const matchAtom = (t: Term) => t.kind === 'atom';

const validInh = (t: Term): boolean => {
    if (!matchInh(t)) return false;
    const s = getSubject(t), p = getPredicate(t);
    return !!(s && p);
};

const validImp = (t: Term): boolean => {
    if (!matchImp(t)) return false;
    if (!('args' in t)) return false;
    const [a, c] = t.args;
    return !!(a && c);
};

const extractInh = (t: Term) => {
    const s = getSubject(t), p = getPredicate(t);
    return {s, p};
};

const extractImp = (t: Term) => {
    if (!('args' in t)) return {a: undefined, c: undefined};
    const [a, c] = t.args;
    return {a, c};
};

const syllogism = (
    left: Term,
    right: Term,
    middle: 'subject' | 'predicate',
    result: (s: Term, p: Term) => Term
): Term | undefined => {
    if (!validInh(left) || !validInh(right)) return undefined;

    const {s: s1, p: p1} = extractInh(left);
    const {s: s2, p: p2} = extractInh(right);

    const mid1 = middle === 'subject' ? s1 : p1;
    const mid2 = middle === 'subject' ? s2 : p2;

    if (!mid1 || !mid2 || !sameHash(mid1, mid2)) return undefined;
    return result(mid1, mid2);
};

const _syllogismMeta = (name: string, desc: string) => ({
    id: `nal.${name.toLowerCase()}`,
    name,
    description: desc,
    nalLevel: 1,
    category: 'inference' as const
});

const chainRule = (
    args: [Term, Term],
    mapA: (a: Term, c: Term) => Term,
    mapC: (a: Term, c: Term) => Term,
    check: (c: Term, a: Term) => boolean
): Term | undefined => {
    if (!validImp(args[0]) || !validImp(args[1])) return undefined;
    const {a: a1, c: c1} = extractImp(args[0]);
    const {a: a2, c: c2} = extractImp(args[1]);
    if (!a1 || !c1 || !a2 || !c2) return undefined;
    if (!check(c1, a2)) return undefined;
    return mapA(a1, c2);
};

const registerRule = (
    id: string,
    left: string,
    right: string,
    fn: (premises: Term[]) => Term | null | undefined,
    truthFn: TruthFn,
    priority: number
) =>
    RuleRegistry.register({
        id,
        pattern: createRulePattern(left, right),
        apply: fn as unknown as RuleFn,
        sync: true,
        priority,
        truthFn
    });

export const NALRules = {
    deduction: (premises: Term[]): Term | undefined => {
        const [aToM, mToB] = premises as [Term, Term];
        return syllogism(aToM, mToB, 'subject', (s, p) => TermBuilder.inheritance(s, p));
    },

    induction: (premises: Term[]): Term | undefined => {
        const [sToM, mToB] = premises as [Term, Term];
        return syllogism(sToM, mToB, 'predicate', (s, p) => TermBuilder.inheritance(s, p));
    },

    abduction: (premises: Term[]): Term | undefined => {
        const [aToM, sToB] = premises as [Term, Term];
        return syllogism(aToM, sToB, 'subject', (s, p) => TermBuilder.inheritance(p, s));
    },

    similarity: (premises: Term[]): Term | undefined => {
        const [aToB, bToA] = premises as [Term, Term];
        if (!validInh(aToB) || !validInh(bToA)) return undefined;
        const {s: s1, p: p1} = extractInh(aToB);
        const {s: s2, p: p2} = extractInh(bToA);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        const sim = (sameHash(s1, s2) && sameHash(p1, p2)) || (sameHash(s1, p2) && sameHash(p1, s2));
        return sim ? TermBuilder.similarity(s1, p1) : undefined;
    },

    contrapositive: (premises: Term[]): Term | undefined => {
        const [imp, inh] = premises as [Term, Term];
        if (!matchImp(imp) || !matchInh(inh)) return undefined;
        const {a: ante, c: cons} = extractImp(imp);
        const p = getSubject(inh);
        if (!ante || !cons || !p || !sameHash(ante, p)) return undefined;
        return cons ? TermBuilder.implication(cons, cons) : undefined;
    },

    intersection: (premises: Term[]): Term | undefined => {
        const [c1, c2] = premises as [Term, Term];
        if (!matchConj(c1) || !matchConj(c2)) return undefined;
        const args1 = 'args' in c1 ? c1.args : [];
        const args2 = 'args' in c2 ? c2.args : [];
        const shared = args1.filter((a1: Term) => args2.some((a2: Term) => sameHash(a1, a2)));
        return shared.length > 0 ? TermBuilder.conjunction(...shared) : undefined;
    },

    union: (premises: Term[]): Term | undefined => {
        const [d1, d2] = premises as [Term, Term];
        if (!matchDisj(d1) || !matchDisj(d2)) return undefined;
        const args1 = 'args' in d1 ? d1.args : [];
        const args2 = 'args' in d2 ? d2.args : [];
        const unique = [...args1, ...args2].filter((a: Term, i: number, arr: Term[]) => arr.findIndex((b: Term) => sameHash(a, b)) === i);
        return TermBuilder.disjunction(...unique);
    },

    conjunctionIntro: (premises: Term[]): Term | undefined => {
        const [i1, i2] = premises as [Term, Term];
        if (!validInh(i1) || !validInh(i2)) return undefined;
        const {s: s1, p: p1} = extractInh(i1);
        const {s: s2, p: p2} = extractInh(i2);
        if (!s1 || !p1 || !s2 || !p2 || !sameHash(s1, s2)) return undefined;
        return TermBuilder.conjunction(p1, p2);
    },

    disjunctionIntro: (premises: Term[]): Term | undefined => {
        const [a1, a2] = premises as [Term, Term];
        return matchAtom(a1) && matchAtom(a2) ? TermBuilder.disjunction(a1, a2) : undefined;
    },

    implicationIntro: (premises: Term[]): Term | undefined => {
        const [inh, neg] = premises as [Term, Term];
        if (!validInh(inh) || !matchNeg(neg)) return undefined;
        const {s, p} = extractInh(inh);
        return s && p ? TermBuilder.implication(s, p) : undefined;
    },

    implicationElim: (premises: Term[]): Term | undefined => {
        const [imp, atm] = premises as [Term, Term];
        if (!matchImp(imp) || !matchAtom(atm)) return undefined;
        const {a: ante, c: cons} = extractImp(imp);
        return ante && sameHash(ante, atm) ? cons : undefined;
    },

    equivalenceIntro: (premises: Term[]): Term | undefined => {
        const [imp1, imp2] = premises as [Term, Term];
        if (!validImp(imp1) || !validImp(imp2)) return undefined;
        const {a: a1, c: c1} = extractImp(imp1);
        const {a: a2, c: c2} = extractImp(imp2);
        if (!a1 || !c1 || !a2 || !c2) return undefined;
        const ok = (sameHash(a1, a2) && sameHash(c1, c2)) || (sameHash(a1, c2) && sameHash(c1, a2));
        return ok ? TermBuilder.equivalence(a1, c1) : undefined;
    },

    equivalenceElim: (premises: Term[]): Term | undefined => {
        const [eq, atm] = premises as [Term, Term];
        if (!matchEq(eq) || !matchAtom(atm)) return undefined;
        if (!('args' in eq)) return undefined;
        const [a, c] = eq.args;
        if (!a || !c) return undefined;
        return sameHash(a, atm) || sameHash(c, atm) ? c : undefined;
    },

    negationIntro: (premises: Term[]): Term | undefined => {
        const [imp1, imp2] = premises as [Term, Term];
        if (!validImp(imp1) || !validImp(imp2)) return undefined;
        const {a: a1, c: c1} = extractImp(imp1);
        const {a: a2, c: c2} = extractImp(imp2);
        if (!a1 || !c1 || !a2 || !c2) return undefined;
        const isContra = sameHash(a1, a2) && matchAtom(c1) && matchAtom(c2) &&
            c1.symbol === 'TRUE' && c2.symbol === 'FALSE';
        return isContra ? TermBuilder.negation(a1) : undefined;
    },

    negationElim: (premises: Term[]): Term | undefined => {
        const [n1, n2] = premises as [Term, Term];
        if (!matchNeg(n1) || !matchNeg(n2)) return undefined;
        const args1 = 'args' in n1 ? n1.args : [];
        const args2 = 'args' in n2 ? n2.args : [];
        const a1 = args1[0], a2 = args2[0];
        return a1 && a2 && sameHash(a1, a2) ? TermBuilder.atom('FALSE') : undefined;
    },

    destruct: (premises: Term[]): Term | undefined => {
        const [conj, atm] = premises as [Term, Term];
        if (!matchConj(conj) || !matchAtom(atm)) return undefined;
        const args = 'args' in conj ? conj.args : [];
        return args.find(a => sameHash(a, atm));
    },

    compose: (premises: Term[]): Term | undefined => {
        const [i1, i2] = premises as [Term, Term];
        if (!validInh(i1) || !validInh(i2)) return undefined;
        const {p: p1} = extractInh(i1);
        const {s: s2} = extractInh(i2);
        if (!p1 || !s2 || !sameHash(p1, s2)) return undefined;
        const {s} = extractInh(i1);
        const {p} = extractInh(i2);
        return s && p ? TermBuilder.inheritance(s, p) : undefined;
    },

    decompose: (premises: Term[]): Term | undefined => {
        const [c1, c2] = premises as [Term, Term];
        if (!matchConj(c1) || !matchConj(c2)) return undefined;
        const args1 = 'args' in c1 ? c1.args : [];
        const args2 = 'args' in c2 ? c2.args : [];
        return args1.find(a1 => args2.some(a2 => sameHash(a1, a2)));
    },

    revision: (premises: Term[]): Term | undefined => {
        const [i1, i2] = premises as [Term, Term];
        if (!validInh(i1) || !validInh(i2)) return undefined;
        const {s: s1, p: p1} = extractInh(i1);
        const {s: s2, p: p2} = extractInh(i2);
        return s1 && p1 && s2 && p2 && sameHash(s1, s2) && sameHash(p1, p2) ? i1 : undefined;
    },

    analogy: (premises: Term[]): Term | undefined => {
        const [inh, sim] = premises as [Term, Term];
        if (!validInh(inh) || !matchSim(sim)) return undefined;
        const {s: s1, p: p1} = extractInh(inh);
        const {a: s2, c: p2} = extractImp(sim);
        if (!s1 || !p1 || !s2 || !p2 || !sameHash(p1, s2)) return undefined;
        return TermBuilder.inheritance(s1, p2);
    },

    comparison: (premises: Term[]): Term | undefined => {
        const [inh1, inh2] = premises as [Term, Term];
        if (!validInh(inh1) || !validInh(inh2)) return undefined;
        const {s: s1, p: p1} = extractInh(inh1);
        const {s: s2, p: p2} = extractInh(inh2);
        return s1 && p1 && s2 && p2 && sameHash(s1, s2) ? TermBuilder.similarity(p1, p2) : undefined;
    },

    instantiation: (premises: Term[]): Term | undefined => {
        const [inh, sim] = premises as [Term, Term];
        if (!validInh(inh) || !matchSim(sim)) return undefined;
        const {s: s1, p: p1} = extractInh(inh);
        const {a: s2, c: p2} = extractImp(sim);
        return s1 && p1 && s2 && p2 && sameHash(p1, p2) ? TermBuilder.inheritance(s1, s2) : undefined;
    },

    exemplification: (premises: Term[]): Term | undefined => {
        const [inh1, inh2] = premises as [Term, Term];
        if (!validInh(inh1) || !validInh(inh2)) return undefined;
        const {s: s1, p: p1} = extractInh(inh1);
        const {s: s2, p: p2} = extractInh(inh2);
        return s1 && p1 && s2 && p2 && sameHash(p1, s2) ? TermBuilder.inheritance(s1, p2) : undefined;
    },

    higherOrderDeduction: (premises: Term[]): Term | undefined => {
        const [imp1, imp2] = premises as [Term, Term];
        return chainRule([imp1, imp2], (a, c) => TermBuilder.implication(a, c), (_, c) => c, (c, a) => sameHash(c, a));
    },

    higherOrderAbduction: (premises: Term[]): Term | undefined => {
        const [imp1, imp2] = premises as [Term, Term];
        return chainRule([imp1, imp2], (a, _) => a, (_, a) => a, (c1, a2) => sameHash(c1, a2));
    },

    higherOrderInduction: (premises: Term[]): Term | undefined => {
        const [imp1, imp2] = premises as [Term, Term];
        return chainRule([imp1, imp2], (_, c) => c, (a, c) => TermBuilder.implication(a, c), (a1, a2) => sameHash(a1, a2));
    },

    conditionalDeduction: (premises: Term[]): Term | undefined => {
        const [imp, inh] = premises as [Term, Term];
        if (!validImp(imp) || !validInh(inh)) return undefined;
        const {a: ante, c: cons} = extractImp(imp);
        const {s, p} = extractInh(inh);
        if (!ante || !cons || !s || !p || !sameHash(cons, s)) return undefined;
        return TermBuilder.implication(ante, p);
    },

    conditionalAbduction: (premises: Term[]): Term | undefined => {
        const [imp1, imp2] = premises as [Term, Term];
        if (!validImp(imp1) || !validImp(imp2)) return undefined;
        const {a: a1, c: c1} = extractImp(imp1);
        const {a: a2, c: c2} = extractImp(imp2);
        if (!a1 || !c1 || !a2 || !c2 || !sameHash(c1, c2)) return undefined;
        return TermBuilder.implication(a1, a2);
    },

    detachment: (premises: Term[]): Term | undefined => {
        const [imp, atm] = premises as [Term, Term];
        if (!validImp(imp) || !matchAtom(atm)) return undefined;
        const {a: ante, c: cons} = extractImp(imp);
        return ante && sameHash(ante, atm) ? cons : undefined;
    },

    anchor: (premises: Term[]): Term | undefined => {
        const [atm, sim] = premises as [Term, Term];
        if (!matchAtom(atm) || !matchSim(sim)) return undefined;
        if (!('args' in sim)) return undefined;
        const [a, c] = sim.args;
        if (!a || !c) return undefined;
        return sameHash(atm, a) || sameHash(atm, c)
            ? TermBuilder.inheritance(atm, sameHash(atm, a) ? c : a)
            : undefined;
    },

    merge: (premises: Term[]): Term | undefined => {
        const [i1, i2] = premises as [Term, Term];
        if (!validInh(i1) || !validInh(i2)) return undefined;
        const {s: s1, p: p1} = extractInh(i1);
        const {s: s2, p: p2} = extractInh(i2);
        if (s1 && p1 && s2 && p2) {
            if (sameHash(s1, s2) && sameHash(p1, p2)) return i1;
            if (sameHash(s1, p2) && sameHash(p1, s2)) return TermBuilder.similarity(s1, p1);
        }
        return undefined;
    }
};

const meta = (id: string, name: string, desc: string, level: number, cat: NALRuleMetadata['category']): NALRuleMetadata =>
    ({id, name, description: desc, nalLevel: level, category: cat});

const _m1 = (n: string, d: string) => meta(`nal.${n.toLowerCase()}`, n, d, 1, 'inference');
const _m2 = (n: string, d: string) => meta(`nal.${n.toLowerCase()}`, n, d, 2, 'inference');
const _m4 = (n: string, d: string) => meta(`nal.${n.toLowerCase()}`, n, d, 4, 'inference');

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
registerRule('nal.conditionalDeduction', 'implication', 'inheritance', NALRules.conditionalDeduction, Truth.deduction, 0.8);
registerRule('nal.conditionalAbduction', 'implication', 'implication', NALRules.conditionalAbduction, Truth.abduction, 0.75);
registerRule('nal.detachment', 'implication', 'atom', NALRules.detachment, Truth.deduction, 0.9);
registerRule('nal.anchor', 'atom', 'similarity', NALRules.anchor, Truth.deduction, 0.8);
registerRule('nal.merge', 'inheritance', 'inheritance', NALRules.merge, Truth.revision, 0.65);

export {NALRules as default};