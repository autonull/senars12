/**
 * Kernel Step — a single inference step in the NAL engine.
 *
 * A step represents one rule application: premises -> conclusion
 * with truth computation, stamp derivation, and metadata.
 */

import { Term } from './terms/intern.js';
import { Stamp } from './stamp.js';
import type { TruthValue } from './types.js';
import type { TruthOp } from './truth.js';
import { Truth } from './truth.js';

/** Inference rule identifier. */
export type RuleId = string;

/** Premise for a step. */
export interface Premise {
  term: Term;
  truth: TruthValue;
  stamp: Stamp;
  /** Role in the rule (e.g., 'major', 'minor', 'condition'). */
  role?: string;
}

/** Inference step result. */
export interface StepResult {
  /** The conclusion term. */
  conclusion: Term;
  /** Computed truth value. */
  truth: TruthValue;
  /** Derived stamp. */
  stamp: Stamp;
  /** Rule that was applied. */
  ruleId: RuleId;
  /** Rule category. */
  ruleCategory: RuleCategory;
  /** Premises used. */
  premises: Premise[];
  /** Truth operation used. */
  truthOp: TruthOp;
  /** Step metadata. */
  meta: StepMeta;
}

/** Rule categories. */
export type RuleCategory =
  | 'deduction'
  | 'induction'
  | 'abduction'
  | 'revision'
  | 'comparison'
  | 'analogy'
  | 'resemblance'
  | 'structural'
  | 'temporal'
  | 'meta';

/** Step metadata. */
export interface StepMeta {
  /** Sequence number in derivation. */
  seq: number;
  /** Timestamp. */
  ts: number;
  /** Derivation depth. */
  depth: number;
  /** Whether this step was selected for the bag. */
  selected: boolean;
  /** Priority/urgency. */
  priority: number;
  /** Custom data. */
  custom?: Record<string, unknown>;
}

/** Inference rule definition. */
export interface InferenceRule {
  /** Unique rule ID. */
  id: RuleId;
  /** Human-readable name. */
  name: string;
  /** Rule category. */
  category: RuleCategory;
  /** Number of premises required. */
  arity: number;
  /** Premise roles. */
  premiseRoles: string[];
  /** Truth operation to apply. */
  truthOp: TruthOp;
  /** Condition: check if rule applies to premises. */
  condition: (premises: Premise[]) => boolean;
  /** Build conclusion term from premises. */
  buildConclusion: (premises: Premise[]) => Term | null;
  /** Priority weight (higher = more preferred). */
  priority: number;
  /** Whether rule is built-in (cannot be removed). */
  builtin: boolean;
}

/** Step executor: applies rules to generate steps. */
export class StepExecutor {
  private rules = new Map<RuleId, InferenceRule>();
  private seq = 0;

  /** Register a rule. */
  registerRule(rule: InferenceRule): void {
    this.rules.set(rule.id, rule);
  }

  /** Unregister a rule. */
  unregisterRule(id: RuleId): boolean {
    return this.rules.delete(id);
  }

  /** Get a rule by ID. */
  getRule(id: RuleId): InferenceRule | undefined {
    return this.rules.get(id);
  }

  /** Get all rules. */
  getAllRules(): InferenceRule[] {
    return Array.from(this.rules.values());
  }

  /** Get rules by category. */
  getRulesByCategory(category: RuleCategory): InferenceRule[] {
    return Array.from(this.rules.values()).filter(r => r.category === category);
  }

  /** Execute a single rule on premises. */
  executeRule(
    ruleId: RuleId,
    premises: Premise[],
    options: { priority?: number; customMeta?: Record<string, unknown> } = {}
  ): StepResult | null {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    // Check arity
    if (premises.length !== rule.arity) return null;

    // Check condition
    if (!rule.condition(premises)) return null;

    // Build conclusion
    const conclusion = rule.buildConclusion(premises);
    if (!conclusion) return null;

    // Compute truth
    const truthOp = rule.truthOp;
    let truth: TruthValue;

    if (premises.length === 1) {
      const p0 = premises[0]!;
      truth = Truth[truthOp as 'negation' | 'conversion' | 'structuralDeduction' | 'structuralReduction'](p0.truth);
    } else if (premises.length === 2) {
      const p0 = premises[0]!;
      const p1 = premises[1]!;
      const binaryOp = Truth[truthOp] as (t1: TruthValue, t2: TruthValue) => TruthValue | null;
      const result = binaryOp(p0.truth, p1.truth);
      if (!result) return null;
      truth = result;
    } else {
      // N-ary: chain binary
      let result = premises[0]!.truth;
      const binaryOp = Truth[truthOp] as (t1: TruthValue, t2: TruthValue) => TruthValue | null;
      for (let i = 1; i < premises.length; i++) {
        const next = binaryOp(result, premises[i]!.truth);
        if (!next) return null;
        result = next;
      }
      truth = result;
    }

    // Derive stamp
    const parentStamps = premises.map(p => p.stamp);
    const stamp = this.deriveStamp(parentStamps, ruleId);

    this.seq++;

    return {
      conclusion,
      truth,
      stamp,
      ruleId,
      ruleCategory: rule.category,
      premises,
      truthOp,
      meta: {
        seq: this.seq,
        ts: Date.now(),
        depth: Math.max(...premises.map(p => p.stamp.evidence)) + 1,
        selected: false,
        priority: options.priority ?? rule.priority,
        custom: options.customMeta,
      },
    };
  }

  /** Derive stamp from parent stamps. */
  private deriveStamp(parents: Stamp[], ruleId: string): Stamp {
    if (parents.length === 0) {
      return { id: '', ts: Date.now(), parents: [], derivation: [ruleId], evidence: 0 };
    }

    const parentIds = parents.map(p => p.id);
    const maxEvidence = Math.max(...parents.map(p => p.evidence));
    const allDerivations = [...new Set([...parents.flatMap(p => p.derivation), ruleId])];

    return {
      id: '', // Will be filled by bag
      ts: Date.now(),
      parents: parentIds,
      derivation: allDerivations,
      evidence: maxEvidence + 1,
    };
  }

  /** Apply all applicable rules to a set of premises. */
  applyAllRules(
    premises: Premise[],
    options: { categories?: RuleCategory[]; limit?: number } = {}
  ): StepResult[] {
    const results: StepResult[] = [];
    const { categories, limit = 100 } = options;

    for (const rule of this.rules.values()) {
      if (categories && !categories.includes(rule.category)) continue;
      if (results.length >= limit) break;

      const result = this.executeRule(rule.id, premises);
      if (result) results.push(result);
    }

    // Sort by priority
    results.sort((a, b) => b.meta.priority - a.meta.priority);

    return results.slice(0, limit);
  }

  /** Generate all possible steps from a bag (pairwise). */
  generateSteps(
    bagEntries: Array<{ term: Term; truth: TruthValue; stamp: Stamp }>,
    options: { maxPairs?: number; categories?: RuleCategory[] } = {}
  ): StepResult[] {
    const { maxPairs = 1000, categories } = options;
    const results: StepResult[] = [];

    // Convert to premises
    const premises: Premise[] = bagEntries.map(e => ({
      term: e.term,
      truth: e.truth,
      stamp: e.stamp,
    }));

    // Try all pairs
    let pairs = 0;
    for (let i = 0; i < premises.length && pairs < maxPairs; i++) {
      for (let j = i + 1; j < premises.length && pairs < maxPairs; j++) {
        pairs++;
        const pi = premises[i]!;
        const pj = premises[j]!;
        const pairPremises: Premise[] = [pi, pj];

        for (const rule of this.rules.values()) {
          if (categories && !categories.includes(rule.category)) continue;
          if (rule.arity !== 2) continue;

          const result = this.executeRule(rule.id, pairPremises);
          if (result) results.push(result);
        }
      }
    }

    // Sort by priority
    results.sort((a, b) => b.meta.priority - a.meta.priority);

    return results;
  }

  /** Reset sequence counter. */
  resetSequence(): void {
    this.seq = 0;
  }
}

/** Create a step executor with built-in NAL rules. */
export function createStepExecutor(): StepExecutor {
  const executor = new StepExecutor();

  // Register built-in NAL rules
  registerBuiltinRules(executor);

  return executor;
}

/** Register the core NAL rules. */
function registerBuiltinRules(executor: StepExecutor): void {
  // Deduction: S1-->P1, S2-->P2 | P1==S2 => S1-->P2
  executor.registerRule({
    id: 'deduction',
    name: 'Deduction',
    category: 'deduction',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'deduction',
    priority: 100,
    builtin: true,
    condition: (premises) => {
      const m = premises[0]!;
      const n = premises[1]!;
      // Check if predicate of first matches subject of second
      return isInheritance(m.term) && isInheritance(n.term) &&
        termsEqual(getPredicate(m.term), getSubject(n.term));
    },
    buildConclusion: (premises) => {
      const m = premises[0]!;
      const n = premises[1]!;
      return createInheritance(getSubject(m.term), getPredicate(n.term));
    },
  });

  // Induction: S1-->P, S2-->P => S1-->S2
  executor.registerRule({
    id: 'induction',
    name: 'Induction',
    category: 'induction',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'induction',
    priority: 90,
    builtin: true,
    condition: (premises) => {
      const m = premises[0]!;
      const n = premises[1]!;
      return isInheritance(m.term) && isInheritance(n.term) &&
        termsEqual(getPredicate(m.term), getPredicate(n.term));
    },
    buildConclusion: (premises) => {
      const m = premises[0]!;
      const n = premises[1]!;
      return createInheritance(getSubject(m.term), getSubject(n.term));
    },
  });

  // Abduction: S-->P1, S-->P2 => P1-->P2
  executor.registerRule({
    id: 'abduction',
    name: 'Abduction',
    category: 'abduction',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'abduction',
    priority: 80,
    builtin: true,
    condition: (premises) => {
      const m = premises[0]!;
      const n = premises[1]!;
      return isInheritance(m.term) && isInheritance(n.term) &&
        termsEqual(getSubject(m.term), getSubject(n.term));
    },
    buildConclusion: (premises) => {
      const m = premises[0]!;
      const n = premises[1]!;
      return createInheritance(getPredicate(m.term), getPredicate(n.term));
    },
  });

  // Revision: same term, different evidence
  executor.registerRule({
    id: 'revision',
    name: 'Revision',
    category: 'revision',
    arity: 2,
    premiseRoles: ['belief1', 'belief2'],
    truthOp: 'revision',
    priority: 95,
    builtin: true,
    condition: (premises) => {
      const m = premises[0]!;
      const n = premises[1]!;
      return m.term === n.term;
    },
    buildConclusion: (premises) => premises[0]!.term,
  });

  // Comparison & Analogy: S1-->P1, S2-->P2 => (S1*S2)-->(P1*P2) | (S1*S2)<->(P1*P2)
  const twoInheritanceCondition = (premises: Premise[]) =>
    isInheritance(premises[0]!.term) && isInheritance(premises[1]!.term);

  const buildProductPairConclusion = (
    createRelation: (subject: Term, predicate: Term) => Term
  ) => (premises: Premise[]) => {
    const m = premises[0]!;
    const n = premises[1]!;
    const s1 = getSubject(m.term);
    const s2 = getSubject(n.term);
    const p1 = getPredicate(m.term);
    const p2 = getPredicate(n.term);
    return createRelation(createProduct(s1, s2), createProduct(p1, p2));
  };

  executor.registerRule({
    id: 'comparison',
    name: 'Comparison',
    category: 'comparison',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'analogy',
    priority: 70,
    builtin: true,
    condition: twoInheritanceCondition,
    buildConclusion: buildProductPairConclusion(createInheritance),
  });

  executor.registerRule({
    id: 'analogy',
    name: 'Analogy',
    category: 'analogy',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'analogy',
    priority: 65,
    builtin: true,
    condition: twoInheritanceCondition,
    buildConclusion: buildProductPairConclusion(createSimilarity),
  });

  // Resemblance: S1-->P, S2-->P => S1<->S2
  executor.registerRule({
    id: 'resemblance',
    name: 'Resemblance',
    category: 'resemblance',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'resemblance',
    priority: 75,
    builtin: true,
    condition: (premises) => {
      const m = premises[0]!;
      const n = premises[1]!;
      return isInheritance(m.term) && isInheritance(n.term) &&
        termsEqual(getPredicate(m.term), getPredicate(n.term));
    },
    buildConclusion: (premises) => {
      const m = premises[0]!;
      const n = premises[1]!;
      return createSimilarity(getSubject(m.term), getSubject(n.term));
    },
  });

  // Negation: ~A
  executor.registerRule({
    id: 'negation',
    name: 'Negation',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'negation',
    priority: 50,
    builtin: true,
    condition: () => true,
    buildConclusion: (premises) => createNegation(premises[0]!.term),
  });

  // Conversion: A => A (swap subject/predicate)
  executor.registerRule({
    id: 'conversion',
    name: 'Conversion',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'conversion',
    priority: 55,
    builtin: true,
    condition: (premises) => isInheritance(premises[0]!.term) || isSimilarity(premises[0]!.term),
    buildConclusion: (premises) => {
      const term = premises[0]!.term;
      if (isInheritance(term)) {
        return createInheritance(getPredicate(term), getSubject(term));
      }
      if (isSimilarity(term)) {
        return createSimilarity(getPredicate(term), getSubject(term));
      }
      return null;
    },
  });
}

/** Term helpers for rule conditions. */
function isInheritance(term: Term): boolean {
  return term.op === '-->';
}

function isSimilarity(term: Term): boolean {
  return term.op === '<->';
}

function getSubject(term: Term): Term {
  return (term as any).args[0];
}

function getPredicate(term: Term): Term {
  return (term as any).args[1];
}

function termsEqual(a: Term, b: Term): boolean {
  return a === b; // Interned terms
}

function createInheritance(subject: Term, predicate: Term): Term {
  return { op: '-->', args: [subject, predicate], arity: 2, hash: 0, complexity: 0 } as any;
}

function createSimilarity(subject: Term, predicate: Term): Term {
  return { op: '<->', args: [subject, predicate], arity: 2, hash: 0, complexity: 0 } as any;
}

function createProduct(...terms: Term[]): Term {
  return { op: '*', args: terms, arity: terms.length, hash: 0, complexity: 0 } as any;
}

function createNegation(term: Term): Term {
  return { op: '~', args: [term], arity: 1, hash: 0, complexity: 0 } as any;
}

/** Step recorder for logging/replay. */
export class StepRecorder {
  private steps: StepResult[] = [];
  private maxSteps: number;

  constructor(maxSteps = 10000) {
    this.maxSteps = maxSteps;
  }

  /** Record a step. */
  record(step: StepResult): void {
    this.steps.push(step);
    if (this.steps.length > this.maxSteps) {
      this.steps.shift();
    }
  }

  /** Get all recorded steps. */
  getAll(): StepResult[] {
    return [...this.steps];
  }

  /** Get steps by rule. */
  getByRule(ruleId: RuleId): StepResult[] {
    return this.steps.filter(s => s.ruleId === ruleId);
  }

  /** Get steps by category. */
  getByCategory(category: RuleCategory): StepResult[] {
    return this.steps.filter(s => s.ruleCategory === category);
  }

  /** Clear recorded steps. */
  clear(): void {
    this.steps = [];
  }

  /** Get statistics. */
  getStats(): { total: number; byRule: Record<string, number>; byCategory: Record<string, number> } {
    const byRule: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const step of this.steps) {
      byRule[step.ruleId] = (byRule[step.ruleId] ?? 0) + 1;
      byCategory[step.ruleCategory] = (byCategory[step.ruleCategory] ?? 0) + 1;
    }

    return { total: this.steps.length, byRule, byCategory };
  }
}

/** Create a step recorder. */
export function createStepRecorder(maxSteps?: number): StepRecorder {
  return new StepRecorder(maxSteps);
}