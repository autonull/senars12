import type {Term} from '../terms';
import {getPredicate, getSubject, TermBuilder, termsEqual, Truth} from '../terms';
import {registerRule} from './shared.js';
import {buildBinaryInhRule, buildInhRule, getVars} from './rule-builder.js';

const {
    negation, inheritance, conjunction, disjunction, implication, equivalence, similarity,
    sequence, parallel, predictive, operation, instance, property, atom
} = TermBuilder;

const VALIDATE_TRUTH = (t: Term) => t;
const IDENTITY = (t: Term) => t;

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
        return impAnte ? negation(impAnte) : undefined;
    },

    conversion: ([inh]: [Term, Term]): Term | undefined => {
        if (inh.kind !== 'inheritance') return undefined;
        const s = getSubject(inh), p = getPredicate(inh);
        return s && p ? inheritance(p, s) : undefined;
    },

    structuralInheritance: ([compound, component]: [Term, Term]): Term | undefined => {
        if (compound.kind !== 'conjunction') return undefined;
        const found = compound.args.find(a => termsEqual(a, component));
        return found ? inheritance(component, compound) : undefined;
    },

    structuralReduction: ([inh]: [Term, Term]): Term | undefined => {
        if (inh.kind !== 'inheritance') return undefined;
        const pred = getPredicate(inh);
        if (!pred || pred.kind !== 'conjunction') return undefined;
        const sub = getSubject(inh);
        return sub ? inheritance(sub, pred.args[0] ?? pred) : undefined;
    },

    intersectionComposition: buildBinaryInhRule(
        (inh1, inh2) => {
            const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
            if (!sub1 || !sub2 || !termsEqual(sub1, sub2)) return false;
            const pred1 = getPredicate(inh1), pred2 = getPredicate(inh2);
            return !!(pred1 && pred2);
        },
        (inh1, inh2) => {
            const sub1 = getSubject(inh1);
            const pred1 = getPredicate(inh1), pred2 = getPredicate(inh2);
            if (!sub1 || !pred1 || !pred2) return undefined;
            return inheritance(sub1, conjunction(pred1, pred2));
        }
    ),

    unionComposition: buildBinaryInhRule(
        (inh1, inh2) => {
            const pred1 = getPredicate(inh1), pred2 = getPredicate(inh2);
            if (!pred1 || !pred2 || !termsEqual(pred1, pred2)) return false;
            const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
            return !!(sub1 && sub2);
        },
        (inh1, inh2) => {
            const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
            const pred1 = getPredicate(inh1);
            if (!sub1 || !sub2 || !pred1) return undefined;
            return inheritance(disjunction(sub1, sub2), pred1);
        }
    ),

    difference: buildBinaryInhRule(
        (inh1, inh2) => {
            const sub1 = getSubject(inh1), sub2 = getSubject(inh2);
            if (!sub1 || !sub2 || !termsEqual(sub1, sub2)) return false;
            const pred1 = getPredicate(inh1), pred2 = getPredicate(inh2);
            return !!(pred1 && pred2);
        },
        (inh1, inh2) => {
            const sub1 = getSubject(inh1);
            const pred1 = getPredicate(inh1), pred2 = getPredicate(inh2);
            if (!sub1 || !pred1 || !pred2) return undefined;
            return inheritance(sub1, conjunction(pred1, negation(pred2)));
        }
    ),

    implicationDeduction: ([imp1, imp2]: [Term, Term]): Term | undefined => {
        if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
        const cons1 = imp1.args[1];
        const ante2 = imp2.args[0];
        if (!cons1 || !ante2 || !termsEqual(cons1, ante2)) return undefined;
        const ante1 = imp1.args[0];
        const cons2 = imp2.args[1];
        if (!ante1 || !cons2) return undefined;
        return implication(ante1, cons2);
    },

    equivalence: ([imp1, imp2]: [Term, Term]): Term | undefined => {
        if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
        const a1 = imp1.args[0], c1 = imp1.args[1];
        const a2 = imp2.args[0], c2 = imp2.args[1];
        if (!a1 || !c1 || !a2 || !c2) return undefined;
        const forward = termsEqual(a1, a2) && termsEqual(c1, c2);
        const backward = termsEqual(a1, c2) && termsEqual(c1, a2);
        if (!forward && !backward) return undefined;
        return equivalence(a1, c1);
    },

    variableIntroduction: buildInhRule(IDENTITY, inh => {
        const sub = getSubject(inh), pred = getPredicate(inh);
        if (!sub || !pred) return undefined;
        return inheritance(sub, pred);
    }),

    decomposition: ([conj]: [Term, Term]): Term | undefined => {
        if (conj.kind !== 'conjunction') return undefined;
        if (conj.args.length < 2) return undefined;
        return conj.args[0] ?? conj;
    },

    variableDependency: ([t1, t2]: [Term, Term]): Term | undefined => {
        const vars1 = getVars(t1);
        const vars2 = getVars(t2);
        if (vars1.length === 0 || vars2.length === 0) return undefined;
        const shared = vars1.filter(v1 => vars2.some(v2 => termsEqual(v2, v1)));
        if (shared.length === 0) return undefined;
        return conjunction(...shared);
    },

    comparison: buildBinaryInhRule(
        (inh1, inh2) => {
            const s1 = getSubject(inh1), p1 = getPredicate(inh1);
            const s2 = getSubject(inh2), p2 = getPredicate(inh2);
            if (!s1 || !p1 || !s2 || !p2) return false;
            return termsEqual(s1, s2) && termsEqual(p1, p2);
        },
        (inh1, _inh2) => {
            const s1 = getSubject(inh1), p1 = getPredicate(inh1);
            if (!s1 || !p1) return undefined;
            return similarity(s1, p1);
        }
    ),

    analogy: buildBinaryInhRule(
        (inh1, inh2) => {
            const pred1 = getPredicate(inh1);
            const sub2 = getSubject(inh2);
            if (!pred1 || !sub2 || !termsEqual(pred1, sub2)) return false;
            const sub1 = getSubject(inh1), pred2 = getPredicate(inh2);
            return !!(sub1 && pred2);
        },
        (inh1, inh2) => {
            const sub1 = getSubject(inh1), pred2 = getPredicate(inh2);
            if (!sub1 || !pred2) return undefined;
            return inheritance(sub1, pred2);
        }
    ),

    contrapositionRule: ([imp]: [Term, Term]): Term | undefined => {
        if (imp.kind !== 'implication') return undefined;
        const ante = imp.args[0], cons = imp.args[1];
        if (!ante || !cons) return undefined;
        return implication(negation(cons), negation(ante));
    },

    exemplification: buildBinaryInhRule(
        (inh1, inh2) => !!(getSubject(inh1) && getPredicate(inh2)),
        (inh1, inh2) => {
            const sub1 = getSubject(inh1), pred2 = getPredicate(inh2);
            if (!sub1 || !pred2) return undefined;
            return inheritance(sub1, pred2);
        }
    ),

    sameness: buildBinaryInhRule(
        (inh1, inh2) => {
            const s1 = getSubject(inh1), p1 = getPredicate(inh1);
            const s2 = getSubject(inh2), p2 = getPredicate(inh2);
            if (!s1 || !p1 || !s2 || !p2) return false;
            return termsEqual(s1, s2) && termsEqual(p1, p2);
        },
        (inh1, _inh2) => {
            const s1 = getSubject(inh1), p1 = getPredicate(inh1);
            if (!s1 || !p1) return undefined;
            return similarity(s1, p1);
        }
    ),

    revisionWeak: buildBinaryInhRule(
        (inh1, inh2) => {
            const s1 = getSubject(inh1), p1 = getPredicate(inh1);
            const s2 = getSubject(inh2), p2 = getPredicate(inh2);
            if (!s1 || !p1 || !s2 || !p2) return false;
            return termsEqual(s1, s2) && termsEqual(p1, p2);
        },
        (inh1, _inh2) => inh1
    ),

    instanceConversion: buildInhRule(IDENTITY, inh => {
        const s = getSubject(inh), p = getPredicate(inh);
        if (!s || !p) return undefined;
        return inheritance(instance(s), instance(p));
    }),

    propertyConversion: buildInhRule(IDENTITY, inh => {
        const s = getSubject(inh), p = getPredicate(inh);
        if (!s || !p) return undefined;
        return inheritance(property(s), property(p));
    }),

    instanceDeduction: ([inh, inst]: [Term, Term]): Term | undefined => {
        if (inh.kind !== 'inheritance') return undefined;
        if (inst.kind !== 'instance') return undefined;
        const s = getSubject(inh), p = getPredicate(inh);
        const instArg = inst.args[0];
        if (!s || !p || !instArg) return undefined;
        if (termsEqual(s, instArg)) {
            return inheritance(instArg, p);
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
            return inheritance(s, propArg);
        }
        return undefined;
    },

    sequenceIntroduction: buildBinaryInhRule(
        (inh1, inh2) => {
            const s1 = getSubject(inh1), p1 = getPredicate(inh1);
            const s2 = getSubject(inh2), p2 = getPredicate(inh2);
            if (!s1 || !p1 || !s2 || !p2) return false;
            return termsEqual(s1, s2);
        },
        (inh1, inh2) => {
            const s1 = getSubject(inh1);
            const p1 = getPredicate(inh1), p2 = getPredicate(inh2);
            if (!s1 || !p1 || !p2) return undefined;
            return inheritance(s1, sequence(p1, p2));
        }
    ),

    parallelIntroduction: buildBinaryInhRule(
        (inh1, inh2) => {
            const s1 = getSubject(inh1), p1 = getPredicate(inh1);
            const s2 = getSubject(inh2), p2 = getPredicate(inh2);
            if (!s1 || !p1 || !s2 || !p2) return false;
            return termsEqual(s1, s2);
        },
        (inh1, inh2) => {
            const s1 = getSubject(inh1);
            const p1 = getPredicate(inh1), p2 = getPredicate(inh2);
            if (!s1 || !p1 || !p2) return undefined;
            return inheritance(s1, parallel(p1, p2));
        }
    ),

    predictiveImplication: ([seq, inh]: [Term, Term]): Term | undefined => {
        if (seq.kind !== 'sequence') return undefined;
        if (inh.kind !== 'inheritance') return undefined;
        const [seqA, seqB] = seq.args;
        const s = getSubject(inh), p = getPredicate(inh);
        if (!seqA || !seqB || !s || !p) return undefined;
        if (termsEqual(seqA, s) && termsEqual(seqB, p)) {
            return predictive(s, p);
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
            return inheritance(seqA, seqB);
        }
        return undefined;
    },

    operationExecution: ([op, input]: [Term, Term]): Term | undefined => {
        if (op.kind !== 'inheritance') return undefined;
        return operation(op, input);
    },

    goalExecution: ([goal, op]: [Term, Term]): Term | undefined => {
        if (op.kind !== 'operation') return undefined;
        const [opTerm] = op.args;
        if (!opTerm) return undefined;
        return inheritance(goal, opTerm);
    },

    proceduralDecomposition: ([seq, op]: [Term, Term]): Term | undefined => {
        if (seq.kind !== 'sequence') return undefined;
        if (op.kind !== 'operation') return undefined;
        const [seqA, seqB] = seq.args;
        const [opTerm, input] = op.args;
        if (!seqA || !seqB || !opTerm || !input) return undefined;
        return sequence(seqA, operation(opTerm, input));
    },

    proceduralChaining: ([op1, op2]: [Term, Term]): Term | undefined => {
        if (op1.kind !== 'operation' || op2.kind !== 'operation') return undefined;
        const [op1Term, input1] = op1.args;
        const [op2Term, input2] = op2.args;
        if (!op1Term || !input1 || !op2Term || !input2) return undefined;
        if (termsEqual(input1, op2Term)) {
            return sequence(op1Term, input2);
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
            return predictive(seqA, seqB);
        }
        return undefined;
    },

    strategyEffectiveness: ([strategy, result]: [Term, Term]): Term | undefined => {
        if (strategy.kind !== 'inheritance') return undefined;
        if (result.kind !== 'inheritance') return undefined;
        const s = getSubject(strategy), p = getPredicate(strategy);
        if (!s || !p) return undefined;
        return inheritance(operation(s, p), result);
    },

    resourceAllocation: ([task, resource]: [Term, Term]): Term | undefined => {
        if (task.kind !== 'inheritance') return undefined;
        if (resource.kind !== 'inheritance') return undefined;
        const t = getSubject(task), r = getSubject(resource);
        if (!t || !r) return undefined;
        return inheritance(t, operation(atom('allocate'), r));
    },

    errorPatternDetection: ([error, context]: [Term, Term]): Term | undefined => {
        if (error.kind !== 'inheritance') return undefined;
        if (context.kind !== 'inheritance') return undefined;
        const e = getPredicate(error), c = getSubject(context);
        if (!e || !c) return undefined;
        return predictive(c, negation(e));
    },

    utilityEstimation: ([concept, utility]: [Term, Term]): Term | undefined => {
        if (concept.kind !== 'inheritance') return undefined;
        if (utility.kind !== 'inheritance') return undefined;
        const c = getSubject(concept), u = getPredicate(utility);
        if (!c || !u) return undefined;
        return inheritance(c, operation(atom('utility'), u));
    },

    metacognitiveRevision: buildBinaryInhRule(
        (belief1, belief2) => {
            const s1 = getSubject(belief1), p1 = getPredicate(belief1);
            const s2 = getSubject(belief2), p2 = getPredicate(belief2);
            if (!s1 || !p1 || !s2 || !p2) return false;
            return termsEqual(s1, s2) && termsEqual(p1, p2);
        },
        (belief1, _belief2) => {
            const s1 = getSubject(belief1), p1 = getPredicate(belief1);
            if (!s1 || !p1) return undefined;
            return inheritance(operation(atom('meta'), s1), operation(atom('revise'), p1));
        }
    ),

    selfModelConsistency: buildBinaryInhRule(
        (model1, model2) => {
            const s1 = getSubject(model1);
            const s2 = getSubject(model2);
            if (!s1 || !s2) return false;
            return termsEqual(s1, s2);
        },
        (model1, model2) => {
            const s1 = getSubject(model1), s2 = getSubject(model2);
            if (!s1 || !s2) return undefined;
            return similarity(operation(atom('self'), s1), operation(atom('model'), s2));
        }
    )
};

registerRule('nal.modusPonens', 'implication', 'atom', NALExtendedRules.modusPonens, Truth.deduction, 0.95);
registerRule('nal.modusTollens', 'implication', 'negation', NALExtendedRules.modusTollens, Truth.contraposition, 0.9);
registerRule('nal.conversion', 'inheritance', 'inheritance', NALExtendedRules.conversion, Truth.conversion, 0.7);
registerRule('nal.extended.analogy', 'inheritance', 'inheritance', NALExtendedRules.analogy, Truth.analogy, 0.8);
registerRule('nal.extended.comparison', 'inheritance', 'inheritance', NALExtendedRules.comparison, Truth.resemblance, 0.75);
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
registerRule('nal.extended.exemplification', 'inheritance', 'inheritance', NALExtendedRules.exemplification, Truth.exemplification, 0.8);
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
