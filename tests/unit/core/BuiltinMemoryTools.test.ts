import { type CmdArgSet, createBuiltinTools, type ToolResult } from '@senars/core';
import { describe, expect, it } from 'vitest';

interface Episode {
  timestamp: number;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
}

const createStubEpisodic = () => {
  const episodes: Episode[] = [];
  return {
    episodes,
    log: async (type: string, content: string, metadata: Record<string, unknown> = {}) => {
      episodes.push({ timestamp: Date.now(), type, content, metadata });
    },
    getRecent: async (limit = 5) => episodes.slice(-limit),
    search: async (query: string, limit = 10) =>
      episodes.filter((e) => e.content.includes(query)).slice(0, limit),
  };
};

const execute = async (
  name: string,
  args: CmdArgSet,
  tools = createBuiltinTools()
): Promise<ToolResult> => {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`tool not found: ${name}`);
  return await tool.execute(args);
};

describe('builtin memory/metta tools', () => {
  it('remember/episodes/query fail honestly without an episodic backend', async () => {
    expect((await execute('remember', { args: ['"x"'] })).error).toContain('not configured');
    expect((await execute('episodes', { args: [] })).error).toContain('not configured');
    expect((await execute('query', { args: ['"x"'] })).error).toContain('not configured');
  });

  it('metta fails honestly without an engine executor', async () => {
    const res = await execute('metta', { args: ['"(add 1 2)"'] });
    expect(res.success).toBe(false);
    expect(res.error).toContain('metta engine not configured');
  });

  it('remember stores an episode and episodes lists it', async () => {
    const episodic = createStubEpisodic();
    const tools = createBuiltinTools({ episodic: episodic as never });
    const stored = await execute('remember', { args: ['"whiskers is a cat"'] }, tools);
    expect(stored).toMatchObject({ success: true, content: { stored: true } });
    const listed = await execute('episodes', { args: [] }, tools);
    expect((listed.content as { episodes: Episode[] }).episodes.map((e) => e.content)).toContain(
      'whiskers is a cat'
    );
  });

  it('query searches episodes by content', async () => {
    const episodic = createStubEpisodic();
    const tools = createBuiltinTools({ episodic: episodic as never });
    await execute('remember', { args: ['"cats are mammals"'] }, tools);
    await execute('remember', { args: ['"dogs are canines"'] }, tools);
    const res = await execute('query', { args: ['"mammals"'] }, tools);
    const episodes = (res.content as { episodes: Episode[] }).episodes ?? [];
    expect(episodes).toHaveLength(1);
    expect(episodes[0]?.content).toBe('cats are mammals');
  });

  it('metta delegates to the engine executor', async () => {
    const tools = createBuiltinTools({ metta: async (expr) => [`evaluated:${expr}`] });
    const res = await execute('metta', { args: ['"(add 1 2)"'] }, tools);
    expect(res.content).toEqual({ expression: '(add 1 2)', result: ['evaluated:(add 1 2)'] });
  });
});

describe('workspace sandbox + pin store', () => {
  it('fs tools reject paths outside the workspace root', async () => {
    const tools = createBuiltinTools();
    for (const name of ['read_file', 'write_file', 'append_file']) {
      const args =
        name === 'read_file' ? { args: ['"/etc/passwd"'] } : { args: ['"/etc/passwd"', '"x"'] };
      const res = await execute(name, args, tools);
      expect(res.success).toBe(false);
      expect(res.error).toContain('outside workspace');
    }
  });

  it('fs tools accept workspace-relative paths', async () => {
    const tools = createBuiltinTools();
    const res = await execute(
      'write_file',
      { args: ['".cache/sandbox-probe.txt"', '"hi"'] },
      tools
    );
    expect(res.success).toBe(true);
    const { rm } = await import('node:fs/promises');
    await rm('.cache/sandbox-probe.txt');
  });

  it('pin stores, lists, and unpins via the pin store', async () => {
    const pins = new Map<string, string>();
    const tools = createBuiltinTools({
      pins: {
        pin: (key, value) => void pins.set(key, value),
        unpin: (key?: string) => {
          if (key) pins.delete(key);
        },
        recallAll: () => new Map(pins),
      },
    });
    const stored = await execute('pin', { args: ['"goal"', '"learn"'] }, tools);
    expect(stored.content).toEqual({ pinned: 'goal', value: 'learn' });
    const listed = await execute('pin', { args: ['--list'] }, tools);
    expect(listed.content).toEqual({ pinned: [{ key: 'goal', value: 'learn' }] });
    await execute('pin', { args: ['"goal"'] }, tools);
    expect(pins.size).toBe(0);
  });

  it('pin fails honestly without a store', async () => {
    const res = await execute('pin', { args: ['"k"', '"v"'] });
    expect(res.error).toContain('pin store not configured');
  });
});
