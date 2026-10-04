import {
  type CallTally,
  CallTallySeries,
  createCallTally,
  perSecond,
  systemClock,
} from '@senars/util';

/**
 * Per-rule execution tallies.
 *
 * Rule ids arrive from the loaded rule set, which is bounded by the rule table —
 * but a rule set deserialized off disk is still data, so the series carries its
 * own capacity rather than trusting the loader.
 */
export interface RuleStats extends CallTally {
  id: string;
}

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
  rules: RuleStats[];
  system: SystemStats;
}

const MAX_TRACKED_RULES = 4096;

const freshSystem = (): Omit<SystemStats, 'uptime' | 'derivationsPerSecond'> => ({
  totalDerivations: 0,
  totalSteps: 0,
  errors: 0,
  warnings: 0,
});

export class MetricsCollector {
  readonly #rules = new CallTallySeries<string, RuleStats>({
    maxSize: MAX_TRACKED_RULES,
    create: (id) => ({ ...createCallTally(), id }),
  });
  readonly #startedAt = systemClock();
  #system = freshSystem();

  recordRuleExecution(ruleId: string, success: boolean, duration: number): void {
    this.#rules.record(ruleId, success, duration);
  }

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

  getRuleStats(ruleId: string): RuleStats | null;
  getRuleStats(): RuleStats[];
  getRuleStats(ruleId?: string): RuleStats | RuleStats[] | null {
    if (ruleId !== undefined) return this.#rules.get(ruleId) ?? null;
    return [...this.#rules.values()];
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
    return { rules: this.getRuleStats(), system: this.getSystemStats() };
  }

  reset(): void {
    this.#rules.clear();
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
