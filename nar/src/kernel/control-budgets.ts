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

import {
  BUDGET_SCOPE_IDS,
  scopeBudget,
  scopeSpec,
  type BudgetScopeId,
} from './budget-scopes.js';
import type { KernelBudgetGate } from './KernelBudgetGate.js';

export interface ControlBudgetPort {
  /** Spend `cost` units of `scopeId`; `false` when the scope cannot afford it. */
  charge(scopeId: BudgetScopeId, cost?: number): boolean;
  /** Re-open every declared scope from its declared ceilings. */
  beginCycle(): void;
}

export type ControlBudgetOverrides = Partial<Record<BudgetScopeId, number>>;

export class ControlBudgets implements ControlBudgetPort {
  constructor(
    private readonly gate: KernelBudgetGate,
    private readonly overrides: ControlBudgetOverrides = {}
  ) {}

  charge(scopeId: BudgetScopeId, cost = 1): boolean {
    this.open(scopeId);
    return this.gate.check({ operation: scopeSpec(scopeId).operation, scopeId, estimatedCost: cost })
      .granted;
  }

  /**
   * Re-open every declared scope. Four of the five bounds in `BUDGET_SCOPES` are
   * **per cycle**, and a per-cycle bound that is never re-opened is a lifetime
   * bound wearing a per-cycle name.
   */
  beginCycle(): void {
    for (const scopeId of BUDGET_SCOPE_IDS) this.reopen(scopeId);
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
}
