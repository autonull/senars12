import { SeNARSFactory } from '@senars/nar';
import { DEFAULT_NAR_CONFIG } from '@senars/nar';
import { CognitiveCoordinator } from '@senars/core/coordinator';
import { startWebUIWithOptions, type TestServer } from '@senars/ui/server';
import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import type { AgentCapabilities } from '@senars/core';
import { MettaAgent } from '@senars/metta/agent';
import { createAgent } from '@senars/nar/agent';

describe('CognitiveCoordinator Multi-Agent Integration', () => {
  let server: TestServer;
  let coordinator: CognitiveCoordinator;
  let narCleanup: () => void;
  const nar = SeNARSFactory.createDefault(DEFAULT_NAR_CONFIG);
  const narAgent = createAgent({ nar });
  const mettaAgent = new MettaAgent();

  beforeAll(async () => {
    // Start both agents - capture cleanup function for afterAll
    narCleanup = narAgent.start();
    mettaAgent.start();

    // Create coordinator to fan input to both (it doesn't call start() on already-started agents)
    coordinator = new CognitiveCoordinator([narAgent, mettaAgent]);

    server = await startWebUIWithOptions(coordinator, { port: 4000 });
  }, 30000);

  afterAll(async () => {
    await server.close();
    // Use the cleanup function to properly stop NAR agent
    if (narCleanup) narCleanup();
  });

  it('starts server with coordinator as CognitiveEventSource', () => {
    expect(server).toBeDefined();
    expect(server.address().port).toBe(4000);
  });

  it('coordinator implements CognitiveEventSource interface', () => {
    expect(typeof coordinator.start).toBe('function');
    expect(typeof coordinator.stop).toBe('function');
    expect(typeof coordinator.submit).toBe('function');
    expect(typeof coordinator.on).toBe('function');
    expect(typeof coordinator.off).toBe('function');
    expect(typeof coordinator.health).toBe('function');
    expect(typeof coordinator.capabilities).toBe('function');
    expect(typeof coordinator.mount).toBe('function');
    expect(typeof coordinator.unmount).toBe('function');
  });

  it('returns array of capabilities from both agents', () => {
    const caps = coordinator.capabilities();
    expect(Array.isArray(caps)).toBe(true);
    expect(caps.length).toBe(2);

    const engines = (caps as AgentCapabilities[]).map((c) => c.engine);
    expect(engines).toContain('nar');
    expect(engines).toContain('metta');
  });

  it('reports aggregated health status', () => {
    const health = coordinator.health();
    expect(health.status).toBe('healthy');
    expect(typeof health.cycleCount).toBe('number');
  });
});