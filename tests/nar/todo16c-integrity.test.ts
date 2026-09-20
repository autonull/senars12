import { describe, it, expect } from 'vitest';
import { KernelPerceptionGate } from '../../nar/src/kernel/KernelPerceptionGate.js';
import { termParser } from '../../nar/src/terms';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import type { EmbeddingPointer, JudgmentQuery } from '../../nar/src/lm/system-one/types.js';

const QUERY: JudgmentQuery[] = [
  { kind: 'evaluate', instruction: 'Evaluate relevance', rubric: 'relevance', axis: 'epistemic' },
];

describe('B8/X20 — KernelPerceptionGate.eventLog is a bounded ring', () => {
  it('drops oldest events beyond capacity', () => {
    const gate = new KernelPerceptionGate();
    const term = termParser.parse('(a --> b)');
    expect(term).not.toBeNull();
    for (let i = 0; i < 1100; i++) gate.admitTask(term!, 'belief');
    const log = gate.getEventLog();
    expect(log.length).toBeLessThanOrEqual(1000);
  });

  it('clearEventLog resets the ring', () => {
    const gate = new KernelPerceptionGate();
    const term = termParser.parse('(a --> b)');
    gate.admitTask(term!, 'belief');
    expect(gate.getEventLog().length).toBeGreaterThan(0);
    gate.clearEventLog();
    expect(gate.getEventLog().length).toBe(0);
    // Ring still accepts events after clear (sink holds the live array)
    gate.admitTask(term!, 'belief');
    expect(gate.getEventLog().length).toBeGreaterThan(0);
  });
});

describe('B9/X25 — manifold health state machine', () => {
  const makeManifold = async (maxLatencyMs?: number) => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const pointer = await cache.write('health state machine context');
    return {
      pointer: pointer as EmbeddingPointer,
      manifold: createManifold(cache, { ...(maxLatencyMs !== undefined ? { maxLatencyMs } : {}) }),
    };
  };

  it('manual demote sets ready=false + breakerOpen=true; undemote recovers', async () => {
    const { manifold } = await makeManifold();
    manifold.setDemoted(true);
    let health = manifold.health();
    expect(health.ready).toBe(false);
    expect(health.breakerOpen).toBe(true);
    manifold.setDemoted(false);
    health = manifold.health();
    expect(health.ready).toBe(true);
    expect(health.breakerOpen).toBe(false);
  });

  it('latency trip opens the breaker and is isolated from the manual cause', async () => {
    const { pointer, manifold } = await makeManifold(0); // 0 ms bound ⇒ any non-zero-latency batch trips
    const budget = {
      maxCycles: 10,
      maxDepth: 5,
      maxMemoryOps: 100,
      maxLMCalls: 10,
      consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
    } as const;
    // Full batches ⇒ Date.now() delta reliably exceeds the 0 ms bound (no mocks)
    const bigBatch: JudgmentQuery[] = Array.from({ length: 64 }, () => QUERY[0]!);
    for (let i = 0; i < 3; i++) await manifold.judgeBatch(pointer, bigBatch, budget);
    expect(manifold.health().breakerOpen).toBe(true);

    // Undemoting the manual cause does not clear an independent latency trip
    manifold.setDemoted(true);
    expect(manifold.health().ready).toBe(false);
    manifold.setDemoted(false);
    expect(manifold.health().ready).toBe(true);
    expect(manifold.health().breakerOpen).toBe(true); // latency cause still active
  });

  it('healthy batches leave the breaker closed', async () => {
    const { pointer, manifold } = await makeManifold(); // default 33 ms bound
    const budget = {
      maxCycles: 10,
      maxDepth: 5,
      maxMemoryOps: 100,
      maxLMCalls: 10,
      consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
    } as const;
    await manifold.judgeBatch(pointer, QUERY, budget);
    const health = manifold.health();
    expect(health.breakerOpen).toBe(false);
    expect(health.ready).toBe(true);
  });
});
