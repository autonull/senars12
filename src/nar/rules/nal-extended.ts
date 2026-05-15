import type {Term} from '../terms';
import {getPredicate, getSubject, TermBuilder, termsEqual, Truth} from '../terms';
import {extractInh, extractInhPair, registerRule, registerRules} from './shared.js';
import {buildBinaryInhRule, buildInhRule, getVars} from './rule-builder.js';

const ID = <T>(t: T): T => t;

const {negation, inheritance, conjunction, disjunction, implication, equivalence, similarity,
    sequence, parallel, predictive, operation, instance, property, atom} = TermBuilder;

const conversionRule = (wrap: (t: Term) => Term) => buildInhRule(ID, inh => {
    const s = getSubject(inh), p = getPredicate(inh);
    return s && p ? inheritance(wrap(s), wrap(p)) : undefined;
});

const deductionFromType = (typeKind: 'instance' | 'property', matchOn: 'subject' | 'predicate') =>
    ([inh, term]: [Term, Term]): Term | undefined => {
        if (inh.kind !== 'inheritance' || term.kind !== typeKind) return undefined;
        const s = getSubject(inh), p = getPredicate(inh);
        const arg = term.args[0];
        if (!s || !p || !arg) return undefined;
        return termsEqual(matchOn === 'subject' ? s : p, arg) ? inheritance(matchOn === 'subject' ? arg : s, matchOn === 'subject' ? p : arg) : undefined;
    };

const sameSubject = (inh1: Term, inh2: Term): boolean => {
    const s1 = getSubject(inh1), s2 = getSubject(inh2);
    return !!(s1 && s2 && termsEqual(s1, s2));
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

    variableIntroduction: buildInhRule(ID, inh => {
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
            const extracted = extractInhPair(inh1, inh2);
            if (!extracted) return false;
            const {s1, p1, s2, p2} = extracted;
            return termsEqual(s1, s2) && termsEqual(p1, p2);
        },
        (inh1, _inh2) => {
            const {s, p} = extractInh(inh1) ?? {};
            if (!s || !p) return undefined;
            return similarity(s, p);
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
            const extracted = extractInhPair(inh1, inh2);
            if (!extracted) return false;
            const {s1, p1, s2, p2} = extracted;
            return termsEqual(s1, s2) && termsEqual(p1, p2);
        },
        (inh1, _inh2) => {
            const {s, p} = extractInh(inh1) ?? {};
            if (!s || !p) return undefined;
            return similarity(s, p);
        }
    ),

    revisionWeak: buildBinaryInhRule(
        (inh1, inh2) => {
            const extracted = extractInhPair(inh1, inh2);
            if (!extracted) return false;
            const {s1, p1, s2, p2} = extracted;
            return termsEqual(s1, s2) && termsEqual(p1, p2);
        },
        (inh1, _inh2) => inh1
    ),

    instanceConversion: conversionRule(instance),

    propertyConversion: conversionRule(property),

    instanceDeduction: deductionFromType('instance', 'subject'),

    propertyInduction: deductionFromType('property', 'predicate'),

    sequenceIntroduction: buildBinaryInhRule(
        sameSubject,
        (inh1, inh2) => {
            const s = getSubject(inh1);
            const p1 = getPredicate(inh1), p2 = getPredicate(inh2);
            return s && p1 && p2 ? inheritance(s, sequence(p1, p2)) : undefined;
        }
    ),

    parallelIntroduction: buildBinaryInhRule(
        sameSubject,
        (inh1, inh2) => {
            const s = getSubject(inh1);
            const p1 = getPredicate(inh1), p2 = getPredicate(inh2);
            return s && p1 && p2 ? inheritance(s, parallel(p1, p2)) : undefined;
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
            const extracted = extractInhPair(belief1, belief2);
            if (!extracted) return false;
            const {s1, p1, s2, p2} = extracted;
            return termsEqual(s1, s2) && termsEqual(p1, p2);
        },
        (belief1, _belief2) => {
            const {s, p} = extractInh(belief1) ?? {};
            if (!s || !p) return undefined;
            return inheritance(operation(atom('meta'), s), operation(atom('revise'), p));
        }
    ),

    selfModelConsistency: buildBinaryInhRule(
        (model1, model2) => {
            const s1 = getSubject(model1), s2 = getSubject(model2);
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

registerRules([
    {id: 'nal.modusPonens', leftKind: 'implication', rightKind: 'atom', apply: NALExtendedRules.modusPonens, truthFn: Truth.deduction, priority: 0.95},
    {id: 'nal.modusTollens', leftKind: 'implication', rightKind: 'negation', apply: NALExtendedRules.modusTollens, truthFn: Truth.contraposition, priority: 0.9},
    {id: 'nal.conversion', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.conversion, truthFn: Truth.conversion, priority: 0.7},
    {id: 'nal.extended.analogy', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.analogy, truthFn: Truth.analogy, priority: 0.8},
    {id: 'nal.extended.comparison', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.comparison, truthFn: Truth.resemblance, priority: 0.75},
    {id: 'nal.contrapositionRule', leftKind: 'implication', rightKind: 'implication', apply: NALExtendedRules.contrapositionRule, truthFn: Truth.contraposition, priority: 0.7},
    {id: 'nal.structuralInheritance', leftKind: 'conjunction', rightKind: 'inheritance', apply: NALExtendedRules.structuralInheritance, truthFn: Truth.deduction, priority: 0.75},
    {id: 'nal.structuralReduction', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.structuralReduction, truthFn: Truth.structuralReduction, priority: 0.7},
    {id: 'nal.intersectionComposition', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.intersectionComposition, truthFn: Truth.intersection, priority: 0.8},
    {id: 'nal.unionComposition', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.unionComposition, truthFn: Truth.union, priority: 0.75},
    {id: 'nal.difference', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.difference, truthFn: Truth.deduction, priority: 0.7},
    {id: 'nal.implicationDeduction', leftKind: 'implication', rightKind: 'implication', apply: NALExtendedRules.implicationDeduction, truthFn: Truth.deduction, priority: 0.85},
    {id: 'nal.equivalence', leftKind: 'implication', rightKind: 'implication', apply: NALExtendedRules.equivalence, truthFn: Truth.intersection, priority: 0.8},
    {id: 'nal.variableIntroduction', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.variableIntroduction, truthFn: Truth.deduction, priority: 0.6},
    {id: 'nal.decomposition', leftKind: 'conjunction', rightKind: 'conjunction', apply: NALExtendedRules.decomposition, truthFn: Truth.deduction, priority: 0.75},
    {id: 'nal.variableDependency', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.variableDependency, truthFn: Truth.deduction, priority: 0.5},
    {id: 'nal.sameness', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.sameness, truthFn: Truth.sameness, priority: 0.85},
    {id: 'nal.revisionWeak', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.revisionWeak, truthFn: Truth.revision, priority: 0.65},
    {id: 'nal.extended.exemplification', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.exemplification, truthFn: Truth.exemplification, priority: 0.8},
    {id: 'nal.instanceConversion', leftKind: 'inheritance', rightKind: 'instance', apply: NALExtendedRules.instanceConversion, truthFn: Truth.conversion, priority: 0.7},
    {id: 'nal.propertyConversion', leftKind: 'inheritance', rightKind: 'property', apply: NALExtendedRules.propertyConversion, truthFn: Truth.conversion, priority: 0.7},
    {id: 'nal.instanceDeduction', leftKind: 'inheritance', rightKind: 'instance', apply: NALExtendedRules.instanceDeduction, truthFn: Truth.deduction, priority: 0.85},
    {id: 'nal.propertyInduction', leftKind: 'inheritance', rightKind: 'property', apply: NALExtendedRules.propertyInduction, truthFn: Truth.induction, priority: 0.75},
    {id: 'nal.sequenceIntroduction', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.sequenceIntroduction, truthFn: Truth.deduction, priority: 0.75},
    {id: 'nal.parallelIntroduction', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.parallelIntroduction, truthFn: Truth.deduction, priority: 0.7},
    {id: 'nal.predictiveImplication', leftKind: 'sequence', rightKind: 'inheritance', apply: NALExtendedRules.predictiveImplication, truthFn: Truth.deduction, priority: 0.8},
    {id: 'nal.temporalDeduction', leftKind: 'predictive', rightKind: 'sequence', apply: NALExtendedRules.temporalDeduction, truthFn: Truth.deduction, priority: 0.85},
    {id: 'nal.operationExecution', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.operationExecution, truthFn: Truth.deduction, priority: 0.8},
    {id: 'nal.goalExecution', leftKind: 'inheritance', rightKind: 'operation', apply: NALExtendedRules.goalExecution, truthFn: Truth.deduction, priority: 0.85},
    {id: 'nal.proceduralDecomposition', leftKind: 'sequence', rightKind: 'operation', apply: NALExtendedRules.proceduralDecomposition, truthFn: Truth.deduction, priority: 0.75},
    {id: 'nal.proceduralChaining', leftKind: 'operation', rightKind: 'operation', apply: NALExtendedRules.proceduralChaining, truthFn: Truth.deduction, priority: 0.8},
    {id: 'nal.operationToPredictive', leftKind: 'operation', rightKind: 'sequence', apply: NALExtendedRules.operationToPredictive, truthFn: Truth.deduction, priority: 0.75},
    {id: 'nal.strategyEffectiveness', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.strategyEffectiveness, truthFn: Truth.deduction, priority: 0.8},
    {id: 'nal.resourceAllocation', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.resourceAllocation, truthFn: Truth.deduction, priority: 0.75},
    {id: 'nal.errorPatternDetection', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.errorPatternDetection, truthFn: Truth.deduction, priority: 0.7},
    {id: 'nal.utilityEstimation', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.utilityEstimation, truthFn: Truth.deduction, priority: 0.8},
    {id: 'nal.metacognitiveRevision', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.metacognitiveRevision, truthFn: Truth.revision, priority: 0.85},
    {id: 'nal.selfModelConsistency', leftKind: 'inheritance', rightKind: 'inheritance', apply: NALExtendedRules.selfModelConsistency, truthFn: Truth.sameness, priority: 0.9},
]);
