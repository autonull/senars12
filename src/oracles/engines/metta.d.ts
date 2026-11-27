/**
 * MeTTa Oracle — MeTTa evaluation/rewriting through the oracle seam.
 */
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from '../oracle';
import { OraclePinStore } from '../pins';
import type { BudgetSlice, BudgetResource } from '../../budget/budget';
/** Input for MeTTa evaluation. */
export interface MettaInput extends OracleInput {
    operation: 'engine.metta';
    args: [expression: string, options?: MettaOptions];
}
/** MeTTa execution options. */
export interface MettaOptions {
    /** Timeout in milliseconds. */
    timeoutMs?: number;
    /** Maximum number of steps. */
    maxSteps?: number;
    /** Memory limit in bytes. */
    memoryLimit?: number;
    /** Space to evaluate in. */
    space?: string;
}
/** MeTTa execution result. */
export interface MettaResult {
    /** Result atoms. */
    results: MettaAtom[];
    /** Whether evaluation succeeded. */
    success: boolean;
    /** Error message if failed. */
    error?: string;
    /** Duration in ms. */
    durationMs: number;
}
/** MeTTa atom for JSON serialization. */
export type MettaAtom = {
    kind: 'symbol';
    value: string;
} | {
    kind: 'number';
    value: number;
} | {
    kind: 'expression';
    operator: MettaAtom;
    args: MettaAtom[];
} | {
    kind: 'variable';
    name: string;
} | {
    kind: 'grounded';
    type: string;
    value: string;
};
/** MeTTa Oracle configuration. */
export interface MettaOracleConfig extends OracleConfig {
    operation: 'engine.metta';
    /** Default timeout. */
    defaultTimeoutMs?: number;
    /** Default max steps. */
    defaultMaxSteps?: number;
}
/** MeTTa Oracle implementation. */
export declare class MettaOracle implements Oracle<MettaInput, MettaResult> {
    readonly operation: 'engine.metta';
    readonly provider: string;
    readonly version?: string;
    readonly budgetResource?: BudgetResource;
    private runtime;
    private defaultTimeoutMs;
    private defaultMaxSteps;
    private pinStore;
    private isReplay;
    private defaultBudgetSlice?;
    private stats;
    constructor(config: MettaOracleConfig);
    setPinStore(store: OraclePinStore): void;
    setReplayMode(replay: boolean): void;
    call(input: MettaInput, budgetSlice?: BudgetSlice): Promise<OracleOutput<MettaResult>>;
    private atomToJson;
    private execute;
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
/** Create a MeTTa oracle. */
export declare function createMettaOracle(config?: Partial<Omit<MettaOracleConfig, 'operation'>>): MettaOracle;
//# sourceMappingURL=metta.d.ts.map