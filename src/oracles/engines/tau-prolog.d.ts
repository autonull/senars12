/**
 * Tau Prolog Oracle — Prolog reasoning through the oracle seam.
 */
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from '../oracle';
import { OraclePinStore } from '../pins';
import type { BudgetSlice, BudgetResource } from '../../budget/budget';
/** Input for Tau Prolog query. */
export interface TauPrologInput extends OracleInput {
    operation: 'engine.tau-prolog';
    args: [program: string, query: string, options?: TauPrologOptions];
}
/** Tau Prolog execution options. */
export interface TauPrologOptions {
    /** Timeout in milliseconds. */
    timeoutMs?: number;
    /** Maximum number of solutions. */
    maxSolutions?: number;
    /** Whether to include statistics. */
    stats?: boolean;
}
/** Tau Prolog solution. */
export interface TauPrologSolution {
    /** Variable bindings. */
    bindings: Record<string, unknown>;
    /** Solution number. */
    number: number;
}
/** Tau Prolog execution result. */
export interface TauPrologResult {
    /** Whether the query succeeded. */
    success: boolean;
    /** Solutions found. */
    solutions: TauPrologSolution[];
    /** Statistics. */
    stats?: Record<string, unknown>;
    /** Error message if failed. */
    error?: string;
    /** Duration in ms. */
    durationMs: number;
}
/** Tau Prolog Oracle configuration. */
export interface TauPrologOracleConfig extends OracleConfig {
    operation: 'engine.tau-prolog';
    /** Default timeout. */
    defaultTimeoutMs?: number;
    /** Default max solutions. */
    defaultMaxSolutions?: number;
}
/** Tau Prolog Oracle implementation. */
export declare class TauPrologOracle implements Oracle<TauPrologInput, TauPrologResult> {
    readonly operation: 'engine.tau-prolog';
    readonly provider: string;
    readonly version?: string;
    readonly budgetResource?: BudgetResource;
    private defaultTimeoutMs;
    private defaultMaxSolutions;
    private pinStore;
    private isReplay;
    private defaultBudgetSlice?;
    private stats;
    constructor(config: TauPrologOracleConfig);
    setPinStore(store: OraclePinStore): void;
    setReplayMode(replay: boolean): void;
    call(input: TauPrologInput, budgetSlice?: BudgetSlice): Promise<OracleOutput<TauPrologResult>>;
    private execute;
    private termToJS;
    private hashInput;
    isAvailable(): Promise<boolean>;
    getStats(): {
        totalCalls: number;
        successfulCalls: number;
        failedCalls: number;
        pinnedCalls: number;
        totalDurationMs: number;
    };
}
/** Create a Tau Prolog oracle. */
export declare function createTauPrologOracle(config?: Partial<Omit<TauPrologOracleConfig, 'operation'>>): TauPrologOracle;
//# sourceMappingURL=tau-prolog.d.ts.map