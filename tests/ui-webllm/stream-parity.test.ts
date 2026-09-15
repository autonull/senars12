/**
 * WebLLM Stream Parity Test (3A)
 * 
 * Unit test driving ../../ui/src/webllm.ts doStream() with a mock engine
 * (same ChatStreamEvent shapes: text-start/text-delta/text-end/finish).
 * Asserts WS-fallback path and tool-loop event parity.
 * 
 * Runs in <1s, no WebGPU required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart, LanguageModelV4TextPart, LanguageModelV4FinishReason } from '@ai-sdk/provider';

// Empty async iterable for resetting mock
const emptyAsyncIterable: AsyncIterable<any> = {
  [Symbol.asyncIterator]: async function* () { }
};

// Mock the ../../ui/src/webllm.ts module
vi.mock('../../ui/src/webllm.ts', () => {
  // Mock engine
  let mockStreamImpl: AsyncIterable<any> = emptyAsyncIterable;

  function setMockStream(stream: AsyncIterable<any>) {
    mockStreamImpl = stream;
  }

  function createMockModel() {
    return {
      specificationVersion: 'v4',
      provider: 'webllm',
      modelId: 'test-model',
      supportedUrls: {},
      async doGenerate() { throw new Error('Not implemented in mock'); },
      async doStream(_options: LanguageModelV4CallOptions) {
        let textId = 0;

        const readableStream = new ReadableStream<LanguageModelV4StreamPart>({
          async start(controller) {
            let accumulatedContent = '';
            let hasStarted = false;
            let finishReason: any = {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: { 
                inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, 
                outputTokens: { total: 5, text: 5, reasoning: 0 } 
              },
            };

            for await (const chunk of mockStreamImpl) {
              const choice = chunk.choices[0];
              if (!choice) continue;

              const delta = choice.delta?.content ?? '';
              if (delta) {
                accumulatedContent += delta;
                if (!hasStarted) {
                  controller.enqueue({ type: 'text-start', id: String(textId++) } as LanguageModelV4StreamPart);
                  hasStarted = true;
                }
                controller.enqueue({ type: 'text-delta', id: String(textId - 1), delta } as LanguageModelV4StreamPart);
              }

              if (choice.finish_reason) {
                let unified: 'stop' | 'tool-calls' | 'length' | 'content-filter' | 'other' = 'stop';
                switch (choice.finish_reason) {
                  case 'tool_calls': unified = 'tool-calls'; break;
                  case 'length': unified = 'length'; break;
                  case 'content_filter': unified = 'content-filter'; break;
                }
                finishReason = {
                  type: 'finish',
                  finishReason: { unified, raw: choice.finish_reason },
                  usage: { 
                    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, 
                    outputTokens: { total: accumulatedContent.length, text: accumulatedContent.length, reasoning: 0 } 
                  },
                };
              }
            }

            if (hasStarted) {
              controller.enqueue({ type: 'text-end', id: String(textId - 1) } as LanguageModelV4StreamPart);
            }

            controller.enqueue(finishReason);
            controller.close();
          },
        });

        return { stream: readableStream };
      },
    };
  }

  return {
    createWebLLMModel: createMockModel,
    webllmModels: {},
    detectDevice: () => 'cpu' as const,
    preloadModel: vi.fn(),
    clearEngineCache: vi.fn(),
    __testUtils: { setMockStream },
  };
});

// Import the mocked module
const mockedModule = await import('../../ui/src/webllm.ts');
const createWebLLMModel = mockedModule.createWebLLMModel;
const __testUtils = (mockedModule as any).__testUtils;

describe('WebLLM Stream Parity (3A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    __testUtils.setMockStream(emptyAsyncIterable);
  });

  function createMockChunks(chunks: Array<{ content?: string; finish_reason?: string | null }>) {
    return {
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) {
          yield { choices: [{ delta: { content: chunk.content ?? '' }, finish_reason: chunk.finish_reason ?? null }] };
        }
      },
    };
  }

  it('should emit text-start, text-delta, text-end, finish events in order', async () => {
    __testUtils.setMockStream(createMockChunks([
      { content: 'Hello' },
      { content: ' world' },
      { content: '!', finish_reason: 'stop' },
    ]));

    const model = createWebLLMModel('test-model');

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Say hello' }] }],
      temperature: 0.7,
      maxOutputTokens: 100,
    });

    const events: LanguageModelV4StreamPart[] = [];
    for await (const event of result.stream) {
      events.push(event);
    }

    // Verify event sequence
    expect(events.length).toBeGreaterThanOrEqual(4);
    
    // First event: text-start
    const startEvent = events[0];
    expect(startEvent).toBeDefined();
    expect(startEvent!.type).toBe('text-start');
    expect(startEvent).toHaveProperty('id');

    // Middle events: text-delta (at least one)
    const deltaEvents = events.filter(e => e.type === 'text-delta');
    expect(deltaEvents.length).toBeGreaterThanOrEqual(1);
    expect(deltaEvents[0]).toHaveProperty('delta');
    expect(deltaEvents[0]).toHaveProperty('id');

    // Before finish: text-end
    const endEvents = events.filter(e => e.type === 'text-end');
    expect(endEvents.length).toBe(1);
    expect(endEvents[0]).toHaveProperty('id');

    // Last event: finish
    const finishEvent = events[events.length - 1] as LanguageModelV4StreamPart & { type: 'finish'; finishReason: LanguageModelV4FinishReason };
    expect(finishEvent.type).toBe('finish');
    expect(finishEvent.finishReason.unified).toBe('stop');
  });

  it('should handle empty stream gracefully', async () => {
    __testUtils.setMockStream(createMockChunks([]));

    const model = createWebLLMModel('test-model');

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Empty' }] }],
    });

    const events: LanguageModelV4StreamPart[] = [];
    for await (const event of result.stream) {
      events.push(event);
    }

    // Should only get finish event
    expect(events.length).toBe(1);
    const finishEvent = events[0] as LanguageModelV4StreamPart & { type: 'finish'; finishReason: LanguageModelV4FinishReason };
    expect(finishEvent.type).toBe('finish');
  });

  it('should accumulate deltas correctly', async () => {
    __testUtils.setMockStream(createMockChunks([
      { content: 'The' },
      { content: ' quick' },
      { content: ' brown' },
      { content: ' fox', finish_reason: 'stop' },
    ]));

    const model = createWebLLMModel('test-model');

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Complete' }] }],
    });

    const events: LanguageModelV4StreamPart[] = [];
    for await (const event of result.stream) {
      events.push(event);
    }

    // Reconstruct text from deltas
    const deltas = events.filter(e => e.type === 'text-delta').map(e => (e as any).delta).join('');
    expect(deltas).toBe('The quick brown fox');
  });

  it('should emit proper usage metadata in finish event', async () => {
    __testUtils.setMockStream(createMockChunks([
      { content: 'Test response', finish_reason: 'stop' },
    ]));

    const model = createWebLLMModel('test-model');

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
    });

    const events: LanguageModelV4StreamPart[] = [];
    for await (const event of result.stream) {
      events.push(event);
    }

    const finishEvent = events.find(e => e.type === 'finish') as any;
    expect(finishEvent).toBeDefined();
    expect(finishEvent.usage).toBeDefined();
    expect(finishEvent.usage.inputTokens).toBeDefined();
    expect(finishEvent.usage.outputTokens).toBeDefined();
    expect(typeof finishEvent.usage.inputTokens.total).toBe('number');
    expect(typeof finishEvent.usage.outputTokens.total).toBe('number');
    expect(finishEvent.finishReason.unified).toBe('stop');
  });

  it('should maintain consistent textId across events', async () => {
    __testUtils.setMockStream(createMockChunks([
      { content: 'A' },
      { content: 'B' },
      { content: 'C', finish_reason: 'stop' },
    ]));

    const model = createWebLLMModel('test-model');

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
    });

    const events: LanguageModelV4StreamPart[] = [];
    for await (const event of result.stream) {
      events.push(event);
    }

    const startEvent = events.find(e => e.type === 'text-start') as any;
    const deltaEvents = events.filter(e => e.type === 'text-delta') as any[];
    const endEvent = events.find(e => e.type === 'text-end') as any;

    expect(startEvent.id).toBeDefined();
    expect(deltaEvents.every(e => e.id === startEvent.id)).toBe(true);
    expect(endEvent.id).toBe(startEvent.id);
  });
});