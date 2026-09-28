import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { createFileSystemTools } from '../../nar/src/tools/adapters/filesystem.js';
import { describe, expect, it, vi } from 'vitest';

describe('fs tool workspace scope', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'senars-fs-'));
  writeFileSync(join(workspace, 'inside.txt'), 'ok');

  const tools = createFileSystemTools({ workspaceRoot: workspace });
  const run = async (name: 'fs_read' | 'fs_write', args: object): Promise<Record<string, unknown>> =>
    (await tools[name].execute(args as never, { toolCallId: 't', messages: [] } as never)) as Record<
      string,
      unknown
    >;

  it('reads a path inside the workspace', async () => {
    expect(await run('fs_read', { path: 'inside.txt' })).toEqual({
      content: 'ok',
      path: 'inside.txt',
      size: 2,
    });
  });

  it('rejects a traversal escape', async () => {
    expect(await run('fs_read', { path: '../escape.txt' })).toMatchObject({
      error: expect.stringContaining('within workspace'),
    });
  });

  it('rejects a sibling directory that merely shares the root name prefix', async () => {
    const sibling = join(dirname(workspace), `${basename}-evil`, 'f.txt');
    expect(await run('fs_read', { path: sibling })).toMatchObject({
      error: expect.stringContaining('within workspace'),
    });
  });

  it('refuses to write outside the workspace', async () => {
    expect(await run('fs_write', { path: '../evil.txt', content: 'x' })).toMatchObject({
      error: expect.stringContaining('within workspace'),
    });
  });
});

describe('rate limiter window', () => {
  it('admits exactly the limit within one window, then sheds', async () => {
    vi.useFakeTimers();
    try {
      const { createRateLimiter } = await import('../../io/src/bridge/MiddlewarePipeline.js');
      const mw = createRateLimiter(3);
      const respond = vi.fn().mockResolvedValue(undefined);
      const next = vi.fn().mockResolvedValue(undefined);
      const ctx = { respond } as never;
      const msg = {} as never;

      await mw(msg, ctx, next);
      await mw(msg, ctx, next);
      await mw(msg, ctx, next);
      expect(next).toHaveBeenCalledTimes(3);
      expect(respond).not.toHaveBeenCalled();

      await mw(msg, ctx, next);
      expect(next).toHaveBeenCalledTimes(3);
      expect(respond).toHaveBeenCalledWith(expect.stringContaining('Rate limit'));

      // The window slides: once the oldest arrivals age out, capacity returns.
      vi.advanceTimersByTime(1001);
      await mw(msg, ctx, next);
      expect(next).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
