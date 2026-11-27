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
import { type BudgetScopeId } from './budget-scopes';
import type { KernelBudgetGate } from './KernelBudgetGate';
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
    getSpendSummary(): Record<string, {
        ceiling: number;
        spent: number;
        terminationReason: string;
    }>;
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
export declare const UNBUDGETED: ControlBudgetPort;
export declare class ControlBudgets implements ControlBudgetPort {
    private readonly gate;
    private readonly overrides;
    readonly budgeted = true;
    constructor(gate: KernelBudgetGate, overrides?: ControlBudgetOverrides);
    charge(scopeId: BudgetScopeId, cost?: number): boolean;
    /**
     * Re-open every declared scope. Four of the five bounds in `BUDGET_SCOPES` are
     * **per cycle**, and a per-cycle bound that is never re-opened is a lifetime
     * bound wearing a per-cycle name.
     */
    beginCycle(): void;
    /**
     * Open a scope from its declared ceilings, if it is not open already. Opening
     * it on *every* charge would reset the consumption that decided the previous
     * charge, so a scope could never exhaust — a bound wearing a counter. Opening
     * it once also matters because a lazily-created scope inherits the gate's
     * shared budget rather than the declared ceiling.
     */
    private open;
    private reopen;
    getSpendSummary(): Record<string, {
        ceiling: number;
        spent: number;
        terminationReason: string;
    }>;
}
//# sourceMappingURL=control-budgets.d.ts.map