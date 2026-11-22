/**
 * Repair Loop — self-repair and recovery for the cognitive loop.
 *
 * Detects anomalies, diagnoses root causes, and applies repairs.
 */

import type { Term } from '../kernel/terms/term';
import type { Truth } from '../kernel/truth';
import type { Task, TimestampMs } from '../kernel/types';
import type { FacultyInput, FacultyOutput } from '../faculties/specs';
import { facultyEngine } from '../faculties/engine';
import { judgmentCascade, type JudgmentContext, type JudgmentResult } from '../faculties/judgment/cascade';
import type { Clock } from '../kernel/env';

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
  /** Score. */
  score: number;
  /** Consecutive failures. */
  consecutiveFailures: number;
}

/** Repair action types. */
/** Core repair ladder actions (escalating severity). */
export const REPAIR_LADDER_ACTIONS = [
  'param_fix',
  'precondition_subgoal',
  'alternate_operator',
  'explained_veto',
] as const;

/** Operational repair actions. */
export const REPAIR_OPERATIONAL_ACTIONS = [
  'restart_oracle',
  'clear_cache',
  'reset_gate',
  'reduce_budget',
  'increase_timeout',
  'fallback_faculty',
  'rollback_state',
  'replan',
  'recalibrate',
  'alert_human',
] as const;

/** All repair action types. */
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
  /** Target (oracle, gate, faculty, etc.). */
  target: string;
  /** Parameters. */
  params: Record<string, unknown>;
  /** Priority (higher = more urgent). */
  priority: number;
  /** Estimated recovery time (ms). */
  estimatedRecoveryMs: number;
  /** Whether this is a safe action (no side effects). */
  safe: boolean;
}

/** Repair result. */
export interface RepairResult {
  /** Anomaly ID. */
  anomalyId: string;
  /** Actions taken. */
  actions: RepairAction[];
  /** Success. */
  success: boolean;
  /** Duration (ms). */
  durationMs: number;
  /** Error if failed. */
  error?: string;
  /** Post-repair context. */
  postContext?: RepairContext;
}

/** Repair policy. */
export interface RepairPolicy {
  /** Anomaly type. */
  anomalyType: AnomalyType;
  /** Minimum severity to trigger. */
  minSeverity: AnomalySeverity;
  /** Actions to take in order. */
  actions: RepairAction[];
  /** Max retries for this anomaly. */
  maxRetries: number;
  /** Cooldown between retries (ms). */
  cooldownMs: number;
}

/** Default repair policies. */
export const defaultRepairPolicies: RepairPolicy[] = [
  {
    anomalyType: 'stall',
    minSeverity: 'medium',
    actions: [
      { type: 'clear_cache', target: 'faculty', params: {}, priority: 10, estimatedRecoveryMs: 100, safe: true },
      { type: 'restart_oracle', target: 'lm', params: {}, priority: 8, estimatedRecoveryMs: 5000, safe: false },
      { type: 'replan', target: 'loop', params: {}, priority: 5, estimatedRecoveryMs: 1000, safe: true },
    ],
    maxRetries: 3,
    cooldownMs: 30000,
  },
  {
    anomalyType: 'divergence',
    minSeverity: 'high',
    actions: [
      { type: 'rollback_state', target: 'kernel', params: { steps: 5 }, priority: 10, estimatedRecoveryMs: 200, safe: true },
      { type: 'recalibrate', target: 'judgment', params: {}, priority: 8, estimatedRecoveryMs: 500, safe: true },
      { type: 'reduce_budget', target: 'loop', params: { factor: 0.5 }, priority: 6, estimatedRecoveryMs: 100, safe: true },
    ],
    maxRetries: 2,
    cooldownMs: 60000,
  },
  {
    anomalyType: 'contradiction',
    minSeverity: 'medium',
    actions: [
      { type: 'fallback_faculty', target: 'revision', params: {}, priority: 10, estimatedRecoveryMs: 100, safe: true },
      { type: 'recalibrate', target: 'judgment', params: {}, priority: 8, estimatedRecoveryMs: 500, safe: true },
    ],
    maxRetries: 3,
    cooldownMs: 30000,
  },
  {
    anomalyType: 'resource_exhaustion',
    minSeverity: 'high',
    actions: [
      { type: 'reduce_budget', target: 'loop', params: { factor: 0.3 }, priority: 10, estimatedRecoveryMs: 100, safe: true },
      { type: 'clear_cache', target: 'all', params: {}, priority: 8, estimatedRecoveryMs: 200, safe: true },
      { type: 'alert_human', target: 'operator', params: { message: 'Resource exhaustion' }, priority: 5, estimatedRecoveryMs: 0, safe: true },
    ],
    maxRetries: 1,
    cooldownMs: 120000,
  },
  {
    anomalyType: 'oracle_failure',
    minSeverity: 'medium',
    actions: [
      { type: 'restart_oracle', target: 'all', params: {}, priority: 10, estimatedRecoveryMs: 5000, safe: false },
      { type: 'fallback_faculty', target: 'all', params: {}, priority: 8, estimatedRecoveryMs: 100, safe: true },
      { type: 'increase_timeout', target: 'oracle', params: { factor: 2 }, priority: 6, estimatedRecoveryMs: 100, safe: true },
    ],
    maxRetries: 3,
    cooldownMs: 60000,
  },
  {
    anomalyType: 'gate_failure',
    minSeverity: 'high',
    actions: [
      { type: 'reset_gate', target: 'all', params: {}, priority: 10, estimatedRecoveryMs: 100, safe: true },
      { type: 'recalibrate', target: 'judgment', params: {}, priority: 8, estimatedRecoveryMs: 500, safe: true },
      { type: 'rollback_state', target: 'kernel', params: { steps: 3 }, priority: 6, estimatedRecoveryMs: 200, safe: true },
    ],
    maxRetries: 2,
    cooldownMs: 60000,
  },
  {
    anomalyType: 'contract_violation',
    minSeverity: 'critical',
    actions: [
      { type: 'rollback_state', target: 'kernel', params: { steps: 10 }, priority: 10, estimatedRecoveryMs: 500, safe: true },
      { type: 'alert_human', target: 'operator', params: { message: 'Contract violation detected' }, priority: 10, estimatedRecoveryMs: 0, safe: true },
    ],
    maxRetries: 1,
    cooldownMs: 300000,
  },
];

/** Repair ladder policy — escalates through param_fix → precondition_subgoal → alternate_operator → explained_veto. */
export const repairLadderPolicy: RepairPolicy = {
  anomalyType: 'stall', // Generic; ladder can be invoked for any anomaly
  minSeverity: 'low',
  actions: [
    { type: 'param_fix', target: 'config', params: {}, priority: 10, estimatedRecoveryMs: 50, safe: true },
    { type: 'precondition_subgoal', target: 'loop', params: { subgoal: 'establish_precondition' }, priority: 8, estimatedRecoveryMs: 500, safe: true },
    { type: 'alternate_operator', target: 'faculty', params: { operator: 'alternate' }, priority: 6, estimatedRecoveryMs: 1000, safe: true },
    { type: 'explained_veto', target: 'action', params: { reason: 'Escalation exhausted' }, priority: 4, estimatedRecoveryMs: 0, safe: true },
  ],
  maxRetries: 1,
  cooldownMs: 10000,
};

/** Generate repair ladder actions for a specific anomaly. */
export function generateRepairLadder(
  anomaly: Anomaly,
  baseParams: Record<string, unknown> = {}
): RepairAction[] {
  const ladderActions: RepairLadderActionType[] = ['param_fix', 'precondition_subgoal', 'alternate_operator', 'explained_veto'];
  const recoveryTimes: readonly number[] = [50, 500, 1000, 0];
  const target = (baseParams.target as string) ?? 'loop';
  return ladderActions.map((type, index) => ({
    type,
    target,
    params: { ...baseParams, ...ladderParams(type) },
    priority: 10 - index * 2,
    estimatedRecoveryMs: recoveryTimes[index]!,
    safe: true,
  }));
}

function ladderParams(type: RepairLadderActionType): Record<string, unknown> {
  switch (type) {
    case 'param_fix':
      return { parameter: 'explorationRate', newValue: 0.1 };
    case 'precondition_subgoal':
      return { subgoal: 'check_consistency' };
    case 'alternate_operator':
      return { operator: 'revision' };
    case 'explained_veto':
      return { reason: 'Repair ladder exhausted; action vetoed' };
  }
}

/** Repair loop configuration. */
export interface RepairLoopConfig {
  /** Repair policies. */
  policies: RepairPolicy[];
  /** Anomaly detectors. */
  detectors: AnomalyDetector[];
  /** Max concurrent repairs. */
  maxConcurrentRepairs: number;
  /** Repair timeout (ms). */
  repairTimeoutMs: number;
  /** Enable auto-repair. */
  autoRepair: boolean;
}

/** Anomaly detector function. */
export type AnomalyDetector = (context: RepairContext) => Promise<Anomaly[]>;

/** Repair loop. */
export class RepairLoop {
  private config: RepairLoopConfig;
  private activeRepairs = new Map<string, RepairResult>();
  private repairHistory: RepairResult[] = [];
  private anomalyHistory: Anomaly[] = [];
  private retryCounts = new Map<string, number>();
  private lastRepairTime = new Map<string, number>();
  private readonly clock: Clock;

  constructor(
    config: Partial<RepairLoopConfig> = {},
    options: { clock?: Clock } = {}
  ) {
    this.config = {
      policies: config.policies ?? defaultRepairPolicies,
      detectors: config.detectors ?? [],
      maxConcurrentRepairs: config.maxConcurrentRepairs ?? 3,
      repairTimeoutMs: config.repairTimeoutMs ?? 30000,
      autoRepair: config.autoRepair ?? true,
    };
    this.clock = options.clock ?? { now: () => Date.now() as TimestampMs, setTime: () => {}, advance: () => {} };
  }

  /** Add a custom anomaly detector. */
  addDetector(detector: AnomalyDetector): void {
    this.config.detectors.push(detector);
  }

  /** Add a custom repair policy. */
  addPolicy(policy: RepairPolicy): void {
    this.config.policies.push(policy);
  }

  /** Run anomaly detection and repair. */
  async tick(context: RepairContext): Promise<RepairResult[]> {
    const results: RepairResult[] = [];

    // Detect anomalies
    const anomalies = await this.detectAnomalies(context);

    // Filter and prioritize
    const actionableAnomalies = this.prioritizeAnomalies(anomalies, context);

    // Execute repairs
    for (const anomaly of actionableAnomalies) {
      if (this.activeRepairs.size >= this.config.maxConcurrentRepairs) {
        break;
      }

      const policy = this.config.policies.find(p => p.anomalyType === anomaly.type);
      if (!policy) continue;

      // Check retry limits
      const retryKey = `${anomaly.type}:${anomaly.id}`;
      const retries = this.retryCounts.get(retryKey) ?? 0;
      if (retries >= policy.maxRetries) continue;

      // Check cooldown
      const lastRepair = this.lastRepairTime.get(retryKey) ?? 0;
      if (this.clock.now() - lastRepair < policy.cooldownMs) continue;

      // Check severity
      const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      if (severityOrder[anomaly.severity] < severityOrder[policy.minSeverity]) continue;

      // Execute repair
      const result = await this.executeRepair(anomaly, policy, context);
      results.push(result);

      // Update tracking
      this.retryCounts.set(retryKey, retries + 1);
      this.lastRepairTime.set(retryKey, this.clock.now());
      this.activeRepairs.set(anomaly.id, result);
      this.repairHistory.push(result);
      this.anomalyHistory.push(anomaly);

      // Clean up old history
      if (this.repairHistory.length > 1000) this.repairHistory.shift();
      if (this.anomalyHistory.length > 1000) this.anomalyHistory.shift();
    }

    // Check for completed repairs
    this.cleanupCompletedRepairs();

    return results;
  }

  /** Detect anomalies using registered detectors. */
  private async detectAnomalies(context: RepairContext): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    for (const detector of this.config.detectors) {
      try {
        const detected = await detector(context);
        anomalies.push(...detected);
      } catch (error) {
        console.warn('Anomaly detector failed:', error);
      }
    }

    return anomalies;
  }

  /** Prioritize anomalies by severity and recency. */
  private prioritizeAnomalies(anomalies: Anomaly[], _context: RepairContext): Anomaly[] {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return anomalies
      .sort((a, b) => {
        const sevDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (sevDiff !== 0) return sevDiff;
        return b.detectedAt - a.detectedAt;
      })
      .slice(0, this.config.maxConcurrentRepairs);
  }

  /** Execute a repair for an anomaly. */
  private async executeRepair(
    anomaly: Anomaly,
    policy: RepairPolicy,
    context: RepairContext
  ): Promise<RepairResult> {
    const startTs = this.clock.now();
    const actionsTaken: RepairAction[] = [];
    let success = true;
    let error: string | undefined;

    for (const action of policy.actions) {
      try {
        await this.executeAction(action, context);
        actionsTaken.push(action);
      } catch (e) {
        success = false;
        error = e instanceof Error ? e.message : String(e);
        console.warn(`Repair action ${action.type} failed:`, error);
        // Continue with next action
      }
    }

    const durationMs = this.clock.now() - startTs;

    return {
      anomalyId: anomaly.id,
      actions: actionsTaken,
      success,
      durationMs,
      error,
    };
  }

  /** Execute a single repair action. */
  private async executeAction(action: RepairAction, context: RepairContext): Promise<void> {
    switch (action.type) {
      // Repair ladder actions (escalating)
      case 'param_fix':
        await this.executeParamFix(action, context);
        break;
      case 'precondition_subgoal':
        await this.executePreconditionSubgoal(action, context);
        break;
      case 'alternate_operator':
        await this.executeAlternateOperator(action, context);
        break;
      case 'explained_veto':
        await this.executeExplainedVeto(action, context);
        break;
      // Operational actions
      case 'restart_oracle':
        await this.restartOracle(action.target, action.params);
        break;
      case 'clear_cache':
        await this.clearCache(action.target, action.params);
        break;
      case 'reset_gate':
        await this.resetGate(action.target, action.params);
        break;
      case 'reduce_budget':
        this.reduceBudget(action.params);
        break;
      case 'increase_timeout':
        this.increaseTimeout(action.params);
        break;
      case 'fallback_faculty':
        await this.fallbackFaculty(action.target, action.params);
        break;
      case 'rollback_state':
        await this.rollbackState(action.params);
        break;
      case 'replan':
        await this.replan(context);
        break;
      case 'recalibrate':
        await this.recalibrate(action.params);
        break;
      case 'alert_human':
        this.alertHuman(action.params);
        break;
    }
  }

  /** Execute param fix — adjust a parameter value. */
  private async executeParamFix(action: RepairAction, _context: RepairContext): Promise<void> {
    const { parameter, newValue } = action.params as { parameter: string; newValue: unknown };
    console.log(`Param fix: ${parameter} = ${JSON.stringify(newValue)}`);
    // In a real implementation, this would update a config parameter
    // For now, emit an event for the parameter change
  }

  /** Execute precondition subgoal — create a subgoal to establish a precondition. */
  private async executePreconditionSubgoal(action: RepairAction, context: RepairContext): Promise<void> {
    const { subgoal } = action.params as { subgoal: string };
    console.log(`Precondition subgoal: ${subgoal}`);
    // S2 mints S1 work: create a WorkItem for the subgoal
    // This would be integrated with the task economy
    await this.mintSubgoalWork(context, subgoal, 'precondition');
  }

  /** Execute alternate operator — switch to a different operator/faculty. */
  private async executeAlternateOperator(action: RepairAction, context: RepairContext): Promise<void> {
    const { operator } = action.params as { operator: string };
    console.log(`Alternate operator: ${operator}`);
    // S2 mints S1 work: create a WorkItem for the alternate approach
    await this.mintSubgoalWork(context, operator, 'alternate');
  }

  /** Execute explained veto — veto an action with explanation. */
  private async executeExplainedVeto(action: RepairAction, context: RepairContext): Promise<void> {
    const { reason } = action.params as { reason: string };
    console.log(`Explained veto: ${reason}`);
    // S2 mints S1 work: create a WorkItem to document the veto rationale
    await this.mintSubgoalWork(context, reason, 'veto');
  }

  /** Mint a subgoal WorkItem into the task economy (S2 mints S1 work). */
  private async mintSubgoalWork(
    context: RepairContext,
    description: string,
    type: 'precondition' | 'alternate' | 'veto'
  ): Promise<void> {
    // This would integrate with the economy to create a WorkItem
    // For now, log the intent
    console.log(`[S2→S1] Minting ${type} subgoal: ${description}`);
    // In full implementation:
    // const workItem = createWorkItem({ type: 'repair_execution', ... });
    // economy.schedule(workItem);
  }

  /** Restart an oracle. */
  private async restartOracle(target: string, _params: Record<string, unknown>): Promise<void> {
    const { oracleRegistry } = await import('../oracles/oracle');
    const oracles = oracleRegistry.getAll();

    for (const oracle of oracles) {
      if (target === 'all' || oracle.provider === target || oracle.operation === target) {
        // Oracle restart would be implemented by the oracle itself
        console.log(`Restarting oracle: ${oracle.operation} (${oracle.provider})`);
      }
    }
  }

  /** Clear cache. */
  private async clearCache(target: string, _params: Record<string, unknown>): Promise<void> {
    // Clear memo/pin stores
    console.log(`Clearing cache: ${target}`);
  }

  /** Reset gate. */
  private async resetGate(target: string, _params: Record<string, unknown>): Promise<void> {
    console.log(`Resetting gate: ${target}`);
  }

  /** Reduce budget. */
  private reduceBudget(params: Record<string, unknown>): void {
    const factor = params.factor as number ?? 0.5;
    console.log(`Reducing budget by factor: ${factor}`);
  }

  /** Increase timeout. */
  private increaseTimeout(params: Record<string, unknown>): void {
    const factor = params.factor as number ?? 2;
    console.log(`Increasing timeout by factor: ${factor}`);
  }

  /** Fallback to symbolic faculty. */
  private async fallbackFaculty(target: string, _params: Record<string, unknown>): Promise<void> {
    console.log(`Falling back faculty: ${target}`);
  }

  /** Rollback state. */
  private async rollbackState(params: Record<string, unknown>): Promise<void> {
    const steps = params.steps as number ?? 5;
    console.log(`Rolling back state by ${steps} steps`);
  }

  /** Replan. */
  private async replan(context: RepairContext): Promise<void> {
    // Invoke planning faculty
    await facultyEngine.invoke({
      faculty: 'planning',
      primary: context.goals[0] ?? { term: 'replan' } as any,
      context: { maxResults: 3 },
      budget: 0.3,
    });
  }

  /** Recalibrate. */
  private async recalibrate(_params: Record<string, unknown>): Promise<void> {
    const { calibrationManager } = await import('../faculties/judgment/calibration');
    calibrationManager.recalibrate();
  }

  /** Alert human. */
  private alertHuman(params: Record<string, unknown>): void {
    const message = params.message as string ?? 'Alert';
    console.error(`ALERT: ${message}`);
  }

  /** Clean up completed repairs. */
  private cleanupCompletedRepairs(): void {
    for (const [id, result] of this.activeRepairs) {
      // In a real implementation, we'd check if repair is complete
      // For now, remove after one tick
      this.activeRepairs.delete(id);
    }
  }

  /** Get repair statistics. */
  getStats(): {
    activeRepairs: number;
    totalRepairs: number;
    successRate: number;
    avgDurationMs: number;
    anomaliesDetected: number;
  } {
    const successful = this.repairHistory.filter(r => r.success).length;
    const total = this.repairHistory.length;
    const avgDuration = total > 0
      ? this.repairHistory.reduce((sum, r) => sum + r.durationMs, 0) / total
      : 0;

    return {
      activeRepairs: this.activeRepairs.size,
      totalRepairs: total,
      successRate: total > 0 ? successful / total : 0,
      avgDurationMs: avgDuration,
      anomaliesDetected: this.anomalyHistory.length,
    };
  }

  /** Get recent anomalies. */
  getRecentAnomalies(limit = 10): Anomaly[] {
    return this.anomalyHistory.slice(-limit);
  }

  /** Get recent repairs. */
  getRecentRepairs(limit = 10): RepairResult[] {
    return this.repairHistory.slice(-limit);
  }

  /** Run the repair ladder for an anomaly (escalates through param_fix → precondition_subgoal → alternate_operator → explained_veto). */
  async runRepairLadder(anomaly: Anomaly, baseParams: Record<string, unknown> = {}): Promise<RepairResult> {
    const ladderActions = generateRepairLadder(anomaly, baseParams);
    const startTs = this.clock.now();
    let success = false;
    let error: string | undefined;
    const actionsTaken: RepairAction[] = [];

    for (const action of ladderActions) {
      try {
        await this.executeAction(action, anomaly.context);
        actionsTaken.push(action);
        // If action succeeds, we could stop here (escalation stops on success)
        // For ladder, we continue to document the full escalation path
        success = true;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        console.warn(`Repair ladder action ${action.type} failed:`, error);
        // Continue to next escalation step
      }
    }

    const durationMs = this.clock.now() - startTs;

    const result: RepairResult = {
      anomalyId: anomaly.id,
      actions: actionsTaken,
      success,
      durationMs,
      error,
    };

    this.repairHistory.push(result);
    if (this.repairHistory.length > 1000) this.repairHistory.shift();

    return result;
  }
}

/** Built-in anomaly detectors. */

export const stallDetector: AnomalyDetector = async (context): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];

  // Check for stall: no progress in recent iterations
  if (context.iteration > 10) {
    const recentTasks = context.recentTasks.slice(-5);
    const uniqueTerms = new Set(recentTasks.map(t => t.term.toString()));
    if (uniqueTerms.size < 2) {
      anomalies.push({
        type: 'stall',
        severity: 'medium',
        description: 'No progress in recent iterations - same terms repeating',
        detectedAt: context.clock.now(),
        context,
        suggestedRepairs: [],
        id: crypto.randomUUID(),
      });
    }
  }

  return anomalies;
};

export const divergenceDetector: AnomalyDetector = async (context): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];

  // Check for belief divergence: contradictory beliefs accumulating
  const beliefs = context.beliefs;
  let contradictions = 0;

  for (let i = 0; i < beliefs.length; i++) {
    for (let j = i + 1; j < beliefs.length; j++) {
      const t1 = beliefs[i]!.term.toString();
      const t2 = beliefs[j]!.term.toString();
      // Simple contradiction check
      if (t1.includes('not') && t2.includes(t1.replace('not', '').trim())) {
        contradictions++;
      }
    }
  }

  if (contradictions > 5) {
    anomalies.push({
      type: 'divergence',
      severity: 'high',
      description: `High contradiction count: ${contradictions}`,
      detectedAt: context.clock.now(),
      context,
      suggestedRepairs: [],
      id: crypto.randomUUID(),
    });
  }

  return anomalies;
};

export const resourceExhaustionDetector: AnomalyDetector = async (context): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];
  const { resources } = context;

  if (resources.memory > 1e9) { // 1GB
    anomalies.push({
      type: 'resource_exhaustion',
      severity: 'high',
      description: `Memory usage high: ${(resources.memory / 1e9).toFixed(2)}GB`,
      detectedAt: context.clock.now(),
      context,
      suggestedRepairs: [],
      id: crypto.randomUUID(),
    });
  }

  if (resources.tokensRemaining < resources.tokensUsed * 0.1) {
    anomalies.push({
      type: 'resource_exhaustion',
      severity: 'high',
      description: 'Token budget nearly exhausted',
      detectedAt: context.clock.now(),
      context,
      suggestedRepairs: [],
      id: crypto.randomUUID(),
    });
  }

  return anomalies;
};

export const oracleFailureDetector: AnomalyDetector = async (context): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];

  for (const oracle of context.oracleHealth) {
    if (!oracle.available || oracle.errorRate > 0.5) {
      anomalies.push({
        type: 'oracle_failure',
        severity: oracle.available ? 'medium' : 'high',
        description: `Oracle ${oracle.operation} unhealthy: available=${oracle.available}, errorRate=${oracle.errorRate.toFixed(2)}`,
        detectedAt: context.clock.now(),
        context,
        suggestedRepairs: [],
        id: crypto.randomUUID(),
      });
    }
  }

  return anomalies;
};

export const gateFailureDetector: AnomalyDetector = async (context): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];

  for (const gate of context.gateStates) {
    if (gate.consecutiveFailures > 3) {
      anomalies.push({
        type: 'gate_failure',
        severity: 'high',
        description: `Gate ${gate.name} failed ${gate.consecutiveFailures} times consecutively`,
        detectedAt: context.clock.now(),
        context,
        suggestedRepairs: [],
        id: crypto.randomUUID(),
      });
    }
  }

  return anomalies;
};

/** Create a repair loop with default detectors. */
export function createRepairLoop(
  config?: Partial<RepairLoopConfig>,
  options?: { clock?: Clock }
): RepairLoop {
  const loop = new RepairLoop(config, options);

  // Add default detectors
  loop.addDetector(stallDetector);
  loop.addDetector(divergenceDetector);
  loop.addDetector(resourceExhaustionDetector);
  loop.addDetector(oracleFailureDetector);
  loop.addDetector(gateFailureDetector);

  return loop;
}

/** Global repair loop instance (non-deterministic; prefer {@link createRepairLoop}). */
export const repairLoop = createRepairLoop();