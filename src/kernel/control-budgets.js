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
import { ALL_RESOURCES, BUDGET_TYPES_MAP, budgetLimit } from '../budget/index';
import { BUDGET_SCOPE_IDS, scopeBudget, scopeSpec } from './budget-scopes';
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
export const UNBUDGETED = {
    budgeted: false,
    charge: () => true,
    beginCycle: () => { },
    getSpendSummary: () => ({}),
};
export class ControlBudgets {
    gate;
    overrides;
    budgeted = true;
    constructor(gate, overrides = {}) {
        this.gate = gate;
        this.overrides = overrides;
    }
    charge(scopeId, cost = 1) {
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
    beginCycle() {
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
    open(scopeId) {
        if (!this.gate.getScopeBudget(scopeId))
            this.reopen(scopeId);
    }
    reopen(scopeId) {
        this.gate.createScope(scopeId, scopeBudget(scopeId, this.gate.getBudget(), this.overrides));
    }
    getSpendSummary() {
        const summary = {};
        const spend = (id, budget, resource) => {
            const consumed = budget.consumed;
            summary[id] = {
                ceiling: budgetLimit(budget, resource),
                spent: consumed[resource],
                terminationReason: budget.terminationReason ?? 'none',
            };
        };
        for (const scopeId of BUDGET_SCOPE_IDS) {
            const scope = this.gate.getScopeBudget(scopeId);
            if (scope)
                spend(scopeId, scope, scopeSpec(scopeId).consumedKey);
        }
        for (const resource of ALL_RESOURCES)
            spend(`global-${BUDGET_TYPES_MAP[resource]}`, this.gate.getBudget(), resource);
        return summary;
    }
}
