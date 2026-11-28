import { type CircuitState } from '@senars/types/llm';
import { Registry } from '@prometheus-io/client';
export declare const prometheusRegistry: Registry<import("@prometheus-io/client").RegistryContentType>;
export declare function recordLmProbe(provider: string, success: boolean): void;
export declare function recordCircuitBreakerState(provider: string, state: CircuitState): void;
export declare function recordLmSpend(provider: string, tokens: number, costMilli: number): void;
export declare function recordDerivation(rule: string, success: boolean, durationMs: number): void;
export declare const systemoneJudgmentsTotal: any;
export declare function recordJudgmentMetric(axis: string, shape: string, tier: number, abstained: boolean, latencyMs: number): void;
export declare const gateDecisionsTotal: any;
export declare const gateVetoesTotal: any;
export declare const schemaPromotionsTotal: any;
export declare const handoversTotal: any;
export declare const bagPressure: any;
/** P2/§5s: per-event cache telemetry (no object churn in the hot path). */
export declare function recordEmbeddingCacheEvent(event: 'hit' | 'miss' | 'eviction', size: number): void;
/** A full-but-bounded memo is a signal the status surface should not infer. */
export declare function recordStrategyMemoSize(strategy: string, size: number): void;
export declare function getMetricsAsText(): Promise<string>;
export declare function getMetricsAsJson(): Promise<Record<string, unknown>>;
//# sourceMappingURL=prometheus.d.ts.map