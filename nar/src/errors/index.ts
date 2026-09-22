/**
 * E1 (TODO20 Phase 3): kernel-domain error taxonomy. The base `SenarsError`
 * (code + context + wrap) lives in `@senars/util/errors` — single definition;
 * every class here adds typed, grep-able context for its failure mode.
 */
import { SenarsError } from '@senars/util/errors';

export { SenarsError } from '@senars/util/errors';

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
    readonly gate: 'perception' | 'action' | 'reward' | 'budget',
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

/** E1: boundary validation with Zod issues attached. */
export class BoundaryValidationError extends SenarsError {
  constructor(
    message: string,
    readonly path: string,
    readonly issues: readonly { path: PropertyKey[]; message: string }[],
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', { path, issues, ...context });
    this.name = 'BoundaryValidationError';
  }

  static fromZod(path: string, error: { issues: { path: PropertyKey[]; message: string }[] }) {
    return new BoundaryValidationError(
      `Validation failed at ${path}: ${error.issues.map((i) => i.message).join('; ')}`,
      path,
      error.issues.map((i) => ({ path: [...i.path], message: i.message }))
    );
  }
}

/** E1: reasoning budget exhausted for a scope/operation. */
export class BudgetExceeded extends SenarsError {
  constructor(
    message: string,
    readonly scope: string,
    readonly operation: string,
    readonly limit: number,
    readonly consumed: number
  ) {
    super(message, 'BUDGET_EXCEEDED', { scope, operation, limit, consumed });
    this.name = 'BudgetExceeded';
  }
}

/** E1: artifact digest verification failed. */
export class DigestMismatch extends SenarsError {
  constructor(
    message: string,
    readonly expected: string,
    readonly actual: string,
    readonly artifact: string
  ) {
    super(message, 'DIGEST_MISMATCH', { expected, actual, artifact });
    this.name = 'DigestMismatch';
  }
}

/** E1: schema induction phase failure with its cause attached. */
export class SchemaInductionError extends SenarsError {
  constructor(message: string, readonly phase: string, options?: ErrorOptions) {
    super(message, 'SCHEMA_INDUCTION', { phase }, options);
    this.name = 'SchemaInductionError';
  }
}
