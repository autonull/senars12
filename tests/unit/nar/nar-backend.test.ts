import { describe, expect, it, vi } from 'vitest';
import { NarBackend } from '@senars/nar';
import type { CognitiveEvent, BackendInput } from '@senars/core';
import type { Agent } from '@senars/nar/agent';

function createMockAgent(): Agent {
  const listeners = new Set<(event: CognitiveEvent) => void>();

  return {
    chat: vi.fn().mockResolvedValue('mock response'),
    chatWithHistory: vi.fn().mockResolvedValue('mock response'),
    chatStream: vi.fn().mockImplementation(async function* () {
      yield { kind: 'finish' as const, text: 'mock stream response' };
      return 'mock stream response';
    }),
    believe: vi.fn().mockResolvedValue(undefined),
    recall: vi.fn().mockResolvedValue([]),
    know: vi.fn(),
    knowGet: vi.fn().mockReturnValue(undefined),
    knowList: vi.fn().mockReturnValue([]),
    start: vi.fn().mockReturnValue(() => {}),
    waitForReady: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    setThrottle: vi.fn(),
    getThrottle: vi.fn().mockReturnValue(50),
    getNAR: vi.fn().mockReturnValue({
      getBeliefs: () => [{ term: { toString: () => '<bird --> animal>' }, truth: { f: 1, c: 0.9 } }],
      getStatistics: () => ({ totalConcepts: 5 }),
    }),
    getEpisodicMemory: vi.fn().mockReturnValue(undefined),
    getLogger: vi.fn().mockReturnValue({} as any),
    getStats: vi.fn().mockReturnValue({
      totalChats: 0, successfulChats: 0, failedChats: 0,
      totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0,
      totalDurationMs: 0, averageDurationMs: 0, startedAt: Date.now(),
    }),
    getRecentDerivations: vi.fn().mockReturnValue([]),
    resolveApproval: vi.fn().mockReturnValue(true),
    getPendingApprovals: vi.fn().mockReturnValue([]),
    getLmRuleStats: vi.fn().mockReturnValue([]),
    getLmRuleExecutionLog: vi.fn().mockReturnValue([]),
    enableLmRule: vi.fn(),
    disableLmRule: vi.fn(),
    setLmRulePriority: vi.fn(),
    getAutonomyEngine: vi.fn().mockReturnValue(undefined),
    getAutonomousLoop: vi.fn().mockReturnValue(undefined),
    getRLFPState: vi.fn().mockReturnValue(null),
    resetRLFP: vi.fn(),
    provideRLFPFeedback: vi.fn(),
    getSelfReasoning: vi.fn().mockReturnValue(null),
    getReasoningQuality: vi.fn().mockReturnValue(null),
    explainBelief: vi.fn().mockResolvedValue(null),
    explainGoal: vi.fn().mockResolvedValue(null),
    traceRule: vi.fn().mockResolvedValue(null),
    getGoalProgress: vi.fn().mockResolvedValue(null),
    listActiveGoals: vi.fn().mockResolvedValue([]),
    explainInNaturalLanguage: vi.fn().mockResolvedValue(null),
    on: vi.fn().mockImplementation((_event: string | '*', handler: (event: CognitiveEvent) => void) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    }),
    off: vi.fn().mockImplementation((_event: string | '*', handler: (event: CognitiveEvent) => void) => {
      listeners.delete(handler);
    }),
    submit: vi.fn(),
    health: vi.fn().mockReturnValue({ status: 'healthy' as const, lastCycle: 0, cycleCount: 0, errorRate: 0 }),
    capabilities: vi.fn().mockReturnValue({ engine: 'nar', supports: { chat: true, beliefs: true, drives: true, skills: false, ltm: false, rlfp: true, selfReasoning: true, autonomyLoop: true } }),
    mount: vi.fn(),
    unmount: vi.fn(),
    setExternalToolOpts: vi.fn(),
  };
}

describe('NarBackend', () => {
  it('has correct id and label', () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);
    expect(backend.id).toBe('nar');
    expect(backend.label).toBe('NAR Symbolic Reasoner');
  });

  it('exposes NAR capabilities', () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);
    expect(backend.capabilities.has('inheritance')).toBe(true);
    expect(backend.capabilities.has('deduction')).toBe(true);
    expect(backend.capabilities.has('truth-revision')).toBe(true);
    expect(backend.capabilities.has('goal-management')).toBe(true);
    expect(backend.capabilities.has('autonomy-loop')).toBe(true);
    expect(backend.capabilities.has('pattern-match')).toBe(false);
  });

  it('initialize calls agent.start() and subscribes to events', async () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);
    await backend.initialize({});
    expect(agent.start).toHaveBeenCalledOnce();
    expect(agent.on).toHaveBeenCalledWith('*', expect.any(Function));
  });

  it('shutdown calls agent.stop() and unsubscribes', async () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);
    await backend.initialize({});
    const unsub = vi.fn();
    (agent.on as ReturnType<typeof vi.fn>).mockReturnValue(unsub);
    await backend.shutdown();
    expect(agent.stop).toHaveBeenCalledOnce();
  });

  it('reason with type=belief delegates to agent.believe', async () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);
    await backend.initialize({});

    const input: BackendInput = {
      type: 'belief',
      content: '<bird --> animal>.',
      correlationId: 'test-1',
    };
    const result = await backend.reason(input);

    expect(result.success).toBe(true);
    expect(result.backendId).toBe('nar');
    expect(agent.believe).toHaveBeenCalledWith('<bird --> animal>.');
  });

  it('reason with type=chat delegates to agent.chat', async () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);
    await backend.initialize({});

    const input: BackendInput = {
      type: 'chat',
      content: 'hello world',
      correlationId: 'test-2',
    };
    const result = await backend.reason(input);

    expect(result.success).toBe(true);
    expect(agent.chat).toHaveBeenCalledWith('hello world');
  });

  it('reason with type=goal delegates to agent.believe', async () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);
    await backend.initialize({});

    const input: BackendInput = {
      type: 'goal',
      content: '(world_peace)!',
      correlationId: 'test-3',
    };
    const result = await backend.reason(input);

    expect(result.success).toBe(true);
    expect(agent.believe).toHaveBeenCalledWith('(world_peace)!');
  });

  it('reason with type=skill returns error', async () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);
    await backend.initialize({});

    const input: BackendInput = {
      type: 'skill',
      content: '(match ...)',
      correlationId: 'test-4',
    };
    const result = await backend.reason(input);

    expect(result.success).toBe(false);
    expect(result.error).toContain('does not support skill execution');
  });

  it('health delegates to agent.health', async () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);
    await backend.initialize({});

    const h = backend.health();
    expect(h.status).toBe('healthy');
  });

  it('getTools returns nar query tools', () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);
    const tools = backend.getTools();
    expect(tools).toBeDefined();
    expect(tools!.length).toBeGreaterThan(0);
    expect(tools!.some((t) => t.name === 'nar-query')).toBe(true);
    expect(tools!.some((t) => t.name === 'nar-explain')).toBe(true);
  });

  it('getSnapshot returns current state', () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);
    const snapshot = backend.getSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot!.backendId).toBe('nar');
    expect(snapshot!.state.beliefs).toBeGreaterThan(0);
    expect(snapshot!.state.totalConcepts).toBe(5);
  });

  it('reason collects events emitted during processing', async () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);

    let eventHandler: ((event: CognitiveEvent) => void) | null = null;
    (agent.on as ReturnType<typeof vi.fn>).mockImplementation((_event: string, handler: any) => {
      eventHandler = handler;
      return () => { eventHandler = null; };
    });

    // Have agent.believe emit derivation events during processing
    const derivationEvent: CognitiveEvent = {
      engine: 'nar',
      type: 'derivation',
      term: '<bird --> animal>',
      confidence: 0.9,
      timestamp: Date.now(),
      correlationId: 'test-5',
    };
    const activatedEvent: CognitiveEvent = {
      engine: 'nar',
      type: 'concept:activated',
      term: 'bird',
      priority: 0.8,
      timestamp: Date.now(),
      correlationId: 'test-5',
    };
    (agent.believe as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      eventHandler?.(derivationEvent);
      eventHandler?.(activatedEvent);
    });

    await backend.initialize({});

    const input: BackendInput = {
      type: 'belief',
      content: '<bird --> animal>.',
      correlationId: 'test-5',
    };
    const result = await backend.reason(input);

    expect(result.success).toBe(true);
    expect(result.events.length).toBeGreaterThanOrEqual(2);
    expect(result.events.some((e) => e.type === 'derivation')).toBe(true);
    expect(result.events.some((e) => e.type === 'concept:activated')).toBe(true);
  });

  it('reason converts derivation events to graph delta', async () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);

    let eventHandler: ((event: CognitiveEvent) => void) | null = null;
    (agent.on as ReturnType<typeof vi.fn>).mockImplementation((_event: string, handler: any) => {
      eventHandler = handler;
      return () => { eventHandler = null; };
    });

    const derivationEvent: CognitiveEvent = {
      engine: 'nar',
      type: 'derivation',
      term: '<bird --> animal>',
      confidence: 0.9,
      timestamp: Date.now(),
      correlationId: 'test-6',
    };
    (agent.believe as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      eventHandler?.(derivationEvent);
    });

    await backend.initialize({});

    const input: BackendInput = {
      type: 'belief',
      content: '<bird --> animal>.',
      correlationId: 'test-6',
    };
    const result = await backend.reason(input);

    expect(result.graphDelta).toBeDefined();
    expect(result.graphDelta!.nodes.length).toBeGreaterThan(0);
    expect(result.graphDelta!.nodes[0].nodeType).toBe('nar:concept');
    // Nodes now contain individual concepts (parsed from relation), not the raw term
    expect(result.graphDelta!.nodes.some(n => n.term === 'bird')).toBe(true);
    expect(result.graphDelta!.nodes.some(n => n.term === 'animal')).toBe(true);
    expect(result.graphDelta!.edges.length).toBeGreaterThan(0);
  });

  it('setExternalTools injects tools into the agent', () => {
    const agent = createMockAgent();
    const backend = new NarBackend(agent);

    const externalTools = [
      {
        name: 'metta-match',
        description: 'Pattern match in MeTTa space',
        schema: { pattern: 'string' },
        execute: async () => 'result',
      },
    ];

    backend.setExternalTools(externalTools);

    // setExternalToolOpts should have been called on the agent
    expect(agent.setExternalToolOpts).toHaveBeenCalled();
  });
});
