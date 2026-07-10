import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { buildAgentTools } from '@senars/nar/agent';

function callTool(
  tools: Record<string, unknown>,
  name: string,
  args: Record<string, unknown>
): unknown {
  const t = tools[name] as { execute?: (a: unknown) => unknown };
  if (!t?.execute) throw new Error(`Tool ${name} not found`);
  return t.execute(args);
}

describe('Agent tools', () => {
  it('know stores a key/value pair', () => {
    const stored: Array<{ key: string; value: string }> = [];
    const tools = buildAgentTools({
      know: (k, v) => {
        stored.push({ key: k, value: v });
      },
      knowGet: (k) => stored.find((s) => s.key === k)?.value,
      knowList: () => stored,
      recall: async () => [],
    });
    const result = callTool(tools, 'know', { key: 'foo', value: 'bar' }) as {
      stored: boolean;
      key: string;
    };
    expect(result.stored).toBe(true);
    expect(result.key).toBe('foo');
    expect(stored).toEqual([{ key: 'foo', value: 'bar' }]);
  });

  it('know_get returns found', () => {
    const map = new Map([['k', 'v']]);
    const tools = buildAgentTools({
      know: (k, v) => map.set(k, v),
      knowGet: (k) => map.get(k),
      knowList: () => [...map.entries()].map(([key, value]) => ({ key, value })),
      recall: async () => [],
    });
    const result = callTool(tools, 'know_get', { key: 'k' }) as { found: boolean; value?: string };
    expect(result.found).toBe(true);
    expect(result.value).toBe('v');
  });

  it('know_get returns not-found', () => {
    const tools = buildAgentTools({
      know: () => {},
      knowGet: () => undefined,
      knowList: () => [],
      recall: async () => [],
    });
    const result = callTool(tools, 'know_get', { key: 'missing' }) as { found: boolean };
    expect(result.found).toBe(false);
  });

  it('know_list returns all entries', () => {
    const map = new Map([
      ['a', '1'],
      ['b', '2'],
    ]);
    const tools = buildAgentTools({
      know: (k, v) => map.set(k, v),
      knowGet: (k) => map.get(k),
      knowList: () => [...map.entries()].map(([key, value]) => ({ key, value })),
      recall: async () => [],
    });
    const result = callTool(tools, 'know_list', {}) as {
      entries: Array<{ key: string; value: string }>;
    };
    expect(result.entries).toEqual(
      expect.arrayContaining([
        { key: 'a', value: '1' },
        { key: 'b', value: '2' },
      ])
    );
  });

  it('recall invokes the underlying recall function with query and limit', async () => {
    let received: { query?: string; limit?: number } = {};
    const tools = buildAgentTools({
      know: () => {},
      knowGet: () => undefined,
      knowList: () => [],
      recall: async (query, limit) => {
        received = { query, limit };
        return [{ timestamp: 1, type: 'input', content: 'hi' }];
      },
    });
    const result = (await callTool(tools, 'recall', { query: 'cat', limit: 5 })) as Array<{
      timestamp: number;
    }>;
    expect(received).toEqual({ query: 'cat', limit: 5 });
    expect(result.length).toBe(1);
  });

  it('exposes zod schemas for input validation (inputSchema is a Zod schema)', () => {
    const tools = buildAgentTools({
      know: () => {},
      knowGet: () => undefined,
      knowList: () => [],
      recall: async () => [],
    });
    const know = tools['know'] as { inputSchema: z.ZodTypeAny };
    const parsed = know.inputSchema.safeParse({ key: 'x', value: 'y' });
    expect(parsed.success).toBe(true);
  });
});
