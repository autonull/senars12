import {EventEmitter} from 'events';
import {emitProviderEvent} from '../util/eventUtils.js';

export class BaseProvider extends EventEmitter {
    constructor(config = {}) {
        super();
        this.id = config.id || this.constructor.name.toLowerCase();
        this.temperature = config.temperature ?? 0.7;
        this.maxTokens = config.maxTokens ?? 100;
        this.config = config;
        this.eventBus = config.eventBus || null;
        this.debug = config.debug ?? false;
        this.loadTimeout = config.loadTimeout ?? 60000; // 60s default timeout for model loading
    }

    _emitDebug(message, data = {}) {
        if (this.debug && this.eventBus) {
            this.eventBus.emit('lm:debug', {
                provider: this.id,
                message,
                timestamp: Date.now(),
                ...data
            });
        }
    }

    _emitEvent(eventName, data = {}) {
        emitProviderEvent(this, this.eventBus, eventName, data, this.id);
    }

    async process(prompt, options = {}) {
        return typeof this.generateText === 'function'
            ? this.generateText(prompt, options)
            : prompt;
    }

    async generateHypothesis(observations, options = {}) {
        const observationsText = observations.join('\n');
        const prompt = `Based on these observations:\n${observationsText}\n\nGenerate a hypothesis about what might be happening:`;
        return this.process(prompt, options);
    }

    async streamText(prompt, options = {}) {
        throw new Error(`Streaming not implemented for ${this.constructor.name}. Implement in subclass.`);
    }

    getModelName() {
        return this.config.modelName || this.id;
    }
}