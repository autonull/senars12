/**
 * The codes a `SenarsError` can carry. Every member is thrown somewhere: a code here
 * that nothing raises is a claim the taxonomy cannot keep, so the four that named
 * intentions the error surface never took (`TRUTH_ERROR`, `SCHEMA_INDUCTION`) went
 * when their classes did. `PLUGIN_LOAD_ERROR` and `METTA_ERROR` came back when
 * their classes joined: a code that is not in this union is a class the kernel
 * cannot dispatch on. `MeTTaError` refines its code into a `MeTTaReason`, so the
 * shared code names the subsystem and the reason names the failure.
 */
export type ErrorCode = 'TOOL_ERROR' | 'ENGINE_ERROR' | 'TRANSPORT_ERROR' | 'PLUGIN_LOAD_ERROR' | 'POLICY_VIOLATION' | 'CONNECTION_ERROR' | 'VALIDATION_ERROR' | 'OPERATION_ERROR' | 'LOOP_DETECTED' | 'TIMEOUT' | 'PARSE_ERROR' | 'EVENT_LOG_ERROR' | 'CONFIGURATION_ERROR' | 'LM_UNAVAILABLE' | 'METTA_ERROR' | 'SANDBOX_TIMEOUT' | 'CROSS_DOMAIN' | 'BUILDER_ERROR' | 'GATE_DENIED' | 'BUDGET_EXCEEDED' | 'DIGEST_MISMATCH' | 'LM_OUTPUT_TOO_LARGE' | 'FULL' | 'UNAVAILABLE' | 'INVALID_EVENT' | 'SERIALIZATION_FAILED';
export declare class SenarsError extends Error {
    readonly code: ErrorCode;
    readonly context?: Record<string, unknown> | undefined;
    constructor(message: string, code: ErrorCode, context?: Record<string, unknown> | undefined, options?: ErrorOptions);
    /** Enrich an unknown thrown value with operation context, preserving the cause (E4). */
    static wrap(error: unknown, context: Record<string, unknown>, code?: ErrorCode): SenarsError;
    /** Safe JSON serialization for MCP error responses. */
    toJSON(): Record<string, unknown>;
}
/** Retryable error codes — errors with these codes should be retried with backoff. */
export declare const RETRYABLE_ERROR_CODES: ReadonlySet<ErrorCode>;
/** Check if an error (any type) is retryable based on its code (for SenarsError) or message fallback. */
export declare function isRetryableError(error: unknown): boolean;
/**
 * The one subclass shape in the taxonomy: a `name`, an {@link ErrorCode}, and the
 * `(message, context, cause)` arguments all of them accepted.
 *
 * Eight classes had that constructor written out in full, so a code added to the
 * union above cost a file per code and every one of those files had to remember
 * to thread `options` through — three of them did not, so an error raised through
 * them silently dropped its cause. The taxonomy is now one declaration per code,
 * and cause threading is not optional.
 *
 * Returns the constructor only; a caller that names the instance type pairs it
 * with `export type X = InstanceType<typeof X>`.
 */
export declare const codedError: <N extends string, C extends ErrorCode>(name: N, code: C) => {
    new (message: string, context?: Record<string, unknown>, options?: ErrorOptions): {
        name: string;
        message: string;
        stack?: string;
        cause?: unknown;
        readonly code: ErrorCode;
        readonly context?: Record<string, unknown> | undefined;
        /** Safe JSON serialization for MCP error responses. */
        toJSON(): Record<string, unknown>;
        readonly "~effect/ErrorReporter/ignore"?: boolean;
        readonly "~effect/ErrorReporter/severity"?: import("effect/LogLevel").Severity;
        readonly "~effect/ErrorReporter/attributes"?: import("effect/Record").ReadonlyRecord<string, unknown>;
        readonly "~effect/Runtime/errorExitCode"?: number;
        readonly "~effect/Runtime/errorReported"?: boolean;
    };
    isError(error: unknown): error is Error;
    /** Enrich an unknown thrown value with operation context, preserving the cause (E4). */
    wrap(error: unknown, context: Record<string, unknown>, code?: ErrorCode): SenarsError;
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
    stackTraceLimit: number;
};
//# sourceMappingURL=senars-error.d.ts.map