/**
 * Budget event vocabulary — shared by budget.ts and budget-otel.ts to break cycle.
 */
import type { BudgetLimits, BudgetResource, ConsumedBudget, TerminationReason } from './budget-resources';
/** Every `budget:slice:*` payload, so a bus can be typed against this alone. */
export interface BudgetEventMap {
    'budget:slice:created': {
        sliceId: string;
        parentId?: string;
        maxCycles: number;
        maxDepth: number;
        maxMemoryOps: number;
        maxLMCalls: number;
    };
    'budget:slice:consumed': {
        sliceId: string;
        resource: BudgetResource;
        amount: number;
        consumed: number;
        total: number;
        pressure: number;
    };
    'budget:slice:exhausted': {
        sliceId: string;
        reason: TerminationReason;
        consumed: ConsumedBudget;
        total: BudgetLimits;
    };
    'budget:slice:merged': {
        parentId: string;
        childId: string;
        consumed: ConsumedBudget;
    };
}
//# sourceMappingURL=budget-events.d.ts.map