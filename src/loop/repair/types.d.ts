/**
 * Repair Loop Types — shared type definitions.
 */
import type { Task } from '../../kernel/types';
import type { Clock } from '../../kernel/env';
/** Anomaly types. */
export declare const ANOMALY_TYPES: readonly ['stall', 'divergence', 'contradiction', 'resource_exhaustion', 'oracle_failure', 'gate_failure', 'contract_violation'];
export type AnomalyType = (typeof ANOMALY_TYPES)[number];
/** Anomaly severity. */
export declare const ANOMALY_SEVERITY: readonly ['low', 'medium', 'high', 'critical'];
export type AnomalySeverity = (typeof ANOMALY_SEVERITY)[number];
/** Detected anomaly. */
export interface Anomaly {
    /** Anomaly type. */
    type: AnomalyType;
    /** Severity. */
    severity: AnomalySeverity;
    /** Description. */
    description: string;
    /** Detection timestamp. */
    detectedAt: number;
    /** Context when detected. */
    context: RepairContext;
    /** Suggested repairs. */
    suggestedRepairs: RepairAction[];
    /** Unique ID. */
    id: string;
}
/** Repair context. */
export interface RepairContext {
    /** Current loop iteration. */
    iteration: number;
    /** Recent tasks. */
    recentTasks: Task[];
    /** Current beliefs. */
    beliefs: Task[];
    /** Current goals. */
    goals: Task[];
    /** Resource usage. */
    resources: ResourceUsage;
    /** Oracle health. */
    oracleHealth: OracleHealth[];
    /** Gate states. */
    gateStates: GateState[];
    /** Deterministic clock for timestamps. */
    clock: Clock;
}
/** Resource usage. */
export interface ResourceUsage {
    /** CPU usage (0-1). */
    cpu: number;
    /** Memory usage (bytes). */
    memory: number;
    /** Token budget used. */
    tokensUsed: number;
    /** Token budget remaining. */
    tokensRemaining: number;
    /** Wall time (ms). */
    wallTimeMs: number;
}
/** Oracle health. */
export interface OracleHealth {
    /** Oracle operation. */
    operation: string;
    /** Available. */
    available: boolean;
    /** Error rate (0-1). */
    errorRate: number;
    /** Average latency (ms). */
    avgLatencyMs: number;
    /** Last error. */
    lastError?: string;
}
/** Gate state. */
export interface GateState {
    /** Gate name. */
    name: string;
    /** Passed. */
    passed: boolean;
    /** Failure reason. */
    reason?: string;
}
/** Repair ladder action types. */
export declare const REPAIR_LADDER_ACTIONS: readonly ['reduce_scope', 'increase_budget', 'delegate', 'fallback', 'abort'];
export declare const REPAIR_OPERATIONAL_ACTIONS: readonly ['retry', 'replan', 'retrieve_context', 'verify_premises', 'escalate'];
export declare const REPAIR_ACTIONS: readonly ["reduce_scope", "increase_budget", "delegate", "fallback", "abort", "retry", "replan", "retrieve_context", "verify_premises", "escalate"];
export type RepairActionType = (typeof REPAIR_ACTIONS)[number];
export type RepairLadderActionType = (typeof REPAIR_LADDER_ACTIONS)[number];
/** Repair action. */
export interface RepairAction {
    /** Action type. */
    type: RepairActionType;
    /** Human-readable description. */
    description: string;
    /** Parameters for the action. */
    params: Record<string, unknown>;
    /** Confidence this will help (0-1). */
    confidence: number;
    /** Estimated cost. */
    cost: number;
}
/** Repair result. */
export interface RepairResult {
    /** Action that was attempted. */
    action: RepairAction;
    /** Whether the repair succeeded. */
    success: boolean;
    /** Outcome description. */
    outcome: string;
    /** New anomalies detected. */
    newAnomalies: Anomaly[];
    /** Timestamp. */
    timestamp: number;
}
/** Repair policy. */
export interface RepairPolicy {
    /** Policy name. */
    name: string;
    /** Applies to anomaly types. */
    appliesTo: AnomalyType[];
    /** Minimum severity. */
    minSeverity: AnomalySeverity;
    /** Action generator. */
    generateActions: (context: RepairContext, anomaly: Anomaly) => RepairAction[];
    /** Priority (higher = tried first). */
    priority: number;
}
/** Repair loop configuration. */
export interface RepairLoopConfig {
    /** Maximum repair attempts per anomaly. */
    maxAttempts: number;
    /** Policies to apply. */
    policies: RepairPolicy[];
    /** Anomaly detectors. */
    detectors: AnomalyDetector[];
    /** Clock for timestamps. */
    clock: Clock;
}
/** Anomaly detector function. */
export type AnomalyDetector = (context: RepairContext) => Promise<Anomaly[]>;
//# sourceMappingURL=types.d.ts.map