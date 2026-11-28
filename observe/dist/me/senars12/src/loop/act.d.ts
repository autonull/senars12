/**
 * Loop Act — action execution and effect handling for the cognitive loop.
 */
import type { Term } from '../kernel/terms';
import type { Truth } from '../kernel/truth';
import type { Task } from '../kernel/types';
import type { SelectionCandidate } from './select';
import type { Clock } from '../kernel/env';
/** Action types. */
export declare const ACTION_TYPES: readonly ['internal', 'oracle', 'motor', 'communication', 'memory', 'meta'];
export type ActionType = (typeof ACTION_TYPES)[number];
/** Action status. */
export declare const ACTION_STATUS: readonly ['pending', 'executing', 'completed', 'failed', 'cancelled'];
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
    /** @deprecated Retryability is now determined by {@link isRetryableError} based on SenarsError.code.
     * This field is kept for backward compatibility but is no longer used. */
    retryableErrors?: string[];
}
/** Default retry policy. */
export declare const defaultRetryPolicy: RetryPolicy;
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
export declare class ActionExecutor {
    private context;
    private activeActions;
    private executionHistory;
    private maxHistory;
    private clock;
    constructor(context: ActContext, clock?: Clock);
    /** Execute an action. */
    execute(action: Action): Promise<ActionResult>;
    /** Execute action once (single attempt). */
    private executeOnce;
    /** Check preconditions. */
    private checkPreconditions;
    /** Execute internal action (belief/goal manipulation). */
    private executeInternal;
    /** Execute oracle action. */
    private executeOracle;
    /** Execute motor action (external actuation). */
    private executeMotor;
    /** Execute communication action. */
    private executeCommunication;
    /** Execute memory action. */
    private executeMemory;
    /** Execute meta action (control flow). */
    private executeMeta;
    /** Apply effects to memory. */
    private applyEffects;
    /** Check if action needs compensation. */
    private needsCompensation;
    /** Compute retry delay. */
    private computeDelay;
    /** Record execution result. */
    private recordResult;
    /** Compensate for a failed action. */
    compensate(action: Action): Promise<ActionResult[]>;
    /** Get execution history. */
    getHistory(limit?: number): ActionResult[];
    /** Get active actions. */
    getActiveActions(): Action[];
    /** Get statistics. */
    getStats(): {
        totalExecuted: number;
        successRate: number;
        avgDurationMs: number;
        byType: Record<ActionType, {
            count: number;
            successRate: number;
        }>;
    };
}
/** Create an action executor. */
export declare function createActionExecutor(context: ActContext): ActionExecutor;
/** Action factory — creates actions from selection results. */
export declare class ActionFactory {
    /** Create action from selection candidate. */
    static createFromCandidate(candidate: SelectionCandidate, params?: Record<string, unknown>): Action;
    /** Infer action type from candidate. */
    private static inferActionType;
    /** Generate preconditions. */
    private static generatePreconditions;
    /** Generate effects. */
    private static generateEffects;
}
//# sourceMappingURL=act.d.ts.map