import type { AutonomyMode, AutonomyModeChangedEvent, BudgetExhaustedEvent, CognitiveEvent, PolicyViolationEvent, ReasoningBudget } from '@senars/schemas';
import type { GateLogKey } from './event-ring';
import type { IActionGate, IBudgetGate, IPerceptionGate, IRewardGate } from './interfaces';
import { KernelActionGate, type KernelActionGateConfig } from './KernelActionGate';
import { KernelBudgetGate, type KernelBudgetGateConfig } from './KernelBudgetGate';
import { KernelPerceptionGate, type KernelPerceptionGateConfig } from './KernelPerceptionGate';
import { KernelRewardGate, type KernelRewardGateConfig } from './KernelRewardGate';
import type { SourceReputation } from './source-reputation';
/** One persisted gate event and the ring it came from — the C4.3 replay input. */
export interface GateLogEntry {
    gate: GateLogKey;
    event: CognitiveEvent;
}
/**
 * The four gate configs, as each gate accepts them, plus the two registry-wide
 * settings. Spelled with the gate modules' own config types so a field can
 * never exist on a gate and be missing here.
 */
export interface GateRegistryInit {
    perceptionConfig?: Partial<KernelPerceptionGateConfig>;
    actionConfig?: Partial<KernelActionGateConfig>;
    rewardConfig?: Partial<KernelRewardGateConfig>;
    budgetConfig?: Partial<KernelBudgetGateConfig>;
    initialBudget?: ReasoningBudget;
    initialAutonomyMode?: AutonomyMode;
}
export interface IGateRegistry {
    getPerceptionGate(): IPerceptionGate;
    getActionGate(): IActionGate;
    getRewardGate(): IRewardGate;
    getBudgetGate(): IBudgetGate;
    initialize(config?: GateRegistryInit): void;
    isInitialized(): boolean;
    reset(): void;
    getAllEventLogs(): {
        perception: ReadonlyArray<CognitiveEvent>;
        action: ReadonlyArray<PolicyViolationEvent>;
        autonomy: ReadonlyArray<AutonomyModeChangedEvent>;
        reward: ReadonlyArray<PolicyViolationEvent>;
        budget: ReadonlyArray<BudgetExhaustedEvent>;
    };
    /** Re-seed the rings from a persisted gate log (CORE.19 C4.3); returns how many events landed. */
    restoreEventLogs(entries: ReadonlyArray<GateLogEntry>): number;
    clearAllEventLogs(): void;
}
export declare class GateRegistry implements IGateRegistry {
    private gates;
    private initialized;
    constructor();
    /**
     * The one place a gate exists. Construction, configuration and `reset` each used
     * to spell the same four lines, so a fifth gate meant three edits and a reset
     * could leave one of them behind.
     */
    private construct;
    /** Phase E (REFACTOR.todo1): attach source reputation to the perception gate. */
    setReputation(reputation: SourceReputation): void;
    getPerceptionGate(): IPerceptionGate;
    getActionGate(): IActionGate;
    getRewardGate(): IRewardGate;
    getBudgetGate(): IBudgetGate;
    initialize(config?: GateRegistryInit): void;
    isInitialized(): boolean;
    reset(): void;
    getAllEventLogs(): {
        perception: ReturnType<KernelPerceptionGate['getEventLog']>;
        action: ReturnType<KernelActionGate['getEventLog']>;
        autonomy: ReturnType<KernelActionGate['getAutonomyLog']>;
        reward: ReturnType<KernelRewardGate['getEventLog']>;
        budget: ReturnType<KernelBudgetGate['getEventLog']>;
    };
    /**
     * Route a persisted gate log back into the rings it came from (CORE.19 C4.3).
     * The autonomy ring is a state-transition log, so the mode it ends at is
     * restored with it — the one piece of gate state the log implies, so the log
     * and the gate cannot disagree after a restart.
     */
    restoreEventLogs(entries: ReadonlyArray<GateLogEntry>): number;
    clearAllEventLogs(): void;
}
/** The only way to obtain gates (TODO19 F2, TODO33 §5.P2.7). There is no process-global registry: a singleton with a `reset()` that existed solely for test isolation let a NAR with an isolated registry share the global's budget and autonomy mode with any separately-built `Focus`. Every consumer is handed one. */
export declare const createGateRegistry: () => GateRegistry;
//# sourceMappingURL=GateRegistry.d.ts.map