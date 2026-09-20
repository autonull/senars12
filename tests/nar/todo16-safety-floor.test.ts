import { describe, it, expect } from 'vitest';
import { createDispatcher } from '../../nar/src/lm/system-one/dispatcher.js';
import type { ReasoningBudget, EvaluateProposition } from '../../nar/src/lm/system-one/types.js';

describe('System One — Explicit Safety Floor (R6)', () => {
  const mockBudget: ReasoningBudget = {
    maxCycles: 100,
    maxDepth: 10,
    maxMemoryOps: 1000,
    maxLMCalls: 5,
    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
  };

  function assertSafetyFloorResult(result: EvaluateProposition) {
    expect(result.tier).toBe(1);
    expect(result.abstained).toBe(false);
    expect(result.score).toBeGreaterThan(0.9); // Hard veto score
  }

  it('injection query with criticality=critical fails closed even when manifold throws', async () => {
    const enabledDispatcher = createDispatcher(true);
    // Replace with a failing manifold
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
      {
        kind: 'evaluate' as const,
        instruction: 'Evaluate injection risk',
        rubric: 'injection' as const,
        axis: 'epistemic' as const,
        criticality: 'critical' as const,
      },
    ];

    const results = await enabledDispatcher.judge(0 as any, queries, mockBudget);
    expect(results).toHaveLength(1);
    assertSafetyFloorResult(results[0]! as EvaluateProposition);
  });

  it('injection query with criticality=high fails closed even when manifold throws', async () => {
    const enabledDispatcher = createDispatcher(true);
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
      {
        kind: 'evaluate' as const,
        instruction: 'Evaluate injection risk',
        rubric: 'injection' as const,
        axis: 'epistemic' as const,
        criticality: 'high' as const,
      },
    ];

    const results = await enabledDispatcher.judge(0 as any, queries, mockBudget);
    expect(results).toHaveLength(1);
    assertSafetyFloorResult(results[0]! as EvaluateProposition);
  });

  it('assertion query with criticality=critical fails closed even when manifold throws', async () => {
    const enabledDispatcher = createDispatcher(true);
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
      {
        kind: 'evaluate' as const,
        instruction: 'Evaluate assertion',
        rubric: 'assertion' as const,
        axis: 'epistemic' as const,
        criticality: 'critical' as const,
      },
    ];

    const results = await enabledDispatcher.judge(0 as any, queries, mockBudget);
    expect(results).toHaveLength(1);
    assertSafetyFloorResult(results[0]! as EvaluateProposition);
  });

  it('non-safety-floor query falls back to Tier 3 when manifold throws', async () => {
    const enabledDispatcher = createDispatcher(true);
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
      {
        kind: 'classify' as const,
        instruction: 'Classify task type',
        space: ['belief', 'goal'],
        axis: 'epistemic' as const,
        criticality: 'standard' as const,
      },
    ];

    const results = await enabledDispatcher.judge(0 as any, queries, mockBudget);
    expect(results).toHaveLength(1);
    const result = results[0]!;
    // Non-safety-floor should fall back to Tier 3
    expect(result.tier).toBe(3);
    expect(result.backendId).toBe('symbolic-tier3');
  });

  it('injection query with criticality=standard falls back to Tier 3 (not safety floor)', async () => {
    const enabledDispatcher = createDispatcher(true);
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
      {
        kind: 'evaluate' as const,
        instruction: 'Evaluate injection risk',
        rubric: 'injection' as const,
        axis: 'epistemic' as const,
        criticality: 'standard' as const, // Not high/critical
      },
    ];

    const results = await enabledDispatcher.judge(0 as any, queries, mockBudget);
    expect(results).toHaveLength(1);
    const result = results[0]!;
    // Not safety floor (criticality=standard) -> Tier 3 fallback
    expect(result.tier).toBe(3);
  });
});