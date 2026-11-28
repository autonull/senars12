import { type BudgetEventBus } from '../budget/index';
import type { BudgetExhaustedEvent } from '../schemas/cognitive-events';
import type { BudgetGateInput, BudgetGateOutput, GateOutcome } from '../schemas/gate-io';
import type { ReasoningBudget } from '../schemas/reasoning-budget';
import { KernelGate } from './gate-base';
export interface KernelBudgetGateConfig {
    defaultBudget: ReasoningBudget;
    costTable: Record<string, number>;
    eventBus?: BudgetEventBus;
}
export declare const createDefaultReasoningBudget: () => ReasoningBudget;
export declare class KernelBudgetGate extends KernelGate<BudgetExhaustedEvent> {
    private budget;
    private readonly budgetId;
    private scopes;
    private costTable;
    private readonly eventBus?;
    protected outcomeOf(output: unknown): GateOutcome;
    constructor(config?: Partial<KernelBudgetGateConfig>);
    /** Emit a budget slice created event. */
    private emitSliceCreated;
    /** Emit a budget slice consumed event. */
    private emitSliceConsumed;
    /** Emit a budget slice exhausted event. */
    private emitSliceExhausted;
    /** Emit a budget slice merged event. */
    private emitSliceMerged;
    /** Validate at the boundary where a budget enters the gate, never on the per-operation read path. */
    private adopt;
    private resolveBudget;
    /** Consumed LM-call units for a named scope (B7 flow-level accounting observability). */
    getScopeConsumed(scopeId: string): number;
    check(input: BudgetGateInput): BudgetGateOutput;
    private decideBudget;
    getBudget(): Readonly<ReasoningBudget>;
    setBudget(budget: ReasoningBudget): void;
    resetBudget(): void;
    createScope(scopeId: string, budget?: ReasoningBudget): void;
    /**
     * Zero an open scope's consumption, keeping the ceilings it was opened with.
     *
     * A per-cycle bound is re-opened every cycle, and re-opening went through
     * `createScope` with a budget rebuilt from the gate's own — two copies to read
     * it, one spread to reshape it, and a zod validation of an object the gate had
     * just constructed, six times per cycle. The ceilings are fixed when a scope
     * opens, so only the counters move.
     */
    resetConsumption(scopeId: string): void;
    releaseScope(scopeId: string): void;
    getScopeBudget(scopeId: string): ReasoningBudget | undefined;
    isExhausted(operation?: string): boolean;
    private getRemaining;
}
//# sourceMappingURL=KernelBudgetGate.d.ts.map