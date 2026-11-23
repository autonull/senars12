/**
 * Logic Port — the unified interface for truth-valued logics.
 *
 * All truth-valued logics (NAL, Axiomatic, Fuzzy) implement this port.
 * The port defines the contract for:
 * - Type representation (T)
 * - Expectation/confidence computation
 * - Contradiction checking
 * - Coexistence policy
 * - Inference rules as data (formula-ASTs)
 */

import { Term } from '../kernel/terms/intern';
import { TruthValue } from '../kernel/types';
import { Stamp } from '../kernel/stamp';
import { FunctionRegistry } from '../util/registry';

/** Inference rule as a formula-AST (data, not code). */
export interface RuleAST<T> {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly arity: 1 | 2;
  readonly premiseRoles: readonly string[];
  /** Truth function name (resolves to implementation). */
  readonly truthFn: string;
  readonly priority: number;
  /** Condition as an AST (evaluated by interpreter). */
  readonly condition: ConditionAST;
  /** Conclusion builder as an AST. */
  readonly conclusion: ConclusionAST<T>;
}

/** Condition AST for rule applicability. */
export type ConditionAST =
  | { op: 'and'; args: readonly ConditionAST[] }
  | { op: 'or'; args: readonly ConditionAST[] }
  | { op: 'not'; arg: ConditionAST }
  | { op: 'eq'; left: TermRef; right: TermRef }
  | { op: 'is_inheritance'; term: TermRef }
  | { op: 'is_similarity'; term: TermRef }
  | { op: 'is_prediction'; term: TermRef }
  | { op: 'is_sequential'; term: TermRef }
  | { op: 'is_concurrent'; term: TermRef }
  | { op: 'is_variable'; term: TermRef }
  | { op: 'true' }
  | { op: 'false' };

/** Term reference in a condition/conclusion AST. */
export type TermRef =
  | { op: 'premise'; index: 0 | 1; field: 'subject' | 'predicate' | 'term' }
  | { op: 'constant'; value: string }
  | { op: 'variable'; name: string }
  | { op: 'inheritance'; subject: TermRef; predicate: TermRef }
  | { op: 'similarity'; subject: TermRef; predicate: TermRef }
  | { op: 'product'; terms: readonly TermRef[] }
  | { op: 'negation'; term: TermRef }
  | { op: 'prediction'; antecedent: TermRef; consequent: TermRef }
  | { op: 'sequential'; first: TermRef; second: TermRef }
  | { op: 'concurrent'; first: TermRef; second: TermRef }
  | { op: 'parallel'; first: TermRef; second: TermRef };

/** Conclusion AST. */
export type ConclusionAST<T> = TermRef;

/** Premise for inference. */
export interface Premise<T> {
  readonly term: T;
  readonly truth: TruthValue;
  readonly stamp: Stamp;
  readonly role?: string;
}

/** Step result from applying a rule. */
export interface StepResult<T> {
  readonly conclusion: T;
  readonly truth: TruthValue;
  readonly stamp: Stamp;
  readonly ruleId: string;
  readonly ruleCategory: string;
  readonly premises: readonly Premise<T>[];
  readonly truthFn: string;
}

/** Logic port interface. */
export interface Logic<T> {
  /** Unique logic identifier. */
  readonly id: string;
  /** Logic version. */
  readonly version: string;
  /** Codec for serialization. */
  readonly codec: Codec<T>;
  /** Compute expectation (for ranking). */
  readonly expect: (t: T) => number;
  /** Compute confidence. */
  readonly conf: (t: T) => number;
  /** Check if two terms contradict. */
  readonly contradicts: (a: T, b: T) => boolean;
  /** Coexistence policy for conflicting beliefs. */
  readonly policy: 'coexist' | 'report';
  /** All inference rules as formula-ASTs. */
  readonly rules: readonly RuleAST<T>[];
}

/** Codec for serialization/deserialization. */
export interface Codec<T> {
  /** Serialize to string. */
  readonly encode: (t: T) => string;
  /** Deserialize from string. */
  readonly decode: (s: string) => T | null;
}

/** Logic registry for managing multiple logics. */
export class LogicRegistry<T = Term> extends FunctionRegistry<string, Logic<T>> {
  constructor() {
    super((logic) => logic.id);
  }

  /** Register a logic. */
  override register(logic: Logic<T>): void {
    super.register(logic);
  }

  /** Get a logic by ID. */
  override get(id: string): Logic<T> | undefined {
    return super.get(id);
  }

  /** Get all registered logics. */
  override getAll(): Logic<T>[] {
    return super.getAll();
  }

  /** Check if a logic is registered. */
  override has(id: string): boolean {
    return super.has(id);
  }
}

/** Create a logic registry. */
export function createLogicRegistry<T = Term>(): LogicRegistry<T> {
  return new LogicRegistry<T>();
}