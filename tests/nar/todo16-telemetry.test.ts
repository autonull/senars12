import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KernelPerceptionGate } from '../../nar/src/kernel/KernelPerceptionGate.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { SystemOneIngressJudge } from '../../nar/src/lm/system-one/ingress-judge.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { validateCognitiveEvent } from '@senars/kernel/schemas';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { JudgmentQuery } from '../../nar/src/lm/system-one/types.js';

const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

describe('System One — Telemetry Emission (R2)', () => {
  let cache: EmbeddingCache;
  let manifold: ReturnType<typeof createManifold>;
  let gate: KernelPerceptionGate;

  beforeEach(async () => {
    cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    manifold = createManifold(cache, { abstainThreshold: 0.05 });
    gate = new KernelPerceptionGate({
      systemOne: {
        enabled: true,
        judge: new SystemOneIngressJudge({ manifold, embeddingCache: cache, budget }),
      },
    });
  });

  it('emits judgment.resolved event for each proposition in batch', async () => {
    // The KernelPerceptionGate uses 6 hardcoded ingress queries
    const expectedIngressQueries = 6;

    const pointer = await cache.write('(test --> observation).');
    const result = await gate.admit({
      rawObservation: '(test --> observation).',
      sourceQuality: 'LLM_PRIOR',
      sensorConfidence: 1.0,
      sourceId: 'test-source',
    });

    console.log('Admit result:', result);
    
    // The gate's eventLog should contain judgment.resolved events
    const events = (gate as any).eventLog;
    const judgmentEvents = events.filter((e: any) => e.type === 'judgment.resolved');
    
    // Debug: print all events
    console.log('All events:', events.map((e: any) => e.type));
    console.log('SystemOne enabled:', (gate as any).config.systemOne?.enabled);
    console.log('Manifold judge:', (gate as any).judge?.constructor?.name);
    
    // Expect one event per ingress query (6 total)
    expect(judgmentEvents.length).toBe(expectedIngressQueries);
  });

  it('judgment.resolved events have correct schema and engine=proposer', async () => {
    await gate.admit({
      rawObservation: '(test --> observation).',
      sourceQuality: 'LLM_PRIOR',
      sensorConfidence: 1.0,
      sourceId: 'test-source',
    });

    const events = (gate as any).eventLog;
    const judgmentEvents = events.filter((e: any) => e.type === 'judgment.resolved');
    
    expect(judgmentEvents.length).toBe(6);
    const event = judgmentEvents[0];
    
    // Validate against kernel schema
    expect(() => validateCognitiveEvent(event)).not.toThrow();
    expect(event.engine).toBe('proposer');
    expect(event.type).toBe('judgment.resolved');
    expect(['classify', 'evaluate']).toContain(event.payload.shape);
    expect(['epistemic', 'teleological']).toContain(event.payload.axis);
    expect(event.payload.backendId).toBe('encoder-wasm-s1');
    expect(event.payload.tier).toBe(1);
    expect(typeof event.payload.latencyMs).toBe('number');
    expect(typeof event.payload.abstained).toBe('boolean');
    expect(['standard', 'provisional']).toContain(event.payload.stampType);
    expect(event.payload.calibrationVersion).toBe('v2.4.1');
    expect(event.payload.cost).toMatchObject({
      tokensIn: expect.any(Number),
      tokensOut: expect.any(Number),
      computeMs: expect.any(Number),
      memoryMb: expect.any(Number),
    });
  });

  it('records Prometheus metrics for each judgment', async () => {
    const { systemoneJudgmentsTotal } = await import('../../nar/src/metrics/prometheus.js');
    
    await gate.admit({
      rawObservation: '(test --> observation).',
      sourceQuality: 'LLM_PRIOR',
      sensorConfidence: 1.0,
      sourceId: 'test-source',
    });

    // Check that metrics were incremented
    const metrics = await systemoneJudgmentsTotal.get();
    console.log('Metrics:', JSON.stringify(metrics, null, 2));
    expect(metrics.name).toBe('senars_systemone_judgments_total');
    expect(metrics.values.length).toBeGreaterThan(0);
    const metricValue = metrics.values[0]!;
    expect(metricValue.labels.axis).toBe('epistemic');
    expect(metricValue.labels.shape).toBe('classify');
    expect(metricValue.labels.tier).toBe('1');
    expect(metricValue.value).toBeGreaterThan(0);
  });

  it('does not emit judgment.resolved events when systemOne.enabled=false', async () => {
    const disabledGate = new KernelPerceptionGate({
      systemOne: {
        enabled: false,
        judge: new SystemOneIngressJudge({ manifold, embeddingCache: cache, budget }),
      },
    });

    await disabledGate.admit({
      rawObservation: '(test --> observation).',
      sourceQuality: 'LLM_PRIOR',
      sensorConfidence: 1.0,
      sourceId: 'test-source',
    });

    const events = (disabledGate as any).eventLog;
    const judgmentEvents = events.filter((e: any) => e.type === 'judgment.resolved');
    
    expect(judgmentEvents.length).toBe(0);
  });

  it('proposition count == event count == metric delta for a batch', async () => {
    // Reset metrics by creating a fresh counter check
    const { systemoneJudgmentsTotal } = await import('../../nar/src/metrics/prometheus.js');
    const metricsBefore = await systemoneJudgmentsTotal.get();
    const totalBefore = metricsBefore.values.reduce((sum, v) => sum + v.value, 0);
    
    await gate.admit({
      rawObservation: '(test --> observation).',
      sourceQuality: 'LLM_PRIOR',
      sensorConfidence: 1.0,
      sourceId: 'test-source',
    });

    const events = (gate as any).eventLog;
    const judgmentEvents = events.filter((e: any) => e.type === 'judgment.resolved');
    
    // Proposition count == event count (6 ingress queries)
    expect(judgmentEvents.length).toBe(6);
    
    // Metric delta should match
    const metricsAfter = await systemoneJudgmentsTotal.get();
    const totalAfter = metricsAfter.values.reduce((sum, v) => sum + v.value, 0);
    expect(totalAfter - totalBefore).toBe(6);
  });
});