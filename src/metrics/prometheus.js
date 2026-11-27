import { CIRCUIT_STATES } from '@senars/types/llm';
import { collectDefaultMetrics, Counter, Gauge, Registry, } from '@prometheus-io/client';
// Create a registry for our metrics
export const prometheusRegistry = new Registry();
// Add default Node.js metrics (CPU, memory, etc.)
collectDefaultMetrics({ register: prometheusRegistry, prefix: 'senars_' });
/**
 * Every metric in this file, registered against the one registry via registerMetric().
 * This avoids the prom-client pattern of passing `registers` in the constructor.
 * Types are `any` because @prometheus-io/client types don't support label inference.
 */
const counter = (config) => {
    const c = new Counter(config);
    prometheusRegistry.registerMetric(c);
    return c;
};
const gauge = (config) => {
    const g = new Gauge(config);
    prometheusRegistry.registerMetric(g);
    return g;
};
// LM probe metrics
const lmProbeTotal = counter({
    name: 'senars_lm_probe_total',
    help: 'Total number of LM health probes',
    labelNames: ['provider', 'result'],
});
// Circuit breaker state metrics
const lmCircuitState = gauge({
    name: 'senars_lm_circuit_state',
    help: 'Current circuit breaker state (0=closed, 1=half-open, 2=open)',
    labelNames: ['provider', 'state'],
});
const lmSpendTokens = counter({
    name: 'lm_spend_tokens',
    help: 'H3: cumulative spend-accounted tokens per provider',
    labelNames: ['provider'],
});
const lmSpendCostMilli = counter({
    name: 'lm_spend_cost_milli',
    help: 'H3: cumulative cost in milli-dollars per provider',
    labelNames: ['provider'],
});
// Derivation metrics
const derivationsTotal = counter({
    name: 'senars_derivations_total',
    help: 'Total number of derivations',
    labelNames: ['rule', 'result'], // result: success, failure
});
const derivationDurationMs = gauge({
    name: 'senars_derivation_duration_ms',
    help: 'Duration of last derivation in milliseconds',
    labelNames: ['rule'],
});
// Helper functions to update metrics
export function recordLmProbe(provider, success) {
    lmProbeTotal.inc({ provider, result: success ? 'success' : 'failure' });
}
export function recordCircuitBreakerState(provider, state) {
    // Reset all states for this provider
    CIRCUIT_STATES.forEach((s) => {
        lmCircuitState.set({ provider, state: s }, s === state ? 1 : 0);
    });
}
export function recordLmSpend(provider, tokens, costMilli) {
    lmSpendTokens.inc({ provider }, tokens);
    lmSpendCostMilli.inc({ provider }, costMilli);
}
export function recordDerivation(rule, success, durationMs) {
    derivationsTotal.inc({ rule, result: success ? 'success' : 'failure' });
    derivationDurationMs.set({ rule }, durationMs);
}
// ─── System One (TODO16 §11.2) ──────────────────────────────────────────────
export const systemoneJudgmentsTotal = counter({
    name: 'senars_systemone_judgments_total',
    help: 'Total System One judgments resolved',
    labelNames: ['axis', 'shape', 'tier', 'abstained'],
});
const systemoneJudgmentLatencyMs = gauge({
    name: 'senars_systemone_judgment_latency_ms',
    help: 'System One judgment latency (ms) by tier',
    labelNames: ['tier'],
});
export function recordJudgmentMetric(axis, shape, tier, abstained, latencyMs) {
    systemoneJudgmentsTotal.inc({ axis, shape, tier: String(tier), abstained: String(abstained) });
    systemoneJudgmentLatencyMs.set({ tier: String(tier) }, latencyMs);
}
// O4 (TODO20): gate decisions, vetoes, schema promotions, handovers, bag pressure
export const gateDecisionsTotal = counter({
    name: 'senars_gate_decisions_total',
    help: 'Gate decisions by gate type and outcome',
    labelNames: ['gate', 'decision'],
});
export const gateVetoesTotal = counter({
    name: 'senars_gate_vetoes_total',
    help: 'Gate vetoes by gate type and reason',
    labelNames: ['gate', 'reason'],
});
export const schemaPromotionsTotal = counter({
    name: 'senars_schema_promotions_total',
    help: 'Schemas promoted into the schema store',
    labelNames: ['scope'],
});
export const handoversTotal = counter({
    name: 'senars_handovers_total',
    help: 'Review-band handovers to the heuristic baseline (GameFocus E2)',
    labelNames: [],
});
export const bagPressure = gauge({
    name: 'senars_bag_pressure',
    help: 'Priority-bag pressure by bag name',
    labelNames: ['bag'],
});
const embeddingCacheHitsTotal = counter({
    name: 'senars_embedding_cache_hits_total',
    help: 'System One embedding cache hits',
    labelNames: [],
});
const embeddingCacheMissesTotal = counter({
    name: 'senars_embedding_cache_misses_total',
    help: 'System One embedding cache misses',
    labelNames: [],
});
const embeddingCacheEvictionsTotal = counter({
    name: 'senars_embedding_cache_evictions_total',
    help: 'System One embedding cache LRU evictions',
    labelNames: [],
});
const embeddingCacheSize = gauge({
    name: 'senars_embedding_cache_size',
    help: 'Current System One embedding cache entry count',
    labelNames: [],
});
/** P2/§5s: per-event cache telemetry (no object churn in the hot path). */
export function recordEmbeddingCacheEvent(event, size) {
    if (event === 'hit')
        embeddingCacheHitsTotal.inc();
    else if (event === 'miss')
        embeddingCacheMissesTotal.inc();
    else
        embeddingCacheEvictionsTotal.inc();
    embeddingCacheSize.set(size);
}
/** TODO27 §18.4: memo occupancy per strategy slot (tier 1 + tier 2). */
const strategyMemoSize = gauge({
    name: 'senars_strategy_memo_size',
    help: 'Memoized strategy instances held per slot, bounded by the registry limit',
    labelNames: ['strategy'],
});
/** A full-but-bounded memo is a signal the status surface should not infer. */
export function recordStrategyMemoSize(strategy, size) {
    strategyMemoSize.set({ strategy }, size);
}
// Export metrics in Prometheus format
export async function getMetricsAsText() {
    return prometheusRegistry.metrics();
}
export async function getMetricsAsJson() {
    const metrics = await prometheusRegistry.getMetricsAsJSON();
    return metrics.reduce((acc, metric) => {
        acc[metric.name] = metric.values;
        return acc;
    }, {});
}
