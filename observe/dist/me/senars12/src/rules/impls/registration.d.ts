import { type Term } from '../../terms';
import type { RuleDef, RuleFn } from '../types';
export declare const RULE_BODIES: Readonly<Record<string, RuleFn>>;
declare const NAL_EXTENDED_RULES: RuleDef[];
/**
 * The shipped table. Every declaration at revision 0 with `builtin` provenance —
 * nothing was admitted, so nothing has a parent revision. Disabled rules are
 * dropped here and nowhere else, so `BUILTIN_DECLARATIONS` is the single answer
 * to "what does this NAR actually run".
 */
export declare const BUILTIN_DECLARATIONS: {
    ruleId: string;
    description: string;
    left: {
        op: Term['kind'];
    };
    right: {
        op: Term['kind'];
    };
    truthFn: "FALSE" | "MAX_CONFIDENCE" | "NEUTRAL" | "TRUE" | "abduction" | "abductionChain" | "analogy" | "attention" | "c2w" | "choice" | "compare" | "comparison" | "contradict" | "contraposition" | "conversion" | "conversionChain" | "create" | "damp" | "deduction" | "deductionChain" | "deductionWeak" | "deserialize" | "detachment" | "diff" | "equals" | "exemplification" | "expectation" | "format" | "fromUnknown" | "harshness" | "induction" | "inductionChain" | "intersection" | "isStronger" | "negation" | "normalize" | "reinforce" | "resemblance" | "revision" | "revisionWeak" | "sameness" | "serialize" | "structuralDeduction" | "structuralReduction" | "subtract" | "union" | "w2c" | "weak";
    body: string;
    priority: number;
}[];
/** Why a rule is not shipped — for a gate, a status report, or the next attempt. */
export declare const DISABLED_RULES: Readonly<Record<string, string>>;
export { NAL_EXTENDED_RULES };
//# sourceMappingURL=registration.d.ts.map