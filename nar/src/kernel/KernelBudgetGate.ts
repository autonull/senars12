import type {
  BudgetExhaustedEvent,
  BudgetGateInput,
  BudgetGateOutput,
  CognitiveEvent,
  ReasoningBudget,
  TerminationReason,
} from '@senars/kernel/schemas';
import { validateCognitiveEvent, validateReasoningBudget } from '@senars/kernel/schemas';
import { v4 as uuidv4 } from 'uuid';
import { BoundedEventLog, pushBounded } from './event-ring.js';
import { recordGateDecision } from '../telemetry/index.js';

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

export class KernelBudgetGate {
  private budget: ReasoningBudget;
  private scopes = new Map<string, ReasoningBudget>();
  readonly eventLog = new BoundedEventLog<BudgetExhaustedEvent>();
  private costTable: Record<string, number>;

  constructor(config?: Partial<KernelBudgetGateConfig>) {
    this.costTable = { ...DEFAULT_COST_TABLE, ...config?.costTable };
    this.budget = config?.defaultBudget ?? this.createDefaultBudget();
  }

  private createDefaultBudget(): ReasoningBudget {
    return {
      maxCycles: 1000,
      maxDepth: 100,
      maxMemoryOps: 10000,
      maxLMCalls: 50,
      wallclockDeadlineMs: undefined,
      abortSignal: undefined,
      terminationReason: undefined,
      consumed: {
        cycles: 0,
        depth: 0,
        memoryOps: 0,
        llmCalls: 0,
      },
    };
  }

  private freshCounters(): ReasoningBudget {
    return {
      ...this.budget,
      consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
      terminationReason: undefined,
    };
  }

  private resolveBudget(input: BudgetGateInput): ReasoningBudget {
    if (input.budget) return input.budget;
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
    const correlationId = input.correlationId ?? uuidv4();
    const operation = input.operation;
    const estimatedCost = input.estimatedCost ?? this.costTable[operation] ?? 1;

    const budget = this.resolveBudget(input);
    validateReasoningBudget(budget);

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
    validateReasoningBudget(budget);
    this.budget = budget;
  }

  resetBudget(): void {
    this.budget = this.createDefaultBudget();
    this.scopes.clear();
  }

  createScope(scopeId: string, budget?: ReasoningBudget): void {
    this.scopes.set(scopeId, budget ?? this.freshCounters());
  }

  releaseScope(scopeId: string): void {
    this.scopes.delete(scopeId);
  }

  getScopeBudget(scopeId: string): ReasoningBudget | undefined {
    return this.scopes.get(scopeId);
  }

  getEventLog(): ReadonlyArray<BudgetExhaustedEvent> {
    return this.eventLog.toArray();
  }

  clearEventLog(): void {
    this.eventLog.clear();
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
