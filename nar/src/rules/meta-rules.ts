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

import { Truth, type TruthType, TermBuilder, atom, type Term, isCompound, isAtomic, getTermArgs } from '../terms';
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

/** Check if term is an Inheritance (A --> B) */
function isInheritance(term: Term): boolean {
  return isCompound(term) && term.kind === 'inheritance';
}

/** Extract subject and predicate from Inheritance term */
function getInheritanceParts(term: Term): { subject: Term; predicate: Term } | null {
  if (!isInheritance(term)) return null;
  const args = getTermArgs(term);
  if (!args || args.length !== 2) return null;
  const subject = args[0];
  const predicate = args[1];
  if (!subject || !predicate) return null;
  return { subject, predicate };
}

/** Extract variable binding from a premise like (drive_competence --> low) */
function extractVariableBinding(term: Term, expectedPredicate: string): string | null {
  const parts = getInheritanceParts(term);
  if (!parts) return null;
  if (!isAtomic(parts.predicate) || parts.predicate.symbol !== expectedPredicate) return null;
  if (!isAtomic(parts.subject)) return null;
  return parts.subject.symbol;
}

/** Build operation term AST: ^tool(args...) -> Inheritance(Product(args...), Atom('^tool')) */
function buildOperationTerm(toolName: string, argTerms: Term[]): Term {
  const productTerm = argTerms.length > 0
    ? TermBuilder.create('product', argTerms)
    : atom('*');
  const opAtom = atom('^' + toolName);
  const result = TermBuilder.inheritance(productTerm, opAtom);
  if (!result) {
    throw new Error(`Failed to build operation term for ${toolName}`);
  }
  return result;
}

/** Debug logging for meta-rules */
const META_DEBUG = false;

function metaLog(msg: string, data?: unknown): void {
  if (META_DEBUG) {
    console.log(`[META] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

/** Build registered meta-rules with proper patterns */
export function buildMetaRules(): RegisteredRule[] {
  const rules: RegisteredRule[] = [
    // Strategy selection: (drive:competence --> low) & (situation --> requires_strategy) & (strategy --> $s) ==> (^select_strategy($s))!
    {
      id: 'meta-strategy-selection',
      pattern: { left: { op: 'inheritance' }, right: { op: 'inheritance' } },
      apply: (premises) => {
        const [p1, p2] = premises;
        const driveLow = extractVariableBinding(p1, 'low');
        const situationRequires = extractVariableBinding(p2, 'requires_strategy');
        metaLog('meta-strategy-selection check', { p1: p1?.toString(), p2: p2?.toString(), driveLow, situationRequires });
        if (driveLow && situationRequires) {
          const result = buildOperationTerm('switch_strategy', [atom('focused'), atom('derivation')]);
          metaLog('meta-strategy-selection FIRED', { result: result.toString() });
          return result;
        }
        return undefined;
      },
      sync: true,
      priority: META_AIKR_BOUNDS.metaRulePriority,
      truthFn: () => META_RULE_TRUTH,
      taskType: 'goal',
    },
    // Knob tuning: (rlfp:reward --> below_threshold) & (knob --> $k) ==> (^apply_tuning($k, $v))!
    {
      id: 'meta-knob-tuning',
      pattern: { left: { op: 'inheritance' }, right: { op: 'inheritance' } },
      apply: (premises) => {
        const [p1, p2] = premises;
        const rewardLow = extractVariableBinding(p1, 'below_threshold');
        const knobName = extractVariableBinding(p2, 'knob');
        metaLog('meta-knob-tuning check', { p1: p1?.toString(), p2: p2?.toString(), rewardLow, knobName });
        if (rewardLow && knobName) {
          const result = buildOperationTerm('tune_knob', [atom(knobName), atom('auto')]);
          metaLog('meta-knob-tuning FIRED', { result: result.toString() });
          return result;
        }
        return undefined;
      },
      sync: true,
      priority: META_AIKR_BOUNDS.metaRulePriority,
      truthFn: () => META_RULE_TRUTH,
      taskType: 'goal',
    },
    // Test repair: (test_failed --> $t) & (error_pattern --> $e) & (fix_pattern($e) --> $fix) ==> (^apply_fix($fix))!
    {
      id: 'meta-test-repair',
      pattern: { left: { op: 'inheritance' }, right: { op: 'inheritance' } },
      apply: (premises) => {
        const [p1, p2] = premises;
        const testFailed = extractVariableBinding(p1, 'test_failed');
        const errorPattern = extractVariableBinding(p2, 'error_pattern');
        metaLog('meta-test-repair check', { p1: p1?.toString(), p2: p2?.toString(), testFailed, errorPattern });
        if (testFailed && errorPattern) {
          const fixPatternMap: Record<string, string> = {
            'null_pointer_error': 'fix_pattern:null_check',
            'type_mismatch_error': 'fix_pattern:type_annotation',
            'out_of_bounds_error': 'fix_pattern:boundary_check',
          };
          const fixPattern = fixPatternMap[errorPattern] || 'fix_pattern:generic';
          const result = buildOperationTerm('apply_fix', [atom(fixPattern)]);
          metaLog('meta-test-repair FIRED', { result: result.toString() });
          return result;
        }
        return undefined;
      },
      sync: true,
      priority: META_AIKR_BOUNDS.metaRulePriority,
      truthFn: () => META_RULE_TRUTH,
      taskType: 'goal',
    },
    // Schema promotion: (schema --> $s) & (confidence($s) > 0.9) & (frequency($s) > 10) ==> (^promote_rule($s))!
    {
      id: 'meta-schema-promotion',
      pattern: { left: { op: 'inheritance' }, right: { op: 'inheritance' } },
      apply: (premises) => {
        const [p1, p2] = premises;
        const schemaName = extractVariableBinding(p1, 'schema');
        metaLog('meta-schema-promotion check', { p1: p1?.toString(), p2: p2?.toString(), schemaName });
        if (schemaName) {
          const result = buildOperationTerm('register_rule', [atom(schemaName)]);
          metaLog('meta-schema-promotion FIRED', { result: result.toString() });
          return result;
        }
        return undefined;
      },
      sync: true,
      priority: META_AIKR_BOUNDS.metaRulePriority,
      truthFn: () => META_RULE_TRUTH,
      taskType: 'goal',
    },
    // Capability scaffolding: (capability --> $c) & (template($c) --> $tmpl) ==> (^scaffold($tmpl, $c))!
    {
      id: 'meta-capability-scaffold',
      pattern: { left: { op: 'inheritance' }, right: { op: 'inheritance' } },
      apply: (premises) => {
        const [p1, p2] = premises;
        const capabilityName = extractVariableBinding(p1, 'capability');
        const templateName = extractVariableBinding(p2, 'template');
        metaLog('meta-capability-scaffold check', { p1: p1?.toString(), p2: p2?.toString(), capabilityName, templateName });
        if (capabilityName && templateName) {
          const result = buildOperationTerm('scaffold_capability', [atom(templateName), atom(capabilityName)]);
          metaLog('meta-capability-scaffold FIRED', { result: result.toString() });
          return result;
        }
        return undefined;
      },
      sync: true,
      priority: META_AIKR_BOUNDS.metaRulePriority,
      truthFn: () => META_RULE_TRUTH,
      taskType: 'goal',
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