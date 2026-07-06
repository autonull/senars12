import {EmptyOutputError} from './EmptyOutputError.js';

export class LMValidator {
    constructor(config = {}, translator = null, eventBus = null) {
        this.config = config;
        this.translator = translator;
        this.eventBus = eventBus;
    }

    validate(result, providerId) {
        const emptyOutputMode = this.config.emptyOutput ?? 'warn';
        const narseseValidation = this.config.narsese ?? false;

        if (typeof result === 'string' && result.trim().length === 0) {
            const error = new EmptyOutputError('LM returned empty output', providerId);
            if (emptyOutputMode === 'error') {throw error;}
            if (emptyOutputMode === 'warn' && this.eventBus) {
                this.eventBus.emit('lm:empty-output', {providerId, timestamp: Date.now()});
            }
        }

        if (narseseValidation && typeof result === 'string' && this._looksLikeNarsese(result) && this.translator) {
            try {
                this.translator.toNarsese(result);
            } catch (error) {
                if (this.eventBus) {
                    this.eventBus.emit('lm:invalid-narsese', {
                        providerId,
                        output: result,
                        error: error.message,
                        timestamp: Date.now()
                    });
                }
            }
        }
    }

    _looksLikeNarsese(text) {
        return /[<>]|-->|<->|==>|<=>|%/.test(text);
    }
}
