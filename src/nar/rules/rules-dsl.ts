/**
 * Rule DSL - Unified declarative rule definition system
 * Replaces nal.ts and nal-extended.ts with a consolidated DSL approach
 */
import type {Term} from '../terms';
import {getPredicate, getSubject, TermBuilder, termsEqual, Truth} from '../terms';
import {createRulePattern, type RuleFn, RuleRegistry, type TruthFn} from './types.js';
import {buildBinaryInhRule, buildInhRule, getVars} from './rule-builder.js';

interface RuleDef {
    readonly id: string;
    readonly description: string;
    readonly pattern: [Term['kind'], Term['kind']];
    readonly build: RuleFn;
    readonly truth: keyof typeof Truth;
    readonly priority: number;
}

const _rule = <T extends RuleDef>(id: string, description: string, config: Omit<T, 'id' | 'description'>): T =>
    ({id, description, ...config} as T);

const registerRule = (id: string, left: string, right: string, fn: RuleFn, truthFn: TruthFn, priority: number) =>
    RuleRegistry.register({id, pattern: createRulePattern(left, right), apply: fn, sync: true, priority, truthFn});

const registerRulesFromDSL = (rules: RuleDef[]) => {
    for (const r of rules) {
        if (r.build == null) continue;
        registerRule(r.id, r.pattern[0], r.pattern[1], r.build, Truth[r.truth] as TruthFn, r.priority);
    }
};

const ID = <T>(t: T): T => t;

const extractInh = (t: Term) => {
    const s = getSubject(t), p = getPredicate(t);
    return {s, p};
};

const extractInhPair = (inh1: Term, inh2: Term) => {
    const s1 = getSubject(inh1), p1 = getPredicate(inh1);
    const s2 = getSubject(inh2), p2 = getPredicate(inh2);
    if (!s1 || !p1 || !s2 || !p2) return null;
    return {s1, p1, s2, p2};
};

const matchInhPair = <T>(
    fn: (s1: Term, p1: Term, s2: Term, p2: Term) => T | undefined
) => ([inh1, inh2]: [Term, Term]): T | undefined => {
    const extracted = extractInhPair(inh1, inh2);
    if (!extracted) return undefined;
    const {s1, p1, s2, p2} = extracted;
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    return fn(s1, p1, s2, p2);
};

const linkFn = (extractor: (left: Term, right: Term) => { leftTerm: Term | undefined; rightTerm: Term | undefined }) =>
    (left: Term, right: Term): boolean => {
        const {leftTerm, rightTerm} = extractor(left, right);
        return !!(leftTerm && rightTerm && termsEqual(leftTerm, rightTerm));
    };

const dedExtractor = (left: Term, right: Term) => ({
    leftTerm: getPredicate(left),
    rightTerm: getSubject(right)
});
const indExtractor = (left: Term, right: Term) => ({
    leftTerm: getSubject(left),
    rightTerm: getSubject(right)
});
const abdExtractor = (left: Term, right: Term) => ({
    leftTerm: getPredicate(left),
    rightTerm: getPredicate(right)
});

const _deductionLink = linkFn(dedExtractor);
const _inductionLink = linkFn(indExtractor);
const _abductionLink = linkFn(abdExtractor);

const buildDeduction = (left: Term, right: Term): Term | undefined => {
    const s = getSubject(left), p = getPredicate(right);
    if (!s || !p) return undefined;
    const result = TermBuilder.inheritance(s, p);
    return result ?? undefined;
};

const buildInduction = (left: Term, right: Term): Term | undefined => {
    const p1 = getPredicate(left), p2 = getPredicate(right);
    if (!p1 || !p2) return undefined;
    const result = TermBuilder.inheritance(p1, p2);
    return result ?? undefined;
};

const buildAbduction = (left: Term, right: Term): Term | undefined => {
    const s1 = getSubject(left), s2 = getSubject(right);
    if (!s1 || !s2) return undefined;
    const result = TermBuilder.inheritance(s1, s2);
    return result ?? undefined;
};

const buildHigherOrderRule = (
    linkValidator: (a1: Term, c1: Term, a2: Term, c2: Term) => boolean,
    resultBuilder: (a1: Term, c1: Term, a2: Term, c2: Term) => Term | undefined
): RuleFn => ([imp1, imp2]) => {
    if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
    const [a1, c1] = imp1.args, [a2, c2] = imp2.args;
    if (!a1 || !c1 || !a2 || !c2) return undefined;
    return linkValidator(a1, c1, a2, c2) ? resultBuilder(a1, c1, a2, c2) : undefined;
};

const {
    negation, inheritance, conjunction, disjunction, implication, equivalence, similarity,
    sequence, parallel, predictive, operation, instance, property
} = TermBuilder;

const foldNary = (kind: Term['kind'], eq: (a1: Term, a2: Term) => boolean, unique = false): RuleFn => {
    return ([t1, t2]: [Term, Term]): Term | undefined => {
        if (t1.kind !== kind || t2.kind !== kind) return undefined;
        const a1 = t1.args!, a2 = t2.args!;
        const args = unique
            ? [...a1, ...a2].filter((a, i, arr) => arr.findIndex(b => eq(a, b)) === i)
            : a1.filter(x => a2.some(y => eq(x, y)));
        return args.length > 0 ? (kind === 'conjunction' ? TermBuilder.conjunction(...args) : TermBuilder.disjunction(...args)) : undefined;
    };
};

const conversionRule = (wrap: (t: Term) => Term) => buildInhRule(ID, inh => {
    const s = getSubject(inh), p = getPredicate(inh);
    return s && p ? inheritance(wrap(s), wrap(p)) : undefined;
});

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

const deductionFromType = (typeKind: 'instance' | 'property', matchOn: 'subject' | 'predicate') =>
    ([inh, term]: [Term, Term]): Term | undefined => {
        if (inh.kind !== 'inheritance' || term.kind !== typeKind) return undefined;
        const s = getSubject(inh), p = getPredicate(inh);
        const arg = term.args[0];
        if (!s || !p || !arg) return undefined;
        return termsEqual(matchOn === 'subject' ? s : p, arg) ? inheritance(matchOn === 'subject' ? arg : s, matchOn === 'subject' ? p : arg) : undefined;
    };

export const NALRules = {
    deduction: buildBinaryInhRule(
        (l, r) => linkFn(dedExtractor)(l, r),
        buildDeduction
    ),
    induction: buildBinaryInhRule(
        (l, r) => linkFn(indExtractor)(l, r),
        buildInduction
    ),
    abduction: buildBinaryInhRule(
        (l, r) => linkFn(abdExtractor)(l, r),
        buildAbduction
    ),
    similarity: buildBinaryInhRule(
        (l, r) => {
            const s1 = getSubject(l), p1 = getPredicate(l), s2 = getSubject(r), p2 = getPredicate(r);
            if (!s1 || !p1 || !s2 || !p2) return false;
            return (termsEqual(s1, s2) && termsEqual(p1, p2)) || (termsEqual(s1, p2) && termsEqual(p1, s2));
        },
        (l) => {
            const s = getSubject(l), p = getPredicate(l);
            return s && p ? TermBuilder.similarity(s, p) : undefined;
        }
    ),
    contrapositive: ([imp, inh]: [Term, Term]): Term | undefined => {
        if (imp.kind !== 'implication' || inh.kind !== 'inheritance') return undefined;
        const [ante, cons] = imp.args;
        const sub = getSubject(inh);
        if (!ante || !cons || !sub || !termsEqual(ante, sub)) return undefined;
        const consequent = inh.args[1];
        return consequent ? TermBuilder.implication(consequent, cons) : undefined;
    },
    intersection: foldNary('conjunction', (a1, a2) => termsEqual(a1, a2)),
    union: foldNary('disjunction', (a1, a2) => termsEqual(a1, a2), true),
    decompose: ([c1, c2]: [Term, Term]): Term | undefined => {
        if (c1.kind !== 'conjunction' || c2.kind !== 'conjunction') return undefined;
        return c1.args.find(a1 => c2.args.some(a2 => termsEqual(a1, a2)));
    },
    conjunctionIntro: ([i1, i2]: [Term, Term]): Term | undefined => {
        if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') return undefined;
        const s1 = getSubject(i1), p1 = getPredicate(i1), s2 = getSubject(i2), p2 = getPredicate(i2);
        if (!s1 || !p1 || !s2 || !p2 || !termsEqual(s1, s2)) return undefined;
        return TermBuilder.conjunction(p1, p2);
    },
    disjunctionIntro: ([a1, a2]: [Term, Term]): Term | undefined =>
        a1.kind === 'atom' && a2.kind === 'atom' ? TermBuilder.disjunction(a1, a2) : undefined,
    implicationIntro: ([inh, neg]: [Term, Term]): Term | undefined => {
        if (inh.kind !== 'inheritance' || neg.kind !== 'negation') return undefined;
        const sub = getSubject(inh), pred = getPredicate(inh);
        return sub && pred ? TermBuilder.implication(sub, pred) : undefined;
    },
    implicationElim: ([imp, atm]: [Term, Term]): Term | undefined => {
        if (imp.kind !== 'implication' || atm.kind !== 'atom') return undefined;
        const [ante, cons] = imp.args;
        return ante && termsEqual(ante, atm) ? cons : undefined;
    },
    equivalenceIntro: ([imp1, imp2]: [Term, Term]): Term | undefined => {
        if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
        const [a1, c1] = imp1.args, [a2, c2] = imp2.args;
        if (!a1 || !c1 || !a2 || !c2) return undefined;
        const match = (termsEqual(a1, a2) && termsEqual(c1, c2)) || (termsEqual(a1, c2) && termsEqual(c1, a2));
        return match ? TermBuilder.equivalence(a1, c1) : undefined;
    },
    equivalenceElim: ([eq, atm]: [Term, Term]): Term | undefined => {
        if (eq.kind !== 'equivalence' || atm.kind !== 'atom') return undefined;
        const [a, c] = eq.args;
        if (!a || !c) return undefined;
        return termsEqual(a, atm) || termsEqual(c, atm) ? c : undefined;
    },
    negationIntro: ([imp1, imp2]: [Term, Term]): Term | undefined => {
        if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
        const [a1, c1] = imp1.args, [a2, c2] = imp2.args;
        if (!a1 || !c1 || !a2 || !c2) return undefined;
        return (termsEqual(a1, a2) && c1.kind === 'atom' && c2.kind === 'atom' && c1.symbol === 'TRUE' && c2.symbol === 'FALSE')
            ? TermBuilder.negation(a1) : undefined;
    },
    negationElim: ([n1, n2]: [Term, Term]): Term | undefined => {
        if (n1.kind !== 'negation' || n2.kind !== 'negation') return undefined;
        const [a1] = n1.args, [a2] = n2.args;
        return a1 && a2 && termsEqual(a1, a2) ? TermBuilder.atom('FALSE') : undefined;
    },
    destruct: ([conj, atm]: [Term, Term]): Term | undefined =>
        conj.kind === 'conjunction' && atm.kind === 'atom' ? conj.args.find(a => termsEqual(a, atm)) : undefined,
    compose: undefined as unknown as ([i1, i2]: [Term, Term]) => Term | undefined,
    revision: undefined as unknown as ([i1, i2]: [Term, Term]) => Term | undefined,
    analogy: ([inh, sim]: [Term, Term]) => {
        if (inh.kind !== 'inheritance' || sim.kind !== 'similarity') return undefined;
        return matchInhPair((s1, p1, s2, p2) => termsEqual(p1, s2) ? TermBuilder.inheritance(s1, p2) : undefined)([inh, sim]);
    },
    comparison: matchInhPair((s1, p1, s2, p2) => termsEqual(s1, s2) ? TermBuilder.similarity(p1, p2) : undefined) as RuleFn,
    instantiation: ([inh, sim]: [Term, Term]) => {
        if (inh.kind !== 'inheritance' || sim.kind !== 'similarity') return undefined;
        return matchInhPair((s1, p1, s2, p2) => termsEqual(p1, p2) ? TermBuilder.inheritance(s1, s2) : undefined)([inh, sim]);
    },
    exemplification: matchInhPair((s1, p1, s2, p2) => termsEqual(p1, p2) ? TermBuilder.inheritance(s1, s2) : undefined) as RuleFn,
    higherOrderDeduction: buildHigherOrderRule((_a1, c1, a2, _c2) => termsEqual(c1, a2), (a1, _c1, _a2, c2) => TermBuilder.implication(a1, c2)),
    higherOrderAbduction: buildHigherOrderRule((_a1, c1, _a2, c2) => termsEqual(c1, c2), (a1, _c1, a2, _c2) => TermBuilder.implication(a1, a2)),
    higherOrderInduction: buildHigherOrderRule((a1, _c1, a2, _c2) => termsEqual(a1, a2), (_a1, c1, _a2, c2) => TermBuilder.implication(c1, c2))
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
        sameInhPair,
        (inh1, _inh2) => {
            const {s, p} = extractInh(inh1);
            if (!s || !p) return undefined;
            return similarity(s, p);
        }
    ),
    analogy: ([inh, sim]: [Term, Term]): Term | undefined => {
        if (inh.kind !== 'inheritance' || sim.kind !== 'similarity') return undefined;
        return matchInhPair((s1, p1, s2, p2) => termsEqual(p1, s2) ? TermBuilder.inheritance(s1, p2) : undefined)([inh, sim]);
    },
    contrapositionRule: ([imp]: [Term, Term]): Term | undefined => {
        if (imp.kind !== 'implication') return undefined;
        const ante = imp.args[0], cons = imp.args[1];
        if (!ante || !cons) return undefined;
        return implication(negation(cons), negation(ante));
    },
    exemplification: buildBinaryInhRule(
        (inh1, inh2) => {
            const p1 = getPredicate(inh1), p2 = getPredicate(inh2);
            return !!(p1 && p2 && termsEqual(p1, p2));
        },
        (inh1, inh2) => {
            const s1 = getSubject(inh1), s2 = getSubject(inh2);
            if (!s1 || !s2) return undefined;
            return inheritance(s1, s2);
        }
    ),
    sameness: buildBinaryInhRule(
        sameInhPair,
        (inh1, _inh2) => {
            const {s, p} = extractInh(inh1);
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
    operationExecution: undefined as unknown as ([op, input]: [Term, Term]) => Term | undefined,
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
    strategyEffectiveness: undefined as unknown as ([strategy, result]: [Term, Term]) => Term | undefined,
    resourceAllocation: undefined as unknown as ([task, resource]: [Term, Term]) => Term | undefined,
    errorPatternDetection: undefined as unknown as ([error, context]: [Term, Term]) => Term | undefined,
    utilityEstimation: undefined as unknown as ([concept, utility]: [Term, Term]) => Term | undefined,
    metacognitiveRevision: undefined as unknown as ([t1, t2]: [Term, Term]) => Term | undefined,
    selfModelConsistency: undefined as unknown as ([t1, t2]: [Term, Term]) => Term | undefined,
};

const NAL_RULES: RuleDef[] = [
    {
        id: 'nal.deduction',
        description: 'Classic syllogistic deduction',
        pattern: ['inheritance', 'inheritance'],
        build: NALRules['deduction'] as RuleFn,
        truth: 'deduction',
        priority: 1.0
    },
    {
        id: 'nal.induction',
        description: 'Inductive generalization',
        pattern: ['inheritance', 'inheritance'],
        build: NALRules['induction'] as RuleFn,
        truth: 'induction',
        priority: 0.9
    },
    {
        id: 'nal.abduction',
        description: 'Abductive reasoning',
        pattern: ['inheritance', 'inheritance'],
        build: NALRules['abduction'] as RuleFn,
        truth: 'abduction',
        priority: 0.8
    },
    {
        id: 'nal.similarity',
        description: 'Similarity-based inference',
        pattern: ['inheritance', 'inheritance'],
        build: NALRules['similarity'] as RuleFn,
        truth: 'resemblance',
        priority: 0.95
    },
    {
        id: 'nal.contrapositive',
        description: 'Contrapositive rule',
        pattern: ['implication', 'inheritance'],
        build: NALRules['contrapositive'],
        truth: 'contraposition',
        priority: 0.7
    },
    {
        id: 'nal.intersection',
        description: 'Intersection composition',
        pattern: ['conjunction', 'conjunction'],
        build: NALRules['intersection'],
        truth: 'intersection',
        priority: 0.85
    },
    {
        id: 'nal.union',
        description: 'Union composition',
        pattern: ['disjunction', 'disjunction'],
        build: NALRules['union'],
        truth: 'union',
        priority: 0.8
    },
    {
        id: 'nal.conjunctionIntro',
        description: 'Conjunction introduction',
        pattern: ['inheritance', 'inheritance'],
        build: NALRules['conjunctionIntro'],
        truth: 'intersection',
        priority: 0.75
    },
    {
        id: 'nal.disjunctionIntro',
        description: 'Disjunction introduction',
        pattern: ['atom', 'atom'],
        build: NALRules['disjunctionIntro'],
        truth: 'union',
        priority: 0.7
    },
    {
        id: 'nal.implicationIntro',
        description: 'Implication introduction',
        pattern: ['inheritance', 'negation'],
        build: NALRules['implicationIntro'],
        truth: 'deduction',
        priority: 0.8
    },
    {
        id: 'nal.implicationElim',
        description: 'Implication elimination (modus ponens)',
        pattern: ['implication', 'atom'],
        build: NALRules['implicationElim'],
        truth: 'deduction',
        priority: 0.9
    },
    {
        id: 'nal.equivalenceIntro',
        description: 'Equivalence introduction',
        pattern: ['implication', 'implication'],
        build: NALRules['equivalenceIntro'],
        truth: 'intersection',
        priority: 0.85
    },
    {
        id: 'nal.equivalenceElim',
        description: 'Equivalence elimination',
        pattern: ['equivalence', 'atom'],
        build: NALRules['equivalenceElim'],
        truth: 'deduction',
        priority: 0.9
    },
    {
        id: 'nal.negationIntro',
        description: 'Negation introduction',
        pattern: ['implication', 'implication'],
        build: NALRules['negationIntro'],
        truth: 'deduction',
        priority: 0.75
    },
    {
        id: 'nal.negationElim',
        description: 'Negation elimination',
        pattern: ['negation', 'negation'],
        build: NALRules['negationElim'],
        truth: 'union',
        priority: 0.8
    },
    {
        id: 'nal.destruct',
        description: 'Destructuring rule',
        pattern: ['conjunction', 'atom'],
        build: NALRules['destruct'],
        truth: 'deduction',
        priority: 0.85
    },
    {
        id: 'nal.compose',
        description: 'Composition rule',
        pattern: ['inheritance', 'inheritance'],
        build: NALRules['compose'] as RuleFn,
        truth: 'deduction',
        priority: 0.7
    },
    {
        id: 'nal.decompose',
        description: 'Decomposition rule',
        pattern: ['conjunction', 'conjunction'],
        build: NALRules['decompose'],
        truth: 'deduction',
        priority: 0.8
    },
    {
        id: 'nal.revision',
        description: 'Belief revision',
        pattern: ['inheritance', 'inheritance'],
        build: NALRules['revision'] as RuleFn,
        truth: 'revision',
        priority: 0.6
    },
    {
        id: 'nal.analogy',
        description: 'Analogical reasoning',
        pattern: ['inheritance', 'similarity'],
        build: NALRules['analogy'],
        truth: 'analogy',
        priority: 0.75
    },
    {
        id: 'nal.comparison',
        description: 'Comparison inference',
        pattern: ['inheritance', 'inheritance'],
        build: NALRules['comparison'] as RuleFn,
        truth: 'sameness',
        priority: 0.8
    },
    {
        id: 'nal.instantiation',
        description: 'Term instantiation',
        pattern: ['inheritance', 'similarity'],
        build: NALRules['instantiation'],
        truth: 'deduction',
        priority: 0.85
    },
    {
        id: 'nal.exemplification',
        description: 'Exemplification inference',
        pattern: ['inheritance', 'inheritance'],
        build: NALRules['exemplification'] as RuleFn,
        truth: 'exemplification',
        priority: 0.8
    },
    {
        id: 'nal.higherOrderDeduction',
        description: 'Higher-order deduction',
        pattern: ['implication', 'implication'],
        build: NALRules['higherOrderDeduction'],
        truth: 'deduction',
        priority: 0.85
    },
    {
        id: 'nal.higherOrderAbduction',
        description: 'Higher-order abduction',
        pattern: ['implication', 'implication'],
        build: NALRules['higherOrderAbduction'],
        truth: 'abduction',
        priority: 0.7
    },
    {
        id: 'nal.higherOrderInduction',
        description: 'Higher-order induction',
        pattern: ['implication', 'implication'],
        build: NALRules['higherOrderInduction'],
        truth: 'induction',
        priority: 0.75
    },
];

const NAL_EXTENDED_RULES: RuleDef[] = [
    {
        id: 'nal.modusPonens',
        description: 'Modus ponens',
        pattern: ['implication', 'atom'],
        build: NALExtendedRules['modusPonens'],
        truth: 'deduction',
        priority: 0.95
    },
    {
        id: 'nal.modusTollens',
        description: 'Modus tollens',
        pattern: ['implication', 'negation'],
        build: NALExtendedRules['modusTollens'],
        truth: 'contraposition',
        priority: 0.9
    },
    {
        id: 'nal.conversion',
        description: 'Term conversion',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['conversion'],
        truth: 'conversion',
        priority: 0.7
    },
    {
        id: 'nal.extended.analogy',
        description: 'Extended analogy',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['analogy'],
        truth: 'analogy',
        priority: 0.8
    },
    {
        id: 'nal.extended.comparison',
        description: 'Extended comparison',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['comparison'],
        truth: 'resemblance',
        priority: 0.75
    },
    {
        id: 'nal.contrapositionRule',
        description: 'Contraposition rule',
        pattern: ['implication', 'implication'],
        build: NALExtendedRules['contrapositionRule'],
        truth: 'contraposition',
        priority: 0.7
    },
    {
        id: 'nal.structuralInheritance',
        description: 'Structural inheritance',
        pattern: ['conjunction', 'inheritance'],
        build: NALExtendedRules['structuralInheritance'],
        truth: 'deduction',
        priority: 0.75
    },
    {
        id: 'nal.structuralReduction',
        description: 'Structural reduction',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['structuralReduction'],
        truth: 'structuralReduction',
        priority: 0.7
    },
    {
        id: 'nal.intersectionComposition',
        description: 'Intersection composition',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['intersectionComposition'],
        truth: 'intersection',
        priority: 0.8
    },
    {
        id: 'nal.unionComposition',
        description: 'Union composition',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['unionComposition'],
        truth: 'union',
        priority: 0.75
    },
    {
        id: 'nal.difference',
        description: 'Difference rule',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['difference'],
        truth: 'deduction',
        priority: 0.7
    },
    {
        id: 'nal.implicationDeduction',
        description: 'Implication deduction',
        pattern: ['implication', 'implication'],
        build: NALExtendedRules['implicationDeduction'],
        truth: 'deduction',
        priority: 0.85
    },
    {
        id: 'nal.equivalence',
        description: 'Equivalence rule',
        pattern: ['implication', 'implication'],
        build: NALExtendedRules['equivalence'],
        truth: 'intersection',
        priority: 0.8
    },
    {
        id: 'nal.variableIntroduction',
        description: 'Variable introduction',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['variableIntroduction'],
        truth: 'deduction',
        priority: 0.6
    },
    {
        id: 'nal.decomposition',
        description: 'Decomposition rule',
        pattern: ['conjunction', 'conjunction'],
        build: NALExtendedRules['decomposition'],
        truth: 'deduction',
        priority: 0.75
    },
    {
        id: 'nal.variableDependency',
        description: 'Variable dependency',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['variableDependency'],
        truth: 'deduction',
        priority: 0.5
    },
    {
        id: 'nal.sameness',
        description: 'Sameness rule',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['sameness'],
        truth: 'sameness',
        priority: 0.85
    },
    {
        id: 'nal.revisionWeak',
        description: 'Weak revision',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['revisionWeak'],
        truth: 'revision',
        priority: 0.65
    },
    {
        id: 'nal.extended.exemplification',
        description: 'Extended exemplification',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['exemplification'],
        truth: 'exemplification',
        priority: 0.8
    },
    {
        id: 'nal.instanceConversion',
        description: 'Instance conversion',
        pattern: ['inheritance', 'instance'],
        build: NALExtendedRules['instanceConversion'],
        truth: 'conversion',
        priority: 0.7
    },
    {
        id: 'nal.propertyConversion',
        description: 'Property conversion',
        pattern: ['inheritance', 'property'],
        build: NALExtendedRules['propertyConversion'],
        truth: 'conversion',
        priority: 0.7
    },
    {
        id: 'nal.instanceDeduction',
        description: 'Instance deduction',
        pattern: ['inheritance', 'instance'],
        build: NALExtendedRules['instanceDeduction'],
        truth: 'deduction',
        priority: 0.85
    },
    {
        id: 'nal.propertyInduction',
        description: 'Property induction',
        pattern: ['inheritance', 'property'],
        build: NALExtendedRules['propertyInduction'],
        truth: 'induction',
        priority: 0.75
    },
    {
        id: 'nal.sequenceIntroduction',
        description: 'Sequence introduction',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['sequenceIntroduction'],
        truth: 'deduction',
        priority: 0.75
    },
    {
        id: 'nal.parallelIntroduction',
        description: 'Parallel introduction',
        pattern: ['inheritance', 'inheritance'],
        build: NALExtendedRules['parallelIntroduction'],
        truth: 'deduction',
        priority: 0.7
    },
    {
        id: 'nal.predictiveImplication',
        description: 'Predictive implication',
        pattern: ['sequence', 'inheritance'],
        build: NALExtendedRules['predictiveImplication'],
        truth: 'deduction',
        priority: 0.8
    },
    {
        id: 'nal.temporalDeduction',
        description: 'Temporal deduction',
        pattern: ['predictive', 'sequence'],
        build: NALExtendedRules['temporalDeduction'],
        truth: 'deduction',
        priority: 0.85
    },
    {
        id: 'nal.proceduralDecomposition',
        description: 'Procedural decomposition',
        pattern: ['sequence', 'operation'],
        build: NALExtendedRules['proceduralDecomposition'],
        truth: 'deduction',
        priority: 0.75
    },
    {
        id: 'nal.proceduralChaining',
        description: 'Procedural chaining',
        pattern: ['operation', 'operation'],
        build: NALExtendedRules['proceduralChaining'],
        truth: 'deduction',
        priority: 0.8
    },
    {
        id: 'nal.operationToPredictive',
        description: 'Operation to predictive',
        pattern: ['operation', 'sequence'],
        build: NALExtendedRules['operationToPredictive'],
        truth: 'deduction',
        priority: 0.75
    },
];

registerRulesFromDSL(NAL_RULES);
registerRulesFromDSL(NAL_EXTENDED_RULES);