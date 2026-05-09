import type {Term} from '../terms';
import {getPredicate, getSubject, termsEqual, TermBuilder} from '../terms';
import {createRulePattern, type RuleFn, RuleRegistry, type TruthFn} from './types.js';
import {Truth} from '../terms';
import {matchInh, matchImp, matchConj, matchDisj, matchNeg, matchSim, matchEq, matchAtom, validInh, validImp, extractInh, extractImp} from './shared.js';

export const NALExtendedRules = {
    modusPonens: (premises: Term[]): Term | undefined => {
        const [imp, antecedent] = premises as [Term, Term];
        if (!matchImp(imp) || !matchAtom(antecedent)) return undefined;
        const [impAnte, impCons] = imp.args;
        return impAnte && impCons && termsEqual(impAnte, antecedent) ? impCons : undefined;
    },

    modusTollens: (premises: Term[]): Term | undefined => {
        const [imp, negConsequent] = premises as [Term, Term];
        if (!matchImp(imp) || !matchNeg(negConsequent)) return undefined;
        const impCons = imp.args[1];
        const negArg = negConsequent.args[0];
        if (!impCons || !negArg || !termsEqual(impCons, negArg)) return undefined;
        const impAnte = imp.args[0];
        return impAnte ? TermBuilder.negation(impAnte) : undefined;
    },

    conversion: (premises: Term[]): Term | undefined => {
        const [inh] = premises as [Term, Term];
        if (!matchInh(inh)) return undefined;
        const s = getSubject(inh), p = getPredicate(inh);
        return s && p ? TermBuilder.inheritance(p, s) : undefined;
    },

    structuralInheritance: (premises: Term[]): Term | undefined => {
        const [compound, component] = premises as [Term, Term];
        if (!matchConj(compound)) return undefined;
        const found = compound.args.find(a => termsEqual(a, component));
        return found ? TermBuilder.inheritance(component, compound) : undefined;
    },

    structuralReduction: (premises: Term[]): Term | undefined => {
        const [inh] = premises as [Term, Term];
        if (!matchInh(inh)) return undefined;
        const pred = getPredicate(inh);
        if (!pred || pred.kind !== 'conjunction') return undefined;
        const sub = getSubject(inh);
        return sub ? TermBuilder.inheritance(sub, pred.args[0] ?? pred) : undefined;
    },

    intersectionComposition: (premises: Term[]): Term | undefined => {
        const [inh1, inh2] = premises as [Term, Term];
        if (!matchInh(inh1) || !matchInh(inh2)) return undefined;
        const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
        if (!sub1 || !sub2 || !termsEqual(sub1, sub2)) return undefined;
        const pred1 = getPredicate(inh1), pred2 = getPredicate(inh2);
        return pred1 && pred2 ? TermBuilder.inheritance(sub1, TermBuilder.conjunction(pred1, pred2)) : undefined;
    },

    unionComposition: (premises: Term[]): Term | undefined => {
        const [inh1, inh2] = premises as [Term, Term];
        if (!matchInh(inh1) || !matchInh(inh2)) return undefined;
        const pred1 = getPredicate(inh1), pred2 = getPredicate(inh2);
        if (!pred1 || !pred2 || !termsEqual(pred1, pred2)) return undefined;
        const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
        return sub1 && sub2 ? TermBuilder.inheritance(TermBuilder.disjunction(sub1, sub2), pred1) : undefined;
    },

    difference: (premises: Term[]): Term | undefined => {
        const [inh1, inh2] = premises as [Term, Term];
        if (!matchInh(inh1) || !matchInh(inh2)) return undefined;
        const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
        if (!sub1 || !sub2 || !termsEqual(sub1, sub2)) return undefined;
        const pred1 = getPredicate(inh1);
        const pred2 = getPredicate(inh2);
        if (!pred1 || !pred2) return undefined;
        return TermBuilder.inheritance(sub1, TermBuilder.conjunction(pred1, TermBuilder.negation(pred2)));
    },

    implicationDeduction: (premises: Term[]): Term | undefined => {
        const [imp1, imp2] = premises as [Term, Term];
        if (!matchImp(imp1) || !matchImp(imp2)) return undefined;
        const cons1 = imp1.args[1];
        const ante2 = imp2.args[0];
        if (!cons1 || !ante2 || !termsEqual(cons1, ante2)) return undefined;
        const ante1 = imp1.args[0];
        const cons2 = imp2.args[1];
        if (!ante1 || !cons2) return undefined;
        return TermBuilder.implication(ante1, cons2);
    },

    equivalence: (premises: Term[]): Term | undefined => {
        const [imp1, imp2] = premises as [Term, Term];
        if (!matchImp(imp1) || !matchImp(imp2)) return undefined;
        const a1 = imp1.args[0];
        const c1 = imp1.args[1];
        const a2 = imp2.args[0];
        const c2 = imp2.args[1];
        if (!a1 || !c1 || !a2 || !c2) return undefined;
        const forward = termsEqual(a1, a2) && termsEqual(c1, c2);
        const backward = termsEqual(a1, c2) && termsEqual(c1, a2);
        if (!forward && !backward) return undefined;
        return TermBuilder.equivalence(a1, c1);
    },

    variableIntroduction: (premises: Term[]): Term | undefined => {
        const [inh] = premises as [Term, Term];
        if (!matchInh(inh)) return undefined;
        const sub = getSubject(inh);
        const pred = getPredicate(inh);
        if (!sub || !pred) return undefined;
        return TermBuilder.inheritance(sub, pred);
    },

    decomposition: (premises: Term[]): Term | undefined => {
        const [conj] = premises as [Term, Term];
        if (!matchConj(conj)) return undefined;
        if (conj.args.length < 2) return undefined;
        const results: Term[] = [];
        for (const arg of conj.args) {
            results.push(arg);
        }
        return results[0] ?? conj;
    },

    variableDependency: (_premises: Term[]): Term | undefined => {
        return undefined;
    },

    comparison: (premises: Term[]): Term | undefined => {
        const [inh1, inh2] = premises as [Term, Term];
        if (!matchInh(inh1) || !matchInh(inh2)) return undefined;
        const s1 = getSubject(inh1);
        const p1 = getPredicate(inh1);
        const s2 = getSubject(inh2);
        const p2 = getPredicate(inh2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (termsEqual(s1, s2) && termsEqual(p1, p2)) {
            return TermBuilder.similarity(s1, p1);
        }
        return undefined;
    },

    analogy: (premises: Term[]): Term | undefined => {
        const [inh1, inh2] = premises as [Term, Term];
        if (!matchInh(inh1) || !matchInh(inh2)) return undefined;
        const pred1 = getPredicate(inh1);
        const sub2 = getSubject(inh2);
        if (!pred1 || !sub2 || !termsEqual(pred1, sub2)) return undefined;
        const sub1 = getSubject(inh1);
        const pred2 = getPredicate(inh2);
        if (!sub1 || !pred2) return undefined;
        return TermBuilder.inheritance(sub1, pred2);
    },

    contrapositionRule: (premises: Term[]): Term | undefined => {
        const [imp] = premises as [Term, Term];
        if (!matchImp(imp)) return undefined;
        const ante = imp.args[0];
        const cons = imp.args[1];
        if (!ante || !cons) return undefined;
        return TermBuilder.implication(TermBuilder.negation(cons), TermBuilder.negation(ante));
    },

    exemplification: (premises: Term[]): Term | undefined => {
        const [inh1, inh2] = premises as [Term, Term];
        if (!matchInh(inh1) || !matchInh(inh2)) return undefined;
        const sub1 = getSubject(inh1);
        const pred2 = getPredicate(inh2);
        if (!sub1 || !pred2) return undefined;
        return TermBuilder.inheritance(sub1, pred2);
    },

    sameness: (premises: Term[]): Term | undefined => {
        const [inh1, inh2] = premises as [Term, Term];
        if (!matchInh(inh1) || !matchInh(inh2)) return undefined;
        const s1 = getSubject(inh1);
        const p1 = getPredicate(inh1);
        const s2 = getSubject(inh2);
        const p2 = getPredicate(inh2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (termsEqual(s1, s2) && termsEqual(p1, p2)) {
            return TermBuilder.similarity(s1, p1);
        }
        return undefined;
    },

    revisionWeak: (premises: Term[]): Term | undefined => {
        const [inh1, inh2] = premises as [Term, Term];
        if (!matchInh(inh1) || !matchInh(inh2)) return undefined;
        const s1 = getSubject(inh1);
        const p1 = getPredicate(inh1);
        const s2 = getSubject(inh2);
        const p2 = getPredicate(inh2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (termsEqual(s1, s2) && termsEqual(p1, p2)) {
            return inh1;
        }
        return undefined;
    }
};

const registerExtendedRule = (
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

registerExtendedRule('nal.modusPonens', 'implication', 'atom', NALExtendedRules.modusPonens, Truth.deduction, 0.95);
registerExtendedRule('nal.modusTollens', 'implication', 'negation', NALExtendedRules.modusTollens, Truth.contraposition, 0.9);
registerExtendedRule('nal.conversion', 'inheritance', 'inheritance', NALExtendedRules.conversion, Truth.conversion, 0.7);
registerExtendedRule('nal.analogy', 'inheritance', 'inheritance', NALExtendedRules.analogy, Truth.analogy, 0.8);
registerExtendedRule('nal.comparison', 'inheritance', 'inheritance', NALExtendedRules.comparison, Truth.resemblance, 0.75);
registerExtendedRule('nal.contrapositionRule', 'implication', 'implication', NALExtendedRules.contrapositionRule, Truth.contraposition, 0.7);
registerExtendedRule('nal.structuralInheritance', 'conjunction', 'inheritance', NALExtendedRules.structuralInheritance, Truth.deduction, 0.75);
registerExtendedRule('nal.structuralReduction', 'inheritance', 'inheritance', NALExtendedRules.structuralReduction, Truth.structuralReduction, 0.7);
registerExtendedRule('nal.intersectionComposition', 'inheritance', 'inheritance', NALExtendedRules.intersectionComposition, Truth.intersection, 0.8);
registerExtendedRule('nal.unionComposition', 'inheritance', 'inheritance', NALExtendedRules.unionComposition, Truth.union, 0.75);
registerExtendedRule('nal.difference', 'inheritance', 'inheritance', NALExtendedRules.difference, Truth.deduction, 0.7);
registerExtendedRule('nal.implicationDeduction', 'implication', 'implication', NALExtendedRules.implicationDeduction, Truth.deduction, 0.85);
registerExtendedRule('nal.equivalence', 'implication', 'implication', NALExtendedRules.equivalence, Truth.intersection, 0.8);
registerExtendedRule('nal.variableIntroduction', 'inheritance', 'inheritance', NALExtendedRules.variableIntroduction, Truth.deduction, 0.6);
registerExtendedRule('nal.decomposition', 'conjunction', 'conjunction', NALExtendedRules.decomposition, Truth.deduction, 0.75);
registerExtendedRule('nal.variableDependency', 'inheritance', 'inheritance', NALExtendedRules.variableDependency, Truth.deduction, 0.5);
registerExtendedRule('nal.sameness', 'inheritance', 'inheritance', NALExtendedRules.sameness, Truth.sameness, 0.85);
registerExtendedRule('nal.revisionWeak', 'inheritance', 'inheritance', NALExtendedRules.revisionWeak, Truth.revision, 0.65);
registerExtendedRule('nal.exemplification', 'inheritance', 'inheritance', NALExtendedRules.exemplification, Truth.exemplification, 0.8);