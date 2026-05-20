export interface CognitiveBudget {
    maxNALSteps: number;
    maxLMCalls: number;
    maxDerivationDepth: number;
    maxMemoryOps: number;
}

const CHAT_BUDGET: CognitiveBudget = { maxNALSteps: 3, maxLMCalls: 1, maxDerivationDepth: 2, maxMemoryOps: 5 };
const REASONING_BUDGET: CognitiveBudget = { maxNALSteps: 10, maxLMCalls: 3, maxDerivationDepth: 5, maxMemoryOps: 20 };
const DEEP_BUDGET: CognitiveBudget = { maxNALSteps: 20, maxLMCalls: 5, maxDerivationDepth: 10, maxMemoryOps: 50 };
const BALANCED_BUDGET: CognitiveBudget = { maxNALSteps: 5, maxLMCalls: 2, maxDerivationDepth: 3, maxMemoryOps: 10 };

export const BUDGET_PRESETS: Record<string, CognitiveBudget> = {
    chat: CHAT_BUDGET,
    reasoning: REASONING_BUDGET,
    deep: DEEP_BUDGET,
    balanced: BALANCED_BUDGET,
};

export type Intent = 'narsese' | 'query' | 'chat' | 'goal' | 'believe' | 'explain' | 'counterfactual';

export function getBudget(classification: Intent, complexity = 0.5): CognitiveBudget {
    switch (classification) {
        case 'narsese': return { ...REASONING_BUDGET };
        case 'query': return complexity > 0.7 ? { ...DEEP_BUDGET } : { ...BALANCED_BUDGET };
        case 'chat': return { ...CHAT_BUDGET };
        default: return { ...BALANCED_BUDGET };
    }
}

export class BudgetTracker {
    private nalSteps = 0;
    private lmCalls = 0;
    private memoryOps = 0;
    private budget: CognitiveBudget;

    constructor(budget?: CognitiveBudget) {
        this.budget = budget ?? { maxNALSteps: 5, maxLMCalls: 2, maxDerivationDepth: 3, maxMemoryOps: 10 };
    }

    setBudget(budget: CognitiveBudget): void {
        this.budget = budget;
    }

    canDoNAL(): boolean { return this.nalSteps < this.budget.maxNALSteps; }
    canDoLM(): boolean { return this.lmCalls < this.budget.maxLMCalls; }
    canDoMemory(): boolean { return this.memoryOps < this.budget.maxMemoryOps; }

    recordNAL(): void { this.nalSteps++; }
    recordLM(): void { this.lmCalls++; }
    recordMemory(): void { this.memoryOps++; }

    getRemaining(): { nal: number; lm: number; memory: number } {
        return {
            nal: this.budget.maxNALSteps - this.nalSteps,
            lm: this.budget.maxLMCalls - this.lmCalls,
            memory: this.budget.maxMemoryOps - this.memoryOps,
        };
    }

    reset(): void {
        this.nalSteps = 0;
        this.lmCalls = 0;
        this.memoryOps = 0;
    }
}
