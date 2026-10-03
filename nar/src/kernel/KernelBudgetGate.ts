import {
  ALL_RESOURCES,
  BUDGET_TYPES,
  type BudgetLimits,
  type BudgetResource,
  budgetAffords,
  budgetLimit,
  budgetRefusal,
  budgetRemaining,
  chargeBudget,
  createBudget,
  zeroConsumed,
} from '@senars/core/budget';
import type {
  BudgetExhaustedEvent,
  BudgetGateInput,
  BudgetGateOutput,
  CognitiveEvent,
  ReasoningBudget,
  TerminationReason,
} from '@senars/core/schemas';
import { validateCognitiveEvent, validateReasoningBudget } from '@senars/core/schemas';
import { keyedBy } from '@senars/util';
import { recordGateDecision } from '../telemetry/index.js';
import { BUDGET_SCOPES, type BudgetScopeId, scopeBudget } from './budget-scopes.js';
import { KernelGate } from './gate-base.js';

export interface KernelBudgetGateConfig {
  defaultBudget: ReasoningBudget;
  costTable: Record<string, number>;
}

const DEFAULT_COST_TABLE: Record<string, number> = {
  'nal-step': 1,
  'lm-call': 10,
  'memory-op': 1,
  'derivation-depth': 1,
  'systemone-judgment': 5,
  ...keyedBy(Object.values(BUDGET_SCOPES), (scope) => scope.operation, () => 1),
};

/** Which budget dimension an operation spends. The dimension, its ceiling key and its
 *  exhaustion reason all come from `core/budget`'s one table, so the gate cannot
 *  charge a dimension the engine does not; only the event's own name is the gate's. */
interface OperationSpec {
  readonly resource: BudgetResource;
  readonly budgetType: BudgetExhaustedEvent['payload']['budgetType'];
}

/** The A7 control scopes, derived rather than restated: the scope table owns the
 *  dimension, the ceiling key and the overflow reason, so a new scope cannot be
 *  declared without them. */
const SCOPE_SPECS: Record<string, OperationSpec & { scopeId?: BudgetScopeId }> = Object.fromEntries(
  Object.entries(BUDGET_SCOPES).map(([scopeId, spec]) => [
    spec.operation,
    {
      resource: spec.consumedKey,
      budgetType: BUDGET_TYPES[spec.consumedKey],
      scopeId: scopeId as BudgetScopeId,
    },
  ])
);

const OPERATION_SPECS: Record<string, OperationSpec & { scopeId?: BudgetScopeId }> = {
  ...SCOPE_SPECS,
  'nal-step': { resource: 'cycles', budgetType: 'cycles' },
  'lm-call': { resource: 'llmCalls', budgetType: 'llm' },
  'memory-op': { resource: 'memoryOps', budgetType: 'memory' },
  'derivation-depth': { resource: 'depth', budgetType: 'depth' },
  'systemone-judgment': { resource: 'llmCalls', budgetType: 'llm' },
};

/**
 * What an operation spends. `BudgetOperation` is a closed enum, so an absent spec
 * is only reachable from a cast: an operation with no declared dimension is
 * granted and charged nothing rather than guessed onto one — the old fallback put
 * it on `depth` while reporting `cycles` and refusing with `backpressure`.
 */
const specOf = (operation: string): OperationSpec | undefined => OPERATION_SPECS[operation];

/** The one budget a NAR starts from; the gate's own default and every NAR's initial budget. */
export const NAR_BUDGET_LIMITS = {
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
    const out = this.decideBudget(input);
    recordGateDecision(
      'budget',
      input.operation,
      out.granted,
      out.terminationReason,
      input.correlationId
    );
    return out;
  }

  private decideBudget(input: BudgetGateInput): BudgetGateOutput {
    const operation = input.operation;
    const estimatedCost = input.estimatedCost ?? this.costTable[operation] ?? 1;
    const spec = specOf(operation);
    const resource = spec?.resource;

    const budget = this.resolveBudget(input);
    const granted = resource ? budgetAffords(budget, resource, estimatedCost) : true;
    budget.terminationReason = undefined;

    if (!granted && resource) {
      const correlationId = this.correlationOf(input.correlationId);
      const terminationReason = budgetRefusal(budget, resource);
      // The refusal lives on the budget, not only on the event: `getSpendSummary`
      // reads `terminationReason` per scope, and an event nobody joins reports 'none'
      // for a scope that just refused a charge (TODO33 §5.P3.10).
      budget.terminationReason = terminationReason;
      const event: BudgetExhaustedEvent = {
        type: 'budget.exhausted',
        engine: 'kernel',
        timestamp: Date.now(),
        correlationId,
        payload: {
          budgetType: spec.budgetType,
          remaining: budgetRemaining(budget, resource),
          limit: budgetLimit(budget, resource),
          terminationReason:
            terminationReason as BudgetExhaustedEvent['payload']['terminationReason'],
        },
      };
      validateCognitiveEvent(event);
      this.eventLog.push(event);

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
    return { ...this.budget, consumed: { ...this.budget.consumed } };
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

  releaseScope(scopeId: string): void {
    this.scopes.delete(scopeId);
  }

  getScopeBudget(scopeId: string): ReasoningBudget | undefined {
    return this.scopes.get(scopeId);
  }

  isExhausted(operation?: string): boolean {
    return operation
      ? this.getRemaining(this.budget, operation) <= 0
      : ALL_RESOURCES.some((resource) => budgetRemaining(this.budget, resource) <= 0);
  }

  private getRemaining(budget: ReasoningBudget, operation: string): number {
    const spec = specOf(operation);
    return spec ? budgetRemaining(budget, spec.resource) : Number.POSITIVE_INFINITY;
  }
}
