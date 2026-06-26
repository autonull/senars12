import {describe, expect, it} from '@jest/globals';
import {AISDKAdapter} from '../../../src/nar/lm/adapters';
import type {LMClient} from '../../../src/nar/lm';

class CannedLMClient implements LMClient {
    readonly provider = 'canned';
    readonly model = 'canned-1';
    readonly available = true;
    calls: string[] = [];

    constructor(private readonly response: string) {
    }

    async generateText(prompt: string): Promise<string> {
        this.calls.push(prompt);
        return this.response;
    }
}

const v2Prompt = (input: string, system = 'You are helpful.') => [
    {role: 'system' as const, content: system},
    {role: 'user' as const, content: input},
];

function passthroughSchema() {
    return {
        safeParse: (raw: unknown) => ({success: true, data: raw as unknown}),
    };
}

function strictEchoSchema() {
    return {
        safeParse: (raw: unknown) => {
            const r = raw as { text?: unknown };
            if (typeof r?.text !== 'string') {
                return {success: false, error: {issues: [{code: 'invalid_type', path: ['text']}]}};
            }
            return {success: true, data: {text: r.text}};
        },
    };
}

describe('AISDKAdapter', () => {
    describe('doGenerate', () => {
        it('returns text-only content when LM emits plain text', async () => {
            const client = new CannedLMClient('Just a friendly greeting.');
            const adapter = new AISDKAdapter(client);
            const out = await adapter.doGenerate({prompt: v2Prompt('Hello')});
            expect(out.finishReason).toBe('stop');
            expect(out.content).toEqual([{type: 'text', text: 'Just a friendly greeting.'}]);
        });

        it('parses a single tool call and returns tool-call content part', async () => {
            const client = new CannedLMClient('Got it.\n{"name": "echo", "arguments": {"text": "hi"}}');
            const adapter = new AISDKAdapter(client);
            const out = await adapter.doGenerate({
                prompt: v2Prompt('echo something'),
                tools: [{type: 'function', name: 'echo', description: 'echo', inputSchema: passthroughSchema()}],
            });
            expect(out.finishReason).toBe('tool-calls');
            const callPart = out.content.find(p => p.type === 'tool-call');
            expect(callPart).toBeDefined();
            if (callPart?.type === 'tool-call') {
                expect(callPart.toolName).toBe('echo');
                expect(callPart.input).toEqual({text: 'hi'});
            }
        });

        it('strips tool-call JSON from the text content', async () => {
            const client = new CannedLMClient('Here you go: {"name": "echo", "arguments": {"text": "ping"}}');
            const adapter = new AISDKAdapter(client);
            const out = await adapter.doGenerate({
                prompt: v2Prompt('echo'),
                tools: [{type: 'function', name: 'echo', description: 'echo', inputSchema: passthroughSchema()}],
            });
            const text = out.content.find(p => p.type === 'text');
            expect(text?.type === 'text' && text.text).not.toContain('"name"');
        });

        it('parses multiple tool calls in one response', async () => {
            const client = new CannedLMClient('{"name": "echo", "arguments": {"text": "a"}}\nthen\n{"name": "nar_believe", "arguments": {"statement": "(a --> b)."}}');
            const adapter = new AISDKAdapter(client);
            const out = await adapter.doGenerate({
                prompt: v2Prompt('multi'),
                tools: [
                    {type: 'function', name: 'echo', description: 'echo', inputSchema: passthroughSchema()},
                    {type: 'function', name: 'nar_believe', description: 'believe', inputSchema: passthroughSchema()},
                ],
            });
            const calls = out.content.filter(p => p.type === 'tool-call');
            expect(calls.length).toBe(2);
        });

        it('ignores tool calls for unknown tool names', async () => {
            const client = new CannedLMClient('{"name": "ghost", "arguments": {}}');
            const adapter = new AISDKAdapter(client);
            const out = await adapter.doGenerate({
                prompt: v2Prompt('x'),
                tools: [{type: 'function', name: 'echo', description: 'echo', inputSchema: passthroughSchema()}],
            });
            expect(out.content.every(p => p.type !== 'tool-call')).toBe(true);
            expect(out.finishReason).toBe('stop');
        });

        it('returns empty content on empty LM response', async () => {
            const client = new CannedLMClient('');
            const adapter = new AISDKAdapter(client);
            const out = await adapter.doGenerate({prompt: v2Prompt('x')});
            expect(out.content).toEqual([]);
            expect(out.finishReason).toBe('stop');
        });

        it('falls back to raw args when Zod validation fails', async () => {
            const client = new CannedLMClient('{"name": "echo", "arguments": {"text": 42}}');
            const adapter = new AISDKAdapter(client);
            const out = await adapter.doGenerate({
                prompt: v2Prompt('x'),
                tools: [{type: 'function', name: 'echo', description: 'echo', inputSchema: strictEchoSchema()}],
            });
            const call = out.content.find(p => p.type === 'tool-call');
            expect(call?.type === 'tool-call' && call.input).toEqual({text: 42});
        });

        it('passes validated args through when Zod succeeds', async () => {
            const client = new CannedLMClient('{"name": "echo", "arguments": {"text": "abc"}}');
            const adapter = new AISDKAdapter(client);
            const out = await adapter.doGenerate({
                prompt: v2Prompt('x'),
                tools: [{type: 'function', name: 'echo', description: 'echo', inputSchema: passthroughSchema()}],
            });
            const call = out.content.find(p => p.type === 'tool-call');
            if (call?.type === 'tool-call') expect(call.input).toEqual({text: 'abc'});
        });

        it('ignores malformed JSON in the response', async () => {
            const client = new CannedLMClient('here is text {not valid json} more text');
            const adapter = new AISDKAdapter(client);
            const out = await adapter.doGenerate({prompt: v2Prompt('x')});
            expect(out.content.some(p => p.type === 'text')).toBe(true);
        });
    });

    describe('doStream', () => {
        it('yields text-delta then finish events for plain text', async () => {
            const client = new CannedLMClient('Streaming hello');
            const adapter = new AISDKAdapter(client);
            const out = await adapter.doStream({prompt: v2Prompt('hi')});
            const reader = out.stream.getReader();
            const events: unknown[] = [];
            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                events.push(value);
            }
            const types = events.map(e => (e as { type: string }).type);
            expect(types).toContain('text-delta');
            expect(types).toContain('finish');
        });

        it('emits tool-call events for parsed calls', async () => {
            const client = new CannedLMClient('{"name": "echo", "arguments": {"text": "abc"}}');
            const adapter = new AISDKAdapter(client);
            const out = await adapter.doStream({
                prompt: v2Prompt('x'),
                tools: [{type: 'function', name: 'echo', description: 'echo', inputSchema: passthroughSchema()}],
            });
            const reader = out.stream.getReader();
            const events: unknown[] = [];
            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                events.push(value);
            }
            const toolCall = events.find(e => (e as { type: string }).type === 'tool-call');
            expect(toolCall).toBeDefined();
        });
    });
});
