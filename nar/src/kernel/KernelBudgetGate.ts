import { v4 as uuidv4 } from 'uuid';
import type {
    BudgetGateInput,
    BudgetGateOutput,
    ReasoningBudget,
    TerminationReason,
    BudgetExhaustedEvent,
    CognitiveEvent,
} from '@senars/kernel/schemas';
import { validateReasoningBudget, validateCognitiveEvent } from '@senars/kernel/schemas';

export interface KernelBudgetGateConfig {
    defaultBudget: ReasoningBudget;
    costTable: Record<string, number>;
}

const DEFAULT_COST_TABLE: Record<string, number> = {
    'nal-step': 1,
    'lm-call': 10,
    'memory-op': 1,
    'derivation-depth': 1,
};

export class KernelBudgetGate {
    private budget: ReasoningBudget;
    private eventLog: BudgetExhaustedEvent[] = [];
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

    check(input: BudgetGateInput): BudgetGateOutput {
        const correlationId = input.correlationId ?? uuidv4();
        const operation = input.operation;
        const estimatedCost = input.estimatedCost ?? this.costTable[operation] ?? 1;

        const budget = input.budget ?? this.budget;
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
                    terminationReason: terminationReason as BudgetExhaustedEvent['payload']['terminationReason'],
                },
            };
            validateCognitiveEvent(event);
            this.eventLog.push(event);

            return {
                granted: false,
                terminationReason: terminationReason as BudgetExhaustedEvent['payload']['terminationReason'],
                updatedBudget: budget,
            };
        }

        budget.consumed[operation === 'nal-step' ? 'cycles' :
                       operation === 'lm-call' ? 'llmCalls' :
                       operation === 'memory-op' ? 'memoryOps' :
                       'depth'] += estimatedCost;

        budget.terminationReason = undefined;

        return { granted: true, updatedBudget: budget };
    }

    private getRemaining(budget: ReasoningBudget, operation: string, estimatedCost: number): number {
        switch (operation) {
            case 'nal-step':
                return budget.maxCycles - budget.consumed.cycles;
            case 'lm-call':
                return budget.maxLMCalls - budget.consumed.llmCalls;
            case 'memory-op':
                return budget.maxMemoryOps - budget.consumed.memoryOps;
            case 'derivation-depth':
                return budget.maxDepth - budget.consumed.depth;
            default:
                return Infinity;
        }
    }

    private getLimit(budget: ReasoningBudget, operation: string): number {
        switch (operation) {
            case 'nal-step': return budget.maxCycles;
            case 'lm-call': return budget.maxLMCalls;
            case 'memory-op': return budget.maxMemoryOps;
            case 'derivation-depth': return budget.maxDepth;
            default: return 0;
        }
    }

    private toBudgetType(operation: string): BudgetExhaustedEvent['payload']['budgetType'] {
        switch (operation) {
            case 'nal-step': return 'cycles';
            case 'lm-call': return 'llm';
            case 'memory-op': return 'memory';
            case 'derivation-depth': return 'depth';
            default: return 'cycles';
        }
    }

    private getTerminationReason(budget: ReasoningBudget, operation: string): TerminationReason {
        switch (operation) {
            case 'nal-step':
                return budget.consumed.cycles >= budget.maxCycles ? 'cycle-budget' : 'backpressure';
            case 'lm-call':
                return budget.consumed.llmCalls >= budget.maxLMCalls ? 'llm-budget' : 'backpressure';
            case 'memory-op':
                return budget.consumed.memoryOps >= budget.maxMemoryOps ? 'memory-budget' : 'backpressure';
            case 'derivation-depth':
                return budget.consumed.depth >= budget.maxDepth ? 'depth-budget' : 'backpressure';
            default:
                return 'backpressure';
        }
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
    }

    getEventLog(): ReadonlyArray<BudgetExhaustedEvent> {
        return this.eventLog;
    }

    clearEventLog(): void {
        this.eventLog = [];
    }

    isExhausted(operation?: string): boolean {
        if (operation) {
            return this.getRemaining(this.budget, operation, 1) <= 0;
        }
        return this.getRemaining(this.budget, 'nal-step', 1) <= 0 ||
               this.getRemaining(this.budget, 'lm-call', 1) <= 0 ||
               this.getRemaining(this.budget, 'memory-op', 1) <= 0 ||
               this.getRemaining(this.budget, 'derivation-depth', 1) <= 0;
    }
}