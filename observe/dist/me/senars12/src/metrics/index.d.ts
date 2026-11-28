/** What the kernel counts about itself. Every field is bumped in place. */
export interface SystemStats {
    totalDerivations: number;
    totalSteps: number;
    errors: number;
    warnings: number;
    /** Epoch ms since the collector was constructed. */
    uptime: number;
    /** `totalDerivations` over `uptime` — derived on read, so it cannot go stale. */
    derivationsPerSecond: number;
}
export interface MetricsSummary {
    system: SystemStats;
}
/**
 * What the kernel counts about itself — the counters it bumps as it runs.
 *
 * Per-rule performance is deliberately *not* here. It used to be, as a series
 * nothing wrote: the only writer was a facade method with no production caller,
 * while the rule processor already tallied the same fact for the selector that
 * scores with it. A second tally of a known fact is a store that can disagree,
 * and this one disagreed by being empty — eight analyzers and a report read
 * "no rules have run" from it while rules ran. The processor owns that record;
 * ask `RuleProcessor.getModelRuleStats()`.
 */
export declare class MetricsCollector {
    #private;
    recordDerivations(count?: number): void;
    recordSteps(count?: number): void;
    recordError(): void;
    recordWarning(): void;
    getSystemStats(): SystemStats;
    getSummary(): MetricsSummary;
    reset(): void;
}
export { handleMetricsRequest } from './http';
export { createReasoningRoute, DEFAULT_ASK_RUNS, MAX_ASK_RUNS, REASONING_HTTP_ENV, type ReasoningAnswer, type ReasoningHttpEngine, } from './reasoning-http';
export { getMetricsAsJson, getMetricsAsText, prometheusRegistry, recordCircuitBreakerState, recordDerivation, recordLmProbe, recordLmSpend, } from './prometheus';
//# sourceMappingURL=index.d.ts.map