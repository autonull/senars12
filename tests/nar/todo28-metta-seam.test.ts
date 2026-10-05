import { describe, expect, it } from 'vitest';
import { createAgent } from '@senars/nar/agent';
import { createMettaPort } from '@senars/metta/agent';
import { NAR } from '@senars/nar';
import { DEFAULT_CONFIG } from '@senars/nar/types';

/**
 * TODO28 Bench — the MeTTa seam is a seam.
 *
 * Falsifies "the `nar → metta` inversion is closed": the layering claim is
 * only true if the engine is *injected*, and an injection that silently
 * defaults to constructing the engine is an import with extra steps. So the
 * absence case is the one under test — an unwired NAR must fail honestly
 * rather than quietly reaching up.
 */

const narWith = (metta?: ReturnType<typeof createMettaPort>): NAR =>
  new NAR({ ...DEFAULT_CONFIG, enableTools: true, metta });

describe('Bench — nar reaches MeTTa only through the port', () => {
  it('reports the engine as unconfigured when no port is injected', async () => {
    const result = await narWith().tools.get('metta')?.execute({ program: '(+ 2 3)' });
    expect(result).toMatchObject({ success: false });
    expect((result as { error?: string }).error).toContain('metta engine not configured');
  });

  it('still registers the tool, so the surface does not change shape with the engine', () => {
    expect(narWith().tools.get('metta')).toBeDefined();
  });

  it('evaluates through an injected port', async () => {
    const result = await narWith(createMettaPort())
      .tools.get('metta')
      ?.execute({ program: '(+ 2 3)' });
    expect(result).toMatchObject({ success: true, content: '(+ 2 3)' });
  });

  it('reports a malformed program rather than claiming it loaded', async () => {
    const result = await narWith(createMettaPort())
      .tools.get('metta')
      ?.execute({ program: '(+ 2' });
    expect(result).toMatchObject({ success: false });
  });

  it('an agent without a port still starts, with the same tool surface either way', async () => {
    const toolNames = async (metta?: ReturnType<typeof createMettaPort>): Promise<string[]> => {
      const agent = await createAgent({ metta });
      try {
        return agent.motor
          .list()
          .map((tool) => tool.name)
          .sort();
      } finally {
        await agent.stop();
      }
    };
    expect(await toolNames()).toContain('metta');
    expect(await toolNames(createMettaPort())).toEqual(await toolNames());
  });
});
