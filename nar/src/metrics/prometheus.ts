import { Registry, Counter, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a registry for our metrics
export const prometheusRegistry = new Registry();

// Add default Node.js metrics (CPU, memory, etc.)
collectDefaultMetrics({ register: prometheusRegistry, prefix: 'senars_' });

// LM probe metrics
export const lmProbeTotal = new Counter({
  name: 'senars_lm_probe_total',
  help: 'Total number of LM health probes',
  labelNames: ['provider', 'result'],
  registers: [prometheusRegistry],
});

// Circuit breaker state metrics
export const lmCircuitState = new Gauge({
  name: 'senars_lm_circuit_state',
  help: 'Current circuit breaker state (0=closed, 1=half-open, 2=open)',
  labelNames: ['provider', 'state'],
  registers: [prometheusRegistry],
});

// LM call metrics
export const lmCallsTotal = new Counter({
  name: 'senars_lm_calls_total',
  help: 'Total number of LM calls',
  labelNames: ['provider', 'model', 'result'],
  registers: [prometheusRegistry],
});

export const lmCallDurationMs = new Gauge({
  name: 'senars_lm_call_duration_ms',
  help: 'Duration of last LM call in milliseconds',
  labelNames: ['provider', 'model'],
  registers: [prometheusRegistry],
});

export const lmSpendTokens = new Counter({
  name: 'lm_spend_tokens',
  help: 'H3: cumulative spend-accounted tokens per provider',
  labelNames: ['provider'],
  registers: [prometheusRegistry],
});

export const lmSpendCostMilli = new Counter({
  name: 'lm_spend_cost_milli',
  help: 'H3: cumulative cost in milli-dollars per provider',
  labelNames: ['provider'],
  registers: [prometheusRegistry],
});

export const lmTokensTotal = new Counter({
  name: 'senars_lm_tokens_total',
  help: 'Total number of tokens used',
  labelNames: ['provider', 'model', 'type'], // type: input, output, total
  registers: [prometheusRegistry],
});

// Memory metrics
export const memoryEpisodesTotal = new Gauge({
  name: 'senars_memory_episodes_total',
  help: 'Total number of episodes in memory',
  registers: [prometheusRegistry],
});

export const memoryRetrievalHitRate = new Gauge({
  name: 'senars_memory_retrieval_hit_rate',
  help: 'Memory retrieval hit rate',
  registers: [prometheusRegistry],
});

// Derivation metrics
export const derivationsTotal = new Counter({
  name: 'senars_derivations_total',
  help: 'Total number of derivations',
  labelNames: ['rule', 'result'], // result: success, failure
  registers: [prometheusRegistry],
});

export const derivationDurationMs = new Gauge({
  name: 'senars_derivation_duration_ms',
  help: 'Duration of last derivation in milliseconds',
  labelNames: ['rule'],
  registers: [prometheusRegistry],
});

// System metrics
export const systemUptimeSeconds = new Gauge({
  name: 'senars_system_uptime_seconds',
  help: 'System uptime in seconds',
  registers: [prometheusRegistry],
});

export const systemErrorsTotal = new Counter({
  name: 'senars_system_errors_total',
  help: 'Total number of system errors',
  registers: [prometheusRegistry],
});

export const systemWarningsTotal = new Counter({
  name: 'senars_system_warnings_total',
  help: 'Total number of system warnings',
  registers: [prometheusRegistry],
});

// Helper functions to update metrics
export function recordLmProbe(provider: string, success: boolean): void {
  lmProbeTotal.inc({ provider, result: success ? 'success' : 'failure' });
}

export function recordCircuitBreakerState(provider: string, state: 'closed' | 'half-open' | 'open'): void {
  const stateValue = state === 'closed' ? 0 : state === 'half-open' ? 1 : 2;
  // Reset all states for this provider
  ['closed', 'half-open', 'open'].forEach((s) => {
    lmCircuitState.set({ provider, state: s }, s === state ? 1 : 0);
  });
}

export function recordLmSpend(provider: string, tokens: number, costMilli: number): void {
  lmSpendTokens.inc({ provider }, tokens);
  lmSpendCostMilli.inc({ provider }, costMilli);
}

export function recordLmCall(provider: string, model: string, success: boolean, durationMs: number, inputTokens: number, outputTokens: number): void {
  lmCallsTotal.inc({ provider, model, result: success ? 'success' : 'failure' });
  lmCallDurationMs.set({ provider, model }, durationMs);
  lmTokensTotal.inc({ provider, model, type: 'input' }, inputTokens);
  lmTokensTotal.inc({ provider, model, type: 'output' }, outputTokens);
  lmTokensTotal.inc({ provider, model, type: 'total' }, inputTokens + outputTokens);
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

export const systemoneJudgmentLatencyMs = new Gauge({
  name: 'senars_systemone_judgment_latency_ms',
  help: 'System One judgment latency (ms) by tier',
  labelNames: ['tier'] as const,
  registers: [prometheusRegistry],
});

export const systemoneProvisionalActive = new Gauge({
  name: 'senars_systemone_provisional_active',
  help: 'Currently active provisional stamps',
  registers: [prometheusRegistry],
});

export const systemoneHeadEce = new Gauge({
  name: 'senars_systemone_head_ece',
  help: 'Rolling ECE per head',
  labelNames: ['head'] as const,
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

export function updateMemoryMetrics(episodeCount: number, hitRate: number | null): void {
  memoryEpisodesTotal.set(episodeCount);
  if (hitRate !== null) {
    memoryRetrievalHitRate.set(hitRate);
  }
}

export function updateSystemMetrics(uptimeSeconds: number, errors: number, warnings: number): void {
  systemUptimeSeconds.set(uptimeSeconds);
  systemErrorsTotal.inc(errors);
  systemWarningsTotal.inc(warnings);
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

export const embeddingCacheHitsTotal = new Counter({
  name: 'senars_embedding_cache_hits_total',
  help: 'System One embedding cache hits',
  registers: [prometheusRegistry],
});

export const embeddingCacheMissesTotal = new Counter({
  name: 'senars_embedding_cache_misses_total',
  help: 'System One embedding cache misses',
  registers: [prometheusRegistry],
});

export const embeddingCacheEvictionsTotal = new Counter({
  name: 'senars_embedding_cache_evictions_total',
  help: 'System One embedding cache LRU evictions',
  registers: [prometheusRegistry],
});

export const embeddingCacheSize = new Gauge({
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

// Export metrics in Prometheus format
export async function getMetricsAsText(): Promise<string> {
  return prometheusRegistry.metrics();
}

export async function getMetricsAsJson(): Promise<Record<string, unknown>> {
  const metrics = await prometheusRegistry.getMetricsAsJSON();
  return metrics.reduce((acc, metric) => {
    acc[metric.name] = metric.values;
    return acc;
  }, {} as Record<string, unknown>);
}