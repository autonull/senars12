/**
 * NAL Rules — the core Non-Axiomatic Logic inference rules.
 *
 * This module defines the complete NAL rule table as data-driven
 * rule definitions with truth functions, conditions, and priorities.
 */

import { Term, TermOp, TruthValue } from '../../kernel/terms/intern.js';
import { Truth } from '../../kernel/truth.js';
import { Stamp } from '../../kernel/stamp.js';
import type { RuleCategory, RuleId, Premise, StepResult } from '../../kernel/step.js';

/** NAL rule definition. */
export interface NALRule {
  id: RuleId;
  name: string;
  category: RuleCategory;
  arity: 1 | 2;
  premiseRoles: string[];
  truthOp: keyof typeof Truth;
  priority: number;
  condition: (premises: Premise[]) => boolean;
  buildConclusion: (premises: Premise[]) => Term | null;
  /** Optional: custom truth function for complex rules. */
  truthFn?: (premises: Premise[]) => TruthValue | null;
}

/** All NAL rules. */
export const NAL_RULES: NALRule[] = [
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
    truthOp: 'deduction',
    priority: 100,
    condition: (premises) => {
      const [m, n] = premises;
      return isInheritance(m.term) && isInheritance(n.term) &&
        termsEqual(getPredicate(m.term), getSubject(n.term));
    },
    buildConclusion: (premises) => {
      const [m, n] = premises;
      return createInheritance(getSubject(m.term), getPredicate(n.term));
    },
  },

  // Induction: S1-->P, S2-->P => S1-->S2
  {
    id: 'induction',
    name: 'Induction',
    category: 'induction',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'induction',
    priority: 90,
    condition: (premises) => {
      const [m, n] = premises;
      return isInheritance(m.term) && isInheritance(n.term) &&
        termsEqual(getPredicate(m.term), getPredicate(n.term));
    },
    buildConclusion: (premises) => {
      const [m, n] = premises;
      return createInheritance(getSubject(m.term), getSubject(n.term));
    },
  },

  // Abduction: S-->P1, S-->P2 => P1-->P2
  {
    id: 'abduction',
    name: 'Abduction',
    category: 'abduction',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'abduction',
    priority: 80,
    condition: (premises) => {
      const [m, n] = premises;
      return isInheritance(m.term) && isInheritance(n.term) &&
        termsEqual(getSubject(m.term), getSubject(n.term));
    },
    buildConclusion: (premises) => {
      const [m, n] = premises;
      return createInheritance(getPredicate(m.term), getPredicate(n.term));
    },
  },

  // Revision: same term, different evidence
  {
    id: 'revision',
    name: 'Revision',
    category: 'revision',
    arity: 2,
    premiseRoles: ['belief1', 'belief2'],
    truthOp: 'revision',
    priority: 95,
    condition: (premises) => premises[0].term === premises[1].term,
    buildConclusion: (premises) => premises[0].term,
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
    truthOp: 'analogy',
    priority: 70,
    condition: (premises) => {
      return isInheritance(premises[0].term) && isInheritance(premises[1].term);
    },
    buildConclusion: (premises) => {
      const [m, n] = premises;
      return createInheritance(
        createProduct(getSubject(m.term), getSubject(n.term)),
        createProduct(getPredicate(m.term), getPredicate(n.term))
      );
    },
  },

  // Analogy: S1-->P1, S2-->P2 => (S1*S2)<->(P1*P2)
  {
    id: 'analogy',
    name: 'Analogy',
    category: 'analogy',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'analogy',
    priority: 65,
    condition: (premises) => {
      return isInheritance(premises[0].term) && isInheritance(premises[1].term);
    },
    buildConclusion: (premises) => {
      const [m, n] = premises;
      return createSimilarity(
        createProduct(getSubject(m.term), getSubject(n.term)),
        createProduct(getPredicate(m.term), getPredicate(n.term))
      );
    },
  },

  // Resemblance: S1-->P, S2-->P => S1<->S2
  {
    id: 'resemblance',
    name: 'Resemblance',
    category: 'resemblance',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'resemblance',
    priority: 75,
    condition: (premises) => {
      const [m, n] = premises;
      return isInheritance(m.term) && isInheritance(n.term) &&
        termsEqual(getPredicate(m.term), getPredicate(n.term));
    },
    buildConclusion: (premises) => {
      const [m, n] = premises;
      return createSimilarity(getSubject(m.term), getSubject(n.term));
    },
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
    truthOp: 'negation',
    priority: 50,
    condition: () => true,
    buildConclusion: (premises) => createNegation(premises[0].term),
  },

  // Conversion (inheritance): S-->P => P-->S
  {
    id: 'conversion_inheritance',
    name: 'Conversion (Inheritance)',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'conversion',
    priority: 55,
    condition: (premises) => isInheritance(premises[0].term),
    buildConclusion: (premises) => {
      const term = premises[0].term;
      return createInheritance(getPredicate(term), getSubject(term));
    },
  },

  // Conversion (similarity): S<->P => P<->S
  {
    id: 'conversion_similarity',
    name: 'Conversion (Similarity)',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'conversion',
    priority: 55,
    condition: (premises) => isSimilarity(premises[0].term),
    buildConclusion: (premises) => {
      const term = premises[0].term;
      return createSimilarity(getPredicate(term), getSubject(term));
    },
  },

  // Structural deduction: A ==> B => A ==> B (weaken)
  {
    id: 'structural_deduction',
    name: 'Structural Deduction',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'structuralDeduction',
    priority: 45,
    condition: (premises) => premises[0].term.op === TermOp.IMPLICATION,
    buildConclusion: (premises) => premises[0].term,
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
    truthOp: 'deduction',
    priority: 60,
    condition: (premises) => isSequential(premises[0].term),
    buildConclusion: (premises) => {
      const term = premises[0].term;
      const [first, second] = term.args;
      return createPrediction(first, second);
    },
  },

  // Postdiction: (A |> B) => (A | B)
  {
    id: 'postdiction',
    name: 'Postdiction',
    category: 'temporal',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'deduction',
    priority: 60,
    condition: (premises) => isPrediction(premises[0].term),
    buildConclusion: (premises) => {
      const term = premises[0].term;
      const [first, second] = term.args;
      return createSequential(first, second);
    },
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
    truthOp: 'deduction',
    priority: 40,
    condition: (premises) => {
      const [rule, fact] = premises;
      return isImplication(rule.term) &&
        isInheritance(fact.term) &&
        termsEqual(getAntecedent(rule.term), fact.term);
    },
    buildConclusion: (premises) => {
      const [rule] = premises;
      return getConsequent(rule.term);
    },
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
    truthOp: 'deduction',
    priority: 30,
    condition: (premises) => !isVariable(premises[0].term),
    buildConclusion: (premises) => termInterner.variable('$x'),
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
    truthOp: 'deduction',
    priority: 20,
    condition: (premises) => premises[0].stamp.derivation.length > 0,
    buildConclusion: (premises) => {
      const stamp = premises[0].stamp;
      return termInterner.constant(`derived_by_${stamp.derivation.join('_')}`);
    },
  },
];

/** Rule table: maps rule IDs to rule definitions. */
export const RULE_TABLE = new Map<RuleId, NALRule>();
for (const rule of NAL_RULES) {
  RULE_TABLE.set(rule.id, rule);
}

/** Get rule by ID. */
export function getRule(id: RuleId): NALRule | undefined {
  return RULE_TABLE.get(id);
}

/** Get rules by category. */
export function getRulesByCategory(category: RuleCategory): NALRule[] {
  return NAL_RULES.filter(r => r.category === category);
}

/** Get all rule IDs. */
export function getAllRuleIds(): RuleId[] {
  return NAL_RULES.map(r => r.id);
}

/** Check if a rule is built-in (always present). */
export function isBuiltinRule(id: RuleId): boolean {
  const rule = RULE_TABLE.get(id);
  // All current rules are built-in
  return rule !== undefined;
}

/** Term helpers. */
function isInheritance(term: Term): boolean {
  return term.op === TermOp.INHERITANCE;
}

function isSimilarity(term: Term): boolean {
  return term.op === TermOp.SIMILARITY;
}

function isImplication(term: Term): boolean {
  return term.op === TermOp.IMPLICATION;
}

function isSequential(term: Term): boolean {
  return term.op === TermOp.SEQUENTIAL;
}

function isPrediction(term: Term): boolean {
  return term.op === TermOp.PREDICTION;
}

function isVariable(term: Term): boolean {
  return term.op === TermOp.VARIABLE;
}

function getSubject(term: Term): Term {
  return term.args[0];
}

function getPredicate(term: Term): Term {
  return term.args[1];
}

function getAntecedent(term: Term): Term {
  return term.args[0];
}

function getConsequent(term: Term): Term {
  return term.args[1];
}

function termsEqual(a: Term, b: Term): boolean {
  return a === b;
}

function createInheritance(subject: Term, predicate: Term): Term {
  return termInterner.inheritance(subject, predicate);
}

function createSimilarity(subject: Term, predicate: Term): Term {
  return termInterner.similarity(subject, predicate);
}

function createProduct(...terms: Term[]): Term {
  return termInterner.product(...terms);
}

function createNegation(term: Term): Term {
  return termInterner.negation(term);
}

function createPrediction(antecedent: Term, consequent: Term): Term {
  return termInterner.prediction(antecedent, consequent);
}

function createSequential(first: Term, second: Term): Term {
  return termInterner.sequential(first, second);
}

/** Rule application engine. */
export class NALRuleEngine {
  private executor: StepExecutor;

  constructor(executor: StepExecutor) {
    this.executor = executor;
    this.registerRules();
  }

  /** Register all NAL rules with the executor. */
  private registerRules(): void {
    for (const rule of NAL_RULES) {
      this.executor.registerRule({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        arity: rule.arity,
        premiseRoles: rule.premiseRoles,
        truthOp: rule.truthOp,
        priority: rule.priority,
        builtin: true,
        condition: rule.condition,
        buildConclusion: rule.buildConclusion,
      });
    }
  }

  /** Apply all applicable rules to premises. */
  applyRules(premises: Premise[], options?: { categories?: RuleCategory[]; limit?: number }): StepResult[] {
    return this.executor.applyAllRules(premises, options);
  }

  /** Generate steps from a bag. */
  generateSteps(
    bagEntries: Array<{ term: Term; truth: TruthValue; stamp: Stamp }>,
    options?: { maxPairs?: number; categories?: RuleCategory[] }
  ): StepResult[] {
    return this.executor.generateSteps(bagEntries, options);
  }
}

/** Create a NAL rule engine. */
export function createNALRuleEngine(executor: StepExecutor): NALRuleEngine {
  return new NALRuleEngine(executor);
}

/** Verify rule table completeness. */
export function verifyRuleTable(): { complete: boolean; missing: RuleId[]; duplicates: RuleId[] } {
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

  const missing = expectedIds.filter(id => !RULE_TABLE.has(id));
  const seen = new Set<RuleId>();
  const duplicates: RuleId[] = [];
  for (const rule of NAL_RULES) {
    if (seen.has(rule.id)) duplicates.push(rule.id);
    seen.add(rule.id);
  }

  return { complete: missing.length === 0 && duplicates.length === 0, missing, duplicates };
}