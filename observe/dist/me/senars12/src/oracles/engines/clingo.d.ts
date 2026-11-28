/**
 * Clingo Oracle — ASP solving through the oracle seam.
 */
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from '../oracle';
import { OraclePinStore } from '../pins';
/** Input for Clingo ASP solving. */
export interface ClingoInput extends OracleInput {
    operation: 'engine.clingo';
    args: [program: string, options?: ClingoOptions];
}
/** Clingo execution options. */
export interface ClingoOptions {
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
export interface ClingoResult {
    /** Solver result: 'SAT', 'UNSAT', 'UNKNOWN'. */
    result: 'SAT' | 'UNSAT' | 'UNKNOWN';
    /** Models found. */
    models: ClingoModel[];
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
export interface ClingoModel {
    /** Model number. */
    number: number;
    /** Atoms in the model. */
    atoms: string[];
    /** Optimization value (if any). */
    optimization?: number[];
    /** Cost (if any). */
    cost?: number[];
}
/** Clingo Oracle configuration. */
export interface ClingoOracleConfig extends OracleConfig {
    operation: 'engine.clingo';
    /** Path to Clingo executable. */
    clingoPath?: string;
    /** Default timeout. */
    defaultTimeoutMs?: number;
    /** Default number of models. */
    defaultModels?: number;
    /** Default output format. */
    defaultFormat?: 'json' | 'text';
}
/** Clingo Oracle implementation. */
export declare class ClingoOracle implements Oracle<ClingoInput, ClingoResult> {
    readonly operation: 'engine.clingo';
    readonly provider: string;
    readonly version?: string;
    private clingoPath;
    private defaultTimeoutMs;
    private defaultModels;
    private defaultFormat;
    private pinStore;
    private isReplay;
    private stats;
    constructor(config: ClingoOracleConfig);
    setPinStore(store: OraclePinStore): void;
    setReplayMode(replay: boolean): void;
    call(input: ClingoInput): Promise<OracleOutput<ClingoResult>>;
    private execute;
    private parseOutput;
    private parseTextOutput;
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
/** Create a Clingo oracle. */
export declare function createClingoOracle(config?: Partial<Omit<ClingoOracleConfig, 'operation'>>): ClingoOracle;
//# sourceMappingURL=clingo.d.ts.map