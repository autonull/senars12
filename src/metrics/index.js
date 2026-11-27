import { perSecond } from '@senars/util/numeric';
import { systemClock } from '@senars/util/clock';
const freshSystem = () => ({
    totalDerivations: 0,
    totalSteps: 0,
    errors: 0,
    warnings: 0,
});
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
export class MetricsCollector {
    #startedAt = systemClock();
    #system = freshSystem();
    recordDerivations(count = 1) {
        this.#system.totalDerivations += count;
    }
    recordSteps(count = 1) {
        this.#system.totalSteps += count;
    }
    recordError() {
        this.#system.errors++;
    }
    recordWarning() {
        this.#system.warnings++;
    }
    getSystemStats() {
        const uptime = systemClock() - this.#startedAt;
        return {
            ...this.#system,
            uptime,
            derivationsPerSecond: perSecond(this.#system.totalDerivations, uptime),
        };
    }
    getSummary() {
        return { system: this.getSystemStats() };
    }
    reset() {
        this.#system = freshSystem();
    }
}
// Prometheus metrics
export { handleMetricsRequest } from './http';
export { createReasoningRoute, DEFAULT_ASK_RUNS, MAX_ASK_RUNS, REASONING_HTTP_ENV, } from './reasoning-http';
export { getMetricsAsJson, getMetricsAsText, prometheusRegistry, recordCircuitBreakerState, recordDerivation, recordLmProbe, recordLmSpend, } from './prometheus';
