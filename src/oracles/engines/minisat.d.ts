/**
 * MiniSat Oracle — SAT solving through the oracle seam.
 */
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from '../oracle';
import { OraclePinStore } from '../pins';
/** Input for MiniSat SAT solving. */
export interface MiniSatInput extends OracleInput {
    operation: 'engine.minisat';
    args: [cnf: string, options?: MiniSatOptions];
}
/** MiniSat execution options. */
export interface MiniSatOptions {
    /** Timeout in milliseconds. */
    timeoutMs?: number;
    /** Additional command-line arguments. */
    args?: string[];
}
/** MiniSat execution result. */
export interface MiniSatResult {
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
/** MiniSat Oracle configuration. */
export interface MiniSatOracleConfig extends OracleConfig {
    operation: 'engine.minisat';
    /** Path to MiniSat executable. */
    minisatPath?: string;
    /** Default timeout. */
    defaultTimeoutMs?: number;
}
/** MiniSat Oracle implementation. */
export declare class MiniSatOracle implements Oracle<MiniSatInput, MiniSatResult> {
    readonly operation: 'engine.minisat';
    readonly provider: string;
    readonly version?: string;
    private minisatPath;
    private defaultTimeoutMs;
    private pinStore;
    private isReplay;
    private stats;
    constructor(config: MiniSatOracleConfig);
    setPinStore(store: OraclePinStore): void;
    setReplayMode(replay: boolean): void;
    call(input: MiniSatInput): Promise<OracleOutput<MiniSatResult>>;
    private execute;
    private parseOutput;
    private parseModel;
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
/** Create a MiniSat oracle. */
export declare function createMiniSatOracle(config?: Partial<Omit<MiniSatOracleConfig, 'operation'>>): MiniSatOracle;
//# sourceMappingURL=minisat.d.ts.map