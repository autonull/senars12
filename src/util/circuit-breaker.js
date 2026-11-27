/**
 * The single circuit-breaker state machine.
 *
 * `CircuitBreaker.execute` is the one await path — admission, outcome, state
 * transition — and the per-provider routing health in `lm/provider-runtime.ts` is
 * built on this class; neither re-implements closed → open → half-open → closed.
 */
import { OperationError } from '@senars/errors';
import { createLogger } from '@senars/util/logger';
const logger = createLogger({ scope: 'circuit-breaker' });
export class CircuitBreaker {
    #state = 'closed';
    #failures = 0;
    #successes = 0;
    #lastFailure = null;
    #lastSuccess = null;
    config;
    constructor(config = {}) {
        this.config = {
            failureThreshold: config.failureThreshold ?? 5,
            resetTimeoutMs: config.resetTimeoutMs ?? 30_000,
            successThreshold: config.successThreshold ?? 1,
            quiet: config.quiet,
            onTransition: config.onTransition,
        };
    }
    /** Apply new tunables in place — state survives a settings change. */
    configure(config) {
        this.config = { ...this.config, ...config };
    }
    get state() {
        return this.#state;
    }
    snapshot() {
        return {
            state: this.#state,
            consecutiveFailures: this.#failures,
            consecutiveSuccesses: this.#successes,
            lastFailure: this.#lastFailure,
            lastSuccess: this.#lastSuccess,
        };
    }
    /** Admit a call? Moves an expired open circuit to half-open first. */
    canRequest() {
        if (this.#state !== 'open')
            return true;
        if (this.#lastFailure !== null &&
            Date.now() - this.#lastFailure >= this.config.resetTimeoutMs) {
            this.#to('half-open', 'reset_timeout_elapsed');
            return true;
        }
        return false;
    }
    record(success) {
        if (success) {
            this.#successes++;
            this.#failures = 0;
            this.#lastSuccess = Date.now();
            if (this.#state === 'half-open' && this.#successes >= this.config.successThreshold)
                this.close();
            return;
        }
        this.#failures++;
        this.#successes = 0;
        this.#lastFailure = Date.now();
        if (this.#state !== 'open' && this.#failures >= this.config.failureThreshold) {
            this.#to('open', 'failure_threshold_exceeded');
        }
        else if (this.#state === 'half-open') {
            this.#to('open', 'failure_threshold_exceeded');
        }
    }
    /** Force the circuit to half-open — used when an out-of-band probe succeeds. */
    halfOpen(reason = 'probe_recovered') {
        this.#successes = 0;
        this.#to('half-open', reason);
    }
    /**
     * Run `fn` under this breaker: one admission test, then the outcome recorded
     * either way. The single await path — the free function it replaces tested
     * `canRequest()` and then re-tested it inside, so a state that flipped between
     * the two checks admitted work the breaker had already refused.
     */
    async execute(fn) {
        if (!this.canRequest()) {
            this.log('Circuit breaker execution rejected: circuit is open', 'warn');
            throw new OperationError('Circuit breaker is open', { state: this.#state });
        }
        try {
            const result = await fn();
            this.record(true);
            return result;
        }
        catch (err) {
            this.record(false);
            throw err;
        }
    }
    reset() {
        this.#failures = 0;
        this.#successes = 0;
        if (this.#state !== 'closed')
            this.#to('closed', 'reset');
    }
    close() {
        this.#failures = 0;
        this.#successes = 0;
        this.#to('closed', 'success_threshold_met');
    }
    set onTransition(hook) {
        this.config = { ...this.config, onTransition: hook };
    }
    #to(state, reason) {
        if (this.#state === state)
            return;
        const from = this.#state;
        this.#state = state;
        if (from === 'half-open' && state === 'open') {
            this.#failures = 0;
        }
        this.log(`Circuit breaker state changed: ${from} -> ${state}`, state === 'open' ? 'warn' : 'info');
        this.config.onTransition?.(state, reason);
    }
    log(msg, level) {
        if (this.config.quiet)
            logger.debug(msg);
        else if (level === 'warn')
            logger.warn(msg);
        else
            logger.info(msg);
    }
}
