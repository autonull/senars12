import { createLogger } from '../logger';
import { OperationError } from '../types';

const logger = createLogger({ scope: 'circuit-breaker' });

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenRequests: number;
  /** Downgrade routine state-change/rejection logs to debug (graceful degradation). */
  quiet?: boolean;
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
      quiet: config.quiet ?? false,
    };
  }

  private log(msg: string, level: 'info' | 'warn'): void {
    if (this.config.quiet) {
      logger.debug(msg);
    } else if (level === 'warn') {
      logger.warn(msg);
    } else {
      logger.info(msg);
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.log('Circuit breaker state changed: open -> half-open', 'info');
        this.state = 'half-open';
        this.failures = 0;
      } else {
        this.log('Circuit breaker execution rejected: circuit is open', 'warn');
        throw new OperationError('Circuit breaker is open', { state: this.state });
      }
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.log('Circuit breaker state changed: half-open -> closed', 'info');
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
    if (this.state !== 'closed') this.log('Circuit breaker state reset to closed', 'info');
    this.state = 'closed';
    this.failures = 0;
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.config.failureThreshold) {
      if (this.state !== 'open')
        this.log('Circuit breaker state changed: ' + this.state + ' -> open', 'warn');
      this.state = 'open';
    }
  }
}
