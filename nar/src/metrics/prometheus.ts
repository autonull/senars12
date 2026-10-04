import { Counter, collectDefaultMetrics, Gauge, Registry } from 'prom-client';

// Create a registry for our metrics
export const prometheusRegistry = new Registry();

// Add default Node.js metrics (CPU, memory, etc.)
collectDefaultMetrics({ register: prometheusRegistry, prefix: 'senars_' });

// LM probe metrics
const lmProbeTotal = new Counter({
  name: 'senars_lm_probe_total',
  help: 'Total number of LM health probes',
  labelNames: ['provider', 'result'],
  registers: [prometheusRegistry],
});

// Circuit breaker state metrics
const lmCircuitState = new Gauge({
  name: 'senars_lm_circuit_state',
  help: 'Current circuit breaker state (0=closed, 1=half-open, 2=open)',
  labelNames: ['provider', 'state'],
  registers: [prometheusRegistry],
});

const lmSpendTokens = new Counter({
  name: 'lm_spend_tokens',
  help: 'H3: cumulative spend-accounted tokens per provider',
  labelNames: ['provider'],
  registers: [prometheusRegistry],
});

const lmSpendCostMilli = new Counter({
  name: 'lm_spend_cost_milli',
  help: 'H3: cumulative cost in milli-dollars per provider',
  labelNames: ['provider'],
  registers: [prometheusRegistry],
});

// Derivation metrics
const derivationsTotal = new Counter({
  name: 'senars_derivations_total',
  help: 'Total number of derivations',
  labelNames: ['rule', 'result'], // result: success, failure
  registers: [prometheusRegistry],
});

const derivationDurationMs = new Gauge({
  name: 'senars_derivation_duration_ms',
  help: 'Duration of last derivation in milliseconds',
  labelNames: ['rule'],
  registers: [prometheusRegistry],
});

// Helper functions to update metrics
export function recordLmProbe(provider: string, success: boolean): void {
  lmProbeTotal.inc({ provider, result: success ? 'success' : 'failure' });
}

export function recordCircuitBreakerState(
  provider: string,
  state: 'closed' | 'half-open' | 'open'
): void {
  // Reset all states for this provider
  ['closed', 'half-open', 'open'].forEach((s) => {
    lmCircuitState.set({ provider, state: s }, s === state ? 1 : 0);
  });
}

export function recordLmSpend(provider: string, tokens: number, costMilli: number): void {
  lmSpendTokens.inc({ provider }, tokens);
  lmSpendCostMilli.inc({ provider }, costMilli);
}

export function recordDerivation(rule: string, success: boolean, durationMs: number): void {
  derivationsTotal.inc({ rule, result: success ? 'success' : 'failure' });
  derivationDurationMs.set({ rule }, durationMs);
}

// ─── System One (TODO16 §11.2) ──────────────────────────────────────────────

export const systemoneJudgmentsTotal = new Counter({
  name: 'senars_systemone_judgments_total',
  help: 'Total System One judgments resolved',
  labelNames: ['axis', 'shape', 'tier', 'abstained'] as const,
  registers: [prometheusRegistry],
});

const systemoneJudgmentLatencyMs = new Gauge({
  name: 'senars_systemone_judgment_latency_ms',
  help: 'System One judgment latency (ms) by tier',
  labelNames: ['tier'] as const,
  registers: [prometheusRegistry],
});

export function recordJudgmentMetric(
  axis: string,
  shape: string,
  tier: number,
  abstained: boolean,
  latencyMs: number
): void {
  systemoneJudgmentsTotal.inc({ axis, shape, tier: String(tier), abstained: String(abstained) });
  systemoneJudgmentLatencyMs.set({ tier: String(tier) }, latencyMs);
}

// O4 (TODO20): gate decisions, vetoes, schema promotions, handovers, bag pressure
export const gateDecisionsTotal = new Counter({
  name: 'senars_gate_decisions_total',
  help: 'Gate decisions by gate type and outcome',
  labelNames: ['gate', 'decision'] as const,
  registers: [prometheusRegistry],
});

export const gateVetoesTotal = new Counter({
  name: 'senars_gate_vetoes_total',
  help: 'Gate vetoes by gate type and reason',
  labelNames: ['gate', 'reason'] as const,
  registers: [prometheusRegistry],
});

export const schemaPromotionsTotal = new Counter({
  name: 'senars_schema_promotions_total',
  help: 'Schemas promoted into the schema store',
  labelNames: ['scope'] as const,
  registers: [prometheusRegistry],
});

export const handoversTotal = new Counter({
  name: 'senars_handovers_total',
  help: 'Review-band handovers to the heuristic baseline (GameFocus E2)',
  registers: [prometheusRegistry],
});

export const bagPressure = new Gauge({
  name: 'senars_bag_pressure',
  help: 'Priority-bag pressure by bag name',
  labelNames: ['bag'] as const,
  registers: [prometheusRegistry],
});

const embeddingCacheHitsTotal = new Counter({
  name: 'senars_embedding_cache_hits_total',
  help: 'System One embedding cache hits',
  registers: [prometheusRegistry],
});

const embeddingCacheMissesTotal = new Counter({
  name: 'senars_embedding_cache_misses_total',
  help: 'System One embedding cache misses',
  registers: [prometheusRegistry],
});

const embeddingCacheEvictionsTotal = new Counter({
  name: 'senars_embedding_cache_evictions_total',
  help: 'System One embedding cache LRU evictions',
  registers: [prometheusRegistry],
});

const embeddingCacheSize = new Gauge({
  name: 'senars_embedding_cache_size',
  help: 'Current System One embedding cache entry count',
  registers: [prometheusRegistry],
});

/** P2/§5s: per-event cache telemetry (no object churn in the hot path). */
export function recordEmbeddingCacheEvent(event: 'hit' | 'miss' | 'eviction', size: number): void {
  if (event === 'hit') embeddingCacheHitsTotal.inc();
  else if (event === 'miss') embeddingCacheMissesTotal.inc();
  else embeddingCacheEvictionsTotal.inc();
  embeddingCacheSize.set(size);
}

/** TODO27 §18.4: memo occupancy per strategy slot (tier 1 + tier 2). */
const strategyMemoSize = new Gauge({
  name: 'senars_strategy_memo_size',
  help: 'Memoized strategy instances held per slot, bounded by the registry limit',
  labelNames: ['strategy'] as const,
  registers: [prometheusRegistry],
});

/** A full-but-bounded memo is a signal the status surface should not infer. */
export function recordStrategyMemoSize(strategy: string, size: number): void {
  strategyMemoSize.set({ strategy }, size);
}

// Export metrics in Prometheus format
export async function getMetricsAsText(): Promise<string> {
  return prometheusRegistry.metrics();
}

export async function getMetricsAsJson(): Promise<Record<string, unknown>> {
  const metrics = await prometheusRegistry.getMetricsAsJSON();
  return metrics.reduce(
    (acc, metric) => {
      acc[metric.name] = metric.values;
      return acc;
    },
    {} as Record<string, unknown>
  );
}
