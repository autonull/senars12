import { SenarsError } from './senars-error.js';

export class EngineError extends SenarsError {
  constructor(message: string, context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, 'ENGINE_ERROR', context, options);
    this.name = 'EngineError';
  }
}
