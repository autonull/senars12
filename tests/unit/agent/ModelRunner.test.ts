import {describe, it, expect} from '@jest/globals';
import {ModelRunner} from '../../../src/agent/model/ModelRunner.js';
import type {LMClient} from '../../../src/nar/lm/types.js';
import type {ComposedRequest, ReasoningArtifact} from '../../../src/agent/types.js';

class ScriptedLMClient implements LMClient {
    readonly provider = 'scripted';
    readonly model = 'scripted-1';
    readonly available = true;
    public callIndex = 0;
    constructor(private readonly script: string[]) {}
    async generateText(_prompt: string): Promise<string> {
        const out = this.script[this.callIndex] ?? '';
        this.callIndex++;
        return out;
    }
}

function makeComposed(tools: Record<string, unknown>, messages: Array<{role: 'user' | 'assistant' | 'system' | 'tool'; content: string | unknown[]}>): ComposedRequest {
    return {
        system: 'You are helpful.',
        messages,
        tools,
        ctxHash: 'h1',
        snapshot: null,
        budget: {systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 1024},
    };
}

describe('ModelRunner', () => {
    it('returns empty result when no LM client', async () => {
        const runner = new ModelRunner({});
        const composed = makeComposed({}, [{role: 'user', content: 'hi'}]);
        const events: unknown[] = [];
        const result = await (async () => {
            let r: Awaited<ReturnType<typeof drain>> | undefined;
            const it = runner.run(composed);
            while (true) {
                const {value, done} = await it.next();
                if (done) {
                    r = value as Awaited<ReturnType<typeof drain>>;
                    break;
                }
                events.push(value);
            }
            return r!;
        })();
        expect(result.text).toBe('');
        expect(result.toolCalls).toEqual([]);
        expect(result.messages.length).toBe(1);
    });

    it('streams text deltas and finishes when LM emits only text', async () => {
        const client = new ScriptedLMClient(['Hello there.']);
        const runner = new ModelRunner({lmClient: client, maxLoops: 3});
        const composed = makeComposed({}, [{role: 'user', content: 'greet me'}]);
        const events: {kind: string; text?: string}[] = [];
        const result = await drain(runner, composed, events);
        expect(result.text).toBe('Hello there.');
        const textDeltas = events.filter(e => e.kind === 'text-delta');
        expect(textDeltas.length).toBeGreaterThan(0);
        const finish = events.find(e => e.kind === 'finish');
        expect(finish).toBeDefined();
    });

    it('parses a tool call, dispatches it, and appends tool-result to messages', async () => {
        const tools = {
            nar_believe: {
                description: 'Add a belief',
                inputSchema: {safeParse: (raw: unknown) => ({success: true, data: raw})},
                execute: async (args: Record<string, unknown>) => ({success: true, statement: (args as {statement: string}).statement}),
            },
        };
        const client = new ScriptedLMClient([
            'OK adding.\n{"name": "nar_believe", "arguments": {"statement": "(cat --> animal)."}}',
            'Belief recorded.',
        ]);
        const runner = new ModelRunner({lmClient: client, maxLoops: 5});
        const composed = makeComposed(tools, [{role: 'user', content: 'learn this'}]);
        const events: {kind: string; [k: string]: unknown}[] = [];
        const result = await drain(runner, composed, events);
        expect(result.toolCalls.length).toBe(1);
        expect(result.toolCalls[0]?.toolName).toBe('nar_believe');
        expect(result.toolCalls[0]?.args).toEqual({statement: '(cat --> animal).'});
        const beliefArtifact: ReasoningArtifact | undefined = result.artifacts.find(a => a.type === 'belief_added');
        expect(beliefArtifact).toBeDefined();
        const toolResults = events.filter(e => e.kind === 'tool-result');
        expect(toolResults.length).toBe(1);
        const toolCallMsg = result.messages.find(m => m.role === 'assistant' && Array.isArray(m.content));
        expect(toolCallMsg).toBeDefined();
        const toolResultMsg = result.messages.find(m => m.role === 'tool' && Array.isArray(m.content));
        expect(toolResultMsg).toBeDefined();
        if (Array.isArray(toolResultMsg?.content)) {
            const firstPart = toolResultMsg.content[0] as {type: string; toolCallId?: string};
            expect(firstPart.type).toBe('tool-result');
            expect(firstPart.toolCallId).toBeDefined();
        }
    });

    it('loops twice when LM emits a second tool call in a follow-up response', async () => {
        const tools = {
            first: {
                description: 'first tool',
                inputSchema: {safeParse: (raw: unknown) => ({success: true, data: raw})},
                execute: async () => 'first-result',
            },
            second: {
                description: 'second tool',
                inputSchema: {safeParse: (raw: unknown) => ({success: true, data: raw})},
                execute: async () => 'second-result',
            },
        };
        const client = new ScriptedLMClient([
            'First.\n{"name": "first", "arguments": {}}',
            'Then second.\n{"name": "second", "arguments": {}}',
            'All done.',
        ]);
        const runner = new ModelRunner({lmClient: client, maxLoops: 5});
        const composed = makeComposed(tools, [{role: 'user', content: 'go'}]);
        const result = await drain(runner, composed, []);
        expect(result.toolCalls.map(t => t.toolName)).toEqual(['first', 'second']);
        expect(client.callIndex).toBe(3);
    });

    it('stops looping after maxLoops even if tool calls continue', async () => {
        const tools = {
            loop: {
                description: 'loop tool',
                inputSchema: {safeParse: (raw: unknown) => ({success: true, data: raw})},
                execute: async () => 'ok',
            },
        };
        const client = new ScriptedLMClient([
            '{"name": "loop", "arguments": {}}',
            '{"name": "loop", "arguments": {}}',
            '{"name": "loop", "arguments": {}}',
            '{"name": "loop", "arguments": {}}',
        ]);
        const runner = new ModelRunner({lmClient: client, maxLoops: 2});
        const composed = makeComposed(tools, [{role: 'user', content: 'go'}]);
        const result = await drain(runner, composed, []);
        expect(result.toolCalls.length).toBe(2);
    });

    it('surfaces tool execution errors without crashing', async () => {
        const tools = {
            boom: {
                description: 'explodes',
                inputSchema: {safeParse: (raw: unknown) => ({success: true, data: raw})},
                execute: async () => { throw new Error('kapow'); },
            },
        };
        const client = new ScriptedLMClient(['{"name": "boom", "arguments": {}}', 'ok.']);
        const runner = new ModelRunner({lmClient: client, maxLoops: 3});
        const composed = makeComposed(tools, [{role: 'user', content: 'go'}]);
        const events: {kind: string; [k: string]: unknown}[] = [];
        const result = await drain(runner, composed, events);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]?.message).toBe('kapow');
        const errEvent = events.find(e => e.kind === 'tool-error');
        expect(errEvent).toBeDefined();
    });

    it('handles malformed JSON in the LM response by treating it as text', async () => {
        const client = new ScriptedLMClient(['not a tool call { bad json }']);
        const runner = new ModelRunner({lmClient: client, maxLoops: 2});
        const composed = makeComposed({}, [{role: 'user', content: 'go'}]);
        const result = await drain(runner, composed, []);
        expect(result.toolCalls).toEqual([]);
        expect(result.text).toContain('not a tool call');
    });
});

type Drainable = {run: (c: ComposedRequest, s?: AbortSignal) => AsyncGenerator<unknown, {text: string; toolCalls: Array<{toolName: string; args: Record<string, unknown>}>; artifacts: ReasoningArtifact[]; errors: Array<{message: string}>; messages: Array<{role: string; content: string | unknown[]}>}, void>};

async function drain(runner: Drainable, composed: ComposedRequest, events: unknown[]) {
    const iter = runner.run(composed);
    let final: {text: string; toolCalls: Array<{toolName: string; args: Record<string, unknown>}>; artifacts: ReasoningArtifact[]; errors: Array<{message: string}>; messages: Array<{role: string; content: string | unknown[]}>} | undefined;
    while (true) {
        const {value, done} = await iter.next();
        if (done) {
            final = value as typeof final;
            break;
        }
        events.push(value);
    }
    return final!;
}
