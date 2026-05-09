import type {Term} from '../terms';
import {getPredicate, getSubject, termsEqual, TermBuilder} from '../terms';
import {createRulePattern, type RuleFn, RuleRegistry, type TruthFn} from './types.js';
import {Truth} from '../terms';
import {matchInh, matchImp, matchConj, matchDisj, matchNeg, matchSim, matchEq, matchAtom, validInh, validImp, extractInh, extractImp} from './shared.js';

export const NALExtendedRules = {
    modusPonens: (premises: Term[]): Term | undefined => {
        const [imp, antecedent] = premises as [Term, Term];
        if (!matchImp(imp) || !matchAtom(antecedent)) return undefined;
        const impArgs = (imp as any).args as Term[];
        const [impAnte, impCons] = [impArgs[0], impArgs[1]];
        return impAnte && impCons && termsEqual(impAnte, antecedent) ? impCons : undefined;
    },

    modusTollens: (premises: Term[]): Term | undefined => {
        const [imp, negConsequent] = premises as [Term, Term];
        if (!matchImp(imp) || !matchNeg(negConsequent)) return undefined;
        const impArgs = (imp as any).args as Term[];
        const negArgs = (negConsequent as any).args as Term[];
        const impCons = impArgs[1];
        const negArg = negArgs[0];
        if (!impCons || !negArg || !termsEqual(impCons, negArg)) return undefined;
        const impAnte = impArgs[0];
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
        const compoundArgs = (compound as any).args as Term[];
        const found = compoundArgs.find((a: Term) => termsEqual(a, component));
        return found ? TermBuilder.inheritance(component, compound) : undefined;
    },

    structuralReduction: (premises: Term[]): Term | undefined => {
        const [inh] = premises as [Term, Term];
        if (!matchInh(inh)) return undefined;
        const pred = getPredicate(inh);
        if (!pred || pred.kind !== 'conjunction') return undefined;
        const sub = getSubject(inh);
        const predArgs = ('args' in pred) ? (pred as any).args as Term[] : [];
        return sub ? TermBuilder.inheritance(sub, predArgs[0] ?? pred) : undefined;
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
        const imp1Args = (imp1 as any).args as Term[];
        const imp2Args = (imp2 as any).args as Term[];
        const cons1 = imp1Args[1];
        const ante2 = imp2Args[0];
        if (!cons1 || !ante2 || !termsEqual(cons1, ante2)) return undefined;
        const ante1 = imp1Args[0];
        const cons2 = imp2Args[1];
        if (!ante1 || !cons2) return undefined;
        return TermBuilder.implication(ante1, cons2);
    },

    equivalence: (premises: Term[]): Term | undefined => {
        const [imp1, imp2] = premises as [Term, Term];
        if (!matchImp(imp1) || !matchImp(imp2)) return undefined;
        const imp1Args = (imp1 as any).args as Term[];
        const imp2Args = (imp2 as any).args as Term[];
        const a1 = imp1Args[0];
        const c1 = imp1Args[1];
        const a2 = imp2Args[0];
        const c2 = imp2Args[1];
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
        const conjArgs = (conj as any).args as Term[];
        if (conjArgs.length < 2) return undefined;
        const results: Term[] = [];
        for (const arg of conjArgs) {
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
        const impArgs2 = (imp as any).args as Term[];
        const ante = impArgs2[0];
        const cons = impArgs2[1];
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

RuleRegistry.register({id: 'nal.modusPonens', pattern: createRulePattern('implication', 'atom'), apply: NALExtendedRules.modusPonens as unknown as RuleFn, sync: true, priority: 0.95, truthFn: Truth.deduction});
RuleRegistry.register({id: 'nal.modusTollens', pattern: createRulePattern('implication', 'negation'), apply: NALExtendedRules.modusTollens as unknown as RuleFn, sync: true, priority: 0.9, truthFn: Truth.contraposition});
RuleRegistry.register({id: 'nal.conversion', pattern: createRulePattern('inheritance', 'inheritance'), apply: NALExtendedRules.conversion as unknown as RuleFn, sync: true, priority: 0.7, truthFn: Truth.conversion});
RuleRegistry.register({id: 'nal.analogy', pattern: createRulePattern('inheritance', 'inheritance'), apply: NALExtendedRules.analogy as unknown as RuleFn, sync: true, priority: 0.8, truthFn: Truth.analogy});
RuleRegistry.register({id: 'nal.comparison', pattern: createRulePattern('inheritance', 'inheritance'), apply: NALExtendedRules.comparison as unknown as RuleFn, sync: true, priority: 0.75, truthFn: Truth.resemblance});
RuleRegistry.register({id: 'nal.contrapositionRule', pattern: createRulePattern('implication', 'implication'), apply: NALExtendedRules.contrapositionRule as unknown as RuleFn, sync: true, priority: 0.7, truthFn: Truth.contraposition});
RuleRegistry.register({id: 'nal.structuralInheritance', pattern: createRulePattern('conjunction', 'inheritance'), apply: NALExtendedRules.structuralInheritance as unknown as RuleFn, sync: true, priority: 0.75, truthFn: Truth.deduction});
RuleRegistry.register({id: 'nal.structuralReduction', pattern: createRulePattern('inheritance', 'inheritance'), apply: NALExtendedRules.structuralReduction as unknown as RuleFn, sync: true, priority: 0.7, truthFn: Truth.structuralReduction});
RuleRegistry.register({id: 'nal.intersectionComposition', pattern: createRulePattern('inheritance', 'inheritance'), apply: NALExtendedRules.intersectionComposition as unknown as RuleFn, sync: true, priority: 0.8, truthFn: Truth.intersection});
RuleRegistry.register({id: 'nal.unionComposition', pattern: createRulePattern('inheritance', 'inheritance'), apply: NALExtendedRules.unionComposition as unknown as RuleFn, sync: true, priority: 0.75, truthFn: Truth.union});
RuleRegistry.register({id: 'nal.difference', pattern: createRulePattern('inheritance', 'inheritance'), apply: NALExtendedRules.difference as unknown as RuleFn, sync: true, priority: 0.7, truthFn: Truth.deduction});
RuleRegistry.register({id: 'nal.implicationDeduction', pattern: createRulePattern('implication', 'implication'), apply: NALExtendedRules.implicationDeduction as unknown as RuleFn, sync: true, priority: 0.85, truthFn: Truth.deduction});
RuleRegistry.register({id: 'nal.equivalence', pattern: createRulePattern('implication', 'implication'), apply: NALExtendedRules.equivalence as unknown as RuleFn, sync: true, priority: 0.8, truthFn: Truth.intersection});
RuleRegistry.register({id: 'nal.variableIntroduction', pattern: createRulePattern('inheritance', 'inheritance'), apply: NALExtendedRules.variableIntroduction as unknown as RuleFn, sync: true, priority: 0.6, truthFn: Truth.deduction});
RuleRegistry.register({id: 'nal.decomposition', pattern: createRulePattern('conjunction', 'conjunction'), apply: NALExtendedRules.decomposition as unknown as RuleFn, sync: true, priority: 0.75, truthFn: Truth.deduction});
RuleRegistry.register({id: 'nal.variableDependency', pattern: createRulePattern('inheritance', 'inheritance'), apply: NALExtendedRules.variableDependency as unknown as RuleFn, sync: true, priority: 0.5, truthFn: Truth.deduction});
RuleRegistry.register({id: 'nal.sameness', pattern: createRulePattern('inheritance', 'inheritance'), apply: NALExtendedRules.sameness as unknown as RuleFn, sync: true, priority: 0.85, truthFn: Truth.sameness});
RuleRegistry.register({id: 'nal.revisionWeak', pattern: createRulePattern('inheritance', 'inheritance'), apply: NALExtendedRules.revisionWeak as unknown as RuleFn, sync: true, priority: 0.65, truthFn: Truth.revision});
RuleRegistry.register({id: 'nal.exemplification', pattern: createRulePattern('inheritance', 'inheritance'), apply: NALExtendedRules.exemplification as unknown as RuleFn, sync: true, priority: 0.8, truthFn: Truth.exemplification});
