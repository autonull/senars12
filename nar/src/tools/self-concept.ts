/**
 * Self-Concept Vocabulary — Semantic Narsese beliefs representing system components
 * as first-class concepts. These enable NAR to reason about its own architecture.
 * 
 * Key Design: Fix patterns are SEMANTIC CONCEPTS, not AST-grep strings.
 * The NAR reasons about `fix_pattern:null_check`; the tool layer maps to actual codemod strings.
 */

import { Truth, type TruthType, TermBuilder, atom } from '../terms';
import type { NAR } from '../nar.js';

/** Semantic truth values for self-beliefs (high confidence, moderate frequency) */
const SELF_TRUTH: TruthType = Truth.create(0.7, 0.9);

/** Narsese belief strings for self-concept initialization */
export const SELF_CONCEPT_BELIEFS = [
  // Components
  '(system_component --> knob).',
  '(system_component --> strategy).',
  '(system_component --> tool).',
  '(system_component --> rule).',
  '(system_component --> test).',
  '(system_component --> scenario).',
  '(system_component --> concept).',
  '(system_component --> schema).',
  '(system_component --> capability).',

  // Causal/functional relations
  '(knob_maxLoops --> affects_modelRunner_maxLoops).',
  '(strategy_focused --> reduces_derivations).',
  '(tool_codemod --> modifies_source_code).',
  '(rule_transitivity --> derives_implication).',
  '(test_fix_test --> requires_codemod).',
  '(scenario_induction --> tests_induction_capability).',
  '(schema --> promotes_to_rule).',
  '(capability --> implemented_by_tool).',

  // Fix patterns (SEMANTIC — not syntactic)
  '(fix_pattern_null_check --> applies_to_null_pointer_error).',
  '(fix_pattern_type_annotation --> applies_to_type_mismatch_error).',
  '(fix_pattern_boundary_check --> applies_to_out_of_bounds_error).',
  '(fix_pattern_assertion --> applies_to_assertion_failure).',
  '(fix_pattern_undefined_check --> applies_to_undefined_variable).',
  '(fix_pattern_empty_check --> applies_to_empty_collection_error).',
  '(fix_pattern_division_by_zero --> applies_to_division_by_zero_error).',
  '(fix_pattern_async_handling --> applies_to_unhandled_promise_rejection).',

  // Self-model: the system knows it can self-modify
  '(self --> can_modify_own_code).',
  '(self --> can_tune_own_knobs).',
  '(self --> can_add_own_rules).',
  '(self --> can_generate_own_tests).',
  '(self --> can_run_own_scenarios).',
] as const;

/** Initialize self-concept beliefs into NAR */
export async function initializeSelfConcept(nar: NAR): Promise<void> {
  for (const belief of SELF_CONCEPT_BELIEFS) {
    await nar.believe(belief, SELF_TRUTH);
  }
}

/** Fix pattern registry — maps semantic concepts to actual codemod patterns */
export interface FixPatternMapping {
  concept: string;           // Narsese concept: fix_pattern:null_check
  description: string;       // Human-readable description
  pattern: string;           // ast-grep pattern to match
  replacement: string;       // ast-grep replacement
  lang?: string;             // Language (default: typescript)
}

/** Built-in fix pattern mappings */
export const FIX_PATTERN_MAPPINGS: FixPatternMapping[] = [
  {
    concept: 'fix_pattern_null_check',
    description: 'Add null check before property access',
    pattern: '$X.$Y',
    replacement: '$X?. $Y',
    lang: 'typescript',
  },
  {
    concept: 'fix_pattern_type_annotation',
    description: 'Replace any with unknown for type safety',
    pattern: 'let $X: any = $V',
    replacement: 'let $X: unknown = $V',
    lang: 'typescript',
  },
  {
    concept: 'fix_pattern_boundary_check',
    description: 'Add boundary check before array access',
    pattern: '$ARR[$IDX]',
    replacement: '($IDX >= 0 && $IDX < $ARR.length ? $ARR[$IDX] : undefined)',
    lang: 'typescript',
  },
  {
    concept: 'fix_pattern_assertion',
    description: 'Add assertion for assumed conditions',
    pattern: 'if ($COND) { $BODY }',
    replacement: 'if ($COND) { $BODY } else { throw new Error("Assertion failed: " + $COND) }',
    lang: 'typescript',
  },
  {
    concept: 'fix_pattern_undefined_check',
    description: 'Add undefined check before use',
    pattern: 'const $X = $Y',
    replacement: 'const $X = $Y ?? (() => { throw new Error("Unexpected undefined") })()',
    lang: 'typescript',
  },
  {
    concept: 'fix_pattern_empty_check',
    description: 'Check for empty collection before iteration',
    pattern: 'for (const $X of $ARR) { $BODY }',
    replacement: 'if ($ARR.length > 0) { for (const $X of $ARR) { $BODY } }',
    lang: 'typescript',
  },
  {
    concept: 'fix_pattern_division_by_zero',
    description: 'Guard against division by zero',
    pattern: '$A / $B',
    replacement: '($B !== 0 ? $A / $B : NaN)',
    lang: 'typescript',
  },
  {
    concept: 'fix_pattern_async_handling',
    description: 'Add .catch() to unhandled promises',
    pattern: '$PROM.then($FN)',
    replacement: '$PROM.then($FN).catch($ERR => console.error($ERR))',
    lang: 'typescript',
  },
];

/** Get codemod pattern for a fix pattern concept */
export function getFixPatternMapping(concept: string): FixPatternMapping | undefined {
  // Accept both colon and underscore formats
  const normalized = concept.replace(':', '_');
  return FIX_PATTERN_MAPPINGS.find((m) => m.concept === normalized);
}

/** Get all fix pattern concepts */
export function getFixPatternConcepts(): string[] {
  return FIX_PATTERN_MAPPINGS.map((m) => m.concept);
}