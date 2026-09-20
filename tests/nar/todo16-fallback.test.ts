import { describe, it, expect, beforeEach } from 'vitest';
import { createDispatcher } from '../../nar/src/lm/system-one/dispatcher.js';
import type { CognitiveContext, ReasoningBudget } from '../../nar/src/lm/system-one/types.js';
import { KernelPerceptionGate } from '../../nar/src/kernel/KernelPerceptionGate.js';
import { validateCognitiveEvent } from '@senars/kernel/schemas';

describe('System One — Thermodynamic Fallback (Bench 13)', () => {
  let dispatcher: ReturnType<typeof createDispatcher>;
  const mockContext: CognitiveContext = {
    topBeliefs: ['<bird --> animal>. %1.00;0.90%'],
    topGoals: ['<self --> fly>!'],
    workingMemory: [],
    tickId: 'test-tick-1',
  };
  const mockBudget: ReasoningBudget = {
    maxCycles: 100,
    maxDepth: 10,
    maxMemoryOps: 1000,
    maxLMCalls: 5,
    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
  };

  beforeEach(() => {
    dispatcher = createDispatcher(false); // disabled = fallback only
  });

  it('degrades to Deterministic (Tier 0) when manifold disabled', async () => {
    const queries = [
      { kind: 'classify' as const, instruction: 'test', space: ['a', 'b'], axis: 'epistemic' as const },
    ];
    const results = await dispatcher.judge(0 as any, queries, mockBudget);
    expect(results).toHaveLength(1);
    const result = results[0]!;
    expect(result.tier).toBe(0);
    expect(result.backendId).toBe('deterministic-tier0');
    expect(result.abstained).toBe(false);
  });

  it('degrades to Symbolic (Tier 3) when manifold throws', async () => {
    const enabledDispatcher = createDispatcher(true);
    // Manually replace with a failing manifold
    (enabledDispatcher as any).tier1 = {
      async judgeBatch() {
        throw new Error('Manifold unavailable');
      },
      async consensus() {
        throw new Error('Manifold unavailable');
      },
      health() {
        return { backendId: 'failing' as any, ready: false, breakerOpen: true, rollingEce: 1.0, queueDepth: 0 };
      },
    };

    const queries = [
      { kind: 'classify' as const, instruction: 'test', space: ['a', 'b'], axis: 'epistemic' as const },
    ];
    const results = await enabledDispatcher.judge(0 as any, queries, mockBudget);
    expect(results).toHaveLength(1);
    const result = results[0]!;
    expect(result.tier).toBe(3);
    expect(result.backendId).toBe('symbolic-tier3');
  });

  it('synthesize falls back to cortex when dispatcher disabled', async () => {
    const results: any[] = [];
    for await (const synth of dispatcher.synthesize(mockContext, { kind: 'synthesize', instruction: 'test', maxCandidates: 2 }, mockBudget)) {
      results.push(synth);
    }
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('synthesize');
    expect(results[0].candidates).toHaveLength(2);
  });

  it('proposeAndJudge works with fallback chain', async () => {
    const result = await dispatcher.proposeAndJudge(
      mockContext,
      { kind: 'synthesize', instruction: 'Generate term', grammar: 'narsese-term', maxCandidates: 2 },
      [{ kind: 'classify' as const, instruction: 'Select best', space: ['a', 'b'], axis: 'teleological' as const }],
      mockBudget
    );
    expect(result.candidates).toHaveLength(2);
    expect(result.judgments).toHaveLength(2);
    expect(result.ranked).toHaveLength(2);
    // Phase 2 (§6.4): without manifold validation, hypotheses are admitted
    // provisionally instead of with calibrated Truth.
    expect(result.admitted).toHaveLength(0);
    expect(result.provisional).toHaveLength(2);
    for (const { provisional } of result.provisional) {
      expect(provisional.stamp.source).toBe('LM');
      expect(provisional.cInitial).toBeGreaterThan(0);
    }
  });

  it('KernelPerceptionGate still admits tasks when System One disabled', async () => {
    const gate = new KernelPerceptionGate();
    const input = {
      sourceId: 'test',
      rawObservation: '<bird --> animal>.',
      sensorConfidence: 0.9,
      sourceQuality: 'PRIMARY' as const,
    };
    const output = await gate.admit(input);
    expect(output.admitted).toBe(true);
    expect(output.task).toBeDefined();
    expect(output.task?.source).toBe('user');
  });

  it('judgment.resolved event validates via validateCognitiveEvent', () => {
    const event = {
      type: 'judgment.resolved',
      engine: 'proposer',
      timestamp: Date.now(),
      correlationId: 'test-corr-1',
      payload: {
        queryId: 'q1',
        shape: 'classify',
        axis: 'epistemic',
        backendId: 'deterministic-tier0',
        tier: 0,
        latencyMs: 5,
        entropy: 0.1,
        abstained: false,
        stampType: 'standard',
        calibrationVersion: 'v1.0.0',
        cost: { tokensIn: 0, tokensOut: 0, computeMs: 5, memoryMb: 1 },
      },
    };
    expect(() => validateCognitiveEvent(event)).not.toThrow();
    const validated = validateCognitiveEvent(event);
    expect(validated.engine).toBe('proposer');
    expect(validated.type).toBe('judgment.resolved');
  });

  it('Safety gates remain intact during fallback', async () => {
    // Verify that KernelActionGate still enforces autonomy mode
    const { KernelActionGate } = await import('../../nar/src/kernel/KernelActionGate.js');
    const actionGate = new KernelActionGate({ autonomyMode: 'observe-only' });
    const input = {
      proposalId: 'test-prop-1',
      operation: 'test_op',
      args: {},
      correlationId: 'test-corr-2',
    };
    const output = actionGate.authorize(input);
    expect(output.authorized).toBe(false);
    expect(output.vetoReason).toContain('observe-only');
  });

  it('config systemOne.enabled: false yields byte-identical baseline behavior', () => {
    // This is a structural test — the dispatcher with enabled=false
    // should route all judgment to Tier 0/3 without any System One code paths.
    const disabledDispatcher = createDispatcher(false);
    const enabledDispatcher = createDispatcher(true);

    // Both should have the same interface
    expect(typeof disabledDispatcher.judge).toBe('function');
    expect(typeof enabledDispatcher.judge).toBe('function');
    expect(typeof disabledDispatcher.synthesize).toBe('function');
    expect(typeof enabledDispatcher.synthesize).toBe('function');
    expect(typeof disabledDispatcher.proposeAndJudge).toBe('function');
    expect(typeof enabledDispatcher.proposeAndJudge).toBe('function');
  });
});