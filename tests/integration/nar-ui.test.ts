import { createAgent } from '@senars/nar/agent';
import { SeNARSFactory } from '@senars/nar';
import { DEFAULT_NAR_CONFIG } from '@senars/nar';
import { startWebUIWithOptions, type TestServer } from '@senars/ui/server';
import { describe, expect, it, afterAll, beforeAll, vi } from 'vitest';
import type { CognitiveEvent } from '@senars/core';

describe('NAR Agent + UI Server Integration', () => {
  let agent: ReturnType<typeof createAgent>;
  let server: TestServer;
  const TEST_PORT = 3998;

  beforeAll(async () => {
    const nar = SeNARSFactory.createDefault({ ...DEFAULT_NAR_CONFIG });
    agent = createAgent({ nar });
    agent.start();

    server = await startWebUIWithOptions(agent, { port: TEST_PORT });
  }, 30000);

  afterAll(async () => {
    await server.close();
    agent.stop();
  });

  it('starts UI server with NAR Agent as CognitiveEventSource', () => {
    expect(server).toBeDefined();
    expect(server.address().port).toBe(TEST_PORT);
  });

  it('NAR Agent implements CognitiveEventSource interface', () => {
    expect(typeof agent.start).toBe('function');
    expect(typeof agent.stop).toBe('function');
    expect(typeof agent.submit).toBe('function');
    expect(typeof agent.on).toBe('function');
    expect(typeof agent.off).toBe('function');
    expect(typeof agent.health).toBe('function');
    expect(typeof agent.capabilities).toBe('function');
    expect(typeof agent.mount).toBe('function');
    expect(typeof agent.unmount).toBe('function');
  });

  it('emits cognitive events for chat input', async () => {
    const events: CognitiveEvent[] = [];
    const handler = (e: CognitiveEvent) => events.push(e);

    agent.on('*', handler);
    // Consume the async generator with stream option
    for await (const _ of agent.chat('Hello NAR', { stream: true })) {
      // consume
    }
    await new Promise((r) => setTimeout(r, 100));
    agent.off('*', handler);

    const inputEvents = events.filter((e) => e.type === 'input');
    expect(inputEvents.length).toBeGreaterThan(0);
    expect(inputEvents[0].engine).toBe('nar');
    expect(inputEvents[0].correlationId).toBeDefined();
  });

  it('reports healthy status', () => {
    const health = agent.health();
    expect(health.status).toBe('healthy');
    expect(typeof health.cycleCount).toBe('number');
  });

  it('declares correct capabilities', () => {
    const caps = agent.capabilities();
    expect(caps.engine).toBe('nar');
    expect(caps.supports.chat).toBe(true);
    expect(caps.supports.beliefs).toBe(true);
    expect(caps.supports.drives).toBe(true);
    expect(caps.supports.skills).toBe(false);
    expect(caps.supports.ltm).toBe(false);
    expect(caps.supports.rlfp).toBe(true);
    expect(caps.supports.selfReasoning).toBe(true);
    expect(caps.supports.autonomyLoop).toBe(true);
  });
});