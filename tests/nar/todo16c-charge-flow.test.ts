import { describe, it, expect } from 'vitest';
import { KernelBudgetGate } from '../../nar/src/kernel/KernelBudgetGate.js';
import {
  SystemOneDispatcher,
  DeterministicManifold,
  Tier3SymbolicManifold,
  StubCortex,
} from '../../nar/src/lm/system-one/dispatcher.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { chargeJudgment, resourceCostToLmCalls } from '../../nar/src/lm/system-one/resource-gate.js';
import type { EmbeddingPointer, JudgmentQuery } from '../../nar/src/lm/system-one/types.js';

const budget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
} as const;

const QUERIES: JudgmentQuery[] = [
  { kind: 'evaluate', instruction: 'Evaluate relevance', rubric: 'relevance', axis: 'epistemic' },
  { kind: 'classify', instruction: 'Classify task type', space: ['belief', 'goal'], axis: 'epistemic' },
];

const makeCache = () => {
  const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
  return cache;
};

const makeDispatcher = async (gate: KernelBudgetGate, scopeId: string) => {
  const cache = makeCache();
  await cache.warmup(['ctx']);
  const pointer = await cache.write('bench28 context');
  return {
    pointer: pointer as EmbeddingPointer,
    dispatcher: new SystemOneDispatcher(
      new DeterministicManifold(),
      createManifold(cache, { abstainThreshold: 0.05 }),
      new Tier3SymbolicManifold(),
      new StubCortex(),
      true,
      { budgetGate: gate, budgetScopeId: scopeId }
    ),
  };
};

describe('System One — flow-level resource accounting (Bench 28)', () => {
  it('judge charges systemone-judgment per batch: gate accounting matches max proposition cost', async () => {
    const gate = new KernelBudgetGate();
    const { pointer, dispatcher } = await makeDispatcher(gate, 'bench28-charge');
    const results = await dispatcher.judge(pointer, QUERIES, { ...budget });

    expect(results.length).toBe(QUERIES.length);
    expect(results.some((r) => r.tier === 1)).toBe(true);
    const expectedCharge = Math.max(...results.map((r) => resourceCostToLmCalls(r.cost!)));
    expect(gate.getScopeConsumed('bench28-charge')).toBe(expectedCharge);
  });

  it('exhausted scope denies the batch — no Tier-1 propositions emitted', async () => {
    const gate = new KernelBudgetGate();
    const { pointer, dispatcher } = await makeDispatcher(gate, 'bench28-deny');

    for (let i = 0; i < 200; i++) {
      const verdict = chargeJudgment(gate, 'bench28-deny', {
        tokensIn: 1, tokensOut: 0, computeMs: 1, memoryMb: 1,
      });
      if (!verdict.granted) break;
    }

    const results = await dispatcher.judge(pointer, QUERIES, { ...budget });
    for (const r of results) expect(r.tier).not.toBe(1);
  });

  it('no gate configured — no accounting, propositions flow unchanged', async () => {
    const cache = makeCache();
    await cache.warmup(['ctx']);
    const pointer = await cache.write('bench28 context');
    const dispatcher = new SystemOneDispatcher(
      new DeterministicManifold(),
      createManifold(cache, { abstainThreshold: 0.05 }),
      new Tier3SymbolicManifold(),
      new StubCortex(),
      true,
      {}
    );
    const results = await dispatcher.judge(pointer as EmbeddingPointer, QUERIES, { ...budget });
    expect(results.some((r) => r.tier === 1)).toBe(true);
  });
});
