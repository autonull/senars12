/**
 * Derivation Repair — repairs for derivation anomalies.
 */
import type { RepairContext, RepairAction, Anomaly, RepairPolicy } from './types';
/** Generate derivation repair actions. */
export declare function generateDerivationRepairs(context: RepairContext, anomaly: Anomaly): RepairAction[];
/** Derivation repair policy. */
export declare const derivationRepairPolicy: RepairPolicy;
/** Contradiction repair policy. */
export declare const contradictionRepairPolicy: RepairPolicy;
//# sourceMappingURL=derivation.d.ts.map