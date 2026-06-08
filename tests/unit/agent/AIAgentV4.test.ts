import {describe, it, expect, beforeEach} from '@jest/globals';
import {AIAgent} from '../../../src/agent/agent.js';
import {getPolicy, recordRoute, recordTool} from '../../../src/agent/services/metrics.js';
import {SeNARSFactory} from '../../../src/nar/index.js';
import type {LMClient} from '../../../src/nar/lm/types.js';
import type {NAR} from '../../../src/nar/nar.js';

const scriptedLM: LMClient = {
    provider: 'scripted',
    model: 'scripted-1',
    available: true,
    async generateText(prompt: string) {
        if (prompt.toLowerCase().includes('hello')) return 'Hi there!';
        return 'Mock response.';
    },
};

describe('AIAgent (v4 slim core)', () => {
    let nar: NAR;
    beforeEach(() => {
        nar = SeNARSFactory.createForTesting({maxConcepts: 20});
    });

    it('routes narsese belief to NAR and records episode', async () => {
        const agent = new AIAgent({nar, lmClient: scriptedLM});
        const text = await agent.chat('(cat --> animal).');
        expect(text).toContain('(cat --> animal)');
        expect(nar.getBeliefs().length).toBeGreaterThan(0);
        const episodes = agent.getRecentEpisodes();
        expect(episodes.length).toBe(1);
        expect(episodes[0]!.routeKind).toBe('narsese-belief');
    });

    it('routes commands verbatim', async () => {
        const agent = new AIAgent({nar, lmClient: scriptedLM});
        const text = await agent.chat('.run 5');
        expect(text).toBe('[run 5]');
    });

    it('falls back to nl for natural language', async () => {
        const agent = new AIAgent({nar, lmClient: scriptedLM});
        const text = await agent.chat('Hello there');
        expect(text).toBe('Hi there!');
        expect(agent.getHistory(10).length).toBe(2);
    });

    it('caps history at 40 entries', async () => {
        const agent = new AIAgent({nar, lmClient: scriptedLM});
        for (let i = 0; i < 30; i++) await agent.chat(`turn-${i}`);
        expect(agent.getHistory(100).length).toBeLessThanOrEqual(40);
    });

    it('caps episodes at 256 entries', async () => {
        const agent = new AIAgent({nar, lmClient: scriptedLM});
        for (let i = 0; i < 5; i++) await agent.chat('.run 1');
        expect(agent.listEpisodes(1000).length).toBe(5);
    });

    it('exposes getPolicy from metrics module', () => {
        recordRoute('nl');
        recordRoute('command');
        recordTool('nar_believe');
        const policy = getPolicy();
        expect(policy.routingWeights.nl).toBeGreaterThan(0);
        expect(policy.toolSelectionBias.nar_believe).toBeGreaterThan(0);
        expect(typeof policy.updatedAt).toBe('number');
    });
});
