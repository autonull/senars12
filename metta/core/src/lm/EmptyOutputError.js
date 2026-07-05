import {ProviderError} from '../errors/index.js';

export class EmptyOutputError extends ProviderError {
    constructor(message = 'LM returned empty output', providerId = null) {
        super(message, { providerId, code: 'EMPTY_OUTPUT' });
    }
}
