/**
 * NAL Rules as Formula-ASTs — data-driven rule definitions.
 *
 * These replace the code-based rule definitions with pure data structures
 * that can be interpreted for verification and compiled for execution.
 */

import { Term, TermOp, termInterner } from '../../kernel/terms/intern.js';
import { Stamp } from '../../kernel/stamp.js';
import type { TruthValue } from '../../kernel/types.js';
import type { RuleAST, ConditionAST, ConclusionAST, TermRef, Premise, StepResult } from '../port.js';

/** Type for NAL terms. */
export type NALTerm = Term;

/** Alias for backward compatibility. */
export type NAlTerm = NALTerm;

/** NAL premise. */
export type NALPremise = Premise<NALTerm>;

/** NAL step result. */
export type NALStepResult = StepResult<NALTerm>;

/** Build a term reference to a premise field. */
const prem = (index: 0 | 1, field: 'subject' | 'predicate' | 'term'): TermRef => ({
  op: 'premise',
  index,
  field,
});

/** Build a constant term reference. */
const constRef = (value: string): TermRef => ({ op: 'constant', value });

/** Build an inheritance term reference. */
const inh = (subject: TermRef, predicate: TermRef): TermRef => ({
  op: 'inheritance',
  subject,
  predicate,
});

/** Build a similarity term reference. */
const sim = (subject: TermRef, predicate: TermRef): TermRef => ({
  op: 'similarity',
  subject,
  predicate,
});

/** Build a product term reference. */
const prod = (...terms: TermRef[]): TermRef => ({ op: 'product', terms });

/** Build a negation term reference. */
const neg = (term: TermRef): TermRef => ({ op: 'negation', term });

/** Build a prediction term reference. */
const pred = (antecedent: TermRef, consequent: TermRef): TermRef => ({
  op: 'prediction',
  antecedent,
  consequent,
});

/** Build a sequential term reference. */
const seq = (first: TermRef, second: TermRef): TermRef => ({
  op: 'sequential',
  first,
  second,
});

/** Build a concurrent term reference. */
const conc = (first: TermRef, second: TermRef): TermRef => ({
  op: 'concurrent',
  first,
  second,
});

/** Build a parallel term reference. */
const par = (first: TermRef, second: TermRef): TermRef => ({
  op: 'parallel',
  first,
  second,
});

/** Condition: term is inheritance. */
const isInh = (term: TermRef): ConditionAST => ({ op: 'is_inheritance', term });

/** Condition: term is similarity. */
const isSim = (term: TermRef): ConditionAST => ({ op: 'is_similarity', term });

/** Condition: term is prediction. */
const isPred = (term: TermRef): ConditionAST => ({ op: 'is_prediction', term });

/** Condition: term is sequential. */
const isSeq = (term: TermRef): ConditionAST => ({ op: 'is_sequential', term });

/** Condition: term is concurrent. */
const isConc = (term: TermRef): ConditionAST => ({ op: 'is_concurrent', term });

/** Condition: term is variable. */
const isVar = (term: TermRef): ConditionAST => ({ op: 'is_variable', term });

/** Condition: two terms equal. */
const eq = (left: TermRef, right: TermRef): ConditionAST => ({ op: 'eq', left, right });

/** Condition: always true. */
const always: ConditionAST = { op: 'true' };

/** Condition: AND. */
const and = (...args: ConditionAST[]): ConditionAST => ({ op: 'and', args });

/** Condition: OR. */
const or = (...args: ConditionAST[]): ConditionAST => ({ op: 'or', args });

/** All NAL rules as formula-ASTs. */
export const NAL_RULES_AST: readonly RuleAST<NALTerm>[] = [
  // ========================================================================
  // CORE SYLLOGISTIC RULES (NAL-1 to NAL-4)
  // ========================================================================

  // Deduction: S1-->P1, S2-->P2 | P1==S2 => S1-->P2
  {
    id: 'deduction',
    name: 'Deduction',
    category: 'deduction',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthFn: 'deduction',
    priority: 100,
    condition: and(
      isInh(prem(0, 'term')),
      isInh(prem(1, 'term')),
      eq(prem(0, 'predicate'), prem(1, 'subject'))
    ),
    conclusion: inh(prem(0, 'subject'), prem(1, 'predicate')),
  },

  // Induction: S1-->P, S2-->P => S1-->S2
  {
    id: 'induction',
    name: 'Induction',
    category: 'induction',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthFn: 'induction',
    priority: 90,
    condition: and(
      isInh(prem(0, 'term')),
      isInh(prem(1, 'term')),
      eq(prem(0, 'predicate'), prem(1, 'predicate'))
    ),
    conclusion: inh(prem(0, 'subject'), prem(1, 'subject')),
  },

  // Abduction: S-->P1, S-->P2 => P1-->P2
  {
    id: 'abduction',
    name: 'Abduction',
    category: 'abduction',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthFn: 'abduction',
    priority: 80,
    condition: and(
      isInh(prem(0, 'term')),
      isInh(prem(1, 'term')),
      eq(prem(0, 'subject'), prem(1, 'subject'))
    ),
    conclusion: inh(prem(0, 'predicate'), prem(1, 'predicate')),
  },

  // Revision: same term, different evidence
  {
    id: 'revision',
    name: 'Revision',
    category: 'revision',
    arity: 2,
    premiseRoles: ['belief1', 'belief2'],
    truthFn: 'revision',
    priority: 95,
    condition: eq(prem(0, 'term'), prem(1, 'term')),
    conclusion: prem(0, 'term'),
  },

  // ========================================================================
  // COMPARISON AND ANALOGY (NAL-5)
  // ========================================================================

  // Comparison: S1-->P1, S2-->P2 => (S1*S2)-->(P1*P2)
  {
    id: 'comparison',
    name: 'Comparison',
    category: 'comparison',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthFn: 'analogy',
    priority: 70,
    condition: and(isInh(prem(0, 'term')), isInh(prem(1, 'term'))),
    conclusion: inh(prod(prem(0, 'subject'), prem(1, 'subject')), prod(prem(0, 'predicate'), prem(1, 'predicate'))),
  },

  // Analogy: S1-->P1, S2-->P2 => (S1*S2)<->(P1*P2)
  {
    id: 'analogy',
    name: 'Analogy',
    category: 'analogy',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthFn: 'analogy',
    priority: 65,
    condition: and(isInh(prem(0, 'term')), isInh(prem(1, 'term'))),
    conclusion: sim(prod(prem(0, 'subject'), prem(1, 'subject')), prod(prem(0, 'predicate'), prem(1, 'predicate'))),
  },

  // Resemblance: S1-->P, S2-->P => S1<->S2
  {
    id: 'resemblance',
    name: 'Resemblance',
    category: 'resemblance',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthFn: 'resemblance',
    priority: 75,
    condition: and(
      isInh(prem(0, 'term')),
      isInh(prem(1, 'term')),
      eq(prem(0, 'predicate'), prem(1, 'predicate'))
    ),
    conclusion: sim(prem(0, 'subject'), prem(1, 'subject')),
  },

  // ========================================================================
  // STRUCTURAL RULES (NAL-6)
  // ========================================================================

  // Negation: ~A
  {
    id: 'negation',
    name: 'Negation',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthFn: 'negation',
    priority: 50,
    condition: always,
    conclusion: neg(prem(0, 'term')),
  },

  // Conversion (inheritance): S-->P => P-->S
  {
    id: 'conversion_inheritance',
    name: 'Conversion (Inheritance)',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthFn: 'conversion',
    priority: 55,
    condition: isInh(prem(0, 'term')),
    conclusion: inh(prem(0, 'predicate'), prem(0, 'subject')),
  },

  // Conversion (similarity): S<->P => P<->S
  {
    id: 'conversion_similarity',
    name: 'Conversion (Similarity)',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthFn: 'conversion',
    priority: 55,
    condition: isSim(prem(0, 'term')),
    conclusion: sim(prem(0, 'predicate'), prem(0, 'subject')),
  },

  // Structural deduction: A ==> B => A ==> B (weaken)
  {
    id: 'structural_deduction',
    name: 'Structural Deduction',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthFn: 'structuralDeduction',
    priority: 45,
    condition: { op: 'eq', left: { op: 'premise', index: 0, field: 'term' }, right: constRef('implication') },
    conclusion: prem(0, 'term'),
  },

  // ========================================================================
  // TEMPORAL RULES (NAL-7)
  // ========================================================================

  // Prediction: (A | B) => (A |> B)
  {
    id: 'prediction',
    name: 'Prediction',
    category: 'temporal',
    arity: 1,
    premiseRoles: ['premise'],
    truthFn: 'deduction',
    priority: 60,
    condition: isSeq(prem(0, 'term')),
    conclusion: pred(prem(0, 'subject'), prem(0, 'predicate')),
  },

  // Postdiction: (A |> B) => (A | B)
  {
    id: 'postdiction',
    name: 'Postdiction',
    category: 'temporal',
    arity: 1,
    premiseRoles: ['premise'],
    truthFn: 'deduction',
    priority: 60,
    condition: isPred(prem(0, 'term')),
    conclusion: seq(prem(0, 'subject'), prem(0, 'predicate')),
  },

  // ========================================================================
  // HIGHER-ORDER RULES (NAL-8)
  // ========================================================================

  // Higher-order deduction: (S1-->P1) ==> (S2-->P2), S1-->P1 => S2-->P2
  {
    id: 'higher_order_deduction',
    name: 'Higher-Order Deduction',
    category: 'deduction',
    arity: 2,
    premiseRoles: ['rule', 'fact'],
    truthFn: 'deduction',
    priority: 40,
    condition: and(
      { op: 'eq', left: { op: 'premise', index: 0, field: 'term' }, right: constRef('implication') },
      isInh(prem(1, 'term')),
      eq(prem(0, 'subject'), prem(1, 'term'))
    ),
    conclusion: prem(0, 'predicate'),
  },

  // ========================================================================
  // VARIABLE RULES (NAL-9)
  // ========================================================================

  // Variable introduction: A => $x (where $x unifies with A)
  {
    id: 'variable_introduction',
    name: 'Variable Introduction',
    category: 'meta',
    arity: 1,
    premiseRoles: ['premise'],
    truthFn: 'deduction',
    priority: 30,
    condition: { op: 'not', arg: isVar(prem(0, 'term')) },
    conclusion: { op: 'variable', name: '$x' },
  },

  // ========================================================================
  // META-COGNITIVE RULES
  // ========================================================================

  // Introspection: derive knowledge about own derivations
  {
    id: 'introspection',
    name: 'Introspection',
    category: 'meta',
    arity: 1,
    premiseRoles: ['derivation'],
    truthFn: 'deduction',
    priority: 20,
    condition: { op: 'eq', left: { op: 'premise', index: 0, field: 'term' }, right: constRef('derivation') },
    conclusion: constRef('derived'),
  },
];

/** Rule table: maps rule IDs to rule ASTs. */
export const RULE_TABLE_AST = new Map<string, RuleAST<NALTerm>>();
for (const rule of NAL_RULES_AST) {
  RULE_TABLE_AST.set(rule.id, rule);
}

/** Get rule AST by ID. */
export function getRuleAST(id: string): RuleAST<NALTerm> | undefined {
  return RULE_TABLE_AST.get(id);
}

/** Get rule ASTs by category. */
export function getRuleASTsByCategory(category: string): RuleAST<NALTerm>[] {
  return NAL_RULES_AST.filter(r => r.category === category);
}

/** Get all rule IDs. */
export function getAllRuleASTIds(): string[] {
  return NAL_RULES_AST.map(r => r.id);
}

/** Verify rule table completeness. */
export function verifyRuleTableAST(): { complete: boolean; missing: string[]; duplicates: string[] } {
  const expectedIds = [
    'deduction', 'induction', 'abduction', 'revision',
    'comparison', 'analogy', 'resemblance',
    'negation', 'conversion_inheritance', 'conversion_similarity',
    'structural_deduction',
    'prediction', 'postdiction',
    'higher_order_deduction',
    'variable_introduction',
    'introspection',
  ];

  const missing = expectedIds.filter(id => !RULE_TABLE_AST.has(id));
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const rule of NAL_RULES_AST) {
    if (seen.has(rule.id)) duplicates.push(rule.id);
    seen.add(rule.id);
  }

  return { complete: missing.length === 0 && duplicates.length === 0, missing, duplicates };
}

/** NAL Logic implementation of the Logic port. */
export const NAL_LOGIC = {
  id: 'nal',
  version: '1.0.0',
  codec: {
    encode: (term: NALTerm) => termInterner.format(term),
    decode: (s: string) => termInterner.parse(s),
  },
  expect: (term: NALTerm) => {
    // Expectation is computed from truth, not term alone
    // This is a placeholder - actual expectation needs truth value
    return 0.5;
  },
  conf: (term: NALTerm) => 0.9,
  contradicts: (a: NALTerm, b: NALTerm) => {
    // Check if one is negation of the other
    if (a.op === TermOp.NEGATION && a.args[0] === b) return true;
    if (b.op === TermOp.NEGATION && b.args[0] === a) return true;
    return false;
  },
  policy: 'coexist' as const,
  rules: NAL_RULES_AST,
} as const;