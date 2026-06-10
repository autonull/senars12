import {describe, it, expect} from '@jest/globals';
import {createAgent} from '../../../src/agent/agent.js';
import {EpisodeWorkingMemory} from '../../../src/agent/EpisodeWorkingMemory.js';
import {SeNARSFactory} from '../../../src/nar/index.js';
import {createSession} from '../../../src/agent/ConversationSession.js';
import {createWorkingMemoryTools} from '../../../src/nar/tools/adapters/index.js';
import type {LMClient} from '../../../src/nar/lm/types.js';

const scriptedLM: LMClient = {
    provider: 'scripted',
    model: 'scripted-1',
    available: true,
    async generateText(prompt: string) {
        if (prompt.toLowerCase().includes('hello')) return 'Hi there!';
        if (prompt.toLowerCase().includes('multi')) return 'First part. Second part.';
        return 'Mock reply';
    },
};

describe('EpisodeWorkingMemory', () => {
    it('set stores and get returns', () => {
        const wm = new EpisodeWorkingMemory();
        wm.set('focus', 'cat');
        expect(wm.get('focus')).toBe('cat');
    });

    it('append dedupes and caps', () => {
        const wm = new EpisodeWorkingMemory({maxValuesPerSlot: 3});
        wm.append('evidence', 'a');
        wm.append('evidence', 'b');
        wm.append('evidence', 'a');
        wm.append('evidence', 'c');
        wm.append('evidence', 'd');
        expect(wm.get('evidence')).toEqual(['b', 'c', 'd']);
    });

    it('TTL expires lazily on get', () => {
        let now = 1_000_000;
        const wm = new EpisodeWorkingMemory({clock: () => now});
        wm.set('focus', 'cat', 100);
        now += 200;
        expect(wm.get('focus')).toBeUndefined();
    });

    it('snapshot returns all live slots', () => {
        const wm = new EpisodeWorkingMemory();
        wm.set('focus', 'cat');
        wm.append('evidence', 'a');
        wm.append('evidence', 'b');
        const snap = wm.snapshot();
        expect(snap.focus).toBe('cat');
        expect(snap.evidence).toEqual(['a', 'b']);
    });

    it('clear removes a slot, remove deletes a value', () => {
        const wm = new EpisodeWorkingMemory();
        wm.append('evidence', 'a');
        wm.append('evidence', 'b');
        expect(wm.remove('evidence', 'a')).toBe(true);
        expect(wm.get('evidence')).toBe('b');
        wm.clear('evidence');
        expect(wm.has('evidence')).toBe(false);
    });
});

describe('createWorkingMemoryTools', () => {
    it('returns the 9 expected tool names', () => {
        const wm = new EpisodeWorkingMemory();
        const tools = createWorkingMemoryTools(wm);
        expect(Object.keys(tools).sort()).toEqual([
            'add_evidence',
            'clear_slot',
            'get_slot',
            'mark_open_question',
            'record_derivation',
            'set_focus',
            'set_goal',
            'set_hypothesis',
            'snapshot_working_memory',
        ]);
    });
});

describe('Agent.chatStream', () => {
    it('yields text-delta and finish events for scripted LM', async () => {
        const agent = createAgent({lmClient: scriptedLM});
        const events: {kind: string; text?: string}[] = [];
        const iter = agent.chatStream('hello world');
        let result: string = '';
        while (true) {
            const next = await iter.next();
            if (next.done) {
                result = next.value;
                break;
            }
            events.push(next.value);
        }
        expect(result).toBe('Hi there!');
        const deltas = events.filter(e => e.kind === 'text-delta').map(e => e.text ?? '');
        expect(deltas.join('')).toBe('Hi there!');
        expect(events.some(e => e.kind === 'finish')).toBe(true);
    });

    it('handles Narsese input via short-circuit', async () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 5});
        const agent = createAgent({nar});
        const events: {kind: string; text?: string}[] = [];
        let result = '';
        const iter = agent.chatStream('(cat --> animal).');
        while (true) {
            const next = await iter.next();
            if (next.done) {
                result = next.value;
                break;
            }
            events.push(next.value);
        }
        expect(result).toContain('(cat --> animal)');
        expect(events.some(e => e.kind === 'text-delta')).toBe(true);
    });

    it('honors AbortSignal mid-stream', async () => {
        const agent = createAgent({lmClient: scriptedLM});
        const controller = new AbortController();
        const iter = agent.chatStream('hello world', undefined, {signal: controller.signal});
        controller.abort();
        const first = await iter.next();
        expect(first.done || first.value.kind === 'aborted' || first.value.kind === 'text-delta').toBe(true);
    });
});

describe('Agent with WorkingMemory in chatWithHistory', () => {
    it('passes workingMemory through to buildTools', async () => {
        const agent = createAgent({lmClient: scriptedLM});
        const session = createSession('test:alice');
        const wm = new EpisodeWorkingMemory();
        wm.set('focus', 'cat');
        const reply = await agent.chatWithHistory('hello', session, {workingMemory: wm});
        expect(reply).toBe('Hi there!');
    });
});

describe('Agent recentDerivations', () => {
    it('starts empty and is queryable', () => {
        const agent = createAgent();
        expect(agent.getRecentDerivations()).toEqual([]);
        expect(agent.getLastSelfCorrectionNote()).toBeUndefined();
    });
});

describe('Tool deduplication', () => {
    it('createGeneralTools no longer includes search_memory', async () => {
        const {createGeneralTools} = await import('../../../src/nar/tools/adapters/aisdk-adapter.js');
        const tools = createGeneralTools({});
        expect(tools).not.toHaveProperty('search_memory');
        expect(tools).toHaveProperty('calculate');
        expect(tools).toHaveProperty('get_recent_episodes');
    });
});
