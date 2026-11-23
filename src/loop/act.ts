/**
 * Loop Act — action execution and effect handling for the cognitive loop.
 */

import type { Term } from '../kernel/terms/term';
import type { Truth } from '../kernel/truth';
import type { Task, TaskType } from '../kernel/types';
import type { SelectionResult, SelectionCandidate } from './select';
import type { Clock } from '../kernel/env';
import { createDefaultClock } from '../kernel/env';
import { SenarsError } from '../errors/senars-error';


/** Action types. */
export const ACTION_TYPES = [
  'internal',
  'oracle',
  'motor',
  'communication',
  'memory',
  'meta',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/** Action status. */
export const ACTION_STATUS = [
  'pending',
  'executing',
  'completed',
  'failed',
  'cancelled',
] as const;

export type ActionStatus = (typeof ACTION_STATUS)[number];

/** Action definition. */
export interface Action {
  /** Unique ID. */
  id: string;
  /** Action type. */
  type: ActionType;
  /** The task representing this action. */
  task: Task;
  /** Parameters for execution. */
  params: Record<string, unknown>;
  /** Preconditions. */
  preconditions: ActionPrecondition[];
  /** Expected effects. */
  effects: ActionEffect[];
  /** Timeout (ms). */
  timeoutMs: number;
  /** Retry policy. */
  retry?: RetryPolicy;
  /** Compensation action (for rollback). */
  compensation?: Action;
}

/** Action precondition. */
export interface ActionPrecondition {
  /** Description. */
  description: string;
  /** Check function. */
  check: (context: ActContext) => Promise<boolean>;
  /** Whether violation is fatal. */
  fatal: boolean;
}

/** Action effect. */
export interface ActionEffect {
  /** Effect type. */
  type: 'belief_add' | 'belief_remove' | 'belief_update' | 'goal_add' | 'goal_remove' | 'goal_update' | 'external';
  /** Target term. */
  term: Term;
  /** New truth value (for updates). */
  truth?: Truth;
  /** Probability of effect occurring. */
  probability: number;
  /** Description. */
  description: string;
  /** Priority for execution ordering. */
  priority?: number;
}

/** Retry policy. */
export interface RetryPolicy {
  /** Max attempts. */
  maxAttempts: number;
  /** Base delay (ms). */
  baseDelayMs: number;
  /** Max delay (ms). */
  maxDelayMs: number;
  /** Backoff multiplier. */
  backoffMultiplier: number;
  /** Retryable error types. */
  retryableErrors: string[];
}

/** Default retry policy. */
export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: ['timeout', 'network', 'unavailable'],
};

/** Act context. */
export interface ActContext {
  /** Current beliefs. */
  beliefs: Task[];
  /** Current goals. */
  goals: Task[];
  /** Available budget. */
  budget: number;
  /** Oracle registry. */
  oracles: Map<string, any>;
  /** Memory interface. */
  memory: ActionMemory;
  /** Metadata. */
  metadata?: Record<string, unknown>;
}

/** Memory interface for actions. */
export interface ActionMemory {
  /** Store a belief. */
  storeBelief(task: Task): Promise<void>;
  /** Remove a belief. */
  removeBelief(term: Term): Promise<void>;
  /** Update a belief. */
  updateBelief(term: Term, truth: Truth): Promise<void>;
  /** Store a goal. */
  storeGoal(task: Task): Promise<void>;
  /** Remove a goal. */
  removeGoal(term: Term): Promise<void>;
  /** Query beliefs. */
  queryBeliefs(pattern: Term): Promise<Task[]>;
  /** Query goals. */
  queryGoals(pattern: Term): Promise<Task[]>;
}

/** Action execution result. */
export interface ActionResult {
  /** Action ID. */
  actionId: string;
  /** Status. */
  status: ActionStatus;
  /** Actual effects produced. */
  effects: ActionEffectResult[];
  /** Duration (ms). */
  durationMs: number;
  /** Error if failed. */
  error?: string;
  /** Oracle results. */
  oracleResults?: any[];
  /** Compensation needed. */
  needsCompensation: boolean;
}

/** Action effect result. */
export interface ActionEffectResult {
  /** Effect that was attempted. */
  effect: ActionEffect;
  /** Whether it succeeded. */
  succeeded: boolean;
  /** Actual result. */
  actual?: any;
  /** Error if failed. */
  error?: string;
}

/** Action executor. */
export class ActionExecutor {
  private context: ActContext;
  private activeActions = new Map<string, Action>();
  private executionHistory: ActionResult[] = [];
  private maxHistory = 1000;
  private clock: Clock;

  constructor(context: ActContext, clock?: Clock) {
    this.context = context;
    this.clock = clock ?? createDefaultClock();
  }

  /** Execute an action. */
  async execute(action: Action): Promise<ActionResult> {
    const startTs = this.clock.now();
    this.activeActions.set(action.id, action);

    // Check preconditions
    const precheck = await this.checkPreconditions(action);
    if (!precheck.passed) {
      const result: ActionResult = {
        actionId: action.id,
        status: 'failed',
        effects: [],
        durationMs: this.clock.now() - startTs,
        error: `Precondition failed: ${precheck.failed?.description}`,
        needsCompensation: false,
      };
      this.recordResult(result);
      this.activeActions.delete(action.id);
      return result;
    }

    // Execute with retries
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= (action.retry?.maxAttempts ?? defaultRetryPolicy.maxAttempts)) {
      try {
        const result = await this.executeOnce(action);
        this.recordResult(result);
        this.activeActions.delete(action.id);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new SenarsError(String(error), 'OPERATION_ERROR');
        attempt++;

        if (attempt <= (action.retry?.maxAttempts ?? defaultRetryPolicy.maxAttempts)) {
          const delay = this.computeDelay(attempt, action.retry ?? defaultRetryPolicy);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    const result: ActionResult = {
      actionId: action.id,
      status: 'failed',
      effects: [],
      durationMs: this.clock.now() - startTs,
      error: lastError?.message ?? 'Max retries exceeded',
      needsCompensation: this.needsCompensation(action),
    };

    this.recordResult(result);
    this.activeActions.delete(action.id);
    return result;
  }

  /** Execute action once (single attempt). */
  private async executeOnce(action: Action): Promise<ActionResult> {
    const startTs = this.clock.now();
    const effects: ActionEffectResult[] = [];
    let oracleResults: any[] = [];

    switch (action.type) {
      case 'internal':
        effects.push(...await this.executeInternal(action));
        break;
      case 'oracle': {
        const oracleResult = await this.executeOracle(action);
        oracleResults = oracleResult.oracleResults;
        effects.push(...oracleResult.effects);
        break;
      }
      case 'motor':
        effects.push(...await this.executeMotor(action));
        break;
      case 'communication':
        effects.push(...await this.executeCommunication(action));
        break;
      case 'memory':
        effects.push(...await this.executeMemory(action));
        break;
      case 'meta':
        effects.push(...await this.executeMeta(action));
        break;
    }

    // Apply effects to memory
    await this.applyEffects(effects);

    const allSucceeded = effects.every(e => e.succeeded);

    return {
      actionId: action.id,
      status: allSucceeded ? 'completed' : 'failed',
      effects,
      durationMs: this.clock.now() - startTs,
      error: allSucceeded ? undefined : effects.find(e => !e.succeeded)?.error,
      oracleResults,
      needsCompensation: !allSucceeded && this.needsCompensation(action),
    };
  }

  /** Check preconditions. */
  private async checkPreconditions(action: Action): Promise<{ passed: boolean; failed?: ActionPrecondition }> {
    for (const pre of action.preconditions) {
      try {
        const ok = await pre.check(this.context);
        if (!ok && pre.fatal) {
          return { passed: false, failed: pre };
        }
      } catch (error) {
        if (pre.fatal) {
          return { passed: false, failed: pre };
        }
      }
    }
    return { passed: true };
  }

  /** Execute internal action (belief/goal manipulation). */
  private async executeInternal(action: Action): Promise<ActionEffectResult[]> {
    const results: ActionEffectResult[] = [];

    for (const effect of action.effects) {
      try {
        let succeeded = false;
        let actual: any;

        switch (effect.type) {
          case 'belief_add':
            await this.context.memory.storeBelief({
              term: effect.term,
              type: 'belief' as TaskType,
              truth: effect.truth ?? { f: 0.5, c: 0.5 },
              priority: effect.priority ?? 0.5,
            });
            succeeded = true;
            break;
          case 'belief_remove':
            await this.context.memory.removeBelief(effect.term);
            succeeded = true;
            break;
          case 'belief_update':
            if (effect.truth) {
              await this.context.memory.updateBelief(effect.term, effect.truth);
              succeeded = true;
            }
            break;
          case 'goal_add':
            await this.context.memory.storeGoal({
              term: effect.term,
              type: 'goal' as TaskType,
              truth: effect.truth ?? { f: 0.5, c: 0.5 },
              priority: effect.priority ?? 0.5,
            });
            succeeded = true;
            break;
          case 'goal_remove':
            await this.context.memory.removeGoal(effect.term);
            succeeded = true;
            break;
          case 'goal_update':
            if (effect.truth) {
              await this.context.memory.storeGoal({
                term: effect.term,
                type: 'goal' as TaskType,
                truth: effect.truth,
                priority: effect.priority ?? 0.5,
              });
              succeeded = true;
            }
            break;
        }

        results.push({
          effect,
          succeeded,
          actual,
        });
      } catch (error) {
        results.push({
          effect,
          succeeded: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /** Execute oracle action. */
  private async executeOracle(action: Action): Promise<{ effects: ActionEffectResult[]; oracleResults: any[] }> {
    const effects: ActionEffectResult[] = [];
    const oracleResults: any[] = [];

    const oracleName = action.params.oracle as string;
    const operation = action.params.operation as string;
    const args = action.params.args as unknown[];

    // This would call the actual oracle
    // For now, simulate
    try {
      // const oracle = this.context.oracles.get(oracleName);
      // const result = await oracle.call({ operation, args });

      const result = { value: null, meta: { success: true } }; // Simulated
      oracleResults.push(result);

      // Convert oracle result to effects
      for (const effect of action.effects) {
        if (effect.type === 'external') {
          effects.push({
            effect,
            succeeded: true,
            actual: result.value,
          });
        }
      }
    } catch (error) {
      for (const effect of action.effects) {
        effects.push({
          effect,
          succeeded: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { effects, oracleResults };
  }

  /** Execute motor action (external actuation). */
  private async executeMotor(action: Action): Promise<ActionEffectResult[]> {
    const results: ActionEffectResult[] = [];

    for (const effect of action.effects) {
      try {
        // Motor actions would interface with actuators
        // Simulate success
        results.push({
          effect,
          succeeded: true,
          actual: { executed: true },
        });
      } catch (error) {
        results.push({
          effect,
          succeeded: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /** Execute communication action. */
  private async executeCommunication(action: Action): Promise<ActionEffectResult[]> {
    const results: ActionEffectResult[] = [];

    for (const effect of action.effects) {
      try {
        // Communication actions would send messages
        results.push({
          effect,
          succeeded: true,
          actual: { sent: true },
        });
      } catch (error) {
        results.push({
          effect,
          succeeded: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /** Execute memory action. */
  private async executeMemory(action: Action): Promise<ActionEffectResult[]> {
    // Memory actions are handled by internal executor
    return this.executeInternal(action);
  }

  /** Execute meta action (control flow). */
  private async executeMeta(action: Action): Promise<ActionEffectResult[]> {
    const results: ActionEffectResult[] = [];

    for (const effect of action.effects) {
      try {
        // Meta actions: replan, recalibrate, etc.
        results.push({
          effect,
          succeeded: true,
          actual: { meta: true },
        });
      } catch (error) {
        results.push({
          effect,
          succeeded: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /** Apply effects to memory. */
  private async applyEffects(effects: ActionEffectResult[]): Promise<void> {
    for (const effectResult of effects) {
      if (!effectResult.succeeded) continue;
      // Effects already applied during execution
      // This is a hook for post-processing
    }
  }

  /** Check if action needs compensation. */
  private needsCompensation(action: Action): boolean {
    // Actions with external effects or belief modifications need compensation
    return action.effects.some(e =>
      e.type === 'external' || e.type.startsWith('belief_') || e.type.startsWith('goal_')
    );
  }

  /** Compute retry delay. */
  private computeDelay(attempt: number, policy: RetryPolicy): number {
    const delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
    return Math.min(delay, policy.maxDelayMs);
  }

  /** Sleep utility. */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Record execution result. */
  private recordResult(result: ActionResult): void {
    this.executionHistory.push(result);
    if (this.executionHistory.length > this.maxHistory) {
      this.executionHistory.shift();
    }
  }

  /** Compensate for a failed action. */
  async compensate(action: Action): Promise<ActionResult[]> {
    if (!action.compensation) return [];

    // Execute compensation action
    const result = await this.execute(action.compensation);
    return [result];
  }

  /** Get execution history. */
  getHistory(limit = 50): ActionResult[] {
    return this.executionHistory.slice(-limit);
  }

  /** Get active actions. */
  getActiveActions(): Action[] {
    return Array.from(this.activeActions.values());
  }

  /** Get statistics. */
  getStats(): {
    totalExecuted: number;
    successRate: number;
    avgDurationMs: number;
    byType: Record<ActionType, { count: number; successRate: number }>;
  } {
    const byType: Record<ActionType, { count: number; success: number }> = {
      internal: { count: 0, success: 0 },
      oracle: { count: 0, success: 0 },
      motor: { count: 0, success: 0 },
      communication: { count: 0, success: 0 },
      memory: { count: 0, success: 0 },
      meta: { count: 0, success: 0 },
    };

    for (const result of this.executionHistory) {
      // Would need to track type in result
    }

    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(r => r.status === 'completed').length;

    return {
      totalExecuted: total,
      successRate: total > 0 ? successful / total : 0,
      avgDurationMs: total > 0
        ? this.executionHistory.reduce((sum, r) => sum + r.durationMs, 0) / total
        : 0,
      byType: Object.fromEntries(
        Object.entries(byType).map(([k, v]) => [
          k,
          { count: v.count, successRate: v.count > 0 ? v.success / v.count : 0 }
        ])
      ) as Record<ActionType, { count: number; successRate: number }>,
    };
  }
}

/** Create an action executor. */
export function createActionExecutor(context: ActContext): ActionExecutor {
  return new ActionExecutor(context);
}

/** Action factory — creates actions from selection results. */
export class ActionFactory {
  /** Create action from selection candidate. */
  static createFromCandidate(
    candidate: SelectionCandidate,
    params: Record<string, unknown> = {}
  ): Action {
    const action: Action = {
      id: crypto.randomUUID(),
      type: this.inferActionType(candidate),
      task: candidate.action,
      params,
      preconditions: this.generatePreconditions(candidate),
      effects: this.generateEffects(candidate),
      timeoutMs: 30000,
      retry: defaultRetryPolicy,
    };

    return action;
  }

  /** Infer action type from candidate. */
  private static inferActionType(candidate: SelectionCandidate): ActionType {
    const faculty = candidate.sourceFaculty;
    if (faculty === 'planning' || faculty === 'inference') return 'internal';
    if (faculty === 'communication') return 'communication';
    if (faculty === 'grounding') return 'oracle';
    if (faculty === 'evaluation') return 'meta';
    return 'internal';
  }

  /** Generate preconditions. */
  private static generatePreconditions(candidate: SelectionCandidate): ActionPrecondition[] {
    return [
      {
        description: 'Budget sufficient',
        check: async (context: ActContext) => context.budget >= candidate.cost,
        fatal: true,
      },
      {
        description: 'Action is valid',
        check: async () => candidate.action.term !== undefined,
        fatal: true,
      },
    ];
  }

  /** Generate effects. */
  private static generateEffects(candidate: SelectionCandidate): ActionEffect[] {
    const effects: ActionEffect[] = [];

    // Add primary effect based on action type
    const action = candidate.action;
    if (action.type === 'belief') {
      effects.push({
        type: 'belief_add',
        term: action.term,
        truth: action.truth,
        probability: candidate.confidence,
        description: `Add belief from ${candidate.sourceFaculty}`,
      });
    } else if (action.type === 'goal') {
      effects.push({
        type: 'goal_add',
        term: action.term,
        truth: action.truth,
        probability: candidate.confidence,
        description: `Add goal from ${candidate.sourceFaculty}`,
      });
    }

    return effects;
  }
}