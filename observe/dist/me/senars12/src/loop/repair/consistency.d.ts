/**
 * Consistency Repair — repairs for consistency and gate anomalies.
 */
import type { RepairContext, RepairAction, Anomaly, RepairPolicy } from './types';
/** Generate consistency repair actions. */
export declare function generateConsistencyRepairs(context: RepairContext, anomaly: Anomaly): RepairAction[];
/** Gate failure repair policy. */
export declare const gateFailureRepairPolicy: RepairPolicy;
/** Oracle failure repair policy. */
export declare const oracleFailureRepairPolicy: RepairPolicy;
//# sourceMappingURL=consistency.d.ts.map