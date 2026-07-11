import { MettaAgent } from '@senars/metta/agent';
import { startWebUIWithOptions, type TestServer } from '@senars/ui/server';
import { describe, expect, it, afterAll, beforeAll, vi } from 'vitest';
import type { CognitiveEvent } from '@senars/core';
import type { MeTTaAtom } from '@senars/metta/types/ast';
import type { GroundedOp } from '@senars/metta/core/ops';

describe('MettaAgent + UI Server Integration', () => {
  let agent: MettaAgent;
  let server: TestServer;
  const TEST_PORT = 3999;

  beforeAll(async () => {
    agent = new MettaAgent();
    agent.start();
    
    server = await startWebUIWithOptions(agent, { port: TEST_PORT });
  }, 30000);

  afterAll(async () => {
    await server.close();
    agent.stop();
  });

  it('starts UI server with MettaAgent as CognitiveEventSource', () => {
    expect(server).toBeDefined();
    expect(server.address().port).toBe(TEST_PORT);
  });

  it('MettaAgent implements CognitiveEventSource interface', () => {
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
    // Consume the async generator
    for await (const _ of agent.chat('Hello Metta')) {
      // consume
    }
    await new Promise(r => setTimeout(r, 100));
    agent.off('*', handler);

    const inputEvents = events.filter(e => e.type === 'input');
    expect(inputEvents.length).toBeGreaterThan(0);
    expect(inputEvents[0].engine).toBe('metta');
    expect(inputEvents[0].correlationId).toBeDefined();
  });

  it('reports healthy status', () => {
    const health = agent.health();
    expect(health.status).toBe('healthy');
    expect(typeof health.cycleCount).toBe('number');
  });

  it('declares correct capabilities', () => {
    const caps = agent.capabilities();
    expect(caps.engine).toBe('metta');
    expect(caps.supports.chat).toBe(true);
    expect(caps.supports.skills).toBe(true);
    expect(caps.supports.ltm).toBe(true);
    expect(caps.supports.drives).toBe(false);
    expect(caps.supports.rlfp).toBe(false);
  });

  it('supports skill registration and feedback', () => {
    const mockOp: GroundedOp<readonly MeTTaAtom[], MeTTaAtom> = {
      name: 'test_skill',
      execute: vi.fn().mockResolvedValue(undefined as unknown as MeTTaAtom),
    };
    
    agent.registerSkill('test_skill', mockOp);
    const feedback = agent.getAllSkillFeedback();
    expect(Array.isArray(feedback)).toBe(true);
    // The skill should appear in feedback after being called
  });
});