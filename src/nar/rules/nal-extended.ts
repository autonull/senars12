import type {Term} from '../terms';
import {getPredicate, getSubject, TermBuilder, termsEqual, Truth} from '../terms';
import {extractInh, extractInhPair, registerRule} from './shared.js';
import {buildBinaryInhRule, buildInhRule, getVars} from './rule-builder.js';
import {type TruthFn} from './types.js';

const ID = <T>(t: T): T => t;

const {
    negation, inheritance, conjunction, disjunction, implication, equivalence, similarity,
    sequence, parallel, predictive, operation, instance, property, atom
} = TermBuilder;

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

const sameInhPair = (inh1: Term, inh2: Term) => {
    const extracted = extractInhPair(inh1, inh2);
    if (!extracted) return false;
    const {s1, p1, s2, p2} = extracted;
    return termsEqual(s1, s2) && termsEqual(p1, p2);
};

const buildSequenceRule = (builder: (p1: Term, p2: Term) => Term) => buildBinaryInhRule(
    sameSubject,
    (inh1, inh2) => {
        const s = getSubject(inh1);
        const p1 = getPredicate(inh1), p2 = getPredicate(inh2);
        return s && p1 && p2 ? inheritance(s, builder(p1, p2)) : undefined;
    }
);

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
        sameInhPair,
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
        sameInhPair,
        (inh1, _inh2) => {
            const {s, p} = extractInh(inh1) ?? {};
            if (!s || !p) return undefined;
            return similarity(s, p);
        }
    ),

    revisionWeak: buildBinaryInhRule(
        sameInhPair,
        (inh1, _inh2) => inh1
    ),

    instanceConversion: conversionRule(instance),

    propertyConversion: conversionRule(property),

    instanceDeduction: deductionFromType('instance', 'subject'),

    propertyInduction: deductionFromType('property', 'predicate'),

    sequenceIntroduction: buildSequenceRule(sequence),

    parallelIntroduction: buildSequenceRule(parallel),

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

    // DISABLED: Produces operation terms inside inheritance predicates (BOT7 §1.1)
    // operationExecution: ([op, input]: [Term, Term]): Term | undefined => {
    //     if (op.kind !== 'inheritance') return undefined;
    //     return operation(op, input);
    // },
    operationExecution: undefined as unknown as ([op, input]: [Term, Term]) => Term | undefined,

    // DISABLED: Conflates goal satisfaction with inheritance (BOT7 §1.1)
    // goalExecution: ([goal, op]: [Term, Term]): Term | undefined => {
    //     if (op.kind !== 'operation') return undefined;
    //     const [opTerm] = op.args;
    //     if (!opTerm) return undefined;
    //     return inheritance(goal, opTerm);
    // },
    goalExecution: undefined as unknown as ([goal, op]: [Term, Term]) => Term | undefined,

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

    // DISABLED: Embeds operations in inheritance predicates (BOT7 §1.1)
    // strategyEffectiveness: ([strategy, result]: [Term, Term]): Term | undefined => {
    //     if (strategy.kind !== 'inheritance') return undefined;
    //     if (result.kind !== 'inheritance') return undefined;
    //     const s = getSubject(strategy), p = getPredicate(strategy);
    //     const r = getSubject(result);
    //     if (!s || !p || !r) return undefined;
    //     return implication(operation(s, p), r);
    // },
    strategyEffectiveness: undefined as unknown as ([strategy, result]: [Term, Term]) => Term | undefined,

    // DISABLED: Embeds operations in inheritance predicates (BOT7 §1.1)
    // resourceAllocation: ([task, resource]: [Term, Term]): Term | undefined => {
    //     if (task.kind !== 'inheritance') return undefined;
    //     if (resource.kind !== 'inheritance') return undefined;
    //     const t = getSubject(task), r = getSubject(resource);
    //     if (!t || !r) return undefined;
    //     return implication(t, operation(atom('allocate'), r));
    // },
    resourceAllocation: undefined as unknown as ([task, resource]: [Term, Term]) => Term | undefined,

  // DISABLED: Creates spurious predictive negations (BOT7 §1.1)
  // errorPatternDetection: ([error, context]: [Term, Term]): Term | undefined => {
  // if (error.kind !== 'inheritance') return undefined;
  // if (context.kind !== 'inheritance') return undefined;
  // const e = getPredicate(error), c = getSubject(context);
  // if (!e || !c) return undefined;
  // return predictive(c, negation(e));
  // },
  errorPatternDetection: undefined as unknown as ([error, context]: [Term, Term]) => Term | undefined,

    // DISABLED: Embeds operations in inheritance predicates (BOT7 §1.1)
    // utilityEstimation: ([concept, utility]: [Term, Term]): Term | undefined => {
    //     if (concept.kind !== 'inheritance') return undefined;
    //     if (utility.kind !== 'inheritance') return undefined;
    //     const c = getSubject(concept), u = getPredicate(utility);
    //     if (!c || !u) return undefined;
    //     return implication(c, operation(atom('utility'), u));
    // },
    utilityEstimation: undefined as unknown as ([concept, utility]: [Term, Term]) => Term | undefined,

    // DISABLED: Produces operations as both subject and predicate (BOT7 §1.1)
    // metacognitiveRevision: buildBinaryInhRule(
    //     sameInhPair,
    //     (belief1, _belief2) => {
    //         const {s, p} = extractInh(belief1) ?? {};
    //         if (!s || !p) return undefined;
    //         return equivalence(operation(atom('meta'), s), operation(atom('revise'), p));
    //     }
    // ),
    metacognitiveRevision: undefined as unknown as ([t1, t2]: [Term, Term]) => Term | undefined,

    // DISABLED: Produces operations inside similarity (BOT7 §1.1)
    // selfModelConsistency: buildBinaryInhRule(
    //     (model1, model2) => {
    //         const s1 = getSubject(model1), s2 = getSubject(model2);
    //         if (!s1 || !s2) return false;
    //         return termsEqual(s1, s2);
    //     },
    //     (model1, model2) => {
    //         const s1 = getSubject(model1), s2 = getSubject(model2);
    //         if (!s1 || !s2) return undefined;
    //         return equivalence(operation(atom('self'), s1), operation(atom('model'), s2));
    //     }
    // )
    selfModelConsistency: undefined as unknown as ([t1, t2]: [Term, Term]) => Term | undefined,
};

const RULES = [
    {id: 'nal.modusPonens', left: 'implication', right: 'atom', fn: 'modusPonens', truth: 'deduction', priority: 0.95},
    {id: 'nal.modusTollens', left: 'implication', right: 'negation', fn: 'modusTollens', truth: 'contraposition', priority: 0.9},
    {id: 'nal.conversion', left: 'inheritance', right: 'inheritance', fn: 'conversion', truth: 'conversion', priority: 0.7},
    {id: 'nal.extended.analogy', left: 'inheritance', right: 'inheritance', fn: 'analogy', truth: 'analogy', priority: 0.8},
    {id: 'nal.extended.comparison', left: 'inheritance', right: 'inheritance', fn: 'comparison', truth: 'resemblance', priority: 0.75},
    {id: 'nal.contrapositionRule', left: 'implication', right: 'implication', fn: 'contrapositionRule', truth: 'contraposition', priority: 0.7},
    {id: 'nal.structuralInheritance', left: 'conjunction', right: 'inheritance', fn: 'structuralInheritance', truth: 'deduction', priority: 0.75},
    {id: 'nal.structuralReduction', left: 'inheritance', right: 'inheritance', fn: 'structuralReduction', truth: 'structuralReduction', priority: 0.7},
    {id: 'nal.intersectionComposition', left: 'inheritance', right: 'inheritance', fn: 'intersectionComposition', truth: 'intersection', priority: 0.8},
    {id: 'nal.unionComposition', left: 'inheritance', right: 'inheritance', fn: 'unionComposition', truth: 'union', priority: 0.75},
    {id: 'nal.difference', left: 'inheritance', right: 'inheritance', fn: 'difference', truth: 'deduction', priority: 0.7},
    {id: 'nal.implicationDeduction', left: 'implication', right: 'implication', fn: 'implicationDeduction', truth: 'deduction', priority: 0.85},
    {id: 'nal.equivalence', left: 'implication', right: 'implication', fn: 'equivalence', truth: 'intersection', priority: 0.8},
    {id: 'nal.variableIntroduction', left: 'inheritance', right: 'inheritance', fn: 'variableIntroduction', truth: 'deduction', priority: 0.6},
    {id: 'nal.decomposition', left: 'conjunction', right: 'conjunction', fn: 'decomposition', truth: 'deduction', priority: 0.75},
    {id: 'nal.variableDependency', left: 'inheritance', right: 'inheritance', fn: 'variableDependency', truth: 'deduction', priority: 0.5},
    {id: 'nal.sameness', left: 'inheritance', right: 'inheritance', fn: 'sameness', truth: 'sameness', priority: 0.85},
    {id: 'nal.revisionWeak', left: 'inheritance', right: 'inheritance', fn: 'revisionWeak', truth: 'revision', priority: 0.65},
    {id: 'nal.extended.exemplification', left: 'inheritance', right: 'inheritance', fn: 'exemplification', truth: 'exemplification', priority: 0.8},
    {id: 'nal.instanceConversion', left: 'inheritance', right: 'instance', fn: 'instanceConversion', truth: 'conversion', priority: 0.7},
    {id: 'nal.propertyConversion', left: 'inheritance', right: 'property', fn: 'propertyConversion', truth: 'conversion', priority: 0.7},
    {id: 'nal.instanceDeduction', left: 'inheritance', right: 'instance', fn: 'instanceDeduction', truth: 'deduction', priority: 0.85},
    {id: 'nal.propertyInduction', left: 'inheritance', right: 'property', fn: 'propertyInduction', truth: 'induction', priority: 0.75},
    {id: 'nal.sequenceIntroduction', left: 'inheritance', right: 'inheritance', fn: 'sequenceIntroduction', truth: 'deduction', priority: 0.75},
    {id: 'nal.parallelIntroduction', left: 'inheritance', right: 'inheritance', fn: 'parallelIntroduction', truth: 'deduction', priority: 0.7},
    {id: 'nal.predictiveImplication', left: 'sequence', right: 'inheritance', fn: 'predictiveImplication', truth: 'deduction', priority: 0.8},
    {id: 'nal.temporalDeduction', left: 'predictive', right: 'sequence', fn: 'temporalDeduction', truth: 'deduction', priority: 0.85},
    // DISABLED: {id: 'nal.operationExecution', ...} — produces ^ in inheritance (BOT7 §1.1)
    // DISABLED: {id: 'nal.goalExecution', ...} — conflates goals with inheritance (BOT7 §1.1)
    {id: 'nal.proceduralDecomposition', left: 'sequence', right: 'operation', fn: 'proceduralDecomposition', truth: 'deduction', priority: 0.75},
    {id: 'nal.proceduralChaining', left: 'operation', right: 'operation', fn: 'proceduralChaining', truth: 'deduction', priority: 0.8},
    {id: 'nal.operationToPredictive', left: 'operation', right: 'sequence', fn: 'operationToPredictive', truth: 'deduction', priority: 0.75},
    // DISABLED: {id: 'nal.strategyEffectiveness', ...} — embeds ^ in predicates (BOT7 §1.1)
  // DISABLED: {id: 'nal.resourceAllocation', ...} — embeds ^ in predicates (BOT7 §1.1)
  // DISABLED: {id: 'nal.errorPatternDetection', ...} — creates spurious predictive negations (BOT7 §1.1)
  // {id: 'nal.errorPatternDetection', left: 'inheritance', right: 'inheritance', fn: 'errorPatternDetection', truth: 'deduction', priority: 0.7},
  // DISABLED: {id: 'nal.utilityEstimation', ...} — embeds ^ in predicates (BOT7 §1.1)
    // DISABLED: {id: 'nal.metacognitiveRevision', ...} — operations as subject/predicate (BOT7 §1.1)
    // DISABLED: {id: 'nal.selfModelConsistency', ...} — operations inside similarity (BOT7 §1.1)
] as const;

RULES.forEach(({id, left, right, fn, truth, priority}) => {
    const ruleFn = NALExtendedRules[fn as keyof typeof NALExtendedRules];
    if (ruleFn) {
        registerRule(id, left, right, ruleFn, Truth[truth as keyof typeof Truth] as TruthFn, priority);
    }
});
