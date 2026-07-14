import { Agent } from '@senars/core';
import { MettaBackend } from '@senars/metta/backend';
import { NarBackend } from '@senars/nar';
import { SeNARSFactory } from '@senars/nar';
import { createAgent } from '@senars/nar/agent';
import { DEFAULT_NAR_CONFIG } from '@senars/nar';
import { bootstrapStdLib, clearOps } from '@senars/metta';
import type { BackendInput } from '@senars/core';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Integration test: MeTTa tools are registered into the NAR backend and execute
 * against the real MeTTa runtime through NAR's tool pipeline.
 *
 * The LLM's decision to call a tool is an external, non-deterministic component.
 * This test verifies the deterministic bridge: Agent.registerBackend(Metta) wires
 * MeTTa's tools into NarBackend -> AgentImpl.buildTools(), and executing a tool
 * (exactly what the LLM would invoke) runs real MeTTa code.
 */
describe('MeTTa tool invocation via NAR backend', () => {
  let agent: Agent;
  let narImpl: ReturnType<typeof createAgent>;
  let mettaBackend: MettaBackend;

  beforeAll(async () => {
    clearOps();
    bootstrapStdLib();

    const nar = SeNARSFactory.createDefault({ ...DEFAULT_NAR_CONFIG });
    narImpl = createAgent({ nar });
    const narBackend = new NarBackend(narImpl);

    agent = new Agent({ name: 'metta-tool-test' });
    await agent.registerBackend(narBackend, {});

    mettaBackend = new MettaBackend();
    // Registering MettaBackend wires its tools into the NAR backend automatically
    await agent.registerBackend(mettaBackend, {});
    agent.start();
  });

  it('exposes MeTTa tools in the NAR backend toolset', () => {
    const tools = narImpl.buildTools() as Record<string, { execute?: (args: Record<string, unknown>) => unknown }>;
    expect(tools['metta-match']).toBeDefined();
    expect(tools['metta-rewrite']).toBeDefined();
    expect(tools['metta-query']).toBeDefined();
    expect(typeof tools['metta-match'].execute).toBe('function');
  });

  it('runs a MeTTa match tool against the real runtime', async () => {
    const tools = narImpl.buildTools() as Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
    const result = await tools['metta-match'].execute({ pattern: '(+ $x $y)' });

    // The tool executed real MeTTa and returned the runtime's evaluation result
    expect(typeof result).toBe('string');
    expect(result as string).toMatch(/^(True|False)$/);
  });

  it('runs a MeTTa rewrite tool against the real runtime', async () => {
    const tools = narImpl.buildTools() as Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
    const result = await tools['metta-rewrite'].execute({ rule: '(+ $x 0)', target: '(+ 5 0)' });

    expect(typeof result).toBe('string');
  });

  it('runs a MeTTa query tool against the real runtime', async () => {
    const tools = narImpl.buildTools() as Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
    const result = await tools['metta-query'].execute({ pattern: '(color $x)' });

    expect(typeof result).toBe('string');
  });
});
