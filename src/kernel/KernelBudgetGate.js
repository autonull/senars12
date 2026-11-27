import { budgetAffords, budgetLimit, budgetRefusal, budgetRemaining, chargeBudget, createBudget, freshBudget, isCapacityExhausted, sliceConsumedPayload, sliceCreatedPayload, sliceExhaustedPayload, sliceMergedPayload, snapshotBudget, zeroConsumed, } from '../budget/index';
import { mintCognitiveEvent } from '../schemas/cognitive-events';
import { validateReasoningBudget } from '../schemas/reasoning-budget';
import { keyedBy, mapValues } from '../util/collections';
import { BUDGET_SCOPES, withBudgetId } from './budget-scopes';
import { KernelGate, projectOutcome } from './gate-base';
import { BUDGET_TYPES_MAP } from '@senars/schemas';
/**
 * The operation table: one row per operation, stating what it spends and what it
 * costs. The A7 control scopes are derived rather than restated — the scope table
 * owns the dimension, the ceiling key and the overflow reason — so an operation was
 * previously declared twice: once to price it and once to say what it spends.
 */
const OPERATION_SPECS = {
    ...keyedBy(Object.values(BUDGET_SCOPES), (scope) => scope.operation, (scope) => ({ resource: scope.consumedKey, cost: 1 })),
    'nal-step': { resource: 'cycles', cost: 1 },
    'lm-call': { resource: 'llmCalls', cost: 10 },
    'memory-op': { resource: 'memoryOps', cost: 1 },
    'derivation-depth': { resource: 'depth', cost: 1 },
    'systemone-judgment': { resource: 'llmCalls', cost: 5 },
};
/** The price of every operation, read off the table that says what each one spends. */
const DEFAULT_COST_TABLE = mapValues(OPERATION_SPECS, (spec) => spec.cost);
/**
 * What an operation spends. `BudgetOperation` is a closed enum, so an absent spec
 * is only reachable from a cast: an operation with no declared dimension is
 * granted and charged nothing rather than guessed onto one — the old fallback put
 * it on `depth` while reporting `cycles` and refusing with `backpressure`.
 */
const specOf = (operation) => OPERATION_SPECS[operation];
/** The one budget a NAR starts from; the gate's own default and every NAR's initial budget. */
const NAR_BUDGET_LIMITS = {
    maxCycles: 1000,
    maxDepth: 100,
    maxMemoryOps: 10000,
    maxLMCalls: 50,
};
export const createDefaultReasoningBudget = () => createBudget(NAR_BUDGET_LIMITS);
export class KernelBudgetGate extends KernelGate {
    budget;
    budgetId;
    scopes = new Map();
    costTable;
    eventBus;
    outcomeOf(output) {
        return projectOutcome(output, (o) => o.granted, (o) => o.terminationReason);
    }
    constructor(config) {
        super();
        this.costTable = { ...DEFAULT_COST_TABLE, ...config?.costTable };
        this.eventBus = config?.eventBus;
        this.budgetId = config?.defaultBudget?.id ?? 'root';
        this.budget = this.adopt(config?.defaultBudget ?? createDefaultReasoningBudget());
    }
    /** Emit a budget slice created event. */
    emitSliceCreated(sliceId, parentId, limits) {
        this.eventBus?.emit('budget:slice:created', sliceCreatedPayload(sliceId, parentId, limits));
    }
    /** Emit a budget slice consumed event. */
    emitSliceConsumed(sliceId, resource, amount, budget) {
        this.eventBus?.emit('budget:slice:consumed', sliceConsumedPayload(sliceId, resource, amount, budget));
    }
    /** Emit a budget slice exhausted event. */
    emitSliceExhausted(sliceId, reason, budget) {
        this.eventBus?.emit('budget:slice:exhausted', sliceExhaustedPayload(sliceId, reason, budget));
    }
    /** Emit a budget slice merged event. */
    emitSliceMerged(parentId, childId, childBudget) {
        this.eventBus?.emit('budget:slice:merged', sliceMergedPayload(parentId, childId, childBudget));
    }
    /** Validate at the boundary where a budget enters the gate, never on the per-operation read path. */
    adopt(budget) {
        validateReasoningBudget(budget);
        return withBudgetId(budget, this.budgetId);
    }
    resolveBudget(input) {
        if (input.budget)
            return { budget: this.adopt(input.budget), sliceId: 'inline' };
        if (!input.scopeId)
            return { budget: this.budget, sliceId: this.budgetId };
        const scoped = this.scopes.get(input.scopeId) ?? withBudgetId(freshBudget(this.budget), input.scopeId);
        this.scopes.set(input.scopeId, scoped);
        return { budget: scoped, sliceId: input.scopeId };
    }
    /** Consumed LM-call units for a named scope (B7 flow-level accounting observability). */
    getScopeConsumed(scopeId) {
        return this.scopes.get(scopeId)?.consumed.llmCalls ?? 0;
    }
    check(input) {
        return this.decideAndRecord('budget', input.operation, input, (inp, correlation) => this.decideBudget(inp, correlation), (inp) => inp.correlationId);
    }
    decideBudget(input, correlation) {
        const operation = input.operation;
        const spec = specOf(operation);
        const estimatedCost = input.estimatedCost ?? this.costTable[operation] ?? 1;
        const resource = spec?.resource;
        const { budget, sliceId } = this.resolveBudget(input);
        const granted = resource ? budgetAffords(budget, resource, estimatedCost) : true;
        budget.terminationReason = undefined;
        if (!granted && resource) {
            const terminationReason = budgetRefusal(budget, resource);
            // The refusal lives on the budget, not only on the event: `getSpendSummary`
            // reads `terminationReason` per scope, and an event nobody joins reports 'none'
            // for a scope that just refused a charge (TODO33 §5.P3.10).
            budget.terminationReason = terminationReason;
            this.emitSliceExhausted(sliceId, terminationReason, budget);
            const event = mintCognitiveEvent('budget.exhausted', {
                engine: 'kernel',
                correlationId: correlation(),
                payload: {
                    budgetType: BUDGET_TYPES_MAP[resource],
                    remaining: budgetRemaining(budget, resource),
                    limit: budgetLimit(budget, resource),
                    terminationReason,
                },
            });
            this.emitEvent(event);
            return {
                granted: false,
                terminationReason,
                updatedBudget: budget,
            };
        }
        if (resource) {
            chargeBudget(budget, resource, estimatedCost);
            this.emitSliceConsumed(sliceId, resource, estimatedCost, budget);
        }
        return { granted: true, updatedBudget: budget };
    }
    getBudget() {
        return snapshotBudget(this.budget);
    }
    setBudget(budget) {
        this.budget = this.adopt(budget);
    }
    resetBudget() {
        this.budget = createDefaultReasoningBudget();
        this.scopes.clear();
    }
    createScope(scopeId, budget) {
        const scopeBudget = withBudgetId(budget ? this.adopt(budget) : freshBudget(this.budget), scopeId);
        this.scopes.set(scopeId, scopeBudget);
        this.emitSliceCreated(scopeId, this.budgetId, scopeBudget);
    }
    /**
     * Zero an open scope's consumption, keeping the ceilings it was opened with.
     *
     * A per-cycle bound is re-opened every cycle, and re-opening went through
     * `createScope` with a budget rebuilt from the gate's own — two copies to read
     * it, one spread to reshape it, and a zod validation of an object the gate had
     * just constructed, six times per cycle. The ceilings are fixed when a scope
     * opens, so only the counters move.
     */
    resetConsumption(scopeId) {
        const scope = this.scopes.get(scopeId);
        if (!scope)
            return;
        scope.consumed = zeroConsumed();
        scope.terminationReason = undefined;
    }
    releaseScope(scopeId) {
        this.scopes.delete(scopeId);
    }
    getScopeBudget(scopeId) {
        return this.scopes.get(scopeId);
    }
    isExhausted(operation) {
        return operation
            ? this.getRemaining(this.budget, operation) <= 0
            : isCapacityExhausted(this.budget);
    }
    getRemaining(budget, operation) {
        const spec = specOf(operation);
        return spec ? budgetRemaining(budget, spec.resource) : Number.POSITIVE_INFINITY;
    }
}
