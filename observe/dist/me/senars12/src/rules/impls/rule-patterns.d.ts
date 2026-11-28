import type { Term } from '../../terms';
/** Common rule patterns to avoid repetition in declarations. */
export declare const RulePatterns: {
    readonly inheritance_inheritance: [Term['kind'], Term['kind']];
    readonly implication_implication: [Term['kind'], Term['kind']];
    readonly conjunction_conjunction: [Term['kind'], Term['kind']];
    readonly disjunction_disjunction: [Term['kind'], Term['kind']];
    readonly implication_inheritance: [Term['kind'], Term['kind']];
    readonly implication_atom: [Term['kind'], Term['kind']];
    readonly implication_negation: [Term['kind'], Term['kind']];
    readonly equivalence_atom: [Term['kind'], Term['kind']];
    readonly atom_atom: [Term['kind'], Term['kind']];
    readonly inheritance_negation: [Term['kind'], Term['kind']];
    readonly negation_negation: [Term['kind'], Term['kind']];
    readonly conjunction_atom: [Term['kind'], Term['kind']];
    readonly inheritance_similarity: [Term['kind'], Term['kind']];
    readonly disjunction_negation: [Term['kind'], Term['kind']];
    readonly inheritance_setExt: [Term['kind'], Term['kind']];
    readonly inheritance_setInt: [Term['kind'], Term['kind']];
    readonly operation_operation: [Term['kind'], Term['kind']];
    readonly operation_sequence: [Term['kind'], Term['kind']];
    readonly sequence_operation: [Term['kind'], Term['kind']];
    readonly sequence_inheritance: [Term['kind'], Term['kind']];
    readonly predictive_sequence: [Term['kind'], Term['kind']];
};
export type RulePatternKey = keyof typeof RulePatterns;
//# sourceMappingURL=rule-patterns.d.ts.map