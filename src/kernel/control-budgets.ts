/**
 * The declared control budgets (TODO29.a §5.7).
 *
 * A call site says *which* bound it is inside — `charge('derivations')` — and
 * nothing else: the operation, the dimension, the ceiling and the
 * `TerminationReason` all come from the scope table. That is why this is a
 * narrow port and not `budgetGate.check({ operation: … })` at each site: a
 * hand-written call can disagree with the declaration about which dimension it
 * spends, and the disagreement stays invisible until the wrong reason is raised.
 *
 * It is also this NAR's own budget gate, so a scope and the kernel's accounting
 * cannot drift into two budgets — §7 invariant 12.
 */

import { ALL_RESOURCES, BUDGET_TYPES, type BudgetResource, budgetLimit } from '@senars/core/budget';
import type { ReasoningBudget } from '@senars/core/schemas';
import { BUDGET_SCOPE_IDS, type BudgetScopeId, scopeBudget, scopeSpec } from './budget-scopes.js';
import type { KernelBudgetGate } from './KernelBudgetGate.js';

export interface ControlBudgetPort {
  /**
   * Whether a real budget is behind this port. `false` only for
   * {@link UNBUDGETED}: a caller that falls back to a configuration bound when
   * no port was bound asks this rather than testing for `undefined`, which is
   * why "unbudgeted" is a value and not an omission.
   */
  readonly budgeted: boolean;
  /** Spend `cost` units of `scopeId`; `false` when the scope cannot afford it. */
  charge(scopeId: BudgetScopeId, cost?: number): boolean;
  /** Re-open every declared scope from its declared ceilings. */
  beginCycle(): void;
  /** Get spend summary for all scopes. */
  getSpendSummary(): Record<string, { ceiling: number; spent: number; terminationReason: string }>;
}

export type ControlBudgetOverrides = Partial<Record<BudgetScopeId, number>>;

/**
 * The port a component holds when no budget wiring was bound — every declared
 * bound affordable, no scope ever opened.
 *
 * "Unbudgeted" is a *state*, not the absence of one. It used to be spelled
 * `budgets ? budgets.charge(scope) : true` at each of the four sites that can
 * run without a port, so which of them were optional was decided per call rather
 * than once at construction — and a site that forgot the guard would have thrown
 * on `undefined` instead of charging nothing. Defaulting the field to this makes
 * the third state reachable by construction and leaves one spelling of the
 * question "may I do one more unit of work?".
 */
export const UNBUDGETED: ControlBudgetPort = {
  budgeted: false,
  charge: () => true,
  beginCycle: () => {},
  getSpendSummary: () => ({}),
};

export class ControlBudgets implements ControlBudgetPort {
  readonly budgeted = true;

  constructor(
    private readonly gate: KernelBudgetGate,
    private readonly overrides: ControlBudgetOverrides = {}
  ) {}

  charge(scopeId: BudgetScopeId, cost = 1): boolean {
    this.open(scopeId);
    return this.gate.check({
      operation: scopeSpec(scopeId).operation,
      scopeId,
      estimatedCost: cost,
    }).granted;
  }

  /**
   * Re-open every declared scope. Four of the five bounds in `BUDGET_SCOPES` are
   * **per cycle**, and a per-cycle bound that is never re-opened is a lifetime
   * bound wearing a per-cycle name.
   */
  beginCycle(): void {
    for (const scopeId of BUDGET_SCOPE_IDS) {
      this.open(scopeId);
      this.gate.resetConsumption(scopeId);
    }
  }

  /**
   * Open a scope from its declared ceilings, if it is not open already. Opening
   * it on *every* charge would reset the consumption that decided the previous
   * charge, so a scope could never exhaust — a bound wearing a counter. Opening
   * it once also matters because a lazily-created scope inherits the gate's
   * shared budget rather than the declared ceiling.
   */
  private open(scopeId: BudgetScopeId): void {
    if (!this.gate.getScopeBudget(scopeId)) this.reopen(scopeId);
  }

  private reopen(scopeId: BudgetScopeId): void {
    this.gate.createScope(scopeId, scopeBudget(scopeId, this.gate.getBudget(), this.overrides));
  }

  getSpendSummary(): Record<string, { ceiling: number; spent: number; terminationReason: string }> {
    const summary: Record<string, { ceiling: number; spent: number; terminationReason: string }> =
      {};
    const spend = (id: string, budget: ReasoningBudget, resource: BudgetResource): void => {
      summary[id] = {
        ceiling: budgetLimit(budget, resource),
        spent: budget.consumed[resource],
        terminationReason: budget.terminationReason ?? 'none',
      };
    };

    for (const scopeId of BUDGET_SCOPE_IDS) {
      const scope = this.gate.getScopeBudget(scopeId);
      if (scope) spend(scopeId, scope, scopeSpec(scopeId).consumedKey);
    }
    for (const resource of ALL_RESOURCES)
      spend(BUDGET_TYPES[resource], this.gate.getBudget(), resource);

    return summary;
  }
}
