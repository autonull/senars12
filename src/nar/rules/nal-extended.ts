import type {Term} from '../terms';
import {getPredicate, getSubject, TermBuilder, termsEqual, Truth} from '../terms';
import {type RuleFn} from './types.js';
import {registerRule} from './shared.js';

const getVariables = (term: Term): Term[] => {
    const vars: Term[] = [];
    const collect = (t: Term): void => {
        if (t.kind === 'atom' && (t as any).isVariable) {
            vars.push(t);
        } else if (t.kind !== 'atom') {
            (t.args ?? []).forEach(collect);
        }
    };
    collect(term);
    return vars;
};

const inhRule = (fn: (inh: Term) => Term | undefined): RuleFn => ([t1, _t2]) => {
    if (t1.kind !== 'inheritance') return undefined;
    return fn(t1);
};

const binaryInhRule = (fn: (inh1: Term, inh2: Term) => Term | undefined): RuleFn => ([t1, t2]) => {
    if (t1.kind !== 'inheritance' || t2.kind !== 'inheritance') return undefined;
    return fn(t1, t2);
};

export const NALExtendedRules = {
    modusPonens: ([imp, antecedent]: [Term, Term]): Term | undefined => {
        if (imp.kind !== 'implication' || antecedent.kind !== 'atom') return undefined;
        const [impAnte, impCons] = imp.args;
        return impAnte && impCons && termsEqual(impAnte, antecedent) ? impCons : undefined;
    },

    modusTollens: ([imp, negConsequent]: [Term, Term]): Term | undefined => {
        if (imp.kind !== 'implication' || negConsequent.kind !== 'negation') return undefined;
        const impCons = imp.args[1];
        const negArg = negConsequent.args[0];
        if (!impCons || !negArg || !termsEqual(impCons, negArg)) return undefined;
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
        const found = compound.args.find(a => termsEqual(a, component));
        return found ? TermBuilder.inheritance(component, compound) : undefined;
    },

    structuralReduction: ([inh]: [Term, Term]): Term | undefined => {
        if (inh.kind !== 'inheritance') return undefined;
        const pred = getPredicate(inh);
        if (!pred || pred.kind !== 'conjunction') return undefined;
        const sub = getSubject(inh);
        return sub ? TermBuilder.inheritance(sub, pred.args[0] ?? pred) : undefined;
    },

    intersectionComposition: binaryInhRule((inh1, inh2) => {
        const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
        if (!sub1 || !sub2 || !termsEqual(sub1, sub2)) return undefined;
        const pred1 = getPredicate(inh1), pred2 = getPredicate(inh2);
        return pred1 && pred2 ? TermBuilder.inheritance(sub1, TermBuilder.conjunction(pred1, pred2)) : undefined;
    }),

    unionComposition: binaryInhRule((inh1, inh2) => {
        const pred1 = getPredicate(inh1), pred2 = getPredicate(inh2);
        if (!pred1 || !pred2 || !termsEqual(pred1, pred2)) return undefined;
        const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
        return sub1 && sub2 ? TermBuilder.inheritance(TermBuilder.disjunction(sub1, sub2), pred1) : undefined;
    }),

    difference: binaryInhRule((inh1, inh2) => {
        const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
        if (!sub1 || !sub2 || !termsEqual(sub1, sub2)) return undefined;
        const pred1 = getPredicate(inh1);
        const pred2 = getPredicate(inh2);
        if (!pred1 || !pred2) return undefined;
        return TermBuilder.inheritance(sub1, TermBuilder.conjunction(pred1, TermBuilder.negation(pred2)));
    }),

    implicationDeduction: ([imp1, imp2]: [Term, Term]): Term | undefined => {
        if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
        const cons1 = imp1.args[1];
        const ante2 = imp2.args[0];
        if (!cons1 || !ante2 || !termsEqual(cons1, ante2)) return undefined;
        const ante1 = imp1.args[0];
        const cons2 = imp2.args[1];
        if (!ante1 || !cons2) return undefined;
        return TermBuilder.implication(ante1, cons2);
    },

    equivalence: ([imp1, imp2]: [Term, Term]): Term | undefined => {
        if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
        const a1 = imp1.args[0], c1 = imp1.args[1];
        const a2 = imp2.args[0], c2 = imp2.args[1];
        if (!a1 || !c1 || !a2 || !c2) return undefined;
        const forward = termsEqual(a1, a2) && termsEqual(c1, c2);
        const backward = termsEqual(a1, c2) && termsEqual(c1, a2);
        if (!forward && !backward) return undefined;
        return TermBuilder.equivalence(a1, c1);
    },

    variableIntroduction: inhRule((inh) => {
        const sub = getSubject(inh), pred = getPredicate(inh);
        if (!sub || !pred) return undefined;
        return TermBuilder.inheritance(sub, pred);
    }),

    decomposition: ([conj]: [Term, Term]): Term | undefined => {
        if (conj.kind !== 'conjunction') return undefined;
        if (conj.args.length < 2) return undefined;
        return conj.args[0] ?? conj;
    },

    variableDependency: ([t1, t2]: [Term, Term]): Term | undefined => {
        const vars1 = getVariables(t1);
        const vars2 = getVariables(t2);
        if (vars1.length === 0 || vars2.length === 0) return undefined;
        const shared = vars1.filter(v1 => vars2.some(v2 => termsEqual(v2, v1)));
        if (shared.length === 0) return undefined;
        return TermBuilder.conjunction(...shared);
    },

    comparison: binaryInhRule((inh1, inh2) => {
        const s1 = getSubject(inh1), p1 = getPredicate(inh1);
        const s2 = getSubject(inh2), p2 = getPredicate(inh2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (termsEqual(s1, s2) && termsEqual(p1, p2)) {
            return TermBuilder.similarity(s1, p1);
        }
        return undefined;
    }),

    analogy: binaryInhRule((inh1, inh2) => {
        const pred1 = getPredicate(inh1);
        const sub2 = getSubject(inh2);
        if (!pred1 || !sub2 || !termsEqual(pred1, sub2)) return undefined;
        const sub1 = getSubject(inh1);
        const pred2 = getPredicate(inh2);
        if (!sub1 || !pred2) return undefined;
        return TermBuilder.inheritance(sub1, pred2);
    }),

    contrapositionRule: ([imp]: [Term, Term]): Term | undefined => {
        if (imp.kind !== 'implication') return undefined;
        const ante = imp.args[0], cons = imp.args[1];
        if (!ante || !cons) return undefined;
        return TermBuilder.implication(TermBuilder.negation(cons), TermBuilder.negation(ante));
    },

    exemplification: binaryInhRule((inh1, inh2) => {
        const sub1 = getSubject(inh1);
        const pred2 = getPredicate(inh2);
        if (!sub1 || !pred2) return undefined;
        return TermBuilder.inheritance(sub1, pred2);
    }),

    sameness: binaryInhRule((inh1, inh2) => {
        const s1 = getSubject(inh1), p1 = getPredicate(inh1);
        const s2 = getSubject(inh2), p2 = getPredicate(inh2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (termsEqual(s1, s2) && termsEqual(p1, p2)) {
            return TermBuilder.similarity(s1, p1);
        }
        return undefined;
    }),

    revisionWeak: binaryInhRule((inh1, inh2) => {
        const s1 = getSubject(inh1), p1 = getPredicate(inh1);
        const s2 = getSubject(inh2), p2 = getPredicate(inh2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (termsEqual(s1, s2) && termsEqual(p1, p2)) {
            return inh1;
        }
        return undefined;
    }),

    instanceConversion: inhRule((inh) => {
        const s = getSubject(inh), p = getPredicate(inh);
        if (!s || !p) return undefined;
        return TermBuilder.inheritance(TermBuilder.instance(s), TermBuilder.instance(p));
    }),

    propertyConversion: inhRule((inh) => {
        const s = getSubject(inh), p = getPredicate(inh);
        if (!s || !p) return undefined;
        return TermBuilder.inheritance(TermBuilder.property(s), TermBuilder.property(p));
    }),

    instanceDeduction: ([inh, inst]: [Term, Term]): Term | undefined => {
        if (inh.kind !== 'inheritance') return undefined;
        if (inst.kind !== 'instance') return undefined;
        const s = getSubject(inh), p = getPredicate(inh);
        const instArg = inst.args[0];
        if (!s || !p || !instArg) return undefined;
        if (termsEqual(s, instArg)) {
            return TermBuilder.inheritance(instArg, p);
        }
        return undefined;
    },

    propertyInduction: ([inh, prop]: [Term, Term]): Term | undefined => {
        if (inh.kind !== 'inheritance') return undefined;
        if (prop.kind !== 'property') return undefined;
        const s = getSubject(inh), p = getPredicate(inh);
        const propArg = prop.args[0];
        if (!s || !p || !propArg) return undefined;
        if (termsEqual(p, propArg)) {
            return TermBuilder.inheritance(s, propArg);
        }
        return undefined;
    },

    sequenceIntroduction: binaryInhRule((inh1, inh2) => {
        const s1 = getSubject(inh1), p1 = getPredicate(inh1);
        const s2 = getSubject(inh2), p2 = getPredicate(inh2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (termsEqual(s1, s2)) {
            return TermBuilder.inheritance(s1, TermBuilder.sequence(p1, p2));
        }
        return undefined;
    }),

    parallelIntroduction: binaryInhRule((inh1, inh2) => {
        const s1 = getSubject(inh1), p1 = getPredicate(inh1);
        const s2 = getSubject(inh2), p2 = getPredicate(inh2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (termsEqual(s1, s2)) {
            return TermBuilder.inheritance(s1, TermBuilder.parallel(p1, p2));
        }
        return undefined;
    }),

    predictiveImplication: ([seq, inh]: [Term, Term]): Term | undefined => {
        if (seq.kind !== 'sequence') return undefined;
        if (inh.kind !== 'inheritance') return undefined;
        const [seqA, seqB] = seq.args;
        const s = getSubject(inh), p = getPredicate(inh);
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
        const s = getSubject(strategy), p = getPredicate(strategy);
        if (!s || !p) return undefined;
        return TermBuilder.inheritance(TermBuilder.operation(s, p), result);
    },

    resourceAllocation: ([task, resource]: [Term, Term]): Term | undefined => {
        if (task.kind !== 'inheritance') return undefined;
        if (resource.kind !== 'inheritance') return undefined;
        const t = getSubject(task), r = getSubject(resource);
        if (!t || !r) return undefined;
        return TermBuilder.inheritance(t, TermBuilder.operation(TermBuilder.atom('allocate'), r));
    },

    errorPatternDetection: ([error, context]: [Term, Term]): Term | undefined => {
        if (error.kind !== 'inheritance') return undefined;
        if (context.kind !== 'inheritance') return undefined;
        const e = getPredicate(error), c = getSubject(context);
        if (!e || !c) return undefined;
        return TermBuilder.predictive(c, TermBuilder.negation(e));
    },

    utilityEstimation: ([concept, utility]: [Term, Term]): Term | undefined => {
        if (concept.kind !== 'inheritance') return undefined;
        if (utility.kind !== 'inheritance') return undefined;
        const c = getSubject(concept), u = getPredicate(utility);
        if (!c || !u) return undefined;
        return TermBuilder.inheritance(c, TermBuilder.operation(TermBuilder.atom('utility'), u));
    },

    metacognitiveRevision: binaryInhRule((belief1, belief2) => {
        const s1 = getSubject(belief1), p1 = getPredicate(belief1);
        const s2 = getSubject(belief2), p2 = getPredicate(belief2);
        if (!s1 || !p1 || !s2 || !p2) return undefined;
        if (termsEqual(s1, s2) && termsEqual(p1, p2)) {
            return TermBuilder.inheritance(
                TermBuilder.operation(TermBuilder.atom('meta'), s1),
                TermBuilder.operation(TermBuilder.atom('revise'), p1)
            );
        }
        return undefined;
    }),

    selfModelConsistency: binaryInhRule((model1, model2) => {
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
    })
};

registerRule('nal.modusPonens', 'implication', 'atom', NALExtendedRules.modusPonens, Truth.deduction, 0.95);
registerRule('nal.modusTollens', 'implication', 'negation', NALExtendedRules.modusTollens, Truth.contraposition, 0.9);
registerRule('nal.conversion', 'inheritance', 'inheritance', NALExtendedRules.conversion, Truth.conversion, 0.7);
registerRule('nal.analogy', 'inheritance', 'inheritance', NALExtendedRules.analogy, Truth.analogy, 0.8);
registerRule('nal.comparison', 'inheritance', 'inheritance', NALExtendedRules.comparison, Truth.resemblance, 0.75);
registerRule('nal.contrapositionRule', 'implication', 'implication', NALExtendedRules.contrapositionRule, Truth.contraposition, 0.7);
registerRule('nal.structuralInheritance', 'conjunction', 'inheritance', NALExtendedRules.structuralInheritance, Truth.deduction, 0.75);
registerRule('nal.structuralReduction', 'inheritance', 'inheritance', NALExtendedRules.structuralReduction, Truth.structuralReduction, 0.7);
registerRule('nal.intersectionComposition', 'inheritance', 'inheritance', NALExtendedRules.intersectionComposition, Truth.intersection, 0.8);
registerRule('nal.unionComposition', 'inheritance', 'inheritance', NALExtendedRules.unionComposition, Truth.union, 0.75);
registerRule('nal.difference', 'inheritance', 'inheritance', NALExtendedRules.difference, Truth.deduction, 0.7);
registerRule('nal.implicationDeduction', 'implication', 'implication', NALExtendedRules.implicationDeduction, Truth.deduction, 0.85);
registerRule('nal.equivalence', 'implication', 'implication', NALExtendedRules.equivalence, Truth.intersection, 0.8);
registerRule('nal.variableIntroduction', 'inheritance', 'inheritance', NALExtendedRules.variableIntroduction, Truth.deduction, 0.6);
registerRule('nal.decomposition', 'conjunction', 'conjunction', NALExtendedRules.decomposition, Truth.deduction, 0.75);
registerRule('nal.variableDependency', 'inheritance', 'inheritance', NALExtendedRules.variableDependency, Truth.deduction, 0.5);
registerRule('nal.sameness', 'inheritance', 'inheritance', NALExtendedRules.sameness, Truth.sameness, 0.85);
registerRule('nal.revisionWeak', 'inheritance', 'inheritance', NALExtendedRules.revisionWeak, Truth.revision, 0.65);
registerRule('nal.exemplification', 'inheritance', 'inheritance', NALExtendedRules.exemplification, Truth.exemplification, 0.8);
registerRule('nal.instanceConversion', 'inheritance', 'instance', NALExtendedRules.instanceConversion, Truth.conversion, 0.7);
registerRule('nal.propertyConversion', 'inheritance', 'property', NALExtendedRules.propertyConversion, Truth.conversion, 0.7);
registerRule('nal.instanceDeduction', 'inheritance', 'instance', NALExtendedRules.instanceDeduction, Truth.deduction, 0.85);
registerRule('nal.propertyInduction', 'inheritance', 'property', NALExtendedRules.propertyInduction, Truth.induction, 0.75);
registerRule('nal.sequenceIntroduction', 'inheritance', 'inheritance', NALExtendedRules.sequenceIntroduction, Truth.deduction, 0.75);
registerRule('nal.parallelIntroduction', 'inheritance', 'inheritance', NALExtendedRules.parallelIntroduction, Truth.deduction, 0.7);
registerRule('nal.predictiveImplication', 'sequence', 'inheritance', NALExtendedRules.predictiveImplication, Truth.deduction, 0.8);
registerRule('nal.temporalDeduction', 'predictive', 'sequence', NALExtendedRules.temporalDeduction, Truth.deduction, 0.85);
registerRule('nal.operationExecution', 'inheritance', 'inheritance', NALExtendedRules.operationExecution, Truth.deduction, 0.8);
registerRule('nal.goalExecution', 'inheritance', 'operation', NALExtendedRules.goalExecution, Truth.deduction, 0.85);
registerRule('nal.proceduralDecomposition', 'sequence', 'operation', NALExtendedRules.proceduralDecomposition, Truth.deduction, 0.75);
registerRule('nal.proceduralChaining', 'operation', 'operation', NALExtendedRules.proceduralChaining, Truth.deduction, 0.8);
registerRule('nal.operationToPredictive', 'operation', 'sequence', NALExtendedRules.operationToPredictive, Truth.deduction, 0.75);
registerRule('nal.strategyEffectiveness', 'inheritance', 'inheritance', NALExtendedRules.strategyEffectiveness, Truth.deduction, 0.8);
registerRule('nal.resourceAllocation', 'inheritance', 'inheritance', NALExtendedRules.resourceAllocation, Truth.deduction, 0.75);
registerRule('nal.errorPatternDetection', 'inheritance', 'inheritance', NALExtendedRules.errorPatternDetection, Truth.deduction, 0.7);
registerRule('nal.utilityEstimation', 'inheritance', 'inheritance', NALExtendedRules.utilityEstimation, Truth.deduction, 0.8);
registerRule('nal.metacognitiveRevision', 'inheritance', 'inheritance', NALExtendedRules.metacognitiveRevision, Truth.revision, 0.85);
registerRule('nal.selfModelConsistency', 'inheritance', 'inheritance', NALExtendedRules.selfModelConsistency, Truth.sameness, 0.9);
