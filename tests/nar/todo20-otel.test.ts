import { afterAll, describe, expect, it } from 'vitest';
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-node';
import { createLogger } from '@senars/core';
import { HTTPConnection } from '@senars/io';
import { initOtel, shutdownOtel, withSpan } from '@senars/nar/otel';
import { runHealthChecks } from '@senars/nar/health';
import { getMetricsAsJson } from '@senars/nar/metrics';
import { KernelActionGate, KernelBudgetGate, KernelPerceptionGate } from '@senars/nar/kernel';
import { Negotiator } from '@senars/nar/reflex';
import { SchemaStore } from '@senars/nar/focus';
import { Truth } from '../../nar/src';

class CollectingProcessor implements SpanProcessor {
  readonly spans: ReadableSpan[] = [];
  onStart(): void {}
  onEnd(span: ReadableSpan): void {
    this.spans.push(span);
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
  findByName(name: string): ReadableSpan | undefined {
    return this.spans.find((s) => s.name === name);
  }
}

const collector = new CollectingProcessor();
initOtel({ otlpEndpoint: undefined, spanProcessors: [collector] });

const attrsOf = (span: ReadableSpan): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(span.attributes).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v])
  );

describe('Bench 65 — observability', () => {
  it('emits gate decision spans (O1) and gate metrics (O4)', () => {
    const perception = new KernelPerceptionGate();
    perception.admitTask({ toString: () => 'bird' } as never, 'belief', Truth.NEUTRAL, 'test');
    new KernelBudgetGate().check({ operation: 'lm-call', estimatedCost: 0 });
    new KernelActionGate().authorize({ operation: 'unknown-op' } as never);

    const gateSpan = collector.findByName('gate.perception.admitTask');
    expect(gateSpan).toBeDefined();
    expect(attrsOf(gateSpan!)).toMatchObject({ 'gate.type': 'perception' });
    expect(collector.findByName('gate.budget.lm-call')).toBeDefined();
    expect(collector.findByName('gate.action.unknown-op')).toBeDefined();
  });

  it('emits a negotiator span with veto attributes (O1)', () => {
    const negotiator = new Negotiator({ reflexThreshold: 0.1 });
    const decision = negotiator.resolve(
      [{ action: 'pull_1', value: 1, confidence: 0.9, source: 'test' }],
      [{ action: 'pull_1', truth: { f: 0.1, c: 0.95 }, source: 'trap' }]
    );
    expect(decision.vetoedBy).toBe('nal-trap');
    const span = collector.findByName('negotiator.resolve');
    expect(span).toBeDefined();
    expect(attrsOf(span!)).toMatchObject({ 'negotiator.vetoed': true, 'negotiator.veto_reason': 'nal-trap' });
  });

  it('emits a schema promotion span and counter (O1/O4)', () => {
    const store = new SchemaStore();
    store.promote('bench', [{ action: 'move', kind: 'good', meanReward: 0.9 }], 1);
    expect(collector.findByName('schema_store.promote')).toBeDefined();
  });

  it('enriches JSON logs with traceId/spanId inside a span (O2)', async () => {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (m: string) => lines.push(m);
    try {
      await withSpan('test.log.probe', {}, async () => {
        createLogger({ format: 'json', scope: 'bench' }).info('traced');
      });
    } finally {
      console.log = orig;
    }
    const entry = JSON.parse(lines.find((l) => l.includes('traced'))!);
    expect(entry.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(entry.spanId).toMatch(/^[0-9a-f]{16}$/);
  });

  it('health report aggregates subsystem checks (O3)', async () => {
    const ok = await runHealthChecks({ gates: { isInitialized: () => true } });
    expect(ok.ready).toBe(true);
    const bad = await runHealthChecks({
      gates: { isInitialized: () => false },
      lmReachable: async () => false,
    });
    expect(bad.ready).toBe(false);
    expect(bad.checks.lm?.ok).toBe(false);
    expect(bad.checks.gates?.ok).toBe(false);
  });

  it('HTTP /health/ready returns 200 and 503 from the readiness probe (O3)', async () => {
    const makeConn = (ready: boolean) =>
      new HTTPConnection(
        { type: 'http', config: { name: 'bench', port: 0 } } as never,
        { emit: () => undefined, logger: createLogger({ level: 'error' }), health: () => ({ ready, checks: {} }) }
      );
    for (const ready of [true, false]) {
      const conn = makeConn(ready) as unknown as { connect(): Promise<void>; server: import('node:http').Server };
      await conn.connect();
      const { port } = conn.server.address() as { port: number };
      const res = await fetch(`http://127.0.0.1:${port}/health/ready`);
      expect(res.status).toBe(ready ? 200 : 503);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe(ready ? 'ready' : 'unready');
      await new Promise<void>((resolve) => conn.server.close(() => resolve()));
    }
  });

  it('exposes the O4 metrics in the Prometheus registry', async () => {
    const metrics = await getMetricsAsJson();
    for (const name of [
      'senars_gate_decisions_total',
      'senars_gate_vetoes_total',
      'senars_schema_promotions_total',
      'senars_bag_pressure',
    ]) {
      expect(metrics[name], name).toBeDefined();
    }
    const handovers = metrics['senars_handovers_total'] as Array<{ value: number }>;
    expect(handovers).toBeDefined();
  });

  afterAll(async () => {
    await shutdownOtel();
  });
});
