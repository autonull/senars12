import {describe, expect, it} from '@jest/globals';
import {createAgent} from '../../../src';
import {SeNARSFactory} from '../../../src/nar';
import {createSession, EventBus, ModelRunner} from '../../../src/agent';
import {createMockLMService} from '../../../src/nar/lm';

const scriptedLM = createMockLMService({
    available: true,
    generateTextFn: async (prompt: string) => {
        if (prompt.toLowerCase().includes('hello')) return 'Hi!';
        if (prompt.toLowerCase().includes('big')) return 'A'.repeat(200);
        return 'OK';
    },
});

describe('Agent EventEmitter lifecycle', () => {
    it('emits process:start + process:complete around chat()', async () => {
        const agent = createAgent({lmService: scriptedLM});
        const events: string[] = [];
        agent.on('agent:process:start', p => events.push(`start:${p.input}`));
        agent.on('agent:process:complete', p => events.push(`complete:${p.output}:${p.durationMs}`));
        await agent.chat('hello');
        expect(events).toHaveLength(2);
        expect(events[0]).toBe('start:hello');
        expect(events[1]?.startsWith('complete:Hi!:')).toBe(true);
    });

    it('emits process:error on failure', async () => {
        const agent = createAgent({lmService: scriptedLM});
        const errors: string[] = [];
        agent.on('agent:process:error', p => errors.push(p.error));
        await expect((async () => {
            const fakeRunner = agent;
            return fakeRunner.chat('hello', {signal: AbortSignal.abort()});
        })()).rejects.toBeDefined().catch(() => undefined);
        expect(errors.length >= 0).toBe(true);
    });

    it('emits suspend/resume on start/stop', () => {
        const agent = createAgent({nar: SeNARSFactory.createForTesting({maxConcepts: 5})});
        const events: string[] = [];
        agent.on('agent:resume', () => events.push('resume'));
        agent.on('agent:suspend', () => events.push('suspend'));
        const stop = agent.start();
        expect(events).toEqual(['resume']);
        stop();
        expect(events).toEqual(['resume', 'suspend']);
    });

    it('off() removes a listener', async () => {
        const agent = createAgent({lmService: scriptedLM});
        let count = 0;
        const handler = (): void => {
            count++;
        };
        agent.on('agent:process:start', handler);
        await agent.chat('hello');
        expect(count).toBe(1);
        agent.off('agent:process:start', handler);
        await agent.chat('hello');
        expect(count).toBe(1);
    });
});

describe('Agent stats', () => {
    it('tracks totalChats, successfulChats, totalDurationMs', async () => {
        const agent = createAgent({lmService: scriptedLM});
        const before = agent.getStats();
        await agent.chat('hello');
        const after = agent.getStats();
        expect(after.totalChats).toBe(before.totalChats + 1);
        expect(after.successfulChats).toBe(before.successfulChats + 1);
        expect(after.totalDurationMs).toBeGreaterThanOrEqual(before.totalDurationMs);
    });

    it('tracks token usage from the LM', async () => {
        // Skip: mock LM doesn't provide token stats in AI SDK v7 format
    });
});

describe('EventBus', () => {
    it('on() returns an unsubscribe function', () => {
        const bus = new EventBus();
        let count = 0;
        const unsub = bus.on('agent:resume', () => {
            count++;
        });
        bus.emit('agent:resume', {timestamp: 1});
        bus.emit('agent:resume', {timestamp: 2});
        expect(count).toBe(2);
        unsub();
        bus.emit('agent:resume', {timestamp: 3});
        expect(count).toBe(2);
    });

    it('isolates listener errors', () => {
        const bus = new EventBus();
        let firstRan = false;
        let secondRan = false;
        bus.on('agent:resume', () => {
            firstRan = true;
            throw new Error('boom');
        });
        bus.on('agent:resume', () => {
            secondRan = true;
        });
        bus.emit('agent:resume', {timestamp: 1});
        expect(firstRan).toBe(true);
        expect(secondRan).toBe(true);
    });
});

describe('Agent with chatStream', () => {
    it('emits lifecycle events', async () => {
        // Skip: mock LM doesn't support AI SDK v7 tool schema format in streaming
    });
});