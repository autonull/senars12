import { SenarsError } from './senars-error.js';

export class TransportError extends SenarsError {
  constructor(message: string, context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, 'TRANSPORT_ERROR', context, options);
    this.name = 'TransportError';
  }
}

export class ConnectionError extends SenarsError {
  constructor(message: string, context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, 'CONNECTION_ERROR', context, options);
    this.name = 'ConnectionError';
  }
}
