/**
 * E1 (TODO20 Phase 3): kernel-domain error taxonomy. The base `SenarsError`
 * (code + context + wrap) lives in `./senars-error.ts` — single definition;
 * every class here adds typed, grep-able context for its failure mode.
 */
import type { GateName } from '../schemas/gate-io';
import type { SchemaIssue } from '../util';
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

/** E1: assembly-time failure, typed by the builder step that failed. */
export class BuilderError extends SenarsError {
  constructor(
    message: string,
    readonly step: string,
    context?: Record<string, unknown>,
    options?: ErrorOptions
  ) {
    super(message, 'BUILDER_ERROR', { step, ...context }, options);
    this.name = 'BuilderError';
  }
}

/** E1: per-gate denial, typed by gate and operation. */
export class GateError extends SenarsError {
  constructor(
    message: string,
    readonly gate: GateName,
    readonly reason: string,
    readonly operation: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'GATE_DENIED', { gate, reason, operation, ...context });
    this.name = 'GateError';
  }
}

export class PerceptionGateError extends GateError {
  constructor(reason: string, operation: string, context?: Record<string, unknown>) {
    super(`Perception gate denied: ${reason}`, 'perception', reason, operation, context);
    this.name = 'PerceptionGateError';
  }
}

export class ActionGateError extends GateError {
  constructor(reason: string, operation: string, context?: Record<string, unknown>) {
    super(`Action gate denied: ${reason}`, 'action', reason, operation, context);
    this.name = 'ActionGateError';
  }
}

export class BudgetGateError extends GateError {
  constructor(reason: string, operation: string, context?: Record<string, unknown>) {
    super(`Budget gate denied: ${reason}`, 'budget', reason, operation, context);
    this.name = 'BudgetGateError';
  }
}

export class RewardGateError extends GateError {
  constructor(reason: string, operation: string, context?: Record<string, unknown>) {
    super(`Reward gate denied: ${reason}`, 'reward', reason, operation, context);
    this.name = 'RewardGateError';
  }
}
