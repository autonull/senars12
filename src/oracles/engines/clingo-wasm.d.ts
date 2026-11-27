/**
 * Clingo WASM Oracle — ASP solving through the oracle seam using clingo-wasm.
 */
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from '../oracle';
import { OraclePinStore } from '../pins';
import type { BudgetSlice, BudgetResource } from '../../budget/budget';
/** Input for Clingo ASP solving. */
export interface ClingoWasmInput extends OracleInput {
    operation: 'engine.clingo';
    args: [program: string, options?: ClingoWasmOptions];
}
/** Clingo execution options. */
export interface ClingoWasmOptions {
    /** Timeout in milliseconds. */
    timeoutMs?: number;
    /** Number of models to compute (0 = all). */
    models?: number;
    /** Additional command-line arguments. */
    args?: string[];
    /** Output format: 'json' | 'text'. */
    format?: 'json' | 'text';
}
/** Clingo execution result. */
export interface ClingoWasmResult {
    /** Solver result: 'SAT', 'UNSAT', 'UNKNOWN'. */
    result: 'SAT' | 'UNSAT' | 'UNKNOWN';
    /** Models found. */
    models: ClingoWasmModel[];
    /** Statistics. */
    stats?: Record<string, unknown>;
    /** Raw stdout. */
    stdout: string;
    /** Raw stderr. */
    stderr: string;
    /** Exit code. */
    exitCode: number;
    /** Duration in ms. */
    durationMs: number;
}
/** Clingo model. */
export interface ClingoWasmModel {
    /** Model number. */
    number: number;
    /** Atoms in the model. */
    atoms: string[];
    /** Optimization value (if any). */
    optimization?: number[];
    /** Cost (if any). */
    cost?: number[];
}
/** Clingo WASM Oracle configuration. */
export interface ClingoWasmOracleConfig extends OracleConfig {
    operation: 'engine.clingo';
    /** Default timeout. */
    defaultTimeoutMs?: number;
    /** Default number of models. */
    defaultModels?: number;
    /** Default output format. */
    defaultFormat?: 'json' | 'text';
}
/** Clingo WASM Oracle implementation. */
export declare class ClingoWasmOracle implements Oracle<ClingoWasmInput, ClingoWasmResult> {
    readonly operation: 'engine.clingo';
    readonly provider: string;
    readonly version?: string;
    readonly budgetResource?: BudgetResource;
    private defaultTimeoutMs;
    private defaultModels;
    private defaultFormat;
    private pinStore;
    private isReplay;
    private defaultBudgetSlice?;
    private stats;
    constructor(config: ClingoWasmOracleConfig);
    setPinStore(store: OraclePinStore): void;
    setReplayMode(replay: boolean): void;
    call(input: ClingoWasmInput, budgetSlice?: BudgetSlice): Promise<OracleOutput<ClingoWasmResult>>;
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
/** Create a Clingo WASM oracle. */
export declare function createClingoWasmOracle(config?: Partial<Omit<ClingoWasmOracleConfig, 'operation'>>): ClingoWasmOracle;
//# sourceMappingURL=clingo-wasm.d.ts.map