import { Agent } from '@senars/agent';
import { NAREngine } from '@senars/agent';
import { createLogStore } from '@senars/agent';
import { startAgentUI, type TestServer } from '@senars/ui/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';

describe('Multi-Engine Agent Integration', () => {
  let server: TestServer;
  let agent: Agent;
  let logStore: ReturnType<typeof createLogStore>;
  let statePath: string;

  beforeAll(async () => {
    statePath = mkdtempSync(join(tmpdir(), 'multi-agent-test-'));
    logStore = createLogStore({ dir: join(statePath, 'log') });
    await logStore.open();

    const narEngine = new NAREngine();
    await narEngine.initialize();

    agent = new Agent({ id: 'test-multi', logStore });
    agent.registerEngine('nar', narEngine);
    await agent.start();

    server = await startAgentUI(agent, { port: 0 });
  }, 30000);

  afterAll(async () => {
    await server.close();
    await agent.stop();
    await logStore.close();
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
