/**
 * Loop Act — action execution and effect handling for the cognitive loop.
 */
import { createDefaultClock } from '../kernel/env';
import { SenarsError, isRetryableError } from '../errors/senars-error';
import { sleep } from '../util/async';
/** Action types. */
export const ACTION_TYPES = [
    'internal',
    'oracle',
    'motor',
    'communication',
    'memory',
    'meta',
];
/** Action status. */
export const ACTION_STATUS = [
    'pending',
    'executing',
    'completed',
    'failed',
    'cancelled',
];
/** Default retry policy. */
export const defaultRetryPolicy = {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableErrors: ['timeout', 'network', 'unavailable'],
};
/** Action executor. */
export class ActionExecutor {
    context;
    activeActions = new Map();
    executionHistory = [];
    maxHistory = 1000;
    clock;
    constructor(context, clock) {
        this.context = context;
        this.clock = clock ?? createDefaultClock();
    }
    /** Execute an action. */
    async execute(action) {
        const startTs = this.clock.now();
        this.activeActions.set(action.id, action);
        // Check preconditions
        const precheck = await this.checkPreconditions(action);
        if (!precheck.passed) {
            const result = {
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
        let lastError = null;
        while (attempt <= (action.retry?.maxAttempts ?? defaultRetryPolicy.maxAttempts)) {
            try {
                const result = await this.executeOnce(action);
                this.recordResult(result);
                this.activeActions.delete(action.id);
                return result;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new SenarsError(String(error), 'OPERATION_ERROR');
                attempt++;
                // Only retry if error is retryable (based on SenarsError.code or message fallback)
                if (attempt <= (action.retry?.maxAttempts ?? defaultRetryPolicy.maxAttempts) && isRetryableError(lastError)) {
                    const delay = this.computeDelay(attempt, action.retry ?? defaultRetryPolicy);
                    await sleep(delay);
                }
                else {
                    // Non-retryable error — fail immediately
                    break;
                }
            }
        }
        // All retries failed
        const result = {
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
    async executeOnce(action) {
        const startTs = this.clock.now();
        const effects = [];
        let oracleResults = [];
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
    async checkPreconditions(action) {
        for (const pre of action.preconditions) {
            try {
                const ok = await pre.check(this.context);
                if (!ok && pre.fatal) {
                    return { passed: false, failed: pre };
                }
            }
            catch (error) {
                if (pre.fatal) {
                    return { passed: false, failed: pre };
                }
            }
        }
        return { passed: true };
    }
    /** Execute internal action (belief/goal manipulation). */
    async executeInternal(action) {
        const results = [];
        for (const effect of action.effects) {
            try {
                let succeeded = false;
                let actual;
                switch (effect.type) {
                    case 'belief_add':
                        await this.context.memory.storeBelief({
                            term: effect.term,
                            type: 'belief',
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
                            type: 'goal',
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
                                type: 'goal',
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
            }
            catch (error) {
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
    async executeOracle(action) {
        const effects = [];
        const oracleResults = [];
        const oracleName = action.params.oracle;
        const operation = action.params.operation;
        const args = action.params.args;
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
        }
        catch (error) {
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
    async executeMotor(action) {
        const results = [];
        for (const effect of action.effects) {
            try {
                // Motor actions would interface with actuators
                // Simulate success
                results.push({
                    effect,
                    succeeded: true,
                    actual: { executed: true },
                });
            }
            catch (error) {
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
    async executeCommunication(action) {
        const results = [];
        for (const effect of action.effects) {
            try {
                // Communication actions would send messages
                results.push({
                    effect,
                    succeeded: true,
                    actual: { sent: true },
                });
            }
            catch (error) {
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
    async executeMemory(action) {
        // Memory actions are handled by internal executor
        return this.executeInternal(action);
    }
    /** Execute meta action (control flow). */
    async executeMeta(action) {
        const results = [];
        for (const effect of action.effects) {
            try {
                // Meta actions: replan, recalibrate, etc.
                results.push({
                    effect,
                    succeeded: true,
                    actual: { meta: true },
                });
            }
            catch (error) {
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
    async applyEffects(effects) {
        for (const effectResult of effects) {
            if (!effectResult.succeeded)
                continue;
            // Effects already applied during execution
            // This is a hook for post-processing
        }
    }
    /** Check if action needs compensation. */
    needsCompensation(action) {
        // Actions with external effects or belief modifications need compensation
        return action.effects.some(e => e.type === 'external' || e.type.startsWith('belief_') || e.type.startsWith('goal_'));
    }
    /** Compute retry delay. */
    computeDelay(attempt, policy) {
        const delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
        return Math.min(delay, policy.maxDelayMs);
    }
    /** Record execution result. */
    recordResult(result) {
        this.executionHistory.push(result);
        if (this.executionHistory.length > this.maxHistory) {
            this.executionHistory.shift();
        }
    }
    /** Compensate for a failed action. */
    async compensate(action) {
        if (!action.compensation)
            return [];
        // Execute compensation action
        const result = await this.execute(action.compensation);
        return [result];
    }
    /** Get execution history. */
    getHistory(limit = 50) {
        return this.executionHistory.slice(-limit);
    }
    /** Get active actions. */
    getActiveActions() {
        return Array.from(this.activeActions.values());
    }
    /** Get statistics. */
    getStats() {
        const byType = {
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
            byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [
                k,
                { count: v.count, successRate: v.count > 0 ? v.success / v.count : 0 }
            ])),
        };
    }
}
/** Create an action executor. */
export function createActionExecutor(context) {
    return new ActionExecutor(context);
}
/** Action factory — creates actions from selection results. */
export class ActionFactory {
    /** Create action from selection candidate. */
    static createFromCandidate(candidate, params = {}) {
        const action = {
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
    static inferActionType(candidate) {
        const faculty = candidate.sourceFaculty;
        if (faculty === 'planning' || faculty === 'inference')
            return 'internal';
        if (faculty === 'communication')
            return 'communication';
        if (faculty === 'grounding')
            return 'oracle';
        if (faculty === 'evaluation')
            return 'meta';
        return 'internal';
    }
    /** Generate preconditions. */
    static generatePreconditions(candidate) {
        return [
            {
                description: 'Budget sufficient',
                check: async (context) => context.budget >= candidate.cost,
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
    static generateEffects(candidate) {
        const effects = [];
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
        }
        else if (action.type === 'goal') {
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
