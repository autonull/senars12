import {createLogger} from '../logger';
import {OperationError} from '../types';

const logger = createLogger({scope: 'circuit-breaker'});

export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeoutMs: number;
    halfOpenRequests: number;
}

export class CircuitBreaker {
    private state: 'closed' | 'open' | 'half-open' = 'closed';
    private failures = 0;
    private lastFailureTime = 0;
    private config: CircuitBreakerConfig;

    constructor(config: Partial<CircuitBreakerConfig> = {}) {
        this.config = {
            failureThreshold: config.failureThreshold ?? 5,
            resetTimeoutMs: config.resetTimeoutMs ?? 30000,
            halfOpenRequests: config.halfOpenRequests ?? 3,
        };
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
                logger.info('Circuit breaker state changed: open -> half-open');
                this.state = 'half-open';
                this.failures = 0;
            } else {
                logger.warn('Circuit breaker execution rejected: circuit is open');
                throw new OperationError('Circuit breaker is open', {state: this.state});
            }
        }

        try {
            const result = await fn();
            if (this.state === 'half-open') {
                logger.info('Circuit breaker state changed: half-open -> closed');
                this.state = 'closed';
                this.failures = 0;
            }
            return result;
        } catch (err) {
            this.recordFailure();
            throw err;
        }
    }

    getState(): string {
        return this.state;
    }

    reset(): void {
        if (this.state !== 'closed') logger.info('Circuit breaker state reset to closed');
        this.state = 'closed';
        this.failures = 0;
    }

    private recordFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.config.failureThreshold) {
            if (this.state !== 'open')
                logger.warn('Circuit breaker state changed: ' + this.state + ' -> open');
            this.state = 'open';
        }
    }
}
