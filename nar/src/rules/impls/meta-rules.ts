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

import {
  atom,
  binaryOf,
  isAtomic,
  type Term,
  TermBuilder,
  Truth,
  type TruthType,
} from '../../terms';
import { operationTerm } from '../../terms/impls/operation-term.js';
import type { InferenceTable, RegisteredRule } from '../types.js';

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
  '((drive:competence --> low) & (situation --> requires_strategy) & (strategy --> $s) ==> (^select_strategy($s))!)',

  // Knob tuning (only when reward < threshold)
  '((rlfp:reward --> below_threshold) & (knob --> $k) & (tune --> improves $k) & (^tune($k, $v))! ==> (^apply_tuning($k, $v))!)',

  // Test repair (semantic fix pattern)
  '((test_failed --> $t) & (error_pattern --> $e) & (fix_pattern($e) --> $fix) & (^repair($t, $fix))! ==> (^apply_fix($fix))!)',

  // Schema promotion (high confidence + frequency)
  '((schema --> $s) & (confidence($s) > 0.9) & (frequency($s) > 10) ==> (^promote_rule($s))!)',

  // Capability scaffolding
  '((capability --> $c) & (template($c) --> $tmpl) & (^add_capability($c))! ==> (^scaffold($tmpl, $c))!)',
] as const;

/** The symbol bound by a premise like `(drive_competence --> low)`, if that is what it is. */
function extractVariableBinding(term: Term, expectedPredicate: string): string | null {
  const parts = binaryOf('inheritance', term);
  if (!parts) return null;
  const [subject, predicate] = parts;
  if (!isAtomic(predicate) || predicate.symbol !== expectedPredicate) return null;
  if (!isAtomic(subject)) return null;
  return subject.symbol;
}

/** `tool(arg, ...)` — the shared operation-term encoding. */
const buildOperationTerm = (toolName: string, argTerms: Term[]): Term =>
  operationTerm(
    toolName,
    Object.fromEntries(argTerms.map((arg, i) => [`arg${i}`, arg.toString()]))
  );

/** Debug logging for meta-rules */
const META_DEBUG = false;

/** Lazy payload: the terms are stringified inside the guard, not to be dropped. */
function metaLog(msg: string, data: () => unknown): void {
  if (META_DEBUG) {
    const payload = data();
    console.log(`[META] ${msg}`, payload ? JSON.stringify(payload, null, 2) : '');
  }
}

/**
 * A meta-rule's fixed half.
 *
 * All five meta-rules spelled the same tail — the same premise shape, the same
 * sub-0.1 priority that keeps self-reasoning below world beliefs, the same
 * moderate-confidence truth, the same synchronous shape, the same `goal` task type
 * — so a rule that drifted from it would drift in the rule table and in a
 * reviewer's head at once and nothing would say so. The id is also the label both
 * of a rule's log lines carry, so it is bound once here instead of being written
 * three times per rule and free to disagree with the entry it names.
 */
const metaRule = (id: string, body: MetaRuleBody): RegisteredRule => ({
  id,
  pattern: { left: { op: 'inheritance' }, right: { op: 'inheritance' } },
  apply: (premises) => {
    const [p1, p2] = premises;
    const bound = body(p1, p2);
    metaLog(`${id} check`, () => ({ p1: p1?.toString(), p2: p2?.toString(), bound }));
    if (!bound) return undefined;
    metaLog(`${id} FIRED`, () => ({ result: bound.toString() }));
    return bound;
  },
  sync: true,
  priority: META_AIKR_BOUNDS.metaRulePriority,
  truthFn: () => META_RULE_TRUTH,
  taskType: 'goal',
});

/** The part of a meta-rule that differs: read two premises, emit a task or nothing. */
type MetaRuleBody = (left: Term, right: Term) => Term | undefined;

const FIX_PATTERNS: Record<string, string> = {
  null_pointer_error: 'fix_pattern:null_check',
  type_mismatch_error: 'fix_pattern:type_annotation',
  out_of_bounds_error: 'fix_pattern:boundary_check',
};

/** Build registered meta-rules with proper patterns */
export function buildMetaRules(): RegisteredRule[] {
  return [
    // Strategy selection: (drive:competence --> low) & (situation --> requires_strategy) & (strategy --> $s) ==> (^select_strategy($s))!
    metaRule('meta-strategy-selection', (p1, p2) => {
      const driveLow = extractVariableBinding(p1, 'low');
      const situationRequires = extractVariableBinding(p2, 'requires_strategy');
      if (!driveLow || !situationRequires) return undefined;
      return buildOperationTerm('switch_strategy', [atom('focused'), atom('derivation')]);
    }),

    // Knob tuning: (rlfp:reward --> below_threshold) & (knob --> $k) ==> (^apply_tuning($k, $v))!
    metaRule('meta-knob-tuning', (p1, p2) => {
      const rewardLow = extractVariableBinding(p1, 'below_threshold');
      const knobName = extractVariableBinding(p2, 'knob');
      if (!rewardLow || !knobName) return undefined;
      return buildOperationTerm('tune_knob', [atom(knobName), atom('auto')]);
    }),

    // Test repair: (test_failed --> $t) & (error_pattern --> $e) & (fix_pattern($e) --> $fix) ==> (^apply_fix($fix))!
    metaRule('meta-test-repair', (p1, p2) => {
      const errorPattern = extractVariableBinding(p2, 'error_pattern');
      if (!extractVariableBinding(p1, 'test_failed') || !errorPattern) return undefined;
      return buildOperationTerm('apply_fix', [atom(FIX_PATTERNS[errorPattern] ?? 'fix_pattern:generic')]);
    }),

    // Schema promotion: (schema --> $s) & (confidence($s) > 0.9) & (frequency($s) > 10) ==> (^promote_rule($s))!
    metaRule('meta-schema-promotion', (p1) => {
      const schemaName = extractVariableBinding(p1, 'schema');
      return schemaName ? buildOperationTerm('register_rule', [atom(schemaName)]) : undefined;
    }),

    // Capability scaffolding: (capability --> $c) & (template($c) --> $tmpl) ==> (^scaffold($tmpl, $c))!
    metaRule('meta-capability-scaffold', (p1, p2) => {
      const capabilityName = extractVariableBinding(p1, 'capability');
      const templateName = extractVariableBinding(p2, 'template');
      if (!capabilityName || !templateName) return undefined;
      return buildOperationTerm('scaffold_capability', [atom(templateName), atom(capabilityName)]);
    }),
  ];
}

/**
 * Register the meta-rules into a dispatch table.
 *
 * The table is **required**, not optional: these used to also land on a
 * module-global registry, where a caller who passed nothing still "registered"
 * them and no running engine could see it. A registration with no table is not a
 * registration (TODO29.a §5.10).
 */
export function registerMetaRules(table: InferenceTable): void {
  for (const rule of buildMetaRules()) table.register(rule);
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
export async function initializeMetaReasoning(nar: {
  believe: (input: string, truth?: TruthType) => Promise<void>;
}): Promise<void> {
  for (const belief of META_REASONING_BELIEFS) {
    await nar.believe(belief, META_RULE_TRUTH);
  }
}

/** Check if meta-reasoning should activate based on drive intensities */
export function shouldActivateMetaReasoning(
  driveStates: Iterable<{ currentIntensity: number }>
): boolean {
  for (const state of driveStates) {
    if (state.currentIntensity > META_AIKR_BOUNDS.metaRuleActivationThreshold) return true;
  }
  return false;
}

/** Get meta-reasoning budget status */
export function getMetaBudgetStatus(
  derivationsThisStep: number,
  currentDepth: number
): { withinBudget: boolean; remainingDerivations: number; remainingDepth: number } {
  return {
    withinBudget:
      derivationsThisStep < META_AIKR_BOUNDS.maxMetaDerivationsPerStep &&
      currentDepth < META_AIKR_BOUNDS.maxMetaDerivationDepth,
    remainingDerivations: META_AIKR_BOUNDS.maxMetaDerivationsPerStep - derivationsThisStep,
    remainingDepth: META_AIKR_BOUNDS.maxMetaDerivationDepth - currentDepth,
  };
}
