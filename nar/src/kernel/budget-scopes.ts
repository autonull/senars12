/**
 * The control budgets, declared (TODO29.a §5.7 / §7 invariant 12).
 *
 * A bound is a `ReasoningBudget` scope with a **named** `scopeId` — not a number
 * somebody reads in a hot loop. Every entry answers six questions in one row:
 * what it bounds, which dimension of the budget it spends, who owns it, what it
 * defaults to, where configuration overrides the default, and the
 * `TerminationReason` its overflow raises.
 *
 * Three things this table is *not*, and each was the alternative:
 *
 * - **Not a second budget type.** Every scope is the same `ReasoningBudget` the
 *   gate already accounts, so a scope is a `scopeId` plus its own ceilings.
 * - **Not a place where `decision-derivations` shares a counter with symbolic
 *   derivations.** The two are separate rows with separate ceilings, and the
 *   load-bearing consequence is testable: a decision budget of zero leaves the
 *   symbolic derivation count unchanged, which is §2.4's four-configuration
 *   invariance budgeted rather than asserted.
 * - **Not a cost model.** The default limits are behaviour-neutral relative to
 *   what the call sites already enforced by other means, and where they are
 *   genuinely new (TODO30 measures what they should be).
 */

import type { BudgetOperation, ReasoningBudget, TerminationReason, BudgetScopeId } from '@senars/core/schemas';
import { BUDGET_SCOPE_IDS } from '@senars/core/schemas';

/** One budget dimension, spelled the way `ReasoningBudget` spells it. */
export type BudgetDimension = keyof ReasoningBudget['consumed'];

export type BudgetLimitKey = 'maxCycles' | 'maxDepth' | 'maxMemoryOps' | 'maxLMCalls';

/** The five bounds §5.7 names. The order is the plan's. */
export { BUDGET_SCOPE_IDS, type BudgetScopeId } from '@senars/core/schemas';

export interface BudgetScopeSpec {
  readonly operation: BudgetOperation;
  readonly consumedKey: BudgetDimension;
  readonly limitKey: BudgetLimitKey;
  /** The module that spends this scope, so "unbounded" has an address. */
  readonly owner: string;
  /** The declared default, used unless configuration overrides it. */
  readonly defaultLimit: number;
  /** Where a limit comes from when it is not the default. */
  readonly configSource: string;
  readonly terminationReason: TerminationReason;
  /**
   * The exported symbol a caller names instead of `charge(...)` — a scope spent
   * outside the cycle path, where the id is a value rather than a literal. The
   * gate reads this, so the reference is declared rather than remembered.
   */
  readonly referenceSymbol?: string;
}

export const BUDGET_SCOPES = {
  derivations: {
    operation: 'derivation',
    consumedKey: 'cycles',
    limitKey: 'maxCycles',
    owner: 'InferenceController',
    defaultLimit: 100,
    configSource: 'inference.maxDerivationsPerStep, or controlBudgets.derivations',
    terminationReason: 'cycle-budget',
  },
  premises: {
    operation: 'premise-selection',
    consumedKey: 'cycles',
    limitKey: 'maxCycles',
    owner: 'InferenceController',
    defaultLimit: 64,
    configSource: 'controlBudgets.premises',
    terminationReason: 'cycle-budget',
  },
  'proposal-application': {
    operation: 'proposal-application',
    consumedKey: 'memoryOps',
    limitKey: 'maxMemoryOps',
    owner: 'NARExecution.authorize',
    defaultLimit: 64,
    configSource: 'controlBudgets.proposal-application',
    terminationReason: 'memory-budget',
  },
  'control-work': {
    operation: 'control-work',
    consumedKey: 'cycles',
    limitKey: 'maxCycles',
    owner: 'NARExecution control and observability steps',
    defaultLimit: 16,
    configSource: 'controlBudgets.control-work',
    terminationReason: 'cycle-budget',
  },
  'decision-derivations': {
    operation: 'decision-derivation',
    consumedKey: 'llmCalls',
    limitKey: 'maxLMCalls',
    owner: 'the decision layer (A11 binds the port)',
    defaultLimit: 8,
    configSource: 'controlBudgets.decision-derivations',
    terminationReason: 'llm-budget',
    referenceSymbol: 'DECISION_DERIVATIONS_SCOPE',
  },
} as const satisfies Record<BudgetScopeId, BudgetScopeSpec>;

export const scopeSpec = (scopeId: BudgetScopeId): BudgetScopeSpec => BUDGET_SCOPES[scopeId];

/**
 * The decision layer's judgment cost, charged through the kernel gate under this
 * scope rather than an ad-hoc `'default'`. Named once for both halves of the
 * decision layer: what a judgment costs, and (from A11) what it concludes.
 */
export const DECISION_DERIVATIONS_SCOPE: BudgetScopeId = 'decision-derivations';

/** The declared limit for one scope, or the override configuration supplies. */
export const scopeLimit = (
  scopeId: BudgetScopeId,
  overrides: Partial<Record<BudgetScopeId, number>> = {}
): number => overrides[scopeId] ?? scopeSpec(scopeId).defaultLimit;

/**
 * Resolve a scope's ceilings over a base budget: the dimension the scope spends
 * gets the declared limit, every other dimension inherits `base`, and
 * consumption starts at zero. Inheriting matters — a scope must raise *its own*
 * reason when it exhausts, never trip an unrelated dimension it never spends.
 */
export const scopeBudget = (
  scopeId: BudgetScopeId,
  base: ReasoningBudget,
  overrides: Partial<Record<BudgetScopeId, number>> = {}
): ReasoningBudget => {
  const spec = scopeSpec(scopeId);
  return {
    ...base,
    [spec.limitKey]: scopeLimit(scopeId, overrides),
    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
    terminationReason: undefined,
  };
};
