import { SenarsError } from './senars-error';
export class PolicyViolation extends SenarsError {
    constructor(command, reason, options) {
        super(reason, 'POLICY_VIOLATION', { command }, options);
        this.name = 'PolicyViolation';
    }
}
