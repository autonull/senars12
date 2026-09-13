import { BUILTIN_TOOLS, type CmdArgSet, type ToolResult } from '@senars/core';
import { describe, expect, it } from 'vitest';

const execute = async (name: string, args: CmdArgSet): Promise<ToolResult> => {
  const tool = BUILTIN_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`tool not found: ${name}`);
  return await tool.execute(args);
};

describe('web tools', () => {
  it('search requires a query', async () => {
    const res = await execute('search', { args: [] });
    expect(res.success).toBe(false);
    expect(res.error).toContain('search requires a query');
  });

  it('tavily_search reports a missing key without failing', async () => {
    const saved = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
    const res = await execute('tavily_search', { args: ['"test query"'] });
    if (saved) process.env.TAVILY_API_KEY = saved;
    expect(res.success).toBe(true);
    expect((res.content as { note?: string }).note).toContain('TAVILY_API_KEY not set');
  });

  it('web_fetch refuses non-http protocols', async () => {
    const res = await execute('web_fetch', { args: ['file:///etc/passwd'] });
    expect(res.success).toBe(false);
    expect(res.error).toContain('non-http');
  });

  it('web_fetch requires a URL', async () => {
    const res = await execute('web_fetch', { args: [] });
    expect(res.success).toBe(false);
    expect(res.error).toContain('requires a URL');
  });

  it('web tools are registered on the surface', () => {
    const names = BUILTIN_TOOLS.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['search', 'tavily_search', 'web_fetch']));
  });
});
