import type {Term} from '../terms';
import {getPredicate, getSubject, sameHash, termsEqual, TermBuilder, Truth} from '../terms';
import {createRulePattern, type RuleFn, RuleRegistry, type TruthFn} from './types.js';

const getVariables = (term: Term): Term[] => {
  const vars: Term[] = [];
  const collect = (t: Term): void => {
    if (t.kind === 'atom' && t.isVariable) {
      vars.push(t);
    } else if ('args' in t) {
      t.args.forEach(collect);
    }
  };
  collect(term);
  return vars;
};

export const NALExtendedRules = {
    modusPonens: ([imp, antecedent]: [Term, Term]): Term | undefined => {
        if (imp.kind !== 'implication' || antecedent.kind !== 'atom') return undefined;
        const [impAnte, impCons] = imp.args;
        return impAnte && impCons && sameHash(impAnte, antecedent) ? impCons : undefined;
    },

    modusTollens: ([imp, negConsequent]: [Term, Term]): Term | undefined => {
        if (imp.kind !== 'implication' || negConsequent.kind !== 'negation') return undefined;
        const impCons = imp.args[1];
        const negArg = negConsequent.args[0];
        if (!impCons || !negArg || !sameHash(impCons, negArg)) return undefined;
        const impAnte = imp.args[0];
        return impAnte ? TermBuilder.negation(impAnte) : undefined;
    },

    conversion: ([inh]: [Term, Term]): Term | undefined => {
        if (inh.kind !== 'inheritance') return undefined;
        const s = getSubject(inh), p = getPredicate(inh);
        return s && p ? TermBuilder.inheritance(p, s) : undefined;
    },

    structuralInheritance: ([compound, component]: [Term, Term]): Term | undefined => {
        if (compound.kind !== 'conjunction') return undefined;
        const found = compound.args.find(a => sameHash(a, component));
        return found ? TermBuilder.inheritance(component, compound) : undefined;
    },

    structuralReduction: ([inh]: [Term, Term]): Term | undefined => {
        if (inh.kind !== 'inheritance') return undefined;
        const pred = getPredicate(inh);
        if (!pred || pred.kind !== 'conjunction') return undefined;
        const sub = getSubject(inh);
        return sub ? TermBuilder.inheritance(sub, pred.args[0] ?? pred) : undefined;
    },

    intersectionComposition: ([inh1, inh2]: [Term, Term]): Term | undefined => {
        if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
        const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
        if (!sub1 || !sub2 || !sameHash(sub1, sub2)) return undefined;
        const pred1 = getPredicate(inh1), pred2 = getPredicate(inh2);
        return pred1 && pred2 ? TermBuilder.inheritance(sub1, TermBuilder.conjunction(pred1, pred2)) : undefined;
    },

    unionComposition: ([inh1, inh2]: [Term, Term]): Term | undefined => {
        if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
        const pred1 = getPredicate(inh1), pred2 = getPredicate(inh2);
        if (!pred1 || !pred2 || !sameHash(pred1, pred2)) return undefined;
        const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
        return sub1 && sub2 ? TermBuilder.inheritance(TermBuilder.disjunction(sub1, sub2), pred1) : undefined;
    },

    difference: ([inh1, inh2]: [Term, Term]): Term | undefined => {
        if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
        const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
        if (!sub1 || !sub2 || sub1.hash !== sub2.hash) return undefined;
        const pred1 = getPredicate(inh1);
        const pred2 = getPredicate(inh2);
        if (!pred1 || !pred2) return undefined;
        return TermBuilder.inheritance(sub1, TermBuilder.conjunction(pred1, TermBuilder.negation(pred2)));
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
        return TermBuilder.implication(ante1, cons2);
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
        return TermBuilder.equivalence(a1, c1);
    },

    variableIntroduction(premises: [Term, Term]): Term | undefined {
        const [inh] = premises;
        if (inh.kind !== 'inheritance') return undefined;
        const sub = getSubject(inh);
        const pred = getPredicate(inh);
        if (!sub || !pred) return undefined;
        return TermBuilder.inheritance(sub, pred);
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

  variableDependency(premises: [Term, Term]): Term | undefined {
    const [t1, t2] = premises;
    const vars1 = getVariables(t1);
    const vars2 = getVariables(t2);
    
    if (vars1.length === 0 || vars2.length === 0) return undefined;
    
    const shared = vars1.filter(v1 => vars2.some(v2 => v2.hash === v1.hash));
    if (shared.length === 0) return undefined;
    
    const depTerm = TermBuilder.conjunction(...shared);
    return depTerm;
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
            return TermBuilder.similarity(s1, p1);
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
        return TermBuilder.inheritance(sub1, pred2);
    },

    contrapositionRule(premises: [Term, Term]): Term | undefined {
        const [imp] = premises;
        if (imp.kind !== 'implication') return undefined;
        const ante = imp.args[0];
        const cons = imp.args[1];
        if (!ante || !cons) return undefined;
        return TermBuilder.implication(TermBuilder.negation(cons), TermBuilder.negation(ante));
    },

    exemplification(premises: [Term, Term]): Term | undefined {
        const [inh1, inh2] = premises;
        if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
        const sub1 = getSubject(inh1);
        const pred2 = getPredicate(inh2);
        if (!sub1 || !pred2) return undefined;
        return TermBuilder.inheritance(sub1, pred2);
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
            return TermBuilder.similarity(s1, p1);
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
  },

  instanceConversion: ([inh]: [Term, Term]): Term | undefined => {
    if (inh.kind !== 'inheritance') return undefined;
    const s = getSubject(inh);
    const p = getPredicate(inh);
    if (!s || !p) return undefined;
    return TermBuilder.inheritance(TermBuilder.instance(s), TermBuilder.instance(p));
  },

  propertyConversion: ([inh]: [Term, Term]): Term | undefined => {
    if (inh.kind !== 'inheritance') return undefined;
    const s = getSubject(inh);
    const p = getPredicate(inh);
    if (!s || !p) return undefined;
    return TermBuilder.inheritance(TermBuilder.property(s), TermBuilder.property(p));
  },

  instanceDeduction: ([inh, inst]: [Term, Term]): Term | undefined => {
    if (inh.kind !== 'inheritance') return undefined;
    if (inst.kind !== 'instance') return undefined;
    const s = getSubject(inh);
    const p = getPredicate(inh);
    const instArg = inst.args[0];
    if (!s || !p || !instArg) return undefined;
    if (sameHash(s, instArg)) {
      return TermBuilder.inheritance(instArg, p);
    }
    return undefined;
  },

  propertyInduction: ([inh, prop]: [Term, Term]): Term | undefined => {
    if (inh.kind !== 'inheritance') return undefined;
    if (prop.kind !== 'property') return undefined;
    const s = getSubject(inh);
    const p = getPredicate(inh);
    const propArg = prop.args[0];
    if (!s || !p || !propArg) return undefined;
    if (sameHash(p, propArg)) {
      return TermBuilder.inheritance(s, propArg);
    }
    return undefined;
  },

  sequenceIntroduction: ([inh1, inh2]: [Term, Term]): Term | undefined => {
    if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
    const s1 = getSubject(inh1);
    const p1 = getPredicate(inh1);
    const s2 = getSubject(inh2);
    const p2 = getPredicate(inh2);
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    if (termsEqual(s1, s2)) {
      return TermBuilder.inheritance(s1, TermBuilder.sequence(p1, p2));
    }
    return undefined;
  },

  parallelIntroduction: ([inh1, inh2]: [Term, Term]): Term | undefined => {
    if (inh1.kind !== 'inheritance' || inh2.kind !== 'inheritance') return undefined;
    const s1 = getSubject(inh1);
    const p1 = getPredicate(inh1);
    const s2 = getSubject(inh2);
    const p2 = getPredicate(inh2);
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    if (termsEqual(s1, s2)) {
      return TermBuilder.inheritance(s1, TermBuilder.parallel(p1, p2));
    }
    return undefined;
  },

  predictiveImplication: ([seq, inh]: [Term, Term]): Term | undefined => {
    if (seq.kind !== 'sequence') return undefined;
    if (inh.kind !== 'inheritance') return undefined;
    const [seqA, seqB] = seq.args;
    const s = getSubject(inh);
    const p = getPredicate(inh);
    if (!seqA || !seqB || !s || !p) return undefined;
    if (termsEqual(seqA, s) && termsEqual(seqB, p)) {
      return TermBuilder.predictive(s, p);
    }
    return undefined;
  },

  temporalDeduction: ([pred, seq]: [Term, Term]): Term | undefined => {
    if (pred.kind !== 'predictive') return undefined;
    if (seq.kind !== 'sequence') return undefined;
    const [predA, predB] = pred.args;
    const [seqA, seqB] = seq.args;
    if (!predA || !predB || !seqA || !seqB) return undefined;
    if (termsEqual(predA, seqA) && termsEqual(predB, seqB)) {
      return TermBuilder.inheritance(seqA, seqB);
    }
    return undefined;
  },

  operationExecution: ([op, input]: [Term, Term]): Term | undefined => {
    if (op.kind !== 'inheritance') return undefined;
    const inputTerm = input.kind === 'inheritance' ? input : input;
    return TermBuilder.operation(op, inputTerm);
  },

  goalExecution: ([goal, op]: [Term, Term]): Term | undefined => {
    if (op.kind !== 'operation') return undefined;
    const [opTerm, input] = op.args;
    if (!opTerm || !input) return undefined;
    return TermBuilder.inheritance(goal, opTerm);
  },

  proceduralDecomposition: ([seq, op]: [Term, Term]): Term | undefined => {
    if (seq.kind !== 'sequence') return undefined;
    if (op.kind !== 'operation') return undefined;
    const [seqA, seqB] = seq.args;
    const [opTerm, input] = op.args;
    if (!seqA || !seqB || !opTerm || !input) return undefined;
    return TermBuilder.sequence(seqA, TermBuilder.operation(opTerm, input));
  },

  proceduralChaining: ([op1, op2]: [Term, Term]): Term | undefined => {
    if (op1.kind !== 'operation' || op2.kind !== 'operation') return undefined;
    const [op1Term, input1] = op1.args;
    const [op2Term, input2] = op2.args;
    if (!op1Term || !input1 || !op2Term || !input2) return undefined;
    if (termsEqual(input1, op2Term)) {
      return TermBuilder.sequence(op1Term, input2);
    }
    return undefined;
  },

  operationToPredictive: ([op, seq]: [Term, Term]): Term | undefined => {
    if (op.kind !== 'operation') return undefined;
    if (seq.kind !== 'sequence') return undefined;
    const [opTerm, input] = op.args;
    const [seqA, seqB] = seq.args;
    if (!opTerm || !input || !seqA || !seqB) return undefined;
    if (termsEqual(opTerm, seqA) && termsEqual(input, seqB)) {
      return TermBuilder.predictive(seqA, seqB);
    }
    return undefined;
  },

  strategyEffectiveness: ([strategy, result]: [Term, Term]): Term | undefined => {
    if (strategy.kind !== 'inheritance') return undefined;
    if (result.kind !== 'inheritance') return undefined;
    const s = getSubject(strategy);
    const p = getPredicate(strategy);
    if (!s || !p) return undefined;
    return TermBuilder.inheritance(TermBuilder.operation(s, p), result);
  },

  resourceAllocation: ([task, resource]: [Term, Term]): Term | undefined => {
    if (task.kind !== 'inheritance') return undefined;
    if (resource.kind !== 'inheritance') return undefined;
    const t = getSubject(task);
    const r = getSubject(resource);
    if (!t || !r) return undefined;
    return TermBuilder.inheritance(t, TermBuilder.operation(TermBuilder.atom('allocate'), r));
  },

  errorPatternDetection: ([error, context]: [Term, Term]): Term | undefined => {
    if (error.kind !== 'inheritance') return undefined;
    if (context.kind !== 'inheritance') return undefined;
    const e = getPredicate(error);
    const c = getSubject(context);
    if (!e || !c) return undefined;
    return TermBuilder.predictive(c, TermBuilder.negation(e));
  },

  utilityEstimation: ([concept, utility]: [Term, Term]): Term | undefined => {
    if (concept.kind !== 'inheritance') return undefined;
    if (utility.kind !== 'inheritance') return undefined;
    const c = getSubject(concept);
    const u = getPredicate(utility);
    if (!c || !u) return undefined;
    return TermBuilder.inheritance(c, TermBuilder.operation(TermBuilder.atom('utility'), u));
  },

  metacognitiveRevision: ([belief1, belief2]: [Term, Term]): Term | undefined => {
    if (belief1.kind !== 'inheritance' || belief2.kind !== 'inheritance') return undefined;
    const s1 = getSubject(belief1);
    const p1 = getPredicate(belief1);
    const s2 = getSubject(belief2);
    const p2 = getPredicate(belief2);
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    if (termsEqual(s1, s2) && termsEqual(p1, p2)) {
      return TermBuilder.inheritance(
        TermBuilder.operation(TermBuilder.atom('meta'), s1),
        TermBuilder.operation(TermBuilder.atom('revise'), p1)
      );
    }
    return undefined;
  },

  selfModelConsistency: ([model1, model2]: [Term, Term]): Term | undefined => {
    if (model1.kind !== 'inheritance' || model2.kind !== 'inheritance') return undefined;
    const s1 = getSubject(model1);
    const s2 = getSubject(model2);
    if (!s1 || !s2) return undefined;
    if (termsEqual(s1, s2)) {
      return TermBuilder.similarity(
        TermBuilder.operation(TermBuilder.atom('self'), s1),
        TermBuilder.operation(TermBuilder.atom('model'), s2)
      );
    }
    return undefined;
  }
};

const registerExtendedRule = (
  id: string,
  left: string,
  right: string,
  fn: RuleFn,
  truthFn: TruthFn,
  priority: number
) =>
  RuleRegistry.register({
    id,
    pattern: createRulePattern(left, right),
    apply: fn,
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
registerExtendedRule('nal.instanceConversion', 'inheritance', 'instance', NALExtendedRules.instanceConversion, Truth.conversion, 0.7);
registerExtendedRule('nal.propertyConversion', 'inheritance', 'property', NALExtendedRules.propertyConversion, Truth.conversion, 0.7);
registerExtendedRule('nal.instanceDeduction', 'inheritance', 'instance', NALExtendedRules.instanceDeduction, Truth.deduction, 0.85);
registerExtendedRule('nal.propertyInduction', 'inheritance', 'property', NALExtendedRules.propertyInduction, Truth.induction, 0.75);
registerExtendedRule('nal.sequenceIntroduction', 'inheritance', 'inheritance', NALExtendedRules.sequenceIntroduction, Truth.deduction, 0.75);
registerExtendedRule('nal.parallelIntroduction', 'inheritance', 'inheritance', NALExtendedRules.parallelIntroduction, Truth.deduction, 0.7);
registerExtendedRule('nal.predictiveImplication', 'sequence', 'inheritance', NALExtendedRules.predictiveImplication, Truth.deduction, 0.8);
registerExtendedRule('nal.temporalDeduction', 'predictive', 'sequence', NALExtendedRules.temporalDeduction, Truth.deduction, 0.85);
registerExtendedRule('nal.operationExecution', 'inheritance', 'inheritance', NALExtendedRules.operationExecution, Truth.deduction, 0.8);
registerExtendedRule('nal.goalExecution', 'inheritance', 'operation', NALExtendedRules.goalExecution, Truth.deduction, 0.85);
registerExtendedRule('nal.proceduralDecomposition', 'sequence', 'operation', NALExtendedRules.proceduralDecomposition, Truth.deduction, 0.75);
registerExtendedRule('nal.proceduralChaining', 'operation', 'operation', NALExtendedRules.proceduralChaining, Truth.deduction, 0.8);
registerExtendedRule('nal.operationToPredictive', 'operation', 'sequence', NALExtendedRules.operationToPredictive, Truth.deduction, 0.75);
registerExtendedRule('nal.strategyEffectiveness', 'inheritance', 'inheritance', NALExtendedRules.strategyEffectiveness, Truth.deduction, 0.8);
registerExtendedRule('nal.resourceAllocation', 'inheritance', 'inheritance', NALExtendedRules.resourceAllocation, Truth.deduction, 0.75);
registerExtendedRule('nal.errorPatternDetection', 'inheritance', 'inheritance', NALExtendedRules.errorPatternDetection, Truth.deduction, 0.7);
registerExtendedRule('nal.utilityEstimation', 'inheritance', 'inheritance', NALExtendedRules.utilityEstimation, Truth.deduction, 0.8);
registerExtendedRule('nal.metacognitiveRevision', 'inheritance', 'inheritance', NALExtendedRules.metacognitiveRevision, Truth.revision, 0.85);
registerExtendedRule('nal.selfModelConsistency', 'inheritance', 'inheritance', NALExtendedRules.selfModelConsistency, Truth.sameness, 0.9);