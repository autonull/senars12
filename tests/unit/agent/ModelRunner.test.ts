import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import type { ComposedRequest, ModelProvider } from '@senars/core';
import { ModelRunner } from '@senars/core';
import { createMockLMService } from '@senars/nar';
import { jsonSchema, type LanguageModel, type ModelMessage, type ToolSet, tool } from 'ai';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import { describe, expect, it } from 'vitest';

function makeComposed(messages: ModelMessage[], tools: ToolSet = {}): ComposedRequest {
  return {
    system: 'You are helpful.',
    messages,
    tools,
    ctxHash: 'h1',
    snapshot: null,
    budget: { systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 1024 },
  };
}

describe('ModelRunner', () => {
  it('returns empty result when no model provider', async () => {
    const runner = new ModelRunner({});
    const composed = makeComposed([{ role: 'user', content: 'hi' }]);
    const iter = runner.run(composed);
    let result:
      | {
          text: string;
          toolCalls: unknown[];
          artifacts: unknown[];
          errors: unknown[];
          messages: unknown[];
          usage: unknown;
        }
      | undefined;
    while (true) {
      const { value, done } = await iter.next();
      if (done) {
        result = value as typeof result;
        break;
      }
    }
    expect(result?.text).toBe('');
    expect(result?.toolCalls).toEqual([]);
    expect(result?.messages).toHaveLength(1);
  });

  it('returns fallback when no model available', async () => {
    const provider: ModelProvider = { available: true, getModel: () => undefined };
    const runner = new ModelRunner({ modelProvider: provider, maxLoops: 3 });
    const composed = makeComposed([{ role: 'user', content: 'greet me' }]);
    const iter = runner.run(composed);
    let result: { text: string } | undefined;
    while (true) {
      const { value, done } = await iter.next();
      if (done) {
        result = value as { text: string };
        break;
      }
    }
    expect(result?.text).toBe('No model available');
  });

  it('streams text deltas and finishes with the full text', async () => {
    const lmService = createMockLMService({ generateTextFn: () => 'hello world' });
    const runner = new ModelRunner({ modelProvider: lmService });
    const composed = makeComposed([{ role: 'user', content: 'greet me' }]);
    const events: string[] = [];
    const iter = runner.run(composed);
    let result: { text: string } | undefined;
    while (true) {
      const { value, done } = await iter.next();
      if (done) {
        result = value as { text: string };
        break;
      }
      events.push((value as { kind: string }).kind);
    }
    expect(events).toContain('text-delta');
    expect(result?.text).toBe('hello world');
  });

  it('executes a tool loop and reports tool-call events', async () => {
    const executed: Array<Record<string, unknown>> = [];
    const toolModel = new MockLanguageModelV3({
      provider: 'mock',
      modelId: 'tool-model',
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'tool-input-start', id: 't1', toolName: 'echo' },
            {
              type: 'tool-call',
              toolCallId: 'tc1',
              toolName: 'echo',
              input: JSON.stringify({ message: 'ping' }),
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 1, text: 1, reasoning: 0 },
              },
            },
          ] as LanguageModelV3StreamPart[],
        }),
      }),
    }) as unknown as LanguageModel;

    const tools: ToolSet = {
      echo: tool({
        description: 'echo',
        inputSchema: jsonSchema({ type: 'object', properties: { message: { type: 'string' } } }),
        execute: async (args) => {
          executed.push(args as Record<string, unknown>);
          return `echo:${(args as { message: string }).message}`;
        },
      }),
    };
    const provider: ModelProvider = { available: true, getModel: () => toolModel };
    const runner = new ModelRunner({ modelProvider: provider, maxLoops: 1 });
    const events: Array<{ kind: string }> = [];
    const iter = runner.run(makeComposed([{ role: 'user', content: 'use the tool' }], tools));
    let result: { toolCalls: unknown[]; artifacts: unknown[] } | undefined;
    while (true) {
      const { value, done } = await iter.next();
      if (done) {
        result = value as typeof result;
        break;
      }
      events.push(value as { kind: string });
    }
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain('tool-call');
    expect(kinds).toContain('tool-result');
    expect(executed).toEqual([{ message: 'ping' }]);
    expect(result?.toolCalls).toHaveLength(1);
  });

  const streamChunk = (chunks: LanguageModelV3StreamPart[][]): { model: LanguageModel } => {
    let call = 0;
    const model = new MockLanguageModelV3({
      provider: 'mock',
      modelId: 'tool-model',
      doStream: async () => {
        const batch = chunks[call++] ?? [];
        return {
          stream: simulateReadableStream({ chunks: batch as LanguageModelV3StreamPart[] }),
        };
      },
    }) as unknown as LanguageModel;
    return { model };
  };

  const finishChunk: LanguageModelV3StreamPart = {
    type: 'finish',
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
  };

  const toolCallChunk = (id: string, name: string, input: unknown): LanguageModelV3StreamPart => ({
    type: 'tool-call',
    toolCallId: id,
    toolName: name,
    input: JSON.stringify(input),
  });

  it('executes two tool-calls from one step in parallel and returns resumable messages', async () => {
    const executed: string[] = [];
    const step1: LanguageModelV3StreamPart[] = [
      { type: 'tool-input-start', id: 't1', toolName: 'echo' },
      toolCallChunk('tc1', 'echo', { message: 'a' }),
      { type: 'tool-input-start', id: 't2', toolName: 'echo' },
      toolCallChunk('tc2', 'echo', { message: 'b' }),
      {
        type: 'finish',
        finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
      },
    ];
    const { model } = streamChunk([step1, [finishChunk]]);
    const tools: ToolSet = {
      echo: tool({
        description: 'echo',
        inputSchema: jsonSchema({ type: 'object', properties: { message: { type: 'string' } } }),
        execute: async (args) => `echo:${(args as { message: string }).message}`,
      }),
    };
    const runner = new ModelRunner({
      modelProvider: { available: true, getModel: () => model },
      maxLoops: 2,
    });
    const result = await runner.runToCompletion(
      makeComposed([{ role: 'user', content: 'call tools' }], tools)
    );
    expect(result.toolCalls).toHaveLength(2);
    expect(result.artifacts.map((a) => a.content)).toEqual(
      expect.arrayContaining(['echo:a', 'echo:b'])
    );
    // resumable: returned messages extend the input with the assistant turn
    expect(result.messages.length).toBeGreaterThan(1);
  });

  it('feeds tool errors back to the model and continues the loop', async () => {
    const step1: LanguageModelV3StreamPart[] = [
      toolCallChunk('tc1', 'boom', {}),
      {
        type: 'finish',
        finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
      },
    ];
    const { model } = streamChunk([
      step1,
      [
        { type: 'text-delta', id: 'x', delta: 'recovered' } as LanguageModelV3StreamPart,
        finishChunk,
      ],
    ]);
    const tools: ToolSet = {
      boom: tool({
        description: 'always fails',
        inputSchema: jsonSchema({ type: 'object', properties: {} }),
        execute: async (): Promise<string> => {
          throw new Error('tool exploded');
        },
      }),
    };
    const runner = new ModelRunner({
      modelProvider: { available: true, getModel: () => model },
      maxLoops: 2,
    });
    const events: Array<{ kind: string }> = [];
    const iter = runner.run(makeComposed([{ role: 'user', content: 'try it' }], tools));
    let result: { text: string; errors: unknown[]; messages: Array<{ role: string }> } | undefined;
    while (true) {
      const { value, done } = await iter.next();
      if (done) {
        result = value as typeof result;
        break;
      }
      events.push(value as { kind: string });
    }
    // loop continued past the failing tool to the recovery step
    expect(result?.text).toContain('recovered');
    expect(result?.messages.some((m) => m.role === 'tool')).toBe(true);
  });
});
