import type { Verdict } from '@senars/schemas/gate-io';
import type { KernelBudgetGate } from '../../kernel/KernelBudgetGate';
import type { JudgmentProposition, ResourceCost } from './types';
export type { ResourceCost };
/** The one `Verdict`, carrying the budget gate's own refusal field name. */
export type JudgmentBudgetVerdict = Verdict<'granted', 'terminationReason'>;
/** Map a proposition's ResourceCost to the budget gate's LM-call accounting. */
export declare function resourceCostToLmCalls(cost: ResourceCost): number;
/** Bench 12: every proposition must report a ResourceCost before consuming budget. */
export declare function assertCostReported(p: JudgmentProposition): void;
/**
 * Charge a judgment against the kernel BudgetGate. Denied when the scoped
 * budget cannot afford the LM-call equivalent of the reported cost.
 */
export declare function chargeJudgment(gate: KernelBudgetGate, scopeId: string, cost: ResourceCost): JudgmentBudgetVerdict;
//# sourceMappingURL=resource-gate.d.ts.map