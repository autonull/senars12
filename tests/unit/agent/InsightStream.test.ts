import {describe, it, expect, beforeEach} from '@jest/globals';
import {AutonomousScheduler, type SchedulerInsight} from '../../../src/agent/AutonomousScheduler.js';
import {InsightStream} from '../../../src/agent/autonomy/InsightStream.js';
import type {NAR} from '../../../src/nar/nar.js';

function makeScheduler(): AutonomousScheduler {
    return new AutonomousScheduler({} as NAR, {
        reasoningStepsPerWake: 1,
        wakeupIntervalMs: 1_000_000,
        sleepIntervalMs: 60_000,
        enableLMRules: false,
        effortLevel: 1,
        ringBufferSize: 16,
    });
}

describe('InsightStream — Phase 7 (I9)', () => {
    let scheduler: AutonomousScheduler;
    let stream: InsightStream;

    beforeEach(() => {
        scheduler = makeScheduler();
        stream = new InsightStream(scheduler);
    });

    it('pull() reads from scheduler.getRecentInsights', () => {
        const now = Date.now();
        const items: SchedulerInsight[] = [
            {term: 'cat', ts: now, provenance: 'derivation'},
            {term: 'dog', ts: now + 1, provenance: 'derivation'},
        ];
        scheduler.recordInsights(items);
        expect(stream.size()).toBe(2);
        expect(stream.pull(8).map(i => i.term)).toEqual(['cat', 'dog']);
    });

    it('onInsight() subscribes to emitted insights', () => {
        const seen: SchedulerInsight[] = [];
        stream.onInsight(i => seen.push(i));
        const now = Date.now();
        scheduler.eventBus.emit('scheduler:insights', {
            derived: 1,
            insights: [{term: 't', ts: now, provenance: 'derivation'}],
        });
        expect(seen).toHaveLength(1);
        expect(seen[0]?.term).toBe('t');
    });

    it('returned unsubscribe function detaches the listener', () => {
        let count = 0;
        const off = stream.onInsight(() => count++);
        off();
        scheduler.eventBus.emit('scheduler:insights', {derived: 1, insights: []});
        expect(count).toBe(0);
    });
});
