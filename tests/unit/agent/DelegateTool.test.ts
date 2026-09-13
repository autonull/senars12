import { type AgentToolDeps, ToolRegistry } from '@senars/core';
import { registerAgentTools } from '@senars/core/motor';
import { describe, expect, it } from 'vitest';

const buildRegistry = (deps: AgentToolDeps): ToolRegistry => {
  const motor = new ToolRegistry();
  registerAgentTools(motor, deps);
  return motor;
};

describe('delegate tool', () => {
  it('returns the sub-agent result', async () => {
    const motor = new ToolRegistry();
    registerAgentTools(motor, {
      know: () => undefined,
      knowGet: () => undefined,
      knowList: () => [],
      recall: async () => [],
      delegate: async (prompt: string) => `did: ${prompt}`,
    });
    const res = await motor.execute('delegate', { prompt: 'summarize x' });
    expect(res.success).toBe(true);
    expect((res.content as { result: string }).result).toBe('did: summarize x');
  });

  it('fails closed when delegation is unavailable', async () => {
    const motor = new ToolRegistry();
    registerAgentTools(motor, {
      know: () => undefined,
      knowGet: () => undefined,
      knowList: () => [],
      recall: async () => [],
    });
    const res = await motor.execute('delegate', { prompt: 'x' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('delegation not available');
  });

  it('propagates worker failures as tool errors', async () => {
    const motor = new ToolRegistry();
    registerAgentTools(motor, {
      know: () => undefined,
      knowGet: () => undefined,
      knowList: () => [],
      recall: async () => [],
      delegate: async () => {
        throw new Error('worker crashed');
      },
    });
    const res = await motor.execute('delegate', { prompt: 'x' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('worker crashed');
  });
});
