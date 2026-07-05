/**
 * Circuit breaker pattern implementation for fault tolerance
 */
import {Logger} from './Logger.js';

export class CircuitBreaker {
    static STATES = {
        CLOSED: 'CLOSED',
        OPEN: 'OPEN',
        HALF_OPEN: 'HALF_OPEN'
    };

    constructor(options = {}) {
        this.options = {
            failureThreshold: options.failureThreshold || 5,
            timeout: options.timeout || 60000,
            resetTimeout: options.resetTimeout || 30000,
            halfOpenAttempts: options.halfOpenAttempts || 1,
            onStateChange: options.onStateChange || null,
            ...options
        };

        this.state = CircuitBreaker.STATES.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.successCount = 0;
    }

    async execute(fn, context = {}) {
        // Check if we should transition to HALF_OPEN state
        if (this.state === CircuitBreaker.STATES.OPEN && this.isResetTimeoutExpired()) {
            this.transitionTo(CircuitBreaker.STATES.HALF_OPEN);
            this.successCount = 0;
        }

        // Check if we should open the circuit
        if (this.state !== CircuitBreaker.STATES.HALF_OPEN && this.shouldOpen()) {
            this.forceOpen();
            throw new Error('Circuit breaker is OPEN');
        }

        try {
            const result = await this._executeWithTimeout(fn, context);
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    async _executeWithTimeout(fn, context) {
        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error(`Operation timed out after ${this.options.timeout}ms`));
            }, this.options.timeout);
        });

        try {
            return await Promise.race([
                fn(context),
                timeoutPromise
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    onSuccess() {
        this.failureCount = 0;
        this.successCount++;

        if (this.state === CircuitBreaker.STATES.HALF_OPEN && this.successCount >= this.options.halfOpenAttempts) {
            this.transitionTo(CircuitBreaker.STATES.CLOSED);
            this.successCount = 0;
        }
    }

    onFailure() {
        this.failureCount++;
        if (this.failureCount >= this.options.failureThreshold) {
            this.forceOpen();
        }
    }

    shouldOpen() {
        return this.failureCount >= this.options.failureThreshold;
    }

    isResetTimeoutExpired() {
        return Date.now() - this.lastFailureTime >= this.options.resetTimeout;
    }

    transitionTo(newState) {
        if (this.state !== newState) {
            this.state = newState;
            if (newState === CircuitBreaker.STATES.OPEN) {
                this.lastFailureTime = Date.now();
            }
            if (this.options.onStateChange) {
                try {
                    this.options.onStateChange(newState);
                } catch (error) {
                    Logger.error('CircuitBreaker state change handler error:', error);
                }
            }
        }
    }

    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            shouldOpen: this.shouldOpen(),
            isResetTimeoutExpired: this.isResetTimeoutExpired()
        };
    }

    reset() {
        this.transitionTo(CircuitBreaker.STATES.CLOSED);
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
    }

    forceOpen() {
        this.transitionTo(CircuitBreaker.STATES.OPEN);
    }

    forceClose() {
        this.transitionTo(CircuitBreaker.STATES.CLOSED);
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
    }

    isOpen() {
        return this.state === CircuitBreaker.STATES.OPEN;
    }

    isClosed() {
        return this.state === CircuitBreaker.STATES.CLOSED;
    }

    isHalfOpen() {
        return this.state === CircuitBreaker.STATES.HALF_OPEN;
    }
}

export const withCircuitBreaker = (fn, circuitBreakerOptions = {}) => {
    const circuitBreaker = new CircuitBreaker(circuitBreakerOptions);
    return async (...args) => circuitBreaker.execute(() => fn(...args));
};
