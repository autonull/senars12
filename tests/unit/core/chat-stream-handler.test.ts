import type { Agent } from '@senars/core';
import { aggregateChatResponse } from '@senars/core/bridge/chat-stream-handler';
import { describe, expect, it } from 'vitest';

function fakeAgent(parts: string[]): Agent {
  return {
    chat(text: string): AsyncIterable<{ kind: string; text?: string }> {
      return (async function* () {
        for (const p of parts) yield { kind: 'text-delta', text: p };
      })();
    },
  } as unknown as Agent;
}

describe('aggregateChatResponse', () => {
  it('concatenates text-delta chunks from agent.chat', async () => {
    const agent = fakeAgent(['Hello', ', ', 'world']);
    const out = await aggregateChatResponse(agent, 'hi');
    expect(out).toBe('Hello, world');
  });

  it('returns empty string when there are no text deltas', async () => {
    const agent = {
      chat: async function* () {
        yield { kind: 'done' };
      },
    } as unknown as Agent;
    expect(await aggregateChatResponse(agent, 'hi')).toBe('');
  });

  it('ignores undefined text deltas', async () => {
    const agent = {
      chat: async function* () {
        yield { kind: 'text-delta' };
        yield { kind: 'text-delta', text: 'x' };
      },
    } as unknown as Agent;
    expect(await aggregateChatResponse(agent, 'hi')).toBe('x');
  });

  it('tolerates an agent without a chat method', async () => {
    const agent = {} as unknown as Agent;
    expect(await aggregateChatResponse(agent, 'hi')).toBe('');
  });
});
