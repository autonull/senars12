/**
 * Faculty Engine — executes faculty invocations through the oracle seam.
 */
import type { FacultySpec, FacultyInput, FacultyOutput, FacultyRegistry, FacultyOracleMeta } from './specs';
import type { Clock, IDGenerator } from '../kernel/env';
import type { OracleRegistry } from '../oracles/oracle';
import { OraclePinStore } from '../oracles/pins';
import type { ILMService } from '../lm/interfaces';
/** Faculty engine configuration. */
export interface FacultyEngineConfig {
    /** Faculty registry to use (isolated by default). */
    registry?: FacultyRegistry;
    /** Oracle registry to use (isolated by default). */
    oracles?: OracleRegistry;
    /** LM service for standard oracle registry (if not providing custom oracles). */
    lmService?: ILMService | null;
    /** Clock (deterministic clock by default). */
    clock?: Clock;
    /** ID generator (deterministic by default). */
    ids?: IDGenerator;
    /** Pin store for deterministic replay. */
    pinStore?: OraclePinStore;
    /** Default timeout for faculty calls. */
    defaultTimeoutMs?: number;
    /** Whether to enable fallback on oracle failure. */
    enableFallback?: boolean;
    /** Whether to emit telemetry. */
    telemetry?: boolean;
}
/** Faculty invocation context. */
export interface FacultyInvocationContext {
    /** Unique invocation ID. */
    invocationId: string;
    /** Faculty being invoked. */
    faculty: string;
    /** Input to the faculty. */
    input: FacultyInput;
    /** Start timestamp. */
    startTs: number;
    /** Oracle call metadata. */
    oracleMeta?: FacultyOracleMeta;
}
/** Faculty engine statistics. */
export interface FacultyEngineStats {
    totalInvocations: number;
    successfulInvocations: number;
    failedInvocations: number;
    fallbackInvocations: number;
    pinnedInvocations: number;
    totalDurationMs: number;
    byFaculty: Record<string, {
        calls: number;
        successes: number;
        fallbacks: number;
        avgDurationMs: number;
    }>;
}
/** Faculty engine. */
export declare class FacultyEngine {
    private registry;
    private oracles;
    private clock;
    private ids;
    private pinStore;
    private defaultTimeoutMs;
    private enableFallback;
    private telemetry;
    private isReplay;
    private stats;
    private telemetryCallbacks;
    constructor(config?: FacultyEngineConfig);
    /** Set the pin store. */
    setPinStore(store: OraclePinStore): void;
    /** Enable/disable replay mode. */
    setReplayMode(replay: boolean): void;
    /** Add a telemetry callback. */
    onTelemetry(callback: (context: FacultyInvocationContext, output: FacultyOutput) => void): void;
    /** Invoke a faculty. */
    invoke<T = unknown>(input: FacultyInput): Promise<FacultyOutput<T>>;
    /** Invoke a faculty through the oracle. */
    private invokeThroughOracle;
    /** Build oracle input from faculty input. */
    private buildOracleInput;
    /** Build prompt for LM oracles. */
    private buildPrompt;
    /** Build Z3 script. */
    private buildZ3Script;
    /** Build Clingo program. */
    private buildClingoProgram;
    /** Build Prolog program. */
    private buildPrologProgram;
    /** Build Prolog query. */
    private buildPrologQuery;
    /** Parse oracle output into faculty output. */
    private parseOracleOutput;
    /** Hash faculty input for pinning. */
    private hashInput;
    /** Initialize faculty stats. */
    private initFacultyStats;
    /** Update faculty average duration. */
    private updateFacultyAvgDuration;
    /** Emit telemetry. */
    private emitTelemetry;
    /** Get engine statistics. */
    getStats(): FacultyEngineStats;
    /** Get available faculties. */
    getAvailableFaculties(): FacultySpec[];
    /** Check if a faculty is available. */
    hasFaculty(name: string): boolean;
}
/** Create a faculty engine. */
export declare function createFacultyEngine(config?: FacultyEngineConfig): FacultyEngine;
/** Global faculty engine instance. */
export declare const facultyEngine: FacultyEngine;
/** Convenience function to invoke a faculty. */
export declare function invokeFaculty<T = unknown>(input: FacultyInput): Promise<FacultyOutput<T>>;
//# sourceMappingURL=engine.d.ts.map