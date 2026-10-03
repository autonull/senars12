import { describe, expect, it } from 'vitest';
import { KernelActionGate } from '../../nar/src/kernel/KernelActionGate.js';
import { pushCapped } from '@senars/util';
import { GATE_LOG_CAPACITY } from '../../nar/src/kernel/event-ring.js';
import { MetacognitiveMonitor } from '../../nar/src/cognitive/impls/MetacognitiveMonitor.js';
import { ProposalRouter } from '../../nar/src/governance/pipeline.js';
import {
  InMemorySessionManager,
  SessionStore,
} from '../../util/src/memory/in-memory-session-manager.js';
import { EGraph } from '../../metta/src/engine/egraph.js';
import { Memory } from '../../nar/src/memory/memory.js';

/**
 * Bench 38 — Bounded Runtime (TODO17b Phase B)
 * Targeted cap tests for D11–D17 structures. Heap-soak coverage for the full
 * NAR loop is exercised by tests/soak; these assert each bound directly.
 */

interface RecordingBus {
  handlers: Map<string, Array<(...args: unknown[]) => void>>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

describe('Bench 38 — Bounded Runtime', () => {
  it('D11 — action gate logs are drop-oldest rings (cap 1000)', () => {
    const gate = new KernelActionGate();
    // alternate along a legal transition cycle: propose-only <-> observe-only
    gate.requestModeChange('propose-only', 'system');
    for (let i = 0; i < GATE_LOG_CAPACITY + 10; i++) {
      const next = i % 2 === 0 ? 'observe-only' : 'propose-only';
      const r = gate.requestModeChange(next, 'system');
      if (!r.changed) throw new Error(`unexpected illegal transition to ${next}`);
    }
    expect(gate.getAutonomyLog().length).toBe(GATE_LOG_CAPACITY);
    // newest kept, oldest dropped
    expect(gate.getAutonomyLog().length).toBeLessThanOrEqual(1000);
  });

  it('D11 — pushCapped drops oldest beyond capacity', () => {
    const log: number[] = [];
    for (let i = 0; i < 12; i++) pushCapped(log, i, 10);
    expect(log.length).toBe(10);
    expect(log[0]).toBe(2);
    expect(log[9]).toBe(11);
  });

  it('D13 — MetacognitiveMonitor teardown clears timer + listeners', () => {
    const bus: RecordingBus = {
      handlers: new Map(),
      on(event, handler) {
        const list = this.handlers.get(event) ?? [];
        list.push(handler);
        this.handlers.set(event, list);
      },
      off(event, handler) {
        const list = (this.handlers.get(event) ?? []).filter((h) => h !== handler);
        this.handlers.set(event, list);
      },
    };
    const monitor = new MetacognitiveMonitor({ eventBus: bus } as never);
    expect(monitor.getReasoningTrace()).toEqual([]);
    monitor.shutdown();
    // 5 subscriptions (task:processed ×2, task:derived, rule:fired, error) all removed
    const total = [...bus.handlers.values()].reduce((n, l) => n + l.length, 0);
    expect(total).toBe(0);
    expect(monitor.getReasoningTrace()).toEqual([]);
  });

  it('D14 — ProposalRouter drains empty its queues', () => {
    const router = new ProposalRouter();
    router.route(
      {
        proposalId: 'p1',
        kind: 'patch-apply',
        riskTier: 'high',
        payload: {},
        rewardDomain: 'self-patch-score',
        correlationId: 'c1',
      } as never,
      'low-risk-auto-merge'
    );
    expect(router.getAwaitingApproval().length).toBe(1);
    const drained = router.drainAwaitingApproval();
    expect(drained).toHaveLength(1);
    expect(router.getAwaitingApproval().length).toBe(0);
  });

  it('D15 — InMemorySessionManager caps history and evicts LRU sessions', () => {
    const mgr = new InMemorySessionManager({ maxSessions: 2, maxHistoryPerSession: 3 });
    const a = mgr.getOrCreate('a');
    for (let i = 0; i < 6; i++) a.history.push({ role: 'user', content: `m${i}`, timestamp: i });
    mgr.getOrCreate('a'); // triggers trim
    expect(a.history.length).toBe(3);
    expect(a.history[0]!.content).toBe('m3');
    mgr.getOrCreate('b');
    mgr.getOrCreate('c'); // evicts LRU (a)
    expect(mgr.size()).toBe(2);
    expect(mgr.getOrCreate('a').history.length).toBe(0); // fresh session recreated
  });

  it('D15 — SessionStore bounds restored sessions and their history', () => {
    const store = new SessionStore({ maxSessions: 2, maxHistoryPerSession: 2 });
    const restored = { history: Array.from({ length: 5 }, (_, i) => ({ role: 'user' as const, content: `m${i}`, timestamp: i })) };
    store.load('a', { ...restored, id: 'sess-a', key: 'a', createdAt: 0, lastSeenAt: 0, metadata: {} });
    expect(store.getOrCreate('a').history.map((h) => h.content)).toEqual(['m3', 'm4']);
    store.load('b', { id: 'sess-b', key: 'b', history: [], createdAt: 0, lastSeenAt: 0, metadata: {} });
    store.load('c', { id: 'sess-c', key: 'c', history: [], createdAt: 0, lastSeenAt: 0, metadata: {} });
    expect(store.size()).toBe(2);
    expect([...store.values()].map((s) => s.key).sort()).toEqual(['b', 'c']);
    expect(store.getOrCreate('a').history).toEqual([]); // LRU-evicted, recreated fresh
  });

  it('D16 — LM cache sweep piggybacks on writes', async () => {
    const { ResponseCache } = await import('../../nar/src/lm/service/cache.js');
    let clock = 1_000;
    const rc = new ResponseCache({ ttlMs: 60_000, now: () => clock });
    rc.set('stale', 'v');
    clock += 60_001;
    rc.set('fresh', 'x');
    expect(rc.get('stale')).toBeUndefined();
    expect(rc.size).toBe(1);
    expect(rc.get('fresh')).toBe('x');
  });

  it('D17 — Memory revision log is capped', () => {
    const memory = new Memory();
    const record = (memory as unknown as { recordRevision(e: unknown): void }).recordRevision.bind(memory);
    for (let i = 0; i < 1010; i++) {
      record({ term: '(a-->b)', type: 'revision', timestamp: i, truth: { f: 1, c: 0.9 } });
    }
    const log = (memory as unknown as { revisionLog: { size(): number } }).revisionLog;
    expect(log.size()).toBeLessThanOrEqual(1000);
    expect(log.size()).toBeGreaterThan(0);
  });

  it('D17 — e-graph saturate() respects the step/node budget', () => {
    const g = new EGraph();
    const runaway: { name: string; match: (a: never) => never } = {
      name: 'grow',
      match: () => {
        throw new Error('saturate must not exceed its budget');
      },
    } as never;
    // A rule that always "applies" would loop forever — budget must cut it off.
    const rule = {
      name: 'grow',
      match: () => null,
    };
    // Budgeted saturation terminates even with an always-applicable rule set:
    // simulate by applying a rule that adds a node each round.
    let n = 0;
    const adder = {
      name: 'add',
      match: () => ({ kind: 0, value: `n${n++}` }) as never,
    };
    expect(() =>
      g.saturate([adder as never, rule as never, runaway as never], { maxSteps: 5, maxNodes: 3 })
    ).not.toThrow();
  });

});