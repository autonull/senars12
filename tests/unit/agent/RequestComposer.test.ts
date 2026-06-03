import {describe, it, expect} from '@jest/globals';
import {compose} from '../../../src/agent/request/RequestComposer.js';
import {route} from '../../../src/agent/routing/InputRouter.js';
import {makeDefaultBotConfig} from '../../../src/config/defaults.js';
import type {CognitiveSnapshotData} from '../../../src/agent/types.js';

const config = makeDefaultBotConfig();
const tools = {nar_believe: {description: 'fake', execute: () => ({})}};

describe('RequestComposer', () => {
    it('composes for narsese belief route', () => {
        const r = route('(cat --> animal).');
        const out = compose('(cat --> animal).', r, {tools, config});
        expect(out.system).toBeDefined();
        expect(out.messages.length).toBe(1);
        expect(out.messages[0]?.role).toBe('user');
        expect(out.tools).toBe(tools);
        expect(out.ctxHash).toMatch(/^route:narsese-belief:/);
    });

    it('composes for natural language route', () => {
        const r = route('Hello there');
        const out = compose('Hello there', r, {tools, config});
        expect(out.system).toBeDefined();
        expect(out.messages[0]?.content).toBe('Hello there');
    });

    it('composes for command route', () => {
        const r = route('.run 5');
        const out = compose('.run 5', r, {tools, config});
        expect(out.ctxHash).toMatch(/^route:command:/);
    });

    it('composes for narsese question route', () => {
        const r = route('(cat --> ?)?');
        const out = compose('(cat --> ?)?', r, {tools, config});
        expect(out.ctxHash).toMatch(/^route:narsese-question:/);
    });

    it('embeds snapshot in system prompt when present', () => {
        const r = route('Hello');
        const snap: CognitiveSnapshotData = {
            attention: [{term: 'cat', priority: 0.9}],
            questions: ['is cat alive?'],
            goals: [],
            memory: {totalConcepts: 1, totalTasks: 1, workingMemorySize: 0},
            episodes: [],
            pinnedBeliefs: [],
            tokens: 10,
            capturedAt: Date.now(),
        };
        const out = compose('Hello', r, {tools, config, snapshot: snap});
        expect(out.system).toContain('cat');
        expect(out.system).toContain('is cat alive?');
        expect(out.snapshot).toEqual(snap);
    });

    it('trims history when over budget', () => {
        const r = route('hi');
        const longHistory = Array.from({length: 50}, (_, i) => ({
            role: 'user' as const,
            content: 'x'.repeat(200),
        }));
        const out = compose('hi', r, {tools, config, historyOverride: longHistory, maxContextTokens: 200});
        expect(out.messages.length).toBeLessThanOrEqual(40);
    });

    it('produces deterministic ctxHash for same inputs', () => {
        const r = route('hi');
        const t = 12345;
        const a = compose('hi', r, {tools, config, lastInputAt: t});
        const b = compose('hi', r, {tools, config, lastInputAt: t});
        expect(a.ctxHash).toBe(b.ctxHash);
    });

    it('uses snapshotTokens in budget accounting', () => {
        const r = route('hi');
        const snap: CognitiveSnapshotData = {
            attention: [{term: 'cat', priority: 0.5}],
            questions: [],
            goals: [],
            memory: {totalConcepts: 1, totalTasks: 1, workingMemorySize: 0},
            episodes: [],
            pinnedBeliefs: [],
            tokens: 50,
            capturedAt: Date.now(),
        };
        const out = compose('hi', r, {tools, config, snapshot: snap});
        expect(out.budget.snapshotTokens).toBe(50);
    });

    it('cascades snapshot trim when over budget', () => {
        const r = route('hi');
        const manyEpisodes = Array.from({length: 12}, (_, i) => ({
            timestamp: 1000 + i, type: 'input', summary: 'x'.repeat(50),
        }));
        const snap: CognitiveSnapshotData = {
            attention: Array.from({length: 10}, (_, i) => ({term: `t${i}`, priority: 0.5})),
            questions: ['q1', 'q2', 'q3'],
            goals: ['g1', 'g2'],
            memory: {totalConcepts: 100, totalTasks: 200, workingMemorySize: 0},
            episodes: manyEpisodes,
            pinnedBeliefs: ['b1'],
            tokens: 1000,
            capturedAt: Date.now(),
        };
        const out = compose('hi', r, {tools, config, snapshot: snap, maxContextTokens: 200});
        const trimmed = out.snapshot!;
        expect(trimmed.episodes.length).toBeLessThan(manyEpisodes.length);
        expect(trimmed.tokens).toBeLessThanOrEqual(1000);
    });

    it('returns null snapshot when no snapshot supplied', () => {
        const r = route('hi');
        const out = compose('hi', r, {tools, config});
        expect(out.snapshot).toBeNull();
    });
});
