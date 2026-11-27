/**
 * MiniSat WASM Oracle — SAT solving through the oracle seam using logic-solver-plus (MiniSat WASM).
 */
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from '../oracle';
import { OraclePinStore } from '../pins';
import type { BudgetSlice, BudgetResource } from '../../budget/budget';
/** Input for MiniSat SAT solving. */
export interface MiniSatWasmInput extends OracleInput {
    operation: 'engine.minisat';
    args: [cnf: string, options?: MiniSatWasmOptions];
}
/** MiniSat execution options. */
export interface MiniSatWasmOptions {
    /** Timeout in milliseconds. */
    timeoutMs?: number;
    /** Additional command-line arguments (ignored for WASM). */
    args?: string[];
}
/** MiniSat execution result. */
export interface MiniSatWasmResult {
    /** Solver result: 'SAT', 'UNSAT', 'UNKNOWN'. */
    result: 'SAT' | 'UNSAT' | 'UNKNOWN';
    /** Model (if SAT) - variable assignments. */
    model?: Map<number, boolean>;
    /** Model as array (for JSON serialization). */
    modelArray?: number[];
    /** Raw stdout. */
    stdout: string;
    /** Raw stderr. */
    stderr: string;
    /** Exit code. */
    exitCode: number;
    /** Duration in ms. */
    durationMs: number;
}
/** MiniSat WASM Oracle configuration. */
export interface MiniSatWasmOracleConfig extends OracleConfig {
    operation: 'engine.minisat';
    /** Default timeout. */
    defaultTimeoutMs?: number;
}
/** MiniSat WASM Oracle implementation. */
export declare class MiniSatWasmOracle implements Oracle<MiniSatWasmInput, MiniSatWasmResult> {
    readonly operation: 'engine.minisat';
    readonly provider: string;
    readonly version?: string;
    readonly budgetResource?: BudgetResource;
    private defaultTimeoutMs;
    private pinStore;
    private isReplay;
    private defaultBudgetSlice?;
    private stats;
    constructor(config: MiniSatWasmOracleConfig);
    setPinStore(store: OraclePinStore): void;
    setReplayMode(replay: boolean): void;
    call(input: MiniSatWasmInput, budgetSlice?: BudgetSlice): Promise<OracleOutput<MiniSatWasmResult>>;
    private parseCNF;
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
/** Create a MiniSat WASM oracle. */
export declare function createMiniSatWasmOracle(config?: Partial<Omit<MiniSatWasmOracleConfig, 'operation'>>): MiniSatWasmOracle;
//# sourceMappingURL=minisat-wasm.d.ts.map