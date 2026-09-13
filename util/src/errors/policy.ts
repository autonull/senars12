import { SenarsError } from './senars-error.js';

export class PolicyViolation extends SenarsError {
  constructor(command: string, reason: string, options?: ErrorOptions) {
    super(reason, 'POLICY_VIOLATION', { command }, options);
    this.name = 'PolicyViolation';
  }
}
