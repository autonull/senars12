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
            halfOpenRequests: config.halfOpenRequests ?? 3
        };
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
                this.state = 'half-open';
                this.failures = 0;
            } else {
                throw new Error('Circuit breaker is open');
            }
        }

        try {
            const result = await fn();
            if (this.state === 'half-open') {
                this.state = 'closed';
                this.failures = 0;
            }
            return result;
        } catch (err) {
            this.recordFailure();
            throw err;
        }
    }

    private recordFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.config.failureThreshold) {
            this.state = 'open';
        }
    }

    getState(): string {
        return this.state;
    }

    reset(): void {
        this.state = 'closed';
        this.failures = 0;
    }
}