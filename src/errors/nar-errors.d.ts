export declare const ValidationError: {
    new (message: string, context?: Record<string, unknown>, options?: ErrorOptions): {
        name: string;
        message: string;
        stack?: string;
        cause?: unknown;
        readonly code: import("./senars-error").ErrorCode;
        readonly context?: Record<string, unknown> | undefined;
        toJSON(): Record<string, unknown>;
        readonly "~effect/ErrorReporter/ignore"?: boolean;
        readonly "~effect/ErrorReporter/severity"?: import("effect/LogLevel").Severity;
        readonly "~effect/ErrorReporter/attributes"?: import("effect/Record").ReadonlyRecord<string, unknown>;
        readonly "~effect/Runtime/errorExitCode"?: number;
        readonly "~effect/Runtime/errorReported"?: boolean;
    };
    isError(error: unknown): error is Error;
    wrap(error: unknown, context: Record<string, unknown>, code?: import("./senars-error").ErrorCode): import("./senars-error").SenarsError;
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
    stackTraceLimit: number;
};
export type ValidationError = InstanceType<typeof ValidationError>;
export declare const ConfigurationError: {
    new (message: string, context?: Record<string, unknown>, options?: ErrorOptions): {
        name: string;
        message: string;
        stack?: string;
        cause?: unknown;
        readonly code: import("./senars-error").ErrorCode;
        readonly context?: Record<string, unknown> | undefined;
        toJSON(): Record<string, unknown>;
        readonly "~effect/ErrorReporter/ignore"?: boolean;
        readonly "~effect/ErrorReporter/severity"?: import("effect/LogLevel").Severity;
        readonly "~effect/ErrorReporter/attributes"?: import("effect/Record").ReadonlyRecord<string, unknown>;
        readonly "~effect/Runtime/errorExitCode"?: number;
        readonly "~effect/Runtime/errorReported"?: boolean;
    };
    isError(error: unknown): error is Error;
    wrap(error: unknown, context: Record<string, unknown>, code?: import("./senars-error").ErrorCode): import("./senars-error").SenarsError;
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
    stackTraceLimit: number;
};
export type ConfigurationError = InstanceType<typeof ConfigurationError>;
export declare const OperationError: {
    new (message: string, context?: Record<string, unknown>, options?: ErrorOptions): {
        name: string;
        message: string;
        stack?: string;
        cause?: unknown;
        readonly code: import("./senars-error").ErrorCode;
        readonly context?: Record<string, unknown> | undefined;
        toJSON(): Record<string, unknown>;
        readonly "~effect/ErrorReporter/ignore"?: boolean;
        readonly "~effect/ErrorReporter/severity"?: import("effect/LogLevel").Severity;
        readonly "~effect/ErrorReporter/attributes"?: import("effect/Record").ReadonlyRecord<string, unknown>;
        readonly "~effect/Runtime/errorExitCode"?: number;
        readonly "~effect/Runtime/errorReported"?: boolean;
    };
    isError(error: unknown): error is Error;
    wrap(error: unknown, context: Record<string, unknown>, code?: import("./senars-error").ErrorCode): import("./senars-error").SenarsError;
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
    stackTraceLimit: number;
};
export type OperationError = InstanceType<typeof OperationError>;
//# sourceMappingURL=nar-errors.d.ts.map