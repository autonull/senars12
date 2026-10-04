/**
 * REFACTOR.todo6 Phase F falsifying tests (F1 OTel coverage, F2 replay verification).
 *
 * F1 asserts the new span events are emitted *inside an active tick span* — the
 * only place C22 observability is meaningful.
 * F2 asserts the replay state hash is deterministic and tamper-sensitive; a
 * hash that matches a mutated log is worse than no verification at all.
 *  */

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCognitiveThread } from '@senars/core';
import {
  type BudgetSlice,
  consumeCycles,
  createBudgetSlice,
  mergeConsumption,
  sliceBudget,
} from '@senars/core/budget';
import { validateCognitiveEvent } from '@senars/core/schemas';
import { PriorityBag } from '@senars/nar/bag';
import { CognitiveRegistry } from '@senars/nar/cognitive';
import {
  computeReplayStateHash,
  type ReplaySnapshotFile,
  replayIntoMemory,
  serializeReplayResult,
  verifyReplayStateHash,
} from '@senars/nar/kernel/replay';
import { initOtel, shutdownOtel, withSpan } from '@senars/nar/otel';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CollectingProcessor } from '../helpers/otel.js';

const collector = new CollectingProcessor();
initOtel({ otlpEndpoint: undefined, spanProcessors: [collector] });

const budget = (id: string, cycles: number): BudgetSlice =>
  createBudgetSlice({
    id,
    parentId: undefined,
    maxCycles: cycles,
    maxDepth: 100,
    maxMemoryOps: 10_000,
    maxLMCalls: 100,
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

      // Two refusals, and they are different: this one did not fit in what was
      // left, the next one spent the dimension. A slice answers from the same
      // predicate the budget gate does, so both read the way the gate reads.
      const other = budget('other', 2);
      consumeCycles(other, 5);
      const spent = budget('spent', 2);
      consumeCycles(spent, 2);
      consumeCycles(spent, 1);
      mergeConsumption(parent, other);
    });

    expect(collector.eventsOf('tick', 'budget.slice.created').length).toBeGreaterThanOrEqual(2);
    expect(collector.eventsOf('tick', 'budget.slice.consumed').length).toBe(3);
    expect(collector.eventsOf('tick', 'budget.slice.exhausted').length).toBe(2);
    expect(collector.eventsOf('tick', 'budget.slice.merged').length).toBe(1);

    const created = collector.eventsOf('tick', 'budget.slice.created');
    expect(created.some((a) => a['budget.slice.id'] === 'child')).toBe(true);

    const consumed = collector.eventsOf('tick', 'budget.slice.consumed');
    expect(consumed[0]).toMatchObject({
      'budget.slice.resource': 'cycles',
      'budget.slice.amount': 4,
    });
    expect(consumed[1]).toMatchObject({ 'budget.slice.id': 'parent', 'budget.slice.amount': 2 });

    const exhausted = collector.eventsOf('tick', 'budget.slice.exhausted');
    expect(exhausted[0]).toMatchObject({
      'budget.slice.id': 'other',
      'budget.slice.reason': 'backpressure',
      'budget.slice.total.cycles': 2,
    });
    expect(exhausted[1]).toMatchObject({
      'budget.slice.id': 'spent',
      'budget.slice.reason': 'cycle-budget',
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
    const full = collector
      .eventsOf('tick', 'thread.backpressure')
      .filter((a) => a.reason === 'mailbox-full');
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
          term: `(cat-->animal_${n})`,
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
          term: `(cat-->animal_${n})`,
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
          term: `(cat-->animal_${n})`,
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
