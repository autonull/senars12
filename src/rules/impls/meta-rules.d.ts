/**
 * Meta-Rules with AIKR Bounds — Self-reasoning rules with hard limits
 *
 * These rules enable the NAR to reason about its own operation:
 * - Strategy selection based on competence drive
 * - Knob tuning based on reward signals
 * - Test repair via semantic fix patterns
 * - Schema promotion based on confidence/frequency
 * - Capability scaffolding from templates
 *
 * AIKR Bounds (enforced in RuleProcessor for meta-rules):
 * - maxMetaDerivationDepth: 2 (prevent infinite regress)
 * - maxMetaDerivationsPerStep: 5 (limit compute on self-reasoning)
 * - metaRulePriority: 0.1 (lower than world beliefs)
 * - metaRuleActivationThreshold: drive_intensity > 0.6 (only fire when drives demand it)
 */
import { type TruthType } from '../../terms';
import type { InferenceTable, RegisteredRule } from '../types';
/** AIKR bounds for meta-reasoning */
export declare const META_AIKR_BOUNDS: {
    readonly maxMetaDerivationDepth: 2;
    readonly maxMetaDerivationsPerStep: 5;
    readonly metaRulePriority: 0.1;
    readonly metaRuleActivationThreshold: 0.6;
};
/** Meta-rule definitions in Narsese format */
export declare const META_RULES_NARSESE: readonly ['((drive:competence --> low) & (situation --> requires_strategy) & (strategy --> $s) ==> (^select_strategy($s))!)', '((rlfp:reward --> below_threshold) & (knob --> $k) & (tune --> improves $k) & (^tune($k, $v))! ==> (^apply_tuning($k, $v))!)', '((test_failed --> $t) & (error_pattern --> $e) & (fix_pattern($e) --> $fix) & (^repair($t, $fix))! ==> (^apply_fix($fix))!)', '((schema --> $s) & (confidence($s) > 0.9) & (frequency($s) > 10) ==> (^promote_rule($s))!)', '((capability --> $c) & (template($c) --> $tmpl) & (^add_capability($c))! ==> (^scaffold($tmpl, $c))!)'];
/** Build registered meta-rules with proper patterns */
export declare function buildMetaRules(): RegisteredRule[];
/**
 * Register the meta-rules into a dispatch table.
 *
 * The table is **required**, not optional: these used to also land on a
 * module-global registry, where a caller who passed nothing still "registered"
 * them and no running engine could see it. A registration with no table is not a
 * registration (TODO29.a §5.10).
 */
export declare function registerMetaRules(table: InferenceTable): void;
/** Initialize meta-reasoning beliefs into NAR */
export declare const META_REASONING_BELIEFS: readonly ['(meta_bound_maxDerivationDepth --> 2).', '(meta_bound_maxDerivationsPerStep --> 5).', '(meta_bound_priority --> 0_1).', '(meta_bound_activationThreshold --> 0_6).', '(meta_rule_strategy_selection --> exists).', '(meta_rule_knob_tuning --> exists).', '(meta_rule_test_repair --> exists).', '(meta_rule_schema_promotion --> exists).', '(meta_rule_capability_scaffold --> exists).', '(drive_threshold_competence --> 0_6).', '(drive_threshold_coherence --> 0_6).', '(drive_threshold_curiosity --> 0_6).'];
/** Initialize meta-reasoning beliefs */
export declare function initializeMetaReasoning(nar: {
    believe: (input: string, truth?: TruthType) => Promise<void>;
}): Promise<void>;
/** Check if meta-reasoning should activate based on drive intensities */
export declare function shouldActivateMetaReasoning(driveStates: Iterable<{
    currentIntensity: number;
}>): boolean;
/** Get meta-reasoning budget status */
export declare function getMetaBudgetStatus(derivationsThisStep: number, currentDepth: number): {
    withinBudget: boolean;
    remainingDerivations: number;
    remainingDepth: number;
};
//# sourceMappingURL=meta-rules.d.ts.map