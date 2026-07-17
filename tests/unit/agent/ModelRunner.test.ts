import type { ComposedRequest, ModelProvider } from '@senars/core';
import { ModelRunner } from '@senars/core';
import { describe, expect, it } from 'vitest';

function makeComposed(
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | unknown[];
  }>
): ComposedRequest {
  return {
    system: 'You are helpful.',
    messages,
    tools: {},
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
});
