import { SenarsError } from './senars-error.js';

export class ConfigError extends SenarsError {
  constructor(message: string, context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, 'CONFIG_ERROR', context, options);
    this.name = 'ConfigError';
  }
}
