import { SenarsError } from './senars-error.js';

export class ToolError extends SenarsError {
  constructor(message: string, context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, 'TOOL_ERROR', context, options);
    this.name = 'ToolError';
  }
}
