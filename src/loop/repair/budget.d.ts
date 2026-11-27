/**
 * Budget Repair — repairs for resource exhaustion and budget anomalies.
 */
import type { RepairContext, RepairAction, Anomaly, RepairPolicy } from './types';
/** Generate budget repair actions. */
export declare function generateBudgetRepairs(context: RepairContext, anomaly: Anomaly): RepairAction[];
/** Resource exhaustion repair policy. */
export declare const resourceExhaustionRepairPolicy: RepairPolicy;
/** Stall repair policy. */
export declare const stallRepairPolicy: RepairPolicy;
/** Divergence repair policy. */
export declare const divergenceRepairPolicy: RepairPolicy;
//# sourceMappingURL=budget.d.ts.map