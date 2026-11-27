/**
 * Z3 WASM Oracle — SMT solving through the oracle seam using z3-solver (WASM).
 */
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from '../oracle';
import type { BudgetSlice, BudgetResource } from '../../budget/budget';
import { OraclePinStore } from '../pins';
/** Input for Z3 SMT solving. */
export interface Z3WasmInput extends OracleInput {
    operation: 'engine.z3';
    args: [script: string, options?: Z3WasmOptions];
}
/** Z3 execution options. */
export interface Z3WasmOptions {
    /** Timeout in milliseconds. */
    timeoutMs?: number;
    /** Additional command-line arguments (passed to solver config). */
    args?: string[];
    /** Input format: 'smtlib2' | 'smtlib1' */
    format?: 'smtlib2' | 'smtlib1';
}
/** Z3 execution result. */
export interface Z3WasmResult {
    /** Solver result: 'sat', 'unsat', 'unknown'. */
    result: 'sat' | 'unsat' | 'unknown';
    /** Model (if sat). */
    model?: string;
    /** Proof (if unsat). */
    proof?: string;
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
/** Z3 WASM Oracle configuration. */
export interface Z3WasmOracleConfig extends OracleConfig {
    operation: 'engine.z3';
    /** Default timeout. */
    defaultTimeoutMs?: number;
    /** Default format. */
    defaultFormat?: 'smtlib2' | 'smtlib1';
}
/** Z3 WASM Oracle implementation. */
export declare class Z3WasmOracle implements Oracle<Z3WasmInput, Z3WasmResult> {
    readonly operation: 'engine.z3';
    readonly provider: string;
    readonly version?: string;
    readonly budgetResource?: BudgetResource;
    private defaultTimeoutMs;
    private defaultFormat;
    private pinStore;
    private isReplay;
    private defaultBudgetSlice?;
    private stats;
    constructor(config: Z3WasmOracleConfig);
    setPinStore(store: OraclePinStore): void;
    setReplayMode(replay: boolean): void;
    call(input: Z3WasmInput, budgetSlice?: BudgetSlice): Promise<OracleOutput<Z3WasmResult>>;
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
/** Create a Z3 WASM oracle. */
export declare function createZ3WasmOracle(config?: Partial<Omit<Z3WasmOracleConfig, 'operation'>>): Z3WasmOracle;
//# sourceMappingURL=z3-wasm.d.ts.map