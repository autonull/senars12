import { Agent } from '@senars/core';
import { MettaEngine } from '@senars/metta/engine/MettaEngine';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { startAgentUI, type TestServer } from '@senars/ui/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Multi-Engine Agent Integration', () => {
  let server: TestServer;
  let agent: Agent;

  beforeAll(async () => {
    const narEngine = new NAREngine();
    await narEngine.initialize();
    const mettaEngine = new MettaEngine();
    await mettaEngine.initialize();

    agent = new Agent({ id: 'test-multi' });
    agent.registerEngine('nar', narEngine);
    agent.registerEngine('metta', mettaEngine);
    agent.start();

    server = await startAgentUI(agent, { port: 0 });
  }, 30000);

  afterAll(async () => {
    await server.close();
    agent.stop();
  });

  it('starts server with Agent', () => {
    expect(server).toBeDefined();
    expect(server.address().port).toBeGreaterThan(0);
  });

  it('reports capabilities', () => {
    const caps = agent.capabilities();
    expect(caps).toBeDefined();
    expect(caps.supports.chat).toBe(true);
  });

  it('reports healthy status', () => {
    const health = agent.health();
    expect(health.status).toBe('healthy');
    expect(typeof health.cycleCount).toBe('number');
  });
});
