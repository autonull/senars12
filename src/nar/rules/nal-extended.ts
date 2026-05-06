import type { Term } from '../terms/index.js';
import { RuleRegistry, createRulePattern } from './types.js';
import { TermFactory } from '../terms/factory.js';
// import { Truth } from '../terms/truth.js';

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

export const NALExtendedRules = {
    modusPonens(premises: [Term, Term]): Term | undefined {
        const [imp, antecedent] = premises;
        if (imp.kind !== 'implication') return undefined;
        if (antecedent.kind !== 'atom') return undefined;
        const impAnte = imp.args[0];
        const impCons = imp.args[1];
        if (!impAnte || !impCons) return undefined;
        if (impAnte.hash !== antecedent.hash) return undefined;
        return impCons;
    },

    modusTollens(premises: [Term, Term]): Term | undefined {
        const [imp, negConsequent] = premises;
        if (imp.kind !== 'implication') return undefined;
        if (negConsequent.kind !== 'negation') return undefined;
        const impCons = imp.args[1];
        const negArg = negConsequent.args[0];
        if (!impCons || !negArg) return undefined;
        if (impCons.hash !== negArg.hash) return undefined;
        const impAnte = imp.args[0];
        if (!impAnte) return undefined;
        return TermFactory.negation(impAnte);
    },

    conversion(premises: [Term, Term]): Term | undefined {
        const [inh] = premises;
        if (inh.kind !== 'inheritance') return undefined;
        const s = getSubject(inh);
        const p = getPredicate(inh);
        if (!s || !p) return undefined;
        return TermFactory.inheritance(p, s);
    },

    structuralInheritance(premises: [Term, Term]): Term | undefined {
        const [compound, component] = premises;
        if (compound.kind !== 'conjunction') return undefined;
        const found = compound.args.find(a => a.hash === component.hash);
        if (!found) return undefined;
        return TermFactory.inheritance(component, compound);
    },

    structuralReduction(premises: [Term, Term]): Term | undefined {
        const [inh] = premises;
        if (inh.kind !== 'inheritance') return undefined;
        const pred = getPredicate(inh);
        if (!pred || pred.kind !== 'conjunction') return undefined;
        const sub = getSubject(inh);
        if (!sub) return undefined;
        return TermFactory.inheritance(sub, pred.args[0] ?? pred);
    },

    intersectionComposition(premises: [Term, Term]): Term | undefined {
        const [inh1, inh2] = premises;
        if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
        const sub1 = getSubject(inh1);
        const sub2 = getSubject(inh2);
        if (!sub1 || !sub2 || sub1.hash !== sub2.hash) return undefined;
        const pred1 = getPredicate(inh1);
        const pred2 = getPredicate(inh2);
        if (!pred1 || !pred2) return undefined;
        return TermFactory.inheritance(sub1, TermFactory.conjunction(pred1, pred2));
    },

    unionComposition(premises: [Term, Term]): Term | undefined {
        const [inh1, inh2] = premises;
        if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
        const pred1 = getPredicate(inh1);
        const pred2 = getPredicate(inh2);
        if (!pred1 || !pred2 || pred1.hash !== pred2.hash) return undefined;
        const sub1 = getSubject(inh1);
        const sub2 = getSubject(inh2);
        if (!sub1 || !sub2) return undefined;
        return TermFactory.inheritance(TermFactory.disjunction(sub1, sub2), pred1);
    },

    difference(premises: [Term, Term]): Term | undefined {
        const [inh1, inh2] = premises;
        if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
        const sub1 = getSubject(inh1);
        const sub2 = getSubject(inh2);
        if (!sub1 || !sub2 || sub1.hash !== sub2.hash) return undefined;
        const pred1 = getPredicate(inh1);
        const pred2 = getPredicate(inh2);
        if (!pred1 || !pred2) return undefined;
        return TermFactory.inheritance(sub1, TermFactory.conjunction(pred1, TermFactory.negation(pred2)));
    },

    implicationDeduction(premises: [Term, Term]): Term | undefined {
        const [imp1, imp2] = premises;
        if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
        const cons1 = imp1.args[1];
        const ante2 = imp2.args[0];
        if (!cons1 || !ante2 || cons1.hash !== ante2.hash) return undefined;
        const ante1 = imp1.args[0];
        const cons2 = imp2.args[1];
        if (!ante1 || !cons2) return undefined;
        return TermFactory.implication(ante1, cons2);
    },

    equivalence(premises: [Term, Term]): Term | undefined {
        const [imp1, imp2] = premises;
        if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
        const a1 = imp1.args[0];
        const c1 = imp1.args[1];
        const a2 = imp2.args[0];
        const c2 = imp2.args[1];
        if (!a1 || !c1 || !a2 || !c2) return undefined;
        const forward = a1.hash === a2.hash && c1.hash === c2.hash;
        const backward = a1.hash === c2.hash && c1.hash === a2.hash;
        if (!forward && !backward) return undefined;
        return TermFactory.equivalence(a1, c1);
    },

    variableIntroduction(premises: [Term, Term]): Term | undefined {
        const [inh] = premises;
        if (inh.kind !== 'inheritance') return undefined;
        const sub = getSubject(inh);
        const pred = getPredicate(inh);
        if (!sub || !pred) return undefined;
        return TermFactory.inheritance(sub, pred);
    },

    decomposition(premises: [Term, Term]): Term | undefined {
        const [conj] = premises;
        if (conj.kind !== 'conjunction') return undefined;
        if (conj.args.length < 2) return undefined;
        const results: Term[] = [];
        for (const arg of conj.args) {
            results.push(arg);
        }
        return results[0] ?? conj;
    },

    variableDependency(_premises: [Term, Term]): Term | undefined {
        return undefined;
    },

    comparison(premises: [Term, Term]): Term | undefined {
        const [inh1, inh2] = premises;
        if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
        const s1 = getSubject(inh1);
        const p1 = getPredicate(inh1);
        const s2 = getSubject(inh2);
        const p2 = getPredicate(inh2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (s1.hash === s2.hash && p1.hash === p2.hash) {
            return TermFactory.similarity(s1, p1);
        }
        return undefined;
    },

    analogy(premises: [Term, Term]): Term | undefined {
        const [inh1, inh2] = premises;
        if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
        const pred1 = getPredicate(inh1);
        const sub2 = getSubject(inh2);
        if (!pred1 || !sub2 || pred1.hash !== sub2.hash) return undefined;
        const sub1 = getSubject(inh1);
        const pred2 = getPredicate(inh2);
        if (!sub1 || !pred2) return undefined;
        return TermFactory.inheritance(sub1, pred2);
    },

    contrapositionRule(premises: [Term, Term]): Term | undefined {
        const [imp] = premises;
        if (imp.kind !== 'implication') return undefined;
        const ante = imp.args[0];
        const cons = imp.args[1];
        if (!ante || !cons) return undefined;
        return TermFactory.implication(TermFactory.negation(cons), TermFactory.negation(ante));
    },

    exemplification(premises: [Term, Term]): Term | undefined {
        const [inh1, inh2] = premises;
        if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
        const sub1 = getSubject(inh1);
        const pred2 = getPredicate(inh2);
        if (!sub1 || !pred2) return undefined;
        return TermFactory.inheritance(sub1, pred2);
    },

    sameness(premises: [Term, Term]): Term | undefined {
        const [inh1, inh2] = premises;
        if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
        const s1 = getSubject(inh1);
        const p1 = getPredicate(inh1);
        const s2 = getSubject(inh2);
        const p2 = getPredicate(inh2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (s1.hash === s2.hash && p1.hash === p2.hash) {
            return TermFactory.similarity(s1, p1);
        }
        return undefined;
    },

    revisionWeak(premises: [Term, Term]): Term | undefined {
        const [inh1, inh2] = premises;
        if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
        const s1 = getSubject(inh1);
        const p1 = getPredicate(inh1);
        const s2 = getSubject(inh2);
        const p2 = getPredicate(inh2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (s1.hash === s2.hash && p1.hash === p2.hash) {
            return inh1;
        }
        return undefined;
    }
};

RuleRegistry.register({
    id: 'nal.modusPonens',
    pattern: createRulePattern('implication', 'atom'),
    apply: NALExtendedRules.modusPonens as any,
    sync: true,
    priority: 0.95
});

RuleRegistry.register({
    id: 'nal.modusTollens',
    pattern: createRulePattern('implication', 'negation'),
    apply: NALExtendedRules.modusTollens as any,
    sync: true,
    priority: 0.9
});

RuleRegistry.register({
    id: 'nal.conversion',
    pattern: createRulePattern('inheritance', 'inheritance'),
    apply: NALExtendedRules.conversion as any,
    sync: true,
    priority: 0.7
});

RuleRegistry.register({
    id: 'nal.analogy',
    pattern: createRulePattern('inheritance', 'inheritance'),
    apply: NALExtendedRules.analogy as any,
    sync: true,
    priority: 0.8
});

RuleRegistry.register({
    id: 'nal.comparison',
    pattern: createRulePattern('inheritance', 'inheritance'),
    apply: NALExtendedRules.comparison as any,
    sync: true,
    priority: 0.75
});

RuleRegistry.register({
    id: 'nal.contrapositionRule',
    pattern: createRulePattern('implication', 'implication'),
    apply: NALExtendedRules.contrapositionRule as any,
    sync: true,
    priority: 0.7
});