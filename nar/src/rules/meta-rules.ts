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

import { Truth, type TruthType, TermBuilder, atom, type Term } from '../terms';
import type { RegisteredRule, RuleIndex } from './types.js';
import { RuleRegistry } from './types.js';

/** Semantic truth values for meta-rules (moderate confidence) */
const META_RULE_TRUTH: TruthType = Truth.create(0.6, 0.8);

/** AIKR bounds for meta-reasoning */
export const META_AIKR_BOUNDS = {
  maxMetaDerivationDepth: 2,
  maxMetaDerivationsPerStep: 5,
  metaRulePriority: 0.1,
  metaRuleActivationThreshold: 0.6,
} as const;

/** Meta-rule definitions in Narsese format */
export const META_RULES_NARSESE = [
  // Strategy selection (only when competence drive low)
  '<(drive:competence --> low) & (situation --> requires_strategy) & (strategy --> $s) ==> (^select_strategy($s))!>',

  // Knob tuning (only when reward < threshold)
  '<(rlfp:reward --> below_threshold) & (knob --> $k) & (tune --> improves $k) & (^tune($k, $v))! ==> (^apply_tuning($k, $v))!>',

  // Test repair (semantic fix pattern)
  '<(test_failed --> $t) & (error_pattern --> $e) & (fix_pattern($e) --> $fix) & (^repair($t, $fix))! ==> (^apply_fix($fix))!>',

  // Schema promotion (high confidence + frequency)
  '<(schema --> $s) & (confidence($s) > 0.9) & (frequency($s) > 10) ==> (^promote_rule($s))!>',

  // Capability scaffolding
  '<(capability --> $c) & (template($c) --> $tmpl) & (^add_capability($c))! ==> (^scaffold($tmpl, $c))!>',
] as const;

/** Build registered meta-rules with proper patterns */
export function buildMetaRules(): RegisteredRule[] {
  const $s = atom('$s');
  const $k = atom('$k');
  const $v = atom('$v');
  const $t = atom('$t');
  const $e = atom('$e');
  const $fix = atom('$fix');
  const $c = atom('$c');
  const $tmpl = atom('$tmpl');

  const driveCompetence = atom('drive:competence');
  const low = atom('low');
  const situation = atom('situation');
  const requiresStrategy = atom('requires_strategy');
  const strategy = atom('strategy');
  const rlfpReward = atom('rlfp:reward');
  const belowThreshold = atom('below_threshold');
  const knob = atom('knob');
  const tune = atom('tune');
  const improves = atom('improves');
  const testFailed = atom('test_failed');
  const errorPattern = atom('error_pattern');
  const fixPattern = atom('fix_pattern');
  const schema = atom('schema');
  const confidence = atom('confidence');
  const frequency = atom('frequency');
  const capability = atom('capability');
  const template = atom('template');
  const selectStrategy = atom('^select_strategy');
  const applyTuning = atom('^apply_tuning');
  const repair = atom('^repair');
  const applyFix = atom('^apply_fix');
  const promoteRule = atom('^promote_rule');
  const addCapability = atom('^add_capability');
  const scaffold = atom('^scaffold');

  const rules: RegisteredRule[] = [
    // Strategy selection: (drive:competence --> low) & (situation --> requires_strategy) & (strategy --> $s) ==> (^select_strategy($s))!
    {
      id: 'meta-strategy-selection',
      pattern: { left: { op: 'implication' }, right: { op: 'implication' } },
      apply: (premises) => {
        const [p1, p2] = premises;
        // This is a template - actual implementation in tool layer
        return undefined;
      },
      sync: true,
      priority: META_AIKR_BOUNDS.metaRulePriority,
      truthFn: () => META_RULE_TRUTH,
    },
    // Knob tuning: (rlfp:reward --> below_threshold) & (knob --> $k) & (tune --> improves $k) & (^tune($k, $v))! ==> (^apply_tuning($k, $v))!
    {
      id: 'meta-knob-tuning',
      pattern: { left: { op: 'implication' }, right: { op: 'implication' } },
      apply: (premises) => undefined,
      sync: true,
      priority: META_AIKR_BOUNDS.metaRulePriority,
      truthFn: () => META_RULE_TRUTH,
    },
    // Test repair: (test_failed --> $t) & (error_pattern --> $e) & (fix_pattern($e) --> $fix) & (^repair($t, $fix))! ==> (^apply_fix($fix))!
    {
      id: 'meta-test-repair',
      pattern: { left: { op: 'implication' }, right: { op: 'implication' } },
      apply: (premises) => undefined,
      sync: true,
      priority: META_AIKR_BOUNDS.metaRulePriority,
      truthFn: () => META_RULE_TRUTH,
    },
    // Schema promotion: (schema --> $s) & (confidence($s) > 0.9) & (frequency($s) > 10) ==> (^promote_rule($s))!
    {
      id: 'meta-schema-promotion',
      pattern: { left: { op: 'implication' }, right: { op: 'implication' } },
      apply: (premises) => undefined,
      sync: true,
      priority: META_AIKR_BOUNDS.metaRulePriority,
      truthFn: () => META_RULE_TRUTH,
    },
    // Capability scaffolding: (capability --> $c) & (template($c) --> $tmpl) & (^add_capability($c))! ==> (^scaffold($tmpl, $c))!
    {
      id: 'meta-capability-scaffold',
      pattern: { left: { op: 'implication' }, right: { op: 'implication' } },
      apply: (premises) => undefined,
      sync: true,
      priority: META_AIKR_BOUNDS.metaRulePriority,
      truthFn: () => META_RULE_TRUTH,
    },
  ];

  return rules;
}

/** Register meta-rules into the RuleRegistry */
export function registerMetaRules(ruleIndex?: RuleIndex): void {
  const metaRules = buildMetaRules();
  for (const rule of metaRules) {
    RuleRegistry.register(rule);
    ruleIndex?.register(rule);
  }
}

/** Initialize meta-reasoning beliefs into NAR */
export const META_REASONING_BELIEFS = [
  // AIKR bounds as beliefs
  '(meta_bound_maxDerivationDepth --> 2).',
  '(meta_bound_maxDerivationsPerStep --> 5).',
  '(meta_bound_priority --> 0_1).',
  '(meta_bound_activationThreshold --> 0_6).',

  // Meta-rule declarations
  '(meta_rule_strategy_selection --> exists).',
  '(meta_rule_knob_tuning --> exists).',
  '(meta_rule_test_repair --> exists).',
  '(meta_rule_schema_promotion --> exists).',
  '(meta_rule_capability_scaffold --> exists).',

  // Drive thresholds for meta-reasoning activation
  '(drive_threshold_competence --> 0_6).',
  '(drive_threshold_coherence --> 0_6).',
  '(drive_threshold_curiosity --> 0_6).',
] as const;

/** Initialize meta-reasoning beliefs */
export async function initializeMetaReasoning(nar: { believe: (input: string, truth?: TruthType) => Promise<void> }): Promise<void> {
  for (const belief of META_REASONING_BELIEFS) {
    await nar.believe(belief, META_RULE_TRUTH);
  }
}

/** Check if meta-reasoning should activate based on drive intensities */
export function shouldActivateMetaReasoning(driveStates: Map<string, { currentIntensity: number }>): boolean {
  for (const [, state] of driveStates) {
    if (state.currentIntensity > META_AIKR_BOUNDS.metaRuleActivationThreshold) {
      return true;
    }
  }
  return false;
}

/** Get meta-reasoning budget status */
export function getMetaBudgetStatus(
  derivationsThisStep: number,
  currentDepth: number
): { withinBudget: boolean; remainingDerivations: number; remainingDepth: number } {
  return {
    withinBudget: derivationsThisStep < META_AIKR_BOUNDS.maxMetaDerivationsPerStep && currentDepth < META_AIKR_BOUNDS.maxMetaDerivationDepth,
    remainingDerivations: META_AIKR_BOUNDS.maxMetaDerivationsPerStep - derivationsThisStep,
    remainingDepth: META_AIKR_BOUNDS.maxMetaDerivationDepth - currentDepth,
  };
}