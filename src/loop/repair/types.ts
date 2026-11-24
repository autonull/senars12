/**
 * Repair Loop Types — shared type definitions.
 */

import type { Term } from '../../kernel/terms/term';
import type { Truth } from '../../kernel/truth';
import type { Task, TimestampMs } from '../../kernel/types';
import type { FacultyInput, FacultyOutput } from '../../faculties/specs';
import type { Clock } from '../../kernel/env';

/** Anomaly types. */
export const ANOMALY_TYPES = [
  'stall',
  'divergence',
  'contradiction',
  'resource_exhaustion',
  'oracle_failure',
  'gate_failure',
  'contract_violation',
] as const;

export type AnomalyType = (typeof ANOMALY_TYPES)[number];

/** Anomaly severity. */
export const ANOMALY_SEVERITY = ['low', 'medium', 'high', 'critical'] as const;
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
export const REPAIR_LADDER_ACTIONS = [
  'reduce_scope',
  'increase_budget',
  'delegate',
  'fallback',
  'abort',
] as const;

export const REPAIR_OPERATIONAL_ACTIONS = [
  'retry',
  'replan',
  'retrieve_context',
  'verify_premises',
  'escalate',
] as const;

export const REPAIR_ACTIONS = [
  ...REPAIR_LADDER_ACTIONS,
  ...REPAIR_OPERATIONAL_ACTIONS,
] as const;

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