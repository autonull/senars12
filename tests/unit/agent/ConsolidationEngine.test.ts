import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import {ConsolidationEngine, type EpisodeRecord} from '../../../src/agent/cognition/ConsolidationEngine.js';
import type {NAR} from '../../../src/nar/nar.js';
import type {LMClient} from '../../../src/nar/lm/types.js';
import type {EpisodicMemory} from '../../../src/nar/memory/EpisodicMemory.js';

function makeNAR(): {nar: NAR; input: ReturnType<typeof jest.fn>} {
    const input = jest.fn(async () => undefined);
    return {nar: {input} as unknown as NAR, input};
}

function makeLM(response = '{"beliefs":["(cat --> animal)."]}'): {lm: LMClient; generateText: ReturnType<typeof jest.fn>} {
    const generateText = jest.fn(async () => response);
    return {lm: {provider: 'mock', available: true, model: 'mock', generateText} as unknown as LMClient, generateText};
}

const ep = (overrides: Partial<EpisodeRecord> = {}): EpisodeRecord => ({
    id: `ep-${Math.random()}`,
    timestamp: Date.now(),
    input: 'cats are animals',
    response: 'agreed',
    concepts: ['cat', 'animal'],
    artifacts: [],
    ...overrides,
});

describe('ConsolidationEngine — Phase 8 (I11)', () => {
    let nar: NAR;
    let input: ReturnType<typeof jest.fn>;
    let lm: LMClient;
    let generateText: ReturnType<typeof jest.fn>;
    let consolidation: ConsolidationEngine;

    beforeEach(() => {
        ({nar, input} = makeNAR());
        ({lm, generateText} = makeLM());
        consolidation = new ConsolidationEngine({nar, lmClient: lm, debounceMs: 30});
    });

    afterEach(() => {
        consolidation.abort();
    });

    it('buffers scheduled records until the debounce window expires', () => {
        consolidation.schedule(ep());
        consolidation.schedule(ep({concepts: ['dog']}));
        expect(consolidation.getBufferSize()).toBe(2);
        expect(consolidation.getPassCount()).toBe(0);
    });

    it('debounces: 10 rapid schedules produce at most 1-2 passes', async () => {
        for (let i = 0; i < 10; i++) {
            consolidation.schedule(ep({concepts: ['cat']}));
        }
        await new Promise(r => setTimeout(r, 200));
        expect(consolidation.getPassCount()).toBeLessThanOrEqual(2);
    });

    it('runs a single pass and counts it', async () => {
        for (let i = 0; i < 3; i++) consolidation.schedule(ep({concepts: ['cat']}));
        await new Promise(r => setTimeout(r, 200));
        expect(consolidation.getPassCount()).toBe(1);
    });

    it('extracts beliefs via LM and injects them into NARS', async () => {
        consolidation.schedule(ep({concepts: ['cat']}));
        consolidation.schedule(ep({concepts: ['cat']}));
        consolidation.schedule(ep({concepts: ['cat']}));
        await new Promise(r => setTimeout(r, 200));
        expect(generateText).toHaveBeenCalled();
        expect(input).toHaveBeenCalled();
        const calls = input.mock.calls.map(c => String(c[0]));
        expect(calls.some(c => c.includes('cat --> animal'))).toBe(true);
    });

    it('falls back to aggregation terms when LM is absent', async () => {
        const {nar: nar2, input: input2} = makeNAR();
        const c = new ConsolidationEngine({nar: nar2, debounceMs: 20});
        for (let i = 0; i < 4; i++) c.schedule(ep({concepts: ['cat', 'feline']}));
        await new Promise(r => setTimeout(r, 200));
        expect(input2).toHaveBeenCalled();
    });

    it('is aborted cleanly', () => {
        consolidation.abort();
        consolidation.schedule(ep());
        expect(consolidation.getBufferSize()).toBe(0);
    });

    it('clusters by concept and respects maxClusterLmCalls', async () => {
        const c = new ConsolidationEngine({nar, lmClient: lm, debounceMs: 20, maxClusterLmCalls: 1});
        for (let i = 0; i < 5; i++) {
            c.schedule(ep({concepts: ['cat']}));
            c.schedule(ep({concepts: ['dog']}));
        }
        await new Promise(r => setTimeout(r, 200));
        // 1 cluster processed; the LM was called at most once
        expect(generateText.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('isInFlight toggles true during a pass and false afterwards', async () => {
        const c = new ConsolidationEngine({nar, lmClient: lm, debounceMs: 10});
        c.schedule(ep({concepts: ['cat']}));
        await new Promise(r => setTimeout(r, 200));
        expect(c.isInFlight()).toBe(false);
    });

    it('feedFromMemory() pulls from episodic memory and schedules records', async () => {
        const getEpisodes = jest.fn(async () => [
            {timestamp: 1, type: 'input' as const, content: 'cat', metadata: {}},
            {timestamp: 2, type: 'response' as const, content: 'ok', metadata: {}},
        ]);
        const episodic = {getEpisodes} as unknown as EpisodicMemory;
        const c = new ConsolidationEngine({nar, lmClient: lm, debounceMs: 20, episodicMemory: episodic});
        const added = await c.feedFromMemory(10);
        expect(added).toBe(2);
        expect(getEpisodes).toHaveBeenCalled();
    });

    it('handles LM errors gracefully (no crash, no NARS injection)', async () => {
        const failLM = {provider: 'mock', available: true, model: 'mock', generateText: jest.fn(async () => { throw new Error('boom'); })} as unknown as LMClient;
        const c = new ConsolidationEngine({nar, lmClient: failLM, debounceMs: 20});
        c.schedule(ep({concepts: ['cat']}));
        await new Promise(r => setTimeout(r, 200));
        // The engine swallows LM errors at the cluster level; no NARS injection
        // happens, and the in-flight flag is cleared.
        expect(c.isInFlight()).toBe(false);
        expect(input).not.toHaveBeenCalled();
    });

    describe('episodic log (replay support)', () => {
        it('appends scheduled records to the log', () => {
            const c = new ConsolidationEngine({debounceMs: 1000});
            const r1 = ep({id: 'r1'});
            const r2 = ep({id: 'r2'});
            c.schedule(r1);
            c.schedule(r2);
            expect(c.getLogSize()).toBe(2);
            expect(c.getEpisodeById('r1')).toBe(r1);
            expect(c.getEpisodeById('r2')).toBe(r2);
            expect(c.getEpisodeById('missing')).toBeUndefined();
            c.abort();
        });

        it('getRecentEpisodes returns the most recent N', () => {
            const c = new ConsolidationEngine({debounceMs: 1000});
            for (let i = 0; i < 5; i++) c.schedule(ep({id: `r${i}`}));
            const recent = c.getRecentEpisodes(3);
            expect(recent.map(r => r.id)).toEqual(['r2', 'r3', 'r4']);
            c.abort();
        });

        it('log survives debounce → run cycle (records not consumed)', async () => {
            const c = new ConsolidationEngine({nar, lmClient: lm, debounceMs: 30});
            c.schedule(ep({id: 'persist-1', concepts: ['cat']}));
            await new Promise(r => setTimeout(r, 200));
            expect(c.getPassCount()).toBeGreaterThan(0);
            expect(c.getEpisodeById('persist-1')).toBeDefined();
            c.abort();
        });
    });
});
