/**
 * Base Tool class that all tools should extend
 */

import {ExecutionTracker} from '../util/ExecutionTracker.js';
import {executeGuarded} from '../util/guard.js';
import {validateJsonSchema} from '../util/validate.js';

export class BaseTool {
    constructor(config = {}) {
        this.config = config;
        this.name = this.constructor.name;
        this.createdAt = Date.now();
        this._executionTracker = new ExecutionTracker();
    }

    async execute(params, context, options = {}) {
        const startTime = Date.now();

        return executeGuarded(
            () => this.validate(params),
            async () => {
                await this.beforeExecute(params, context);
                const result = await this._executeImpl(params, context);
                return this.afterExecute(result, params, context);
            },
            {context: `Tool:${this.name}`, defaultValue: null, ...options}
        ).then(result => {
            if (result !== null) {
                this._executionTracker.record(true, Date.now() - startTime);
            }
            return result;
        });
    }

    async _executeImpl(params, context) {
        throw new Error('Tool must implement _executeImpl method');
    }

    getDescription() {
        throw new Error('Tool must implement getDescription method');
    }

    getParameterSchema() {
        return {type: 'object', properties: {}, required: []};
    }

    validate(params) {
        return validateJsonSchema(params, this.getParameterSchema(), `Tool:${this.name}`);
    }

    getCapabilities() {
        return [];
    }

    getCategory() {
        return 'general';
    }

    async beforeExecute(params, context) {
    }

    async afterExecute(result, params, context) {
        return result;
    }

    getStats() {
        return {
            name: this.name,
            ...this._executionTracker.stats,
            createdAt: this.createdAt
        };
    }

    isReady() {
        return true;
    }

    async shutdown() {
    }
}