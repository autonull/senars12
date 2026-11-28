/**
 * Repair Loop — self-repair and recovery for the cognitive loop.
 *
 * Detects anomalies, diagnoses root causes, and applies repairs.
 */
import type { Anomaly, RepairContext, RepairAction, RepairResult, RepairPolicy, RepairLoopConfig, AnomalyDetector, AnomalyType, AnomalySeverity } from './types';
/** Default repair policies. */
export declare const defaultRepairPolicies: RepairPolicy[];
/** Repair ladder policy for escalating repairs. */
export declare const repairLadderPolicy: RepairPolicy;
/** Generate repair ladder for an anomaly. */
export declare function generateRepairLadder(context: RepairContext, anomaly: Anomaly): RepairAction[];
/** Repair Loop — coordinates anomaly detection and repair. */
export declare class RepairLoop {
    #private;
    constructor(config: RepairLoopConfig);
    /** Detect anomalies in the current context. */
    detect(context: RepairContext): Promise<Anomaly[]>;
    /** Apply repairs for detected anomalies. */
    repair(context: RepairContext, anomalies: Anomaly[]): Promise<RepairResult[]>;
    /** Run full detect and repair cycle. */
    run(context: RepairContext): Promise<RepairResult[]>;
    /** Get repair history. */
    getHistory(): RepairResult[];
    /** Clear repair history. */
    clearHistory(): void;
}
/** Create a RepairLoop instance. */
export declare function createRepairLoop(config: RepairLoopConfig): RepairLoop;
/** Detect stalled iterations. */
export declare const stallDetector: AnomalyDetector;
/** Detect divergence in derivation chains. */
export declare const divergenceDetector: AnomalyDetector;
/** Detect resource exhaustion. */
export declare const resourceExhaustionDetector: AnomalyDetector;
/** Detect oracle failures. */
export declare const oracleFailureDetector: AnomalyDetector;
/** Detect gate failures. */
export declare const gateFailureDetector: AnomalyDetector;
export type { Anomaly, RepairContext, RepairAction, RepairResult, RepairPolicy, RepairLoopConfig, AnomalyDetector, AnomalyType, AnomalySeverity, };
export declare function getRepairLoop(config: RepairLoopConfig): RepairLoop;
//# sourceMappingURL=index.d.ts.map