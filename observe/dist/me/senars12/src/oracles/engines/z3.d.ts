/**
 * Z3 Oracle — SMT solving through the oracle seam.
 */
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from '../oracle';
import { OraclePinStore } from '../pins';
/** Input for Z3 SMT solving. */
export interface Z3Input extends OracleInput {
    operation: 'engine.z3';
    args: [script: string, options?: Z3Options];
}
/** Z3 execution options. */
export interface Z3Options {
    /** Timeout in milliseconds. */
    timeoutMs?: number;
    /** Additional command-line arguments. */
    args?: string[];
    /** Input format: 'smtlib2' | 'smtlib1' */
    format?: 'smtlib2' | 'smtlib1';
}
/** Z3 execution result. */
export interface Z3Result {
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
/** Z3 Oracle configuration. */
export interface Z3OracleConfig extends OracleConfig {
    operation: 'engine.z3';
    /** Path to Z3 executable. */
    z3Path?: string;
    /** Default timeout. */
    defaultTimeoutMs?: number;
    /** Default format. */
    defaultFormat?: 'smtlib2' | 'smtlib1';
}
/** Z3 Oracle implementation. */
export declare class Z3Oracle implements Oracle<Z3Input, Z3Result> {
    readonly operation: 'engine.z3';
    readonly provider: string;
    readonly version?: string;
    private z3Path;
    private defaultTimeoutMs;
    private defaultFormat;
    private pinStore;
    private isReplay;
    private stats;
    constructor(config: Z3OracleConfig);
    setPinStore(store: OraclePinStore): void;
    setReplayMode(replay: boolean): void;
    call(input: Z3Input): Promise<OracleOutput<Z3Result>>;
    private execute;
    private parseOutput;
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
/** Create a Z3 oracle. */
export declare function createZ3Oracle(config?: Partial<Omit<Z3OracleConfig, 'operation'>>): Z3Oracle;
//# sourceMappingURL=z3.d.ts.map