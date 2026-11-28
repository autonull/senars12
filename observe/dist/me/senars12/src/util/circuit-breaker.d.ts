/**
 * The single circuit-breaker state machine.
 *
 * `CircuitBreaker.execute` is the one await path — admission, outcome, state
 * transition — and the per-provider routing health in `lm/provider-runtime.ts` is
 * built on this class; neither re-implements closed → open → half-open → closed.
 */
/** Circuit breaker state. */
export type CircuitState = 'closed' | 'open' | 'half-open';
export type TransitionReason = 'failure_threshold_exceeded' | 'reset_timeout_elapsed' | 'success_threshold_met' | 'probe_recovered' | 'reset';
export interface CircuitBreakerConfig {
    /** Consecutive failures before opening. */
    failureThreshold: number;
    /** Time in ms an open circuit waits before admitting a probe. */
    resetTimeoutMs: number;
    /** Successes in half-open before closing. */
    successThreshold: number;
    /** Downgrade routine state-change/rejection logs to debug (graceful degradation). */
    quiet?: boolean;
    onTransition?: (state: CircuitState, reason: TransitionReason) => void;
}
/** The tunable subset — what a settings file may carry. */
export type CircuitBreakerSettings = Pick<CircuitBreakerConfig, 'failureThreshold' | 'resetTimeoutMs' | 'successThreshold'>;
/** The counters a health read reports — the state machine's, plus nothing derived. */
export interface CircuitSnapshot {
    state: CircuitState;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    lastFailure: number | null;
    lastSuccess: number | null;
}
export declare class CircuitBreaker {
    #private;
    config: CircuitBreakerConfig;
    constructor(config?: Partial<CircuitBreakerConfig>);
    /** Apply new tunables in place — state survives a settings change. */
    configure(config: Partial<CircuitBreakerConfig>): void;
    get state(): CircuitState;
    snapshot(): CircuitSnapshot;
    /** Admit a call? Moves an expired open circuit to half-open first. */
    canRequest(): boolean;
    record(success: boolean): void;
    /** Force the circuit to half-open — used when an out-of-band probe succeeds. */
    halfOpen(reason?: TransitionReason): void;
    /**
     * Run `fn` under this breaker: one admission test, then the outcome recorded
     * either way. The single await path — the free function it replaces tested
     * `canRequest()` and then re-tested it inside, so a state that flipped between
     * the two checks admitted work the breaker had already refused.
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    reset(): void;
    close(): void;
    set onTransition(hook: CircuitBreakerConfig['onTransition']);
    private log;
}
//# sourceMappingURL=circuit-breaker.d.ts.map