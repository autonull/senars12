import { Agent } from '@senars/core';
import type { CognitiveStimulus, Engine } from '@senars/core';
import { describe, expect, it, vi } from 'vitest';

function mockEngine(id: string): Engine {
  return {
    id,
    reason: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockResolvedValue([]),
  };
}

describe('Agent', () => {
  it('creates an agent with default state', () => {
    const agent = new Agent({ id: 'test' });
    expect(agent.id).toBe('test');
    expect(agent.engines.size).toBe(0);
    expect(agent.health().status).toBe('stuck');
  });

  it('registers and retrieves engines', () => {
    const agent = new Agent();
    const engine = mockEngine('nar');
    agent.registerEngine('nar', engine);
    expect(agent.engines.has('nar')).toBe(true);
    expect(agent.engines.get('nar')).toBe(engine);
  });

  it('routes input through cycle and returns response', async () => {
    const agent = new Agent();
    const engine = mockEngine('nar');
    agent.registerEngine('nar', engine);

    const result = await agent.cycle({
      text: '<bird --> animal>.',
      source: 'test',
      timestamp: Date.now(),
      correlationId: 'test-1',
    });
    expect(typeof result).toBe('string');
    expect(vi.mocked(engine.reason)).toHaveBeenCalled();
  });

  it('stop shuts down engines', async () => {
    const agent = new Agent();
    const engine = mockEngine('nar');
    agent.registerEngine('nar', engine);
    await agent.start();
    await agent.stop();
    expect(agent.health().status).toBe('stuck');
  });

  it('health reports healthy after start', async () => {
    const agent = new Agent();
    const engine = mockEngine('nar');
    agent.registerEngine('nar', engine);
    await agent.start();
    const h = agent.health();
    expect(h.status).toBe('healthy');
  });

  it('emits events via on handler', async () => {
    const agent = new Agent();
    const listener = vi.fn();
    agent.on('*', listener);

    await agent.cycle({
      text: 'test input',
      source: 'test',
      timestamp: Date.now(),
      correlationId: 'test-2',
    });

    expect(listener).toHaveBeenCalled();
  });
});
