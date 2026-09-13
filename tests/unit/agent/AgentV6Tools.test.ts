import { registerAgentTools, ToolRegistry } from '@senars/core/motor';
import { describe, expect, it } from 'vitest';

async function callTool(
  registry: ToolRegistry,
  name: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; content: unknown }> {
  const spec = registry.get(name);
  if (!spec) throw new Error(`Tool ${name} not found`);
  return spec.execute(args);
}

function buildRegistry(deps: Parameters<typeof registerAgentTools>[1]): ToolRegistry {
  const registry = new ToolRegistry();
  registerAgentTools(registry, deps);
  return registry;
}

describe('Agent tools', () => {
  it('know stores a key/value pair', async () => {
    const stored: Array<{ key: string; value: string }> = [];
    const registry = buildRegistry({
      know: (k, v) => {
        stored.push({ key: k, value: v });
      },
      knowGet: (k) => stored.find((s) => s.key === k)?.value,
      knowList: () => stored,
      recall: async () => [],
    });
    const result = (await callTool(registry, 'know', { key: 'foo', value: 'bar' })) as {
      content: { stored: boolean; key: string };
    };
    expect(result.content.stored).toBe(true);
    expect(result.content.key).toBe('foo');
    expect(stored).toEqual([{ key: 'foo', value: 'bar' }]);
  });

  it('know_get returns found', async () => {
    const map = new Map([['k', 'v']]);
    const registry = buildRegistry({
      know: (k, v) => map.set(k, v),
      knowGet: (k) => map.get(k),
      knowList: () => [...map.entries()].map(([key, value]) => ({ key, value })),
      recall: async () => [],
    });
    const result = (await callTool(registry, 'know_get', { key: 'k' })) as {
      content: { found: boolean; value?: string };
    };
    expect(result.content.found).toBe(true);
    expect(result.content.value).toBe('v');
  });

  it('know_get returns not-found', async () => {
    const registry = buildRegistry({
      know: () => {},
      knowGet: () => undefined,
      knowList: () => [],
      recall: async () => [],
    });
    const result = (await callTool(registry, 'know_get', { key: 'missing' })) as {
      content: { found: boolean };
    };
    expect(result.content.found).toBe(false);
  });

  it('know_list returns all entries', async () => {
    const map = new Map([
      ['a', '1'],
      ['b', '2'],
    ]);
    const registry = buildRegistry({
      know: (k, v) => map.set(k, v),
      knowGet: (k) => map.get(k),
      knowList: () => [...map.entries()].map(([key, value]) => ({ key, value })),
      recall: async () => [],
    });
    const result = (await callTool(registry, 'know_list', {})) as {
      content: { entries: Array<{ key: string; value: string }> };
    };
    expect(result.content.entries).toEqual(
      expect.arrayContaining([
        { key: 'a', value: '1' },
        { key: 'b', value: '2' },
      ])
    );
  });

  it('recall invokes the underlying recall function with query and limit', async () => {
    let received: { query?: string; limit?: number } = {};
    const registry = buildRegistry({
      know: () => {},
      knowGet: () => undefined,
      knowList: () => [],
      recall: async (query, limit) => {
        received = { query, limit };
        return [{ timestamp: 1, type: 'input', content: 'hi', metadata: {} }];
      },
    });
    const result = (await callTool(registry, 'recall', { query: 'cat', limit: 5 })) as {
      content: Array<{ timestamp: number }>;
    };
    expect(received).toEqual({ query: 'cat', limit: 5 });
    expect(result.content.length).toBe(1);
  });

  it('know requires key and value in its schema', async () => {
    const registry = buildRegistry({
      know: () => {},
      knowGet: () => undefined,
      knowList: () => [],
      recall: async () => [],
    });
    expect(registry.get('know')?.parameters).toMatchObject({
      type: 'object',
      required: ['key', 'value'],
    });
  });
});
