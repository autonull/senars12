import { SenarsError } from './senars-error.js';

export class ValidationError extends SenarsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends SenarsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', context);
    this.name = 'ConfigurationError';
  }
}

export class OperationError extends SenarsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'OPERATION_ERROR', context);
    this.name = 'OperationError';
  }
}
