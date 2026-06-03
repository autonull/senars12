import {describe, it, expect, beforeEach} from '@jest/globals';
import {ConversationState} from '../../../src/agent/ConversationState.js';
import {makeDefaultBotConfig} from '../../../src/config/defaults.js';
import type {LMConfig, LMClient} from '../../../src/nar/lm/types.js';
import type {ReasoningArtifact} from '../../../src/agent/types.js';

type SummarizeOpts = LMConfig & {signal?: AbortSignal};

function makeLMClient(delayMs = 5, text = 'Conversation summary: a brief chat.'): LMClient {
    return {
        provider: 'mock',
        available: true,
        model: 'mock',
        async generateText(): Promise<string> {
            if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
            return text;
        },
    };
}

const config = makeDefaultBotConfig({
    conversation: {maxHistory: 5, summaryThreshold: 5, maxArtifacts: 50, pinnedBeliefLimit: 4},
});

describe('ConversationState — Phase 4 reliability', () => {
    let conversation: ConversationState;

    beforeEach(() => {
        conversation = new ConversationState(config);
    });

    it('does not summarize below threshold', async () => {
        const lm = makeLMClient();
        for (let i = 0; i < 4; i++) {
            conversation.addMessage({role: 'user', content: `m${i}`, timestamp: Date.now()}, lm);
        }
        expect(conversation.summary).toBeUndefined();
    });

    it('debounces summarize calls', async () => {
        let calls = 0;
        const callTracker: LMClient = {
            provider: 'mock', available: true, model: 'mock',
            async generateText() { calls++; return 'ok'; },
        };
        const c = new ConversationState(config, undefined, {debounceMs: 30, timeoutMs: 1000});
        for (let i = 0; i < 12; i++) c.addMessage({role: 'user', content: `m${i}`, timestamp: Date.now()}, callTracker);
        await new Promise(r => setTimeout(r, 100));
        expect(calls).toBe(1);
    });

    it('aborts an in-flight summarize on cancel', async () => {
        let aborted = false;
        const lm: LMClient = {
            provider: 'mock', available: true, model: 'mock',
            async generateText(_prompt: string, opts?: SummarizeOpts) {
                const signal = opts?.signal;
                return await new Promise<string>((resolve, reject) => {
                    const timer = setTimeout(() => resolve('done'), 200);
                    signal?.addEventListener('abort', () => { aborted = true; clearTimeout(timer); reject(new Error('aborted')); });
                });
            },
        };
        const c = new ConversationState(config, undefined, {debounceMs: 10, timeoutMs: 1000});
        for (let i = 0; i < 12; i++) c.addMessage({role: 'user', content: `m${i}`, timestamp: Date.now()}, lm);
        await new Promise(r => setTimeout(r, 50));
        c.cancelSummarize();
        await new Promise(r => setTimeout(r, 200));
        expect(aborted).toBe(true);
    });

    it('only runs one summarize at a time (single in-flight guard)', async () => {
        let concurrent = 0;
        let max = 0;
        const lm: LMClient = {
            provider: 'mock', available: true, model: 'mock',
            async generateText() {
                concurrent++;
                max = Math.max(max, concurrent);
                await new Promise(r => setTimeout(r, 30));
                concurrent--;
                return 'summary';
            },
        };
        const c = new ConversationState(config, undefined, {debounceMs: 5, timeoutMs: 1000});
        for (let i = 0; i < 30; i++) c.addMessage({role: 'user', content: `m${i}`, timestamp: Date.now()}, lm);
        await new Promise(r => setTimeout(r, 100));
        expect(max).toBe(1);
    });

    it('pinFromArtifacts adds beliefs and respects the limit', () => {
        const artifacts: ReasoningArtifact[] = [
            {type: 'belief_added', content: '(cat --> animal)', timestamp: 1},
            {type: 'belief_added', content: '(dog --> animal)', timestamp: 2},
            {type: 'belief_added', content: '(bird --> animal)', timestamp: 3},
            {type: 'belief_added', content: '(fish --> animal)', timestamp: 4},
            {type: 'belief_added', content: '(mouse --> animal)', timestamp: 5},
        ];
        conversation.pinFromArtifacts(artifacts, 3);
        const pinned = conversation.getPinned();
        expect(pinned).toHaveLength(3);
        expect(pinned).toContain('(mouse --> animal)');
    });

    it('pinFromArtifacts keeps prior pinned beliefs up to limit', () => {
        conversation.pin('(sky --> blue)');
        conversation.pinFromArtifacts([
            {type: 'belief_added', content: '(cat --> animal)', timestamp: 1},
        ], 3);
        const pinned = conversation.getPinned();
        expect(pinned).toContain('(sky --> blue)');
        expect(pinned).toContain('(cat --> animal)');
    });

    it('absorbModelMessages adds assistant text and tool artifacts', () => {
        const messages: Array<{role: 'user' | 'assistant' | 'system' | 'tool'; content: string | unknown[]}> = [
            {role: 'assistant', content: 'I will help.'},
            {role: 'assistant', content: [
                {type: 'text', text: 'Calling a tool.'},
                {type: 'tool-call', toolName: 'nar_believe', input: {statement: '(a --> b)'}},
                {type: 'tool-result', toolName: 'nar_believe', result: {ok: true}},
            ]},
        ];
        conversation.absorbModelMessages(messages);
        const history = conversation.getHistory();
        expect(history.length).toBeGreaterThanOrEqual(2);
        expect(history.some(m => m.content.includes('I will help'))).toBe(true);
    });

    it('cancelSummarize clears the timer', () => {
        const lm = makeLMClient();
        conversation.addMessage({role: 'user', content: 'm', timestamp: Date.now()}, lm);
        conversation.cancelSummarize();
        expect(conversation.isSummarizing()).toBe(false);
    });
});
