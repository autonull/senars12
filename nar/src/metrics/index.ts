import { perSecond, systemClock } from '@senars/util';

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

const freshSystem = (): Omit<SystemStats, 'uptime' | 'derivationsPerSecond'> => ({
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
  readonly #startedAt = systemClock();
  #system = freshSystem();

  recordDerivations(count = 1): void {
    this.#system.totalDerivations += count;
  }

  recordSteps(count = 1): void {
    this.#system.totalSteps += count;
  }

  recordError(): void {
    this.#system.errors++;
  }

  recordWarning(): void {
    this.#system.warnings++;
  }

  getSystemStats(): SystemStats {
    const uptime = systemClock() - this.#startedAt;
    return {
      ...this.#system,
      uptime,
      derivationsPerSecond: perSecond(this.#system.totalDerivations, uptime),
    };
  }

  getSummary(): MetricsSummary {
    return { system: this.getSystemStats() };
  }

  reset(): void {
    this.#system = freshSystem();
  }
}

// Prometheus metrics
export { handleMetricsRequest } from './http.js';
export {
  getMetricsAsJson,
  getMetricsAsText,
  prometheusRegistry,
  recordCircuitBreakerState,
  recordDerivation,
  recordLmProbe,
  recordLmSpend,
} from './prometheus.js';
