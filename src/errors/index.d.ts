/**
 * E1 (TODO20 Phase 3): kernel-domain error taxonomy. The base `SenarsError`
 * (code + context + wrap) lives in `./senars-error.ts` — single definition;
 * every class here adds typed, grep-able context for its failure mode.
 */
import type { GateName } from '../schemas/gate-io';
import { SenarsError } from './senars-error';
export { SenarsError } from './senars-error';
export { ConnectionError, type ConnectionError as ConnectionErrorType } from './transport';
export { EngineError, type EngineError as EngineErrorType } from './engine';
export { ValidationError, type ValidationError as ValidationErrorType } from './nar-errors';
export { ConfigurationError, type ConfigurationError as ConfigurationErrorType } from './nar-errors';
export { OperationError, type OperationError as OperationErrorType } from './nar-errors';
export { ToolError, type ToolError as ToolErrorType } from './tool';
export { TransportError, type TransportError as TransportErrorType } from './transport';
export { PolicyViolation } from './policy';
export type { ErrorCode } from './senars-error';
export { RETRYABLE_ERROR_CODES, isRetryableError } from './senars-error';
/** E1: assembly-time failure, typed by the builder step that failed. */
export declare class BuilderError extends SenarsError {
    readonly step: string;
    constructor(message: string, step: string, context?: Record<string, unknown>, options?: ErrorOptions);
}
/** E1: per-gate denial, typed by gate and operation. */
export declare class GateError extends SenarsError {
    readonly gate: GateName;
    readonly reason: string;
    readonly operation: string;
    constructor(message: string, gate: GateName, reason: string, operation: string, context?: Record<string, unknown>);
}
export declare class PerceptionGateError extends GateError {
    constructor(reason: string, operation: string, context?: Record<string, unknown>);
}
export declare class ActionGateError extends GateError {
    constructor(reason: string, operation: string, context?: Record<string, unknown>);
}
export declare class BudgetGateError extends GateError {
    constructor(reason: string, operation: string, context?: Record<string, unknown>);
}
export declare class RewardGateError extends GateError {
    constructor(reason: string, operation: string, context?: Record<string, unknown>);
}
//# sourceMappingURL=index.d.ts.map