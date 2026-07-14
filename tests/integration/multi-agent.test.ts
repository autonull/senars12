import { Agent } from '@senars/core';
import { MettaBackend } from '@senars/metta/backend';
import { NarBackend } from '@senars/nar';
import { SeNARSFactory } from '@senars/nar';
import { createAgent } from '@senars/nar/agent';
import { DEFAULT_NAR_CONFIG } from '@senars/nar';
import { startAgentUI, type TestServer } from '@senars/ui/server';
import { describe, expect, it, afterAll, beforeAll } from 'vitest';

describe('Multi-Backend Agent Integration', () => {
  let server: TestServer;
  let agent: Agent;

  beforeAll(async () => {
    const nar = SeNARSFactory.createDefault({ ...DEFAULT_NAR_CONFIG });
    const oldAgent = createAgent({ nar });

    agent = new Agent({ name: 'test-multi' });

    // Register NAR backend (wraps old AgentImpl)
    const narBackend = new NarBackend(oldAgent);
    await agent.registerBackend(narBackend, {});

    // Register MeTTa backend
    const mettaBackend = new MettaBackend();
    await agent.registerBackend(mettaBackend, { metta: { maxRecursionDepth: 100 } });

    agent.start();
    server = await startAgentUI(agent, { port: 0 });
  }, 30000);

  afterAll(async () => {
    await server.close();
    agent.stop();
  });

  it('starts server with Agent as CognitiveEventSource', () => {
    expect(server).toBeDefined();
    expect(server.address().port).toBeGreaterThan(0);
  });

  it('reports capabilities from both backends', () => {
    const caps = agent.capabilities();
    expect(Array.isArray(caps)).toBe(true);
  });

  it('reports healthy status', () => {
    const health = agent.health();
    expect(health.status).toBe('healthy');
    expect(typeof health.cycleCount).toBe('number');
  });
});
