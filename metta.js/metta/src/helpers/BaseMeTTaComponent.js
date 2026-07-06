import {BaseComponent} from '@senars/core';
import {configManager} from '../config/config.js';

export class BaseMeTTaComponent extends BaseComponent {
    #mettaMetrics = new Map();

    constructor(config = {}, name = 'BaseMeTTaComponent', eventBus = null, termFactory = null) {
        super(config, name, eventBus);
        this.termFactory = termFactory;
    }

    emitMeTTaEvent(eventName, data) {
        this.emitEvent(`metta:${eventName}`, () => ({
            component: this._name,
            timestamp: Date.now(),
            ...data
        }));
    }

    #updateMetrics(key, duration) {
        const c = this.#mettaMetrics.get(key) ?? {count: 0, totalTime: 0, errors: 0, avgTime: 0, lastDuration: 0};
        const count = c.count + 1;
        const total = c.totalTime + duration;
        this.#mettaMetrics.set(key, {
            count,
            totalTime: total,
            errors: c.errors,
            avgTime: total / count,
            lastDuration: duration
        });
    }

    #recordError(key) {
        const c = this.#mettaMetrics.get(key);
        this.#mettaMetrics.set(key, {...c, errors: (c?.errors ?? 0) + 1});
    }

    trackOperation(opName, fn) {
        const start = Date.now();
        const key = `${this._name}.${opName}`;

        try {
            const result = fn();
            const duration = Date.now() - start;
            this.#updateMetrics(key, duration);
            if (duration > configManager.get('slowOpThreshold')) {
                this.emitMeTTaEvent('slow-operation', {opName, duration});
            }
            return result;
        } catch (error) {
            this.#recordError(key);
            this.logError(`${opName} failed`, {error: error.message, stack: error.stack});
            this.emitMeTTaEvent('operation-error', {opName, error: error.message});
            throw error;
        }
    }

    async trackOperationAsync(opName, fn) {
        const start = Date.now();
        const key = `${this._name}.${opName}`;

        try {
            const result = await fn();
            this.#updateMetrics(key, Date.now() - start);
            return result;
        } catch (error) {
            this.#recordError(key);
            this.logError(`${opName} failed`, {error: error.message});
            this.emitMeTTaEvent('operation-error', {opName, error: error.message});
            throw error;
        }
    }

    getMeTTaMetrics() {
        return Object.fromEntries([...this.#mettaMetrics].map(([k, v]) => [k, {...v}]));
    }

    setMetric(key, value) {
        this.#mettaMetrics.set(key, value);
    }

    resetMeTTaMetrics() {
        this.#mettaMetrics.clear();
    }

    getStats() {
        return {...super.getMetrics(), mettaMetrics: this.getMeTTaMetrics(), component: this._name};
    }
}
