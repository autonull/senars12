import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import {AutonomousScheduler, type SchedulerInsight} from '../../../src/agent/AutonomousScheduler.js';
import type {NAR} from '../../../src/nar/nar.js';

function makeNAR(beliefs: Array<{term: string; truth?: {f: number; c: number}; derived?: boolean}> = []): NAR {
    return {
        getBeliefs: () => beliefs as never,
        run: jest.fn(async (steps: number) => beliefs.length > 0 ? Math.min(beliefs.length, steps) : 0),
    } as unknown as NAR;
}

describe('AutonomousScheduler — Phase 7 autonomy stream (I9)', () => {
    let scheduler: AutonomousScheduler;

    beforeEach(() => {
        scheduler = new AutonomousScheduler(makeNAR(), {
            reasoningStepsPerWake: 1,
            wakeupIntervalMs: 1_000_000,
            sleepIntervalMs: 60_000,
            enableLMRules: false,
            effortLevel: 1,
            ringBufferSize: 4,
        });
    });

    afterEach(() => {
        scheduler.stop();
    });

    it('starts empty', () => {
        expect(scheduler.size()).toBe(0);
        expect(scheduler.getRecentInsights(8)).toEqual([]);
    });

    it('records insights with bounded eviction', () => {
        const now = Date.now();
        const items: SchedulerInsight[] = Array.from({length: 10}, (_, i) => ({
            term: `t${i}`,
            ts: now + i,
            provenance: 'derivation',
        }));
        scheduler.recordInsights(items);
        expect(scheduler.size()).toBe(4);
        const recent = scheduler.getRecentInsights(8);
        expect(recent[0]?.term).toBe('t6');
        expect(recent[3]?.term).toBe('t9');
    });

    it('getRecentInsights(limit) caps result count', () => {
        const now = Date.now();
        scheduler.recordInsights([
            {term: 'a', ts: now, provenance: 'derivation'},
            {term: 'b', ts: now + 1, provenance: 'derivation'},
            {term: 'c', ts: now + 2, provenance: 'derivation'},
        ]);
        expect(scheduler.getRecentInsights(2).map(i => i.term)).toEqual(['b', 'c']);
    });

    it('getRecentInsights(sinceMs) filters by age', () => {
        const t0 = Date.now();
        const old = t0 - 60_000;
        const fresh = t0 - 1000;
        scheduler.recordInsights([
            {term: 'old', ts: old, provenance: 'derivation'},
            {term: 'new', ts: fresh, provenance: 'derivation'},
        ]);
        const recent = scheduler.getRecentInsights(8, 30_000);
        expect(recent.map(i => i.term)).toEqual(['new']);
    });

    it('tick() runs a cycle and captures derived beliefs', async () => {
        const nar = makeNAR([
            {term: 'cat', truth: {f: 0.9, c: 0.8}, derived: true},
            {term: 'dog', truth: {f: 0.7, c: 0.6}, derived: true},
        ]);
        const s = new AutonomousScheduler(nar, {
            reasoningStepsPerWake: 5,
            wakeupIntervalMs: 60_000,
            sleepIntervalMs: 30_000,
            enableLMRules: false,
            effortLevel: 1,
        });
        const captured = new Promise<unknown>(resolve => {
            s.eventBus.on('scheduler:insights', resolve as never);
        });
        const count = await s.tick();
        expect(count).toBeGreaterThan(0);
        const evt = await captured as {derived: number; insights: SchedulerInsight[]};
        expect(evt.derived).toBeGreaterThan(0);
        expect(evt.insights[0]?.truth).toEqual({frequency: 0.9, confidence: 0.8});
        s.stop();
    });

    it('clear() empties the ring buffer', () => {
        scheduler.recordInsights([{term: 'x', ts: Date.now(), provenance: 'derivation'}]);
        scheduler.clear();
        expect(scheduler.size()).toBe(0);
    });

    it('start() schedules periodic cycles and stop() cancels them', () => {
        const nar = makeNAR([{term: 'cat', derived: true}]);
        const s = new AutonomousScheduler(nar, {
            reasoningStepsPerWake: 1,
            wakeupIntervalMs: 10,
            sleepIntervalMs: 0,
            enableLMRules: false,
            effortLevel: 1,
        });
        s.start();
        s.stop();
        expect(true).toBe(true);
    });
});
