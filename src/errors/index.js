import { SenarsError } from './senars-error';
export { SenarsError } from './senars-error';
export { ConnectionError } from './transport';
export { EngineError } from './engine';
export { ValidationError } from './nar-errors';
export { ConfigurationError } from './nar-errors';
export { OperationError } from './nar-errors';
export { ToolError } from './tool';
export { TransportError } from './transport';
export { PolicyViolation } from './policy';
export { RETRYABLE_ERROR_CODES, isRetryableError } from './senars-error';
/** E1: assembly-time failure, typed by the builder step that failed. */
export class BuilderError extends SenarsError {
    step;
    constructor(message, step, context, options) {
        super(message, 'BUILDER_ERROR', { step, ...context }, options);
        this.step = step;
        this.name = 'BuilderError';
    }
}
/** E1: per-gate denial, typed by gate and operation. */
export class GateError extends SenarsError {
    gate;
    reason;
    operation;
    constructor(message, gate, reason, operation, context) {
        super(message, 'GATE_DENIED', { gate, reason, operation, ...context });
        this.gate = gate;
        this.reason = reason;
        this.operation = operation;
        this.name = 'GateError';
    }
}
export class PerceptionGateError extends GateError {
    constructor(reason, operation, context) {
        super(`Perception gate denied: ${reason}`, 'perception', reason, operation, context);
        this.name = 'PerceptionGateError';
    }
}
export class ActionGateError extends GateError {
    constructor(reason, operation, context) {
        super(`Action gate denied: ${reason}`, 'action', reason, operation, context);
        this.name = 'ActionGateError';
    }
}
export class BudgetGateError extends GateError {
    constructor(reason, operation, context) {
        super(`Budget gate denied: ${reason}`, 'budget', reason, operation, context);
        this.name = 'BudgetGateError';
    }
}
export class RewardGateError extends GateError {
    constructor(reason, operation, context) {
        super(`Reward gate denied: ${reason}`, 'reward', reason, operation, context);
        this.name = 'RewardGateError';
    }
}
