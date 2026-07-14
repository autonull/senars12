import { describe, expect, it, vi } from 'vitest';
import { Agent } from '@senars/core';
import type { ReasoningBackend, Capability, CognitiveEvent } from '@senars/core';

function mockBackend(id: string, caps: Capability[]): ReasoningBackend {
  const listeners = new Set<(e: CognitiveEvent) => void>();
  return {
    id,
    label: id,
    capabilities: new Set(caps),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    health: vi.fn().mockReturnValue({ status: 'healthy' as const }),
    reason: vi.fn().mockResolvedValue({
      backendId: id,
      success: true,
      events: [],
      output: { type: 'text', value: `${id} response` },
    }),
    getTools: vi.fn().mockReturnValue([]),
    getSnapshot: vi.fn().mockReturnValue({
      backendId: id,
      capabilities: caps,
      state: {},
      timestamp: Date.now(),
    }),
  };
}

describe('Agent', () => {
  it('creates an agent with no backends', () => {
    const agent = new Agent({ name: 'test' });
    expect(agent.name).toBe('test');
    expect(agent.getBackendIds()).toEqual([]);
  });

  it('registers and retrieves backends', async () => {
    const agent = new Agent();
    const backend = mockBackend('nar', ['inheritance']);

    await agent.registerBackend(backend);

    expect(agent.hasBackend('nar')).toBe(true);
    expect(agent.getBackend('nar')).toBe(backend);
    expect(agent.getBackendIds()).toEqual(['nar']);
    expect(backend.initialize).toHaveBeenCalledOnce();
  });

  it('aggregates capabilities from all backends', async () => {
    const agent = new Agent();
    await agent.registerBackend(mockBackend('nar', ['inheritance', 'truth-revision']));
    await agent.registerBackend(mockBackend('metta', ['pattern-match', 'query', 'skill-execution']));

    const caps = agent.capabilities();
    expect(caps).toHaveLength(1);
    expect(caps[0].supports.beliefs).toBe(true);
    expect(caps[0].supports.skills).toBe(true);
  });

  it('routes input to backends via submit', async () => {
    const agent = new Agent();
    const narBackend = mockBackend('nar', ['inheritance', 'truth-revision']);
    await agent.registerBackend(narBackend);

    const listener = vi.fn();
    agent.on('*', listener);

    agent.submit('<bird --> animal>.', 'corr-1');

    // Allow async execution to settle
    await vi.waitFor(() => {
      expect(narBackend.reason).toHaveBeenCalled();
    });

    const call = vi.mocked(narBackend.reason).mock.calls[0];
    expect(call[0].content).toBe('<bird --> animal>.');
  });

  it('chat delegates to backend and returns response', async () => {
    const agent = new Agent();
    const narBackend = mockBackend('nar', ['llm-completion']);
    vi.mocked(narBackend.reason).mockResolvedValue({
      backendId: 'nar',
      success: true,
      events: [],
      output: { type: 'text', value: 'Hello from NAR' },
    });
    await agent.registerBackend(narBackend);

    const response = await agent.chat('hello');
    expect(response).toBe('Hello from NAR');
  });

  it('stop shuts down all backends', async () => {
    const agent = new Agent();
    const backend = mockBackend('nar', ['inheritance']);
    await agent.registerBackend(backend);

    agent.stop();

    expect(backend.shutdown).toHaveBeenCalled();
  });

  it('health aggregates from backends', async () => {
    const agent = new Agent();
    await agent.registerBackend(mockBackend('nar', ['inheritance']));

    const h = agent.health();
    expect(h.status).toBe('healthy');
  });

  it('health reports degraded if any backend is degraded', async () => {
    const agent = new Agent();
    const healthy = mockBackend('nar', ['inheritance']);
    const degraded = mockBackend('metta', ['pattern-match']);
    vi.mocked(degraded.health).mockReturnValue({ status: 'degraded' as const });

    await agent.registerBackend(healthy);
    await agent.registerBackend(degraded);

    const h = agent.health();
    expect(h.status).toBe('degraded');
  });

  it('emits events to registered listeners', async () => {
    const agent = new Agent();
    const backend = mockBackend('nar', ['inheritance']);
    await agent.registerBackend(backend);

    const listener = vi.fn();
    agent.on('*', listener);

    const event: CognitiveEvent = {
      engine: 'nar',
      type: 'derivation',
      term: '<bird --> animal>',
      confidence: 0.9,
      timestamp: Date.now(),
      correlationId: 'test-1',
    };

    // Simulate event emission via submit triggering backend reason
    vi.mocked(backend.reason).mockResolvedValue({
      backendId: 'nar',
      success: true,
      events: [event],
    });

    agent.submit('test', 'corr-2');

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalled();
    });
  });
});
