import type { Term } from '../terms/index.js';
import { RuleRegistry, createRulePattern } from './types.js';

function getSubject(term: Term): Term | undefined {
    if (term.kind === 'inheritance' || term.kind === 'similarity') {
        return term.args[0];
    }
    return undefined;
}

function getPredicate(term: Term): Term | undefined {
    if (term.kind === 'inheritance' || term.kind === 'similarity') {
        return term.args[1];
    }
    return undefined;
}

export const NALRules = {
    deduction(premises: [Term, Term]): Term | undefined {
        const aToM = premises[0];
        const mToB = premises[1];
        if (aToM.kind !== 'inheritance' || mToB.kind !== 'inheritance') {
            return undefined;
        }
        const middleA = getSubject(mToB);
        const middleB = getPredicate(aToM);
        if (!middleA || !middleB) {
            return undefined;
        }
        if (middleA.hash !== middleB.hash) {
            return undefined;
        }
        const s = getSubject(aToM);
        const p = getPredicate(mToB);
        if (!s || !p) {
            return undefined;
        }
        return { kind: 'inheritance', args: [s, p], hash: 0 } as Term;
    },

    induction(premises: [Term, Term]): Term | undefined {
        const sToM = premises[0];
        const mToB = premises[1];
        if (sToM.kind !== 'inheritance' || mToB.kind !== 'inheritance') {
            return undefined;
        }
        const middleS = getPredicate(sToM);
        const middleM = getSubject(mToB);
        if (!middleS || !middleM) {
            return undefined;
        }
        if (middleS.hash !== middleM.hash) {
            return undefined;
        }
        const s = getSubject(sToM);
        const p = getPredicate(mToB);
        if (!s || !p) {
            return undefined;
        }
        return { kind: 'inheritance', args: [s, p], hash: 0 } as Term;
    },

    abduction(premises: [Term, Term]): Term | undefined {
        const aToM = premises[0];
        const sToB = premises[1];
        if (aToM.kind !== 'inheritance' || sToB.kind !== 'inheritance') {
            return undefined;
        }
        const middleA = getSubject(aToM);
        const middleS = getSubject(sToB);
        if (!middleA || !middleS) {
            return undefined;
        }
        if (middleA.hash !== middleS.hash) {
            return undefined;
        }
        const p = getPredicate(aToM);
        const s = getSubject(sToB);
        if (!p || !s) {
            return undefined;
        }
        return { kind: 'inheritance', args: [s, p], hash: 0 } as Term;
    },

    similarity(premises: [Term, Term]): Term | undefined {
        const aToB = premises[0];
        const bToA = premises[1];
        if (aToB.kind !== 'inheritance' || bToA.kind !== 'inheritance') {
            return undefined;
        }
        const s1 = getSubject(aToB);
        const p1 = getPredicate(aToB);
        const s2 = getSubject(bToA);
        const p2 = getPredicate(bToA);
        if (!s1 || !p1 || !s2 || !p2) {
            return undefined;
        }
        const sim = (s1.hash === s2.hash && p1.hash === p2.hash) || 
                  (s1.hash === p2.hash && p1.hash === s2.hash);
        if (!sim) {
            return undefined;
        }
        return { kind: 'similarity', args: [s1, p1], hash: 0 } as Term;
    },

    contrapositive(premises: [Term, Term]): Term | undefined {
        const imp = premises[0];
        const inh = premises[1];
        if (imp.kind !== 'implication' || inh.kind !== 'inheritance') {
            return undefined;
        }
        const ante = imp.args[0];
        const cons = imp.args[1];
        if (!ante || !cons) {
            return undefined;
        }
        const sub = getSubject(inh);
        if (!sub) {
            return undefined;
        }
        if (ante.hash === sub.hash) {
            const consequent = inh.args[1];
            if (!consequent) return undefined;
            return { kind: 'implication', args: [consequent, cons], hash: 0 } as Term;
        }
        return undefined;
    },

    intersection(premises: [Term, Term]): Term | undefined {
        const c1 = premises[0];
        const c2 = premises[1];
        if (c1.kind !== 'conjunction' || c2.kind !== 'conjunction') {
            return undefined;
        }
        const shared = c1.args.filter(a1 => c2.args.some(a2 => a1.hash === a2.hash));
        if (shared.length === 0) return undefined;
        return { kind: 'conjunction', args: shared, hash: 0 } as Term;
    },

    union(premises: [Term, Term]): Term | undefined {
        const d1 = premises[0];
        const d2 = premises[1];
        if (d1.kind !== 'disjunction' || d2.kind !== 'disjunction') {
            return undefined;
        }
        const all = [...d1.args, ...d2.args];
        const unique = all.filter((a, i) => all.findIndex(b => a.hash === b.hash) === i);
        return { kind: 'disjunction', args: unique, hash: 0 } as Term;
    },

    conjunctionIntro(premises: [Term, Term]): Term | undefined {
        const i1 = premises[0];
        const i2 = premises[1];
        if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') {
            return undefined;
        }
        const s1 = getSubject(i1);
        const p1 = getPredicate(i1);
        const s2 = getSubject(i2);
        const p2 = getPredicate(i2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (s1.hash !== s2.hash) return undefined;
        return { kind: 'conjunction', args: [p1, p2], hash: 0 } as Term;
    },

    disjunctionIntro(premises: [Term, Term]): Term | undefined {
        const a1 = premises[0];
        const a2 = premises[1];
        if (a1.kind !== 'atom' || a2.kind !== 'atom') return undefined;
        return { kind: 'disjunction', args: [a1, a2], hash: 0 } as Term;
    },

    implicationIntro(premises: [Term, Term]): Term | undefined {
        const inh = premises[0];
        const neg = premises[1];
        if (inh.kind !== 'inheritance' || neg.kind !== 'negation') return undefined;
        const sub = getSubject(inh);
        const pred = getPredicate(inh);
        if (!sub || !pred) return undefined;
        return { kind: 'implication', args: [sub, pred], hash: 0 } as Term;
    },

    implicationElim(premises: [Term, Term]): Term | undefined {
        const imp = premises[0];
        const atm = premises[1];
        if (imp.kind !== 'implication' || atm.kind !== 'atom') return undefined;
        const ante = imp.args[0];
        if (!ante || ante.hash !== atm.hash) return undefined;
        return imp.args[1];
    },

    equivalenceIntro(premises: [Term, Term]): Term | undefined {
        const imp1 = premises[0];
        const imp2 = premises[1];
        if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
        const a1 = imp1.args[0];
        const c1 = imp1.args[1];
        const a2 = imp2.args[0];
        const c2 = imp2.args[1];
        if (!a1 || !c1 || !a2 || !c2) return undefined;
        const forward = a1.hash === a2.hash && c1.hash === c2.hash;
        const back = a1.hash === c2.hash && c1.hash === a2.hash;
        if (!forward && !back) return undefined;
        return { kind: 'equivalence', args: [a1 ?? a2, c1 ?? c2], hash: 0 } as Term;
    },

    equivalenceElim(premises: [Term, Term]): Term | undefined {
        const eq = premises[0];
        const atm = premises[1];
        if (eq.kind !== 'equivalence' || atm.kind !== 'atom') return undefined;
        const a = eq.args[0];
        const c = eq.args[1];
        if (!a || !c) return undefined;
        return a.hash === atm.hash ? c : a.hash === atm.hash ? c : undefined;
    },

    negationIntro(premises: [Term, Term]): Term | undefined {
        const imp1 = premises[0];
        const imp2 = premises[1];
        if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
        const a1 = imp1.args[0];
        const c1 = imp1.args[1];
        const a2 = imp2.args[0];
        const c2 = imp2.args[1];
        if (!a1 || !c1 || !a2 || !c2) return undefined;
        if (a1.hash === a2.hash && c1.kind === 'atom' && c2.kind === 'atom' && c1.symbol === 'TRUE' && c2.symbol === 'FALSE') {
            return { kind: 'negation', args: [a1], hash: 0 } as Term;
        }
        return undefined;
    },

    negationElim(premises: [Term, Term]): Term | undefined {
        const n1 = premises[0];
        const n2 = premises[1];
        if (n1.kind !== 'negation' || n2.kind !== 'negation') return undefined;
        const a1 = n1.args[0];
        const a2 = n2.args[0];
        if (!a1 || !a2) return undefined;
        if (a1.hash === a2.hash) return { kind: 'atom', symbol: 'FALSE', hash: 0 } as Term;
        return undefined;
    },

    destruct(premises: [Term, Term]): Term | undefined {
        const conj = premises[0];
        const atm = premises[1];
        if (conj.kind !== 'conjunction' || atm.kind !== 'atom') return undefined;
        const found = conj.args.find(a => a.hash === atm.hash);
        return found;
    },

    compose(premises: [Term, Term]): Term | undefined {
        const i1 = premises[0];
        const i2 = premises[1];
        if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') return undefined;
        const p1 = getPredicate(i1);
        const s2 = getSubject(i2);
        if (!p1 || !s2 || p1.hash !== s2.hash) return undefined;
        const s = getSubject(i1);
        const p = getPredicate(i2);
        if (!s || !p) return undefined;
        return { kind: 'inheritance', args: [s, p], hash: 0 } as Term;
    },

    decompose(premises: [Term, Term]): Term | undefined {
        const c1 = premises[0];
        const c2 = premises[1];
        if (c1.kind !== 'conjunction' || c2.kind !== 'conjunction') return undefined;
        const shared = c1.args.filter(a1 => c2.args.some(a2 => a1.hash === a2.hash));
        if (shared.length === 0) return undefined;
        return shared[0];
    },

    revision(premises: [Term, Term]): Term | undefined {
        const i1 = premises[0];
        const i2 = premises[1];
        if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') return undefined;
        const s1 = getSubject(i1);
        const p1 = getPredicate(i1);
        const s2 = getSubject(i2);
        const p2 = getPredicate(i2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (s1.hash === s2.hash && p1.hash === p2.hash) {
            return i1;
        }
        return undefined;
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