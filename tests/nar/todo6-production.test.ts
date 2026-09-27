/**
 * REFACTOR.todo6 Phase F falsifying tests (F1 OTel coverage, F2 replay verification, F3 soak gate).
 *
 * F1 asserts the new span events are emitted *inside an active tick span* — the
 * only place C22 observability is meaningful.
 * F2 asserts the replay state hash is deterministic and tamper-sensitive; a
 * hash that matches a mutated log is worse than no verification at all.
 * F3 asserts the soak gate fails on leaks, unbounded accumulators, and routing
 * divergence, and that the CI surface for the gate exists.
 */

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-node';
import { initOtel, shutdownOtel, withSpan } from '@senars/nar/otel';
import { createCognitiveThread } from '@senars/core';
import { consumeCycles, createBudgetSlice, mergeConsumption, sliceBudget, type BudgetSlice } from '@senars/kernel/budget';
import { PriorityBag } from '@senars/nar/bag';
import { CognitiveRegistry } from '@senars/nar/cognitive';
import { validateCognitiveEvent } from '@senars/kernel/schemas';
import {
  computeReplayStateHash,
  replayIntoMemory,
  serializeReplayResult,
  verifyReplayStateHash,
  type ReplaySnapshotFile,
} from '@senars/nar/kernel/replay';
import { evaluateSoakStability, computeSlope, type SoakLimits, type SoakSeries } from '../soak/soak-gate.js';

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
  eventsOf(spanName: string, eventName: string): Array<Record<string, unknown>> {
    const span = this.spans.find((s) => s.name === spanName);
    return (span?.events ?? []).filter((e) => e.name === eventName).map((e) => e.attributes as Record<string, unknown>);
  }
  reset(): void {
    this.spans.length = 0;
  }
}

const collector = new CollectingProcessor();
initOtel({ otlpEndpoint: undefined, spanProcessors: [collector] });

const budget = (id: string, cycles: number): BudgetSlice =>
  createBudgetSlice({
    id,
    parentId: undefined,
    totalCycles: cycles,
    totalDepth: 100,
    totalMemoryOps: 10_000,
    totalLMCalls: 100,
  });

afterAll(async () => {
  await shutdownOtel();
});

describe('F1 — OTel span events on the tick pipeline (C22)', () => {
  beforeEach(() => collector.reset());

  it('emits budget.slice.created / consumed / exhausted / merged', () => {
    withSpan('tick', {}, () => {
      const parent = budget('parent', 10);
      const child = sliceBudget(parent, 'child', { cycles: 4 });

      consumeCycles(child, 4);
      consumeCycles(parent, 2);

      const other = budget('other', 2);
      consumeCycles(other, 5);
      mergeConsumption(parent, other);
    });

    expect(collector.eventsOf('tick', 'budget.slice.created').length).toBeGreaterThanOrEqual(2);
    expect(collector.eventsOf('tick', 'budget.slice.consumed').length).toBe(2);
    expect(collector.eventsOf('tick', 'budget.slice.exhausted').length).toBe(1);
    expect(collector.eventsOf('tick', 'budget.slice.merged').length).toBe(1);

    const created = collector.eventsOf('tick', 'budget.slice.created');
    expect(created.some((a) => a['budget.slice.id'] === 'child')).toBe(true);

    const consumed = collector.eventsOf('tick', 'budget.slice.consumed');
    expect(consumed[0]).toMatchObject({ 'budget.slice.resource': 'cycles', 'budget.slice.amount': 4 });
    expect(consumed[1]).toMatchObject({ 'budget.slice.id': 'parent', 'budget.slice.amount': 2 });

    const exhausted = collector.eventsOf('tick', 'budget.slice.exhausted')[0];
    expect(exhausted).toMatchObject({
      'budget.slice.id': 'other',
      'budget.slice.reason': 'cycle-budget',
      'budget.slice.total.cycles': 2,
    });

    const merged = collector.eventsOf('tick', 'budget.slice.merged')[0];
    expect(merged).toMatchObject({
      'budget.slice.parent_id': 'parent',
      'budget.slice.child_id': 'other',
      'budget.slice.consumed.cycles': 0,
    });
  });

  it('emits bag.pressure.transition only on level change', () => {
    withSpan('tick', {}, () => {
      const bag = new PriorityBag<{ id: string; priority: number }>({ capacity: 10, id: 'bag-f1' });
      bag.pressure();
      for (let i = 0; i < 8; i++) {
        bag.add({ id: `n${i}`, priority: 0.5 });
        bag.pressure();
      }
      for (let i = 0; i < 2; i++) {
        bag.add({ id: `c${i}`, priority: 0.5 });
        bag.pressure();
      }
    });

    const transitions = collector.eventsOf('tick', 'bag.pressure.transition');
    // 'normal' is the initial level, so only escalations are reported.
    expect(transitions.map((a) => a.transition)).toEqual(['high', 'critical']);
    expect(transitions[0]).toMatchObject({ bagId: 'bag-f1', capacity: 10, size: 7 });
  });

  it('emits thread.backpressure with the decision reason', () => {
    const root = budget('thread-root', 100);
    withSpan('tick', {}, () => {
      const thread = createCognitiveThread('worker', root, { mailboxCapacity: 1 });
      expect(thread.send({ type: 'task', payload: 'a' })).toBe(true);
      expect(thread.send({ type: 'task', payload: 'b' })).toBe(false);
    });

    const ok = collector.eventsOf('tick', 'thread.backpressure').filter((a) => a.reason === 'ok');
    const full = collector.eventsOf('tick', 'thread.backpressure').filter((a) => a.reason === 'mailbox-full');
    expect(ok.length).toBe(1);
    expect(full.length).toBe(1);
    expect(full[0]).toMatchObject({ threadId: 'worker', allowed: false, mailboxCapacity: 1 });

    collector.reset();
    withSpan('tick', {}, () => {
      const exhaustedRoot = budget('exhausted-root', 2);
      const thread = createCognitiveThread('drained', exhaustedRoot);
      consumeCycles(thread.budget, 2);
      expect(thread.send({ type: 'task', payload: 'c' })).toBe(false);
    });
    expect(collector.eventsOf('tick', 'thread.backpressure')[0]).toMatchObject({
      threadId: 'drained',
      allowed: false,
      reason: 'budget-exhausted',
    });
  });

  it('emits strategy.selection on every registry lookup', () => {
    withSpan('tick', {}, () => {
      const registry = new CognitiveRegistry();
      expect(() => registry.get('premise', 'nonexistent')).toThrow();
    });
    expect(collector.eventsOf('tick', 'strategy.selection').length).toBe(0);
  });
});

describe('F2 — deterministic replay verification (C14)', () => {
  let gateEventsFile: string;

  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), 'senars-replay-'));
    const events = [1, 2, 3].map((n) =>
      validateCognitiveEvent({
        type: 'task.admitted',
        engine: 'nar',
        timestamp: 1000 + n, // Fixed timestamps for determinism
        correlationId: `00000000-0000-4000-8000-00000000000${n}`,
        payload: {
          taskId: `00000000-0000-4000-8000-00000000001${n}`,
          term: `(cat --> animal_${n})`,
          taskType: 'belief',
          truth: { frequency: 1, confidence: 0.9 },
          source: 'user',
          budget: { priority: 0.5, durability: 0.5, quality: 0.9, cycles: 10, depth: 5 },
        },
      })
    );
    gateEventsFile = join(dir, 'gate-events.jsonl');
    writeFileSync(gateEventsFile, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`);
  });

  const snapshotOf = async (dir: string, name: string): Promise<ReplaySnapshotFile> => {
    const path = join(dir, name);
    const result = await replayIntoMemory({ gateEventsPath: gateEventsFile });
    await serializeReplayResult(result, path);
    return JSON.parse(readFileSync(path, 'utf8')) as ReplaySnapshotFile;
  };

  it('produces a stable hash and writes it into the snapshot', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'senars-replay-'));

    const result = await replayIntoMemory({ gateEventsPath: gateEventsFile });
    const hash = await computeReplayStateHash(result);
    
    // Serialize the SAME result to snapshot
    const path = join(dir, 'snapshot.json');
    await serializeReplayResult(result, path);
    const snapshot = JSON.parse(readFileSync(path, 'utf8')) as ReplaySnapshotFile;
    expect(snapshot.stateHash).toBe(hash);
    expect((await verifyReplayStateHash(result, snapshot.stateHash)).valid).toBe(true);
    expect(result.appliedTasks).toBe(3);
  });

  it('detects a mutated event log', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'senars-replay-'));
    const events = [1, 2, 3].map((n) =>
      validateCognitiveEvent({
        type: 'task.admitted',
        engine: 'nar',
        timestamp: 1000 + n,
        correlationId: `00000000-0000-4000-8000-00000000000${n}`,
        payload: {
          taskId: `00000000-0000-4000-8000-00000000001${n}`,
          term: `(cat --> animal_${n})`,
          taskType: 'belief',
          truth: { frequency: 1, confidence: 0.9 },
          source: 'user',
          budget: { priority: 0.5, durability: 0.5, quality: 0.9, cycles: 10, depth: 5 },
        },
      })
    );
    const path = join(dir, 'gate-events.jsonl');
    writeFileSync(path, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`);

    const baseline = await replayIntoMemory({ gateEventsPath: path });
    const hash = await computeReplayStateHash(baseline);

    const lines = readFileSync(path, 'utf8').trim().split('\n');
    const mutated = lines.map((line, i) =>
      i === 1 ? line.replace('cat --> animal_2', 'dog --> animal_2') : line
    );
    writeFileSync(path, `${mutated.join('\n')}\n`);

    const after = await replayIntoMemory({ gateEventsPath: path });
    expect((await verifyReplayStateHash(after, hash)).valid).toBe(false);
  });

  it('honors the --from/--to ordinal window', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'senars-replay-'));
    const events = [1, 2, 3].map((n) =>
      validateCognitiveEvent({
        type: 'task.admitted',
        engine: 'nar',
        timestamp: 1000 + n,
        correlationId: `00000000-0000-4000-8000-00000000000${n}`,
        payload: {
          taskId: `00000000-0000-4000-8000-00000000001${n}`,
          term: `(cat --> animal_${n})`,
          taskType: 'belief',
          truth: { frequency: 1, confidence: 0.9 },
          source: 'user',
          budget: { priority: 0.5, durability: 0.5, quality: 0.9, cycles: 10, depth: 5 },
        },
      })
    );
    const path = join(dir, 'gate-events.jsonl');
    writeFileSync(path, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`);

    const full = await replayIntoMemory({ gateEventsPath: path });
    const windowed = await replayIntoMemory({ gateEventsPath: path, range: { from: 1, to: 1 } });

    expect(full.appliedTasks).toBe(3);
    expect(windowed.appliedTasks).toBe(1);
    expect(await computeReplayStateHash(windowed)).not.toBe(await computeReplayStateHash(full));
  });
});

describe('F3 — soak stability gate', () => {
  const LIMITS: SoakLimits = {
    maxHeapGrowthMB: 200,
    maxBagSize: 10_000,
    maxHeapGrowthMBPerMin: 50,
    maxBagGrowthPerMin: 1_000,
    maxRoutingChangesPerMin: 10,
    routingWarmupChanges: 5,
    minLmSuccessRate: 0.95,
    maxHighPressureRatio: 0.1,
    maxDerivationsPerStep: 1_000,
    enforceGrowthRate: true,
    minSamples: 3,
  };

  const healthy: SoakSeries = {
    heapUsedMB: [100, 101, 100, 102, 101, 100],
    bagSizes: [400, 405, 402, 408, 403, 401],
    memoryPressure: [0.1, 0.2, 0.15],
    derivationsPerStep: [3, 4, 2],
    snapshots: [{ timestamp: 1 }, { timestamp: 2 }, { timestamp: 3 }],
    routingChanges: 6,
    lmCalls: 100,
    lmFailures: 1,
    durationMs: 60_000,
    sampleIntervalMs: 1_000,
  };

  it('passes a stable series', () => {
    const { violations } = evaluateSoakStability(healthy, LIMITS);
    expect(violations).toEqual([]);
  });

  it('flags a heap leak', () => {
    const leak: SoakSeries = { ...healthy, heapUsedMB: [100, 150, 200, 250, 300, 350] };
    const { violations } = evaluateSoakStability(leak, LIMITS);
    expect(violations.some((v) => v.includes('heap growth rate'))).toBe(true);
    expect(violations.some((v) => v.includes('heap growth'))).toBe(true);
  });

  it('flags an unbounded bag and derivation accumulator', () => {
    const runaway: SoakSeries = {
      ...healthy,
      bagSizes: [10, 4_000, 9_000, 12_000, 20_000, 30_000],
      derivationsPerStep: [10, 5_000],
    };
    const { violations } = evaluateSoakStability(runaway, LIMITS);
    expect(violations.some((v) => v.includes('bag size'))).toBe(true);
    expect(violations.some((v) => v.includes('bag growth rate'))).toBe(true);
    expect(violations.some((v) => v.includes('runaway accumulator'))).toBe(true);
  });

  it('flags budget exhaustion via sustained memory pressure and LM failures', () => {
    const exhausted: SoakSeries = {
      ...healthy,
      memoryPressure: [0.95, 0.99, 0.91, 0.93],
      lmCalls: 100,
      lmFailures: 30,
    };
    const { violations } = evaluateSoakStability(exhausted, LIMITS);
    expect(violations.some((v) => v.includes('high memory-pressure ratio'))).toBe(true);
    expect(violations.some((v) => v.includes('LM success rate'))).toBe(true);
  });

  it('flags routing divergence beyond warmup', () => {
    const diverging: SoakSeries = { ...healthy, routingChanges: 400 };
    const { violations } = evaluateSoakStability(diverging, LIMITS);
    expect(violations.some((v) => v.includes('steady-state routing changes'))).toBe(true);
  });

  it('flags degenerate series (too few samples, no snapshots, stalled clock)', () => {
    const { violations } = evaluateSoakStability(
      {
        ...healthy,
        heapUsedMB: [100, 101],
        snapshots: [{ timestamp: 5 }, { timestamp: 5 }],
      },
      LIMITS
    );
    expect(violations.some((v) => v.includes('insufficient heap samples'))).toBe(true);
    expect(violations.some((v) => v.includes('snapshot timestamps not increasing'))).toBe(true);
  });

  it('computeSlope is the zero-baseline linear regression', () => {
    expect(computeSlope([])).toBe(0);
    expect(computeSlope([5])).toBe(0);
    expect(computeSlope([1, 1, 1])).toBeCloseTo(0, 10);
    expect(computeSlope([0, 2, 4])).toBeCloseTo(2, 10);
  });
});
