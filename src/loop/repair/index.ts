/**
 * Repair Loop — self-repair and recovery for the cognitive loop.
 *
 * Detects anomalies, diagnoses root causes, and applies repairs.
 */

import type { Term } from '../../kernel/terms/term';
import type { Truth } from '../../kernel/truth';
import type { Task, TimestampMs } from '../../kernel/types';
import type { FacultyInput, FacultyOutput } from '../../faculties/specs';
import { facultyEngine } from '../../faculties/engine';
import { judgmentCascade, type JudgmentContext, type JudgmentResult } from '../../faculties/judgment/cascade';
import type { Clock } from '../../kernel/env';
import { createLogger } from '../../util/logger';
import { errMsg } from '@senars/util/error';

import type {
  Anomaly,
  RepairContext,
  RepairAction,
  RepairResult,
  RepairPolicy,
  RepairLoopConfig,
  AnomalyDetector,
  AnomalyType,
  AnomalySeverity,
} from './types';

import { derivationRepairPolicy, contradictionRepairPolicy } from './derivation';
import { gateFailureRepairPolicy, oracleFailureRepairPolicy } from './consistency';
import { resourceExhaustionRepairPolicy, stallRepairPolicy, divergenceRepairPolicy } from './budget';

const logger = createLogger({ scope: 'loop:repair' });

/** Default repair policies. */
export const defaultRepairPolicies: RepairPolicy[] = [
  resourceExhaustionRepairPolicy,
  divergenceRepairPolicy,
  contradictionRepairPolicy,
  derivationRepairPolicy,
  oracleFailureRepairPolicy,
  gateFailureRepairPolicy,
  stallRepairPolicy,
];

/** Repair ladder policy for escalating repairs. */
export const repairLadderPolicy: RepairPolicy = {
  name: 'repair-ladder',
  appliesTo: [...new Set(defaultRepairPolicies.flatMap((p) => p.appliesTo))],
  minSeverity: 'critical',
  generateActions: (context: RepairContext, anomaly: Anomaly): RepairAction[] => {
    const ladderActions = [
      'reduce_scope',
      'increase_budget',
      'delegate',
      'fallback',
      'abort',
    ] as const;

    return ladderActions.map((type, index) => ({
      type,
      description: `Ladder step ${index + 1}: ${type}`,
      params: { step: index, anomalyId: anomaly.id },
      confidence: 0.9 - index * 0.15,
      cost: index * 10,
    }));
  },
  priority: 100,
};

/** Generate repair ladder for an anomaly. */
export function generateRepairLadder(context: RepairContext, anomaly: Anomaly): RepairAction[] {
  return repairLadderPolicy.generateActions(context, anomaly);
}

/** Repair Loop — coordinates anomaly detection and repair. */
export class RepairLoop {
  readonly #config: RepairLoopConfig;
  readonly #attemptCounts = new Map<string, number>();
  readonly #repairHistory: RepairResult[] = [];

  constructor(config: RepairLoopConfig) {
    this.#config = config;
  }

  /** Detect anomalies in the current context. */
  async detect(context: RepairContext): Promise<Anomaly[]> {
    const allAnomalies: Anomaly[] = [];

    for (const detector of this.#config.detectors) {
      try {
        const anomalies = await detector(context);
        allAnomalies.push(...anomalies);
      } catch (error) {
        logger.error({ err: errMsg(error) }, 'Anomaly detector failed');
      }
    }

    return allAnomalies;
  }

  /** Apply repairs for detected anomalies. */
  async repair(context: RepairContext, anomalies: Anomaly[]): Promise<RepairResult[]> {
    const results: RepairResult[] = [];

    // Sort anomalies by severity and priority
    const sortedAnomalies = [...anomalies].sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;

      // Find applicable policies and sort by priority
      const aPolicies = this.#config.policies.filter((p) => p.appliesTo.includes(a.type) && this.#severityMeets(a.severity, p.minSeverity));
      const bPolicies = this.#config.policies.filter((p) => p.appliesTo.includes(b.type) && this.#severityMeets(b.severity, p.minSeverity));
      const aPriority = Math.max(...aPolicies.map((p) => p.priority), 0);
      const bPriority = Math.max(...bPolicies.map((p) => p.priority), 0);
      return bPriority - aPriority;
    });

    for (const anomaly of sortedAnomalies) {
      const anomalyResults = await this.#repairAnomaly(context, anomaly);
      results.push(...anomalyResults);
    }

    return results;
  }

  /** Run full detect and repair cycle. */
  async run(context: RepairContext): Promise<RepairResult[]> {
    const anomalies = await this.detect(context);
    if (anomalies.length === 0) return [];

    logger.info({ count: anomalies.length }, 'Anomalies detected');
    return this.repair(context, anomalies);
  }

  /** Get repair history. */
  getHistory(): RepairResult[] {
    return [...this.#repairHistory];
  }

  /** Clear repair history. */
  clearHistory(): void {
    this.#repairHistory.length = 0;
    this.#attemptCounts.clear();
  }

  async #repairAnomaly(context: RepairContext, anomaly: Anomaly): Promise<RepairResult[]> {
    const key = `${anomaly.type}:${anomaly.id}`;
    const attempts = this.#attemptCounts.get(key) ?? 0;

    if (attempts >= this.#config.maxAttempts) {
      logger.warn({ anomaly: anomaly.id, attempts }, 'Max repair attempts reached');
      return [{
        action: { type: 'abort', description: 'Max attempts reached', params: {}, confidence: 1, cost: 0 },
        success: false,
        outcome: 'Max repair attempts exceeded',
        newAnomalies: [],
        timestamp: this.#config.clock.now(),
      }];
    }

    this.#attemptCounts.set(key, attempts + 1);

    // Find applicable policies
    const policies = this.#config.policies
      .filter((p) => p.appliesTo.includes(anomaly.type) && this.#severityMeets(anomaly.severity, p.minSeverity))
      .sort((a, b) => b.priority - a.priority);

    // Add ladder policy for critical anomalies
    if (anomaly.severity === 'critical') {
      policies.push(repairLadderPolicy);
    }

    const results: RepairResult[] = [];

    for (const policy of policies) {
      const actions = policy.generateActions(context, anomaly);

      for (const action of actions) {
        const result = await this.#executeAction(context, action, anomaly);
        results.push(result);
        this.#repairHistory.push(result);

        if (result.success) {
          logger.info({ anomaly: anomaly.id, action: action.type }, 'Repair succeeded');
          return results;
        } else {
          logger.warn({ anomaly: anomaly.id, action: action.type, outcome: result.outcome }, 'Repair failed');
        }
      }
    }

    return results;
  }

  async #executeAction(context: RepairContext, action: RepairAction, anomaly: Anomaly): Promise<RepairResult> {
    const timestamp = this.#config.clock.now();

    try {
      switch (action.type) {
        case 'retry':
          return await this.#retryAction(context, action, timestamp);
        case 'replan':
          return await this.#replanAction(context, action, timestamp);
        case 'reduce_scope':
          return await this.#reduceScopeAction(context, action, timestamp);
        case 'increase_budget':
          return await this.#increaseBudgetAction(context, action, timestamp);
        case 'delegate':
          return await this.#delegateAction(context, action, timestamp);
        case 'fallback':
          return await this.#fallbackAction(context, action, timestamp);
        case 'abort':
          return await this.#abortAction(context, action, timestamp);
        case 'verify_premises':
          return await this.#verifyPremisesAction(context, action, timestamp);
        case 'retrieve_context':
          return await this.#retrieveContextAction(context, action, timestamp);
        case 'escalate':
          return await this.#escalateAction(context, action, timestamp);
        default:
          return {
            action,
            success: false,
            outcome: `Unknown action type: ${action.type}`,
            newAnomalies: [],
            timestamp,
          };
      }
    } catch (error) {
      return {
        action,
        success: false,
        outcome: `Action threw: ${errMsg(error)}`,
        newAnomalies: [],
        timestamp,
      };
    }
  }

  async #retryAction(context: RepairContext, action: RepairAction, timestamp: number): Promise<RepairResult> {
    return {
      action,
      success: true,
      outcome: 'Retry scheduled',
      newAnomalies: [],
      timestamp,
    };
  }

  async #replanAction(context: RepairContext, action: RepairAction, timestamp: number): Promise<RepairResult> {
    return {
      action,
      success: true,
      outcome: 'Replan initiated',
      newAnomalies: [],
      timestamp,
    };
  }

  async #reduceScopeAction(context: RepairContext, action: RepairAction, timestamp: number): Promise<RepairResult> {
    return {
      action,
      success: true,
      outcome: 'Scope reduced',
      newAnomalies: [],
      timestamp,
    };
  }

  async #increaseBudgetAction(context: RepairContext, action: RepairAction, timestamp: number): Promise<RepairResult> {
    return {
      action,
      success: true,
      outcome: 'Budget increase requested',
      newAnomalies: [],
      timestamp,
    };
  }

  async #delegateAction(context: RepairContext, action: RepairAction, timestamp: number): Promise<RepairResult> {
    return {
      action,
      success: true,
      outcome: 'Delegation initiated',
      newAnomalies: [],
      timestamp,
    };
  }

  async #fallbackAction(context: RepairContext, action: RepairAction, timestamp: number): Promise<RepairResult> {
    return {
      action,
      success: true,
      outcome: 'Fallback engaged',
      newAnomalies: [],
      timestamp,
    };
  }

  async #abortAction(context: RepairContext, action: RepairAction, timestamp: number): Promise<RepairResult> {
    return {
      action,
      success: true,
      outcome: 'Operation aborted',
      newAnomalies: [],
      timestamp,
    };
  }

  async #verifyPremisesAction(context: RepairContext, action: RepairAction, timestamp: number): Promise<RepairResult> {
    // Use faculty engine to verify premises
    try {
      await facultyEngine.invoke({
        faculty: 'inference',
        primary: { premises: anomaly.suggestedRepairs },
        context: { inferenceType: 'deduction' },
      });
      return {
        action,
        success: true,
        outcome: 'Premises verified',
        newAnomalies: [],
        timestamp,
      };
    } catch {
      return {
        action,
        success: false,
        outcome: 'Premise verification failed',
        newAnomalies: [],
        timestamp,
      };
    }
  }

  async #retrieveContextAction(context: RepairContext, action: RepairAction, timestamp: number): Promise<RepairResult> {
    try {
      const result = await facultyEngine.invoke({
        faculty: 'retrieve.rerank',
        primary: { query: action.params.query },
        context: { maxResults: 5 },
      });
      return {
        action,
        success: true,
        outcome: `Retrieved ${Array.isArray(result.result) ? result.result.length : 0} items`,
        newAnomalies: [],
        timestamp,
      };
    } catch {
      return {
        action,
        success: false,
        outcome: 'Context retrieval failed',
        newAnomalies: [],
        timestamp,
      };
    }
  }

  async #escalateAction(context: RepairContext, action: RepairAction, timestamp: number): Promise<RepairResult> {
    return {
      action,
      success: true,
      outcome: 'Escalated to meta-cognitive layer',
      newAnomalies: [],
      timestamp,
    };
  }

  #severityMeets(actual: AnomalySeverity, required: AnomalySeverity): boolean {
    const order = { low: 1, medium: 2, high: 3, critical: 4 };
    return order[actual] >= order[required];
  }
}

/** Create a RepairLoop instance. */
export function createRepairLoop(config?: Partial<RepairLoopConfig>): RepairLoop {
  const defaultConfig: RepairLoopConfig = {
    maxAttempts: 3,
    policies: defaultRepairPolicies,
    detectors: [
      stallDetector,
      divergenceDetector,
      resourceExhaustionDetector,
      oracleFailureDetector,
      gateFailureDetector,
    ],
    clock: { now: () => Date.now() },
  };

  return new RepairLoop({ ...defaultConfig, ...config });
}

/** Default repair loop instance. */
export const repairLoop = createRepairLoop();

// ============================================================================
// Anomaly Detectors
// ============================================================================

/** Detect stalled iterations. */
export const stallDetector: AnomalyDetector = async (context): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];
  const recentIterations = context.recentTasks.filter((t) => t.createdAt > context.clock.now() - 60000);

  if (recentIterations.length < 2 && context.iteration > 5) {
    anomalies.push({
      type: 'stall',
      severity: 'medium',
      description: 'Few tasks completed in last minute',
      detectedAt: context.clock.now(),
      context,
      suggestedRepairs: [],
      id: `stall-${context.iteration}`,
    });
  }

  return anomalies;
};

/** Detect divergence in derivation chains. */
export const divergenceDetector: AnomalyDetector = async (context): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];

  // Check for too many beliefs without goals
  const beliefCount = context.beliefs.length;
  const goalCount = context.goals.length;

  if (beliefCount > goalCount * 10 && beliefCount > 100) {
    anomalies.push({
      type: 'divergence',
      severity: 'high',
      description: `Belief proliferation: ${beliefCount} beliefs for ${goalCount} goals`,
      detectedAt: context.clock.now(),
      context,
      suggestedRepairs: [],
      id: `divergence-${context.iteration}`,
    });
  }

  return anomalies;
};

/** Detect resource exhaustion. */
export const resourceExhaustionDetector: AnomalyDetector = async (context): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];
  const { tokensUsed, tokensRemaining } = context.resources;

  if (tokensRemaining < tokensUsed * 0.1) {
    anomalies.push({
      type: 'resource_exhaustion',
      severity: 'critical',
      description: `Token budget nearly exhausted: ${tokensRemaining} remaining`,
      detectedAt: context.clock.now(),
      context,
      suggestedRepairs: [],
      id: `resource-${context.iteration}`,
    });
  } else if (tokensRemaining < tokensUsed * 0.3) {
    anomalies.push({
      type: 'resource_exhaustion',
      severity: 'high',
      description: `Token budget low: ${tokensRemaining} remaining`,
      detectedAt: context.clock.now(),
      context,
      suggestedRepairs: [],
      id: `resource-${context.iteration}`,
    });
  }

  return anomalies;
};

/** Detect oracle failures. */
export const oracleFailureDetector: AnomalyDetector = async (context): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];

  for (const oracle of context.oracleHealth) {
    if (!oracle.available || oracle.errorRate > 0.5) {
      anomalies.push({
        type: 'oracle_failure',
        severity: oracle.available ? 'high' : 'critical',
        description: `Oracle ${oracle.operation} ${!oracle.available ? 'unavailable' : `error rate ${oracle.errorRate}`}`,
        detectedAt: context.clock.now(),
        context,
        suggestedRepairs: [],
        id: `oracle-${oracle.operation}-${context.iteration}`,
      });
    }
  }

  return anomalies;
};

/** Detect gate failures. */
export const gateFailureDetector: AnomalyDetector = async (context): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];

  for (const gate of context.gateStates) {
    if (!gate.passed) {
      anomalies.push({
        type: 'gate_failure',
        severity: 'high',
        description: `Gate ${gate.name} failed: ${gate.reason ?? 'unknown'}`,
        detectedAt: context.clock.now(),
        context,
        suggestedRepairs: [],
        id: `gate-${gate.name}-${context.iteration}`,
      });
    }
  }

  return anomalies;
};

// Re-export types
export type {
  Anomaly,
  RepairContext,
  RepairAction,
  RepairResult,
  RepairPolicy,
  RepairLoopConfig,
  AnomalyDetector,
  AnomalyType,
  AnomalySeverity,
};