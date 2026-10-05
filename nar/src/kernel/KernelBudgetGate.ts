import {
  BUDGET_TYPES,
  type BudgetLimits,
  type BudgetResource,
  budgetAffords,
  budgetLimit,
  budgetRefusal,
  budgetRemaining,
  chargeBudget,
  createBudget,
  isCapacityExhausted,
  snapshotBudget,
  zeroConsumed,
} from '@senars/core/budget';
import type {
  BudgetExhaustedEvent,
  BudgetGateInput,
  BudgetGateOutput,
  CognitiveEvent,
  GateOutcome,
  ReasoningBudget,
  TerminationReason,
} from '@senars/core/schemas';
import { mintCognitiveEvent, validateReasoningBudget } from '@senars/core/schemas';
import { keyedBy, mapValues } from '@senars/util';
import { BUDGET_SCOPES } from './budget-scopes.js';
import { KernelGate, projectOutcome } from './gate-base.js';

export interface KernelBudgetGateConfig {
  defaultBudget: ReasoningBudget;
  costTable: Record<string, number>;
}

/** What an operation spends: which budget dimension, the event's own name for that
 *  dimension, and its default cost. The dimension, its ceiling key and its exhaustion
 *  reason all come from `core/budget`'s one table, so the gate cannot charge a
 *  dimension the engine does not; only the event's name and the price are its own. */
interface OperationSpec {
  readonly resource: BudgetResource;
  readonly budgetType: BudgetExhaustedEvent['payload']['budgetType'];
  readonly cost: number;
}

/**
 * The operation table: one row per operation, stating what it spends and what it
 * costs. The A7 control scopes are derived rather than restated — the scope table
 * owns the dimension, the ceiling key and the overflow reason — so an operation was
 * previously declared twice: once to price it and once to say what it spends.
 */
const OPERATION_SPECS: Record<string, OperationSpec> = {
  ...keyedBy(
    Object.values(BUDGET_SCOPES),
    (scope) => scope.operation,
    (scope) => ({
      resource: scope.consumedKey,
      budgetType: BUDGET_TYPES[scope.consumedKey],
      cost: 1,
    })
  ),
  'nal-step': { resource: 'cycles', budgetType: 'cycles', cost: 1 },
  'lm-call': { resource: 'llmCalls', budgetType: 'llm', cost: 10 },
  'memory-op': { resource: 'memoryOps', budgetType: 'memory', cost: 1 },
  'derivation-depth': { resource: 'depth', budgetType: 'depth', cost: 1 },
  'systemone-judgment': { resource: 'llmCalls', budgetType: 'llm', cost: 5 },
};

/** The price of every operation, read off the table that says what each one spends. */
const DEFAULT_COST_TABLE: Record<string, number> = mapValues(OPERATION_SPECS, (spec) => spec.cost);

/**
 * What an operation spends. `BudgetOperation` is a closed enum, so an absent spec
 * is only reachable from a cast: an operation with no declared dimension is
 * granted and charged nothing rather than guessed onto one — the old fallback put
 * it on `depth` while reporting `cycles` and refusing with `backpressure`.
 */
const specOf = (operation: string): OperationSpec | undefined => OPERATION_SPECS[operation];

/** The one budget a NAR starts from; the gate's own default and every NAR's initial budget. */
const NAR_BUDGET_LIMITS = {
  maxCycles: 1000,
  maxDepth: 100,
  maxMemoryOps: 10000,
  maxLMCalls: 50,
} as const satisfies BudgetLimits;

export const createDefaultReasoningBudget = (): ReasoningBudget => createBudget(NAR_BUDGET_LIMITS);

export class KernelBudgetGate extends KernelGate<BudgetExhaustedEvent> {
  private budget: ReasoningBudget;
  private scopes = new Map<string, ReasoningBudget>();
  private costTable: Record<string, number>;

  protected override outcomeOf(output: unknown): GateOutcome {
    return projectOutcome<BudgetGateOutput>(
      output,
      (o) => o.granted,
      (o) => o.terminationReason
    );
  }

  constructor(config?: Partial<KernelBudgetGateConfig>) {
    super();
    this.costTable = { ...DEFAULT_COST_TABLE, ...config?.costTable };
    this.budget = this.adopt(config?.defaultBudget ?? createDefaultReasoningBudget());
  }

  /** Validate at the boundary where a budget enters the gate, never on the per-operation read path. */
  private adopt(budget: ReasoningBudget): ReasoningBudget {
    validateReasoningBudget(budget);
    return budget;
  }

  private freshCounters(): ReasoningBudget {
    return { ...this.budget, consumed: zeroConsumed(), terminationReason: undefined };
  }

  private resolveBudget(input: BudgetGateInput): ReasoningBudget {
    if (input.budget) return this.adopt(input.budget);
    if (!input.scopeId) return this.budget;
    let scoped = this.scopes.get(input.scopeId);
    if (!scoped) {
      scoped = this.freshCounters();
      this.scopes.set(input.scopeId, scoped);
    }
    return scoped;
  }

  /** Consumed LM-call units for a named scope (B7 flow-level accounting observability). */
  getScopeConsumed(scopeId: string): number {
    return this.scopes.get(scopeId)?.consumed.llmCalls ?? 0;
  }

  check(input: BudgetGateInput): BudgetGateOutput {
    return this.decideAndRecord(
      'budget',
      input.operation,
      input,
      (inp, correlation) => this.decideBudget(inp, correlation),
      (inp) => inp.correlationId
    );
  }

  private decideBudget(input: BudgetGateInput, correlation: () => string): BudgetGateOutput {
    const operation = input.operation;
    const spec = specOf(operation);
    const estimatedCost = input.estimatedCost ?? this.costTable[operation] ?? 1;
    const resource = spec?.resource;

    const budget = this.resolveBudget(input);
    const granted = resource ? budgetAffords(budget, resource, estimatedCost) : true;
    budget.terminationReason = undefined;

    if (!granted && resource) {
      const terminationReason = budgetRefusal(budget, resource);
      // The refusal lives on the budget, not only on the event: `getSpendSummary`
      // reads `terminationReason` per scope, and an event nobody joins reports 'none'
      // for a scope that just refused a charge (TODO33 §5.P3.10).
      budget.terminationReason = terminationReason;
      const event = mintCognitiveEvent('budget.exhausted', {
        engine: 'kernel',
        correlationId: correlation(),
        payload: {
          budgetType: spec.budgetType,
          remaining: budgetRemaining(budget, resource),
          limit: budgetLimit(budget, resource),
          terminationReason:
            terminationReason as BudgetExhaustedEvent['payload']['terminationReason'],
        },
      });
      this.emitEvent(event);

      return {
        granted: false,
        terminationReason:
          terminationReason as BudgetExhaustedEvent['payload']['terminationReason'],
        updatedBudget: budget,
      };
    }

    if (resource) chargeBudget(budget, resource, estimatedCost);

    return { granted: true, updatedBudget: budget };
  }

  getBudget(): Readonly<ReasoningBudget> {
    return snapshotBudget(this.budget);
  }

  setBudget(budget: ReasoningBudget): void {
    this.budget = this.adopt(budget);
  }

  resetBudget(): void {
    this.budget = createDefaultReasoningBudget();
    this.scopes.clear();
  }

  createScope(scopeId: string, budget?: ReasoningBudget): void {
    this.scopes.set(scopeId, budget ? this.adopt(budget) : this.freshCounters());
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
  resetConsumption(scopeId: string): void {
    const scope = this.scopes.get(scopeId);
    if (!scope) return;
    scope.consumed = zeroConsumed();
    scope.terminationReason = undefined;
  }

  releaseScope(scopeId: string): void {
    this.scopes.delete(scopeId);
  }

  getScopeBudget(scopeId: string): ReasoningBudget | undefined {
    return this.scopes.get(scopeId);
  }

  isExhausted(operation?: string): boolean {
    return operation
      ? this.getRemaining(this.budget, operation) <= 0
      : isCapacityExhausted(this.budget);
  }

  private getRemaining(budget: ReasoningBudget, operation: string): number {
    const spec = specOf(operation);
    return spec ? budgetRemaining(budget, spec.resource) : Number.POSITIVE_INFINITY;
  }
}
