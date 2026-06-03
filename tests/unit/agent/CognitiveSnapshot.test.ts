import {describe, it, expect, beforeEach} from '@jest/globals';
import {CognitiveSnapshot, buildCtxHash} from '../../../src/agent/request/CognitiveSnapshot.js';
import {SeNARSFactory} from '../../../src/nar/index.js';
import {route} from '../../../src/agent/routing/InputRouter.js';

describe('CognitiveSnapshot', () => {
    let snap: CognitiveSnapshot;

    beforeEach(() => {
        snap = new CognitiveSnapshot({maxTokens: 2048, ttlMs: 60_000});
    });

    it('returns null when nar is undefined', async () => {
        const out = await snap.get({ctxHash: 'h1'});
        expect(out).toBeNull();
    });

    it('memoizes per ctxHash', async () => {
        const nar = SeNARSFactory.createDefault();
        await nar.input('(cat --> animal).');
        const ctxHash = buildCtxHash(route('hi'), nar, 1);
        const a = await snap.get({nar, ctxHash});
        const b = await snap.get({nar, ctxHash});
        expect(a).toBe(b);
        expect(snap.getComputeCount()).toBe(1);
    });

    it('recomputes after invalidate', async () => {
        const nar = SeNARSFactory.createDefault();
        const ctxHash = buildCtxHash(route('hi'), nar, 2);
        await snap.get({nar, ctxHash});
        snap.invalidate(ctxHash);
        await snap.get({nar, ctxHash});
        expect(snap.getComputeCount()).toBe(2);
    });

    it('recomputes after invalidateAll', async () => {
        const nar = SeNARSFactory.createDefault();
        const h1 = buildCtxHash(route('hi'), nar, 3);
        const h2 = buildCtxHash(route('there'), nar, 4);
        await snap.get({nar, ctxHash: h1});
        await snap.get({nar, ctxHash: h2});
        expect(snap.getComputeCount()).toBe(2);
        snap.invalidateAll();
        await snap.get({nar, ctxHash: h1});
        expect(snap.getComputeCount()).toBe(3);
        expect(snap.size()).toBe(1);
    });

    it('respects TTL expiration', async () => {
        const nar = SeNARSFactory.createDefault();
        const shortTtl = new CognitiveSnapshot({ttlMs: 5});
        const ctxHash = buildCtxHash(route('hi'), nar, 5);
        await shortTtl.get({nar, ctxHash});
        await new Promise(r => setTimeout(r, 20));
        await shortTtl.get({nar, ctxHash});
        expect(shortTtl.getComputeCount()).toBe(2);
    });

    it('captures attention, questions, goals, memory', async () => {
        const nar = SeNARSFactory.createDefault();
        await nar.input('(cat --> animal).');
        const out = await snap.get({nar, ctxHash: buildCtxHash(route('hi'), nar, 6)});
        expect(out).not.toBeNull();
        expect(out!.memory.totalConcepts).toBeGreaterThan(0);
    });

    it('trims to budget when snapshot exceeds maxTokens', async () => {
        const nar = SeNARSFactory.createDefault();
        for (let i = 0; i < 10; i++) await nar.input(`(t${i} --> cat).`);
        const tiny = new CognitiveSnapshot({maxTokens: 50, maxAttention: 15, maxEpisodes: 5});
        const out = await tiny.get({nar, ctxHash: buildCtxHash(route('hi'), nar, 7)});
        expect(out).not.toBeNull();
        expect(out!.attention.length).toBeLessThan(15);
    });
});
