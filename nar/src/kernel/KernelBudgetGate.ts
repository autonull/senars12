import { type BudgetLimits, createBudget } from '@senars/core/budget';
import type {
  BudgetExhaustedEvent,
  BudgetGateInput,
  BudgetGateOutput,
  CognitiveEvent,
  ReasoningBudget,
  TerminationReason,
} from '@senars/core/schemas';
import { validateCognitiveEvent, validateReasoningBudget } from '@senars/core/schemas';
import { recordGateDecision } from '../telemetry/index.js';
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
};

/** Which budget dimension an operation spends, and how exhaustion is reported. Single source for
 *  consumption, remaining/limit reads, budget type, and termination reason. */
interface OperationSpec {
  readonly consumedKey: keyof ReasoningBudget['consumed'];
  readonly maxKey: 'maxCycles' | 'maxDepth' | 'maxMemoryOps' | 'maxLMCalls';
  readonly budgetType: BudgetExhaustedEvent['payload']['budgetType'];
  readonly exhaustedReason: TerminationReason;
}

const OPERATION_SPECS: Record<string, OperationSpec> = {
  'nal-step': {
    consumedKey: 'cycles',
    maxKey: 'maxCycles',
    budgetType: 'cycles',
    exhaustedReason: 'cycle-budget',
  },
  'lm-call': {
    consumedKey: 'llmCalls',
    maxKey: 'maxLMCalls',
    budgetType: 'llm',
    exhaustedReason: 'llm-budget',
  },
  'memory-op': {
    consumedKey: 'memoryOps',
    maxKey: 'maxMemoryOps',
    budgetType: 'memory',
    exhaustedReason: 'memory-budget',
  },
  'derivation-depth': {
    consumedKey: 'depth',
    maxKey: 'maxDepth',
    budgetType: 'depth',
    exhaustedReason: 'depth-budget',
  },
  'systemone-judgment': {
    consumedKey: 'llmCalls',
    maxKey: 'maxLMCalls',
    budgetType: 'llm',
    exhaustedReason: 'llm-budget',
  },
};

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
    return {
      ...this.budget,
      consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
      terminationReason: undefined,
    };
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
    recordGateDecision('budget', input.operation, out.granted, out.terminationReason);
    return out;
  }

  private decideBudget(input: BudgetGateInput): BudgetGateOutput {
    const correlationId = this.correlationOf(input.correlationId);
    const operation = input.operation;
    const estimatedCost = input.estimatedCost ?? this.costTable[operation] ?? 1;

    const budget = this.resolveBudget(input);
    const remaining = this.getRemaining(budget, operation, estimatedCost);
    const granted = remaining >= estimatedCost;

    if (!granted) {
      const terminationReason = this.getTerminationReason(budget, operation);
      const event: BudgetExhaustedEvent = {
        type: 'budget.exhausted',
        engine: 'kernel',
        timestamp: Date.now(),
        correlationId,
        payload: {
          budgetType: this.toBudgetType(operation),
          remaining,
          limit: this.getLimit(budget, operation),
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

    budget.consumed[OPERATION_SPECS[operation]?.consumedKey ?? 'depth'] += estimatedCost;

    budget.terminationReason = undefined;

    return { granted: true, updatedBudget: budget };
  }

  private getRemaining(budget: ReasoningBudget, operation: string, estimatedCost: number): number {
    const spec = OPERATION_SPECS[operation];
    return spec ? budget[spec.maxKey] - budget.consumed[spec.consumedKey] : Infinity;
  }

  private getLimit(budget: ReasoningBudget, operation: string): number {
    const spec = OPERATION_SPECS[operation];
    return spec ? budget[spec.maxKey] : 0;
  }

  private toBudgetType(operation: string): BudgetExhaustedEvent['payload']['budgetType'] {
    return OPERATION_SPECS[operation]?.budgetType ?? 'cycles';
  }

  private getTerminationReason(budget: ReasoningBudget, operation: string): TerminationReason {
    const spec = OPERATION_SPECS[operation];
    if (!spec) return 'backpressure';
    return budget.consumed[spec.consumedKey] >= budget[spec.maxKey]
      ? spec.exhaustedReason
      : 'backpressure';
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
    if (operation) {
      return this.getRemaining(this.budget, operation, 1) <= 0;
    }
    return (
      this.getRemaining(this.budget, 'nal-step', 1) <= 0 ||
      this.getRemaining(this.budget, 'lm-call', 1) <= 0 ||
      this.getRemaining(this.budget, 'memory-op', 1) <= 0 ||
      this.getRemaining(this.budget, 'derivation-depth', 1) <= 0
    );
  }
}
