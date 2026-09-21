import { describe, expect, it } from 'vitest';
import type { EmbeddingPointer, JudgmentProposition, ReasoningBudget } from '../../nar/src/lm/system-one/types.js';
import { consensusFanout, fanoutWithinBudget, verifyCascade } from '../../nar/src/lm/system-one/verify.js';

/**
 * P2 (TODO19): SDE-style verify cascade + consensus fan-out budget knob.
 * Thin compositions — benched on behavior (band routing, budget clamping).
 */

const pointer = { digest: 'verify-test' } as unknown as EmbeddingPointer;
const budget = (maxLMCalls: number, llmCalls = 0): ReasoningBudget => ({
  maxCycles: 100, maxDepth: 10, maxMemoryOps: 100, maxLMCalls,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls },
});

const prop = (score: number | undefined): JudgmentProposition[] => [{
  kind: 'evaluate', rubric: 'plausibility', axis: 'epistemic',
  ...(score === undefined ? { abstained: true } : { abstained: false, score, top: { option: 'true', p: score } }),
}] as unknown as JudgmentProposition[];

/** Scripted judge: pops one score per judgeBatch call. */
const judge = (scores: (number | undefined)[]) => {
  const queue = [...scores];
  const j = {
    calls: 0,
    judgeBatch: async () => {
      j.calls++;
      return prop(queue.shift());
    },
  };
  return j;
};

const BANDS = { act: 0.8, review: 0.5, block: 0.2 };

describe('P2 — verify cascade (SDE-style)', () => {
  it('confident true statement: act, no stage-2 verification fired', async () => {
    const j = judge([0.95]);
    const result = await verifyCascade(j, pointer, 'the sky is blue', BANDS, budget(10));
    expect(result.decision).toBe('act');
    expect(result.p).toBe(0.95);
    expect(result.verification).toBeUndefined();
    expect(j.calls).toBe(1);
  });

  it('uncertain statement: escalates to stage-2 verification', async () => {
    const j = judge([0.6, 0.9]);
    const result = await verifyCascade(j, pointer, 'the key is under the mat', BANDS, budget(10));
    expect(result.decision).toBe('review');
    expect(result.verification).toBeDefined();
    expect(j.calls).toBe(2);
  });

  it('abstained stage-1: abstain, no escalation', async () => {
    const j = judge([undefined]);
    const result = await verifyCascade(j, pointer, 'unfathomable', BANDS, budget(10));
    expect(result.decision).toBe('abstain');
    expect(result.verification).toBeUndefined();
    expect(j.calls).toBe(1);
  });
});

describe('P2 — consensus fan-out as a budget knob', () => {
  it('clamps k to remaining LM-call budget', () => {
    expect(fanoutWithinBudget(5, budget(3))).toBe(3);
    expect(fanoutWithinBudget(5, budget(10), 7)).toBe(3);
    expect(fanoutWithinBudget(2, budget(10), 4)).toBe(2);
  });

  it('never drops below 1 — exhausted budget degrades to a single judgment', () => {
    expect(fanoutWithinBudget(5, budget(3, 3))).toBe(1);
  });

  it('consensusFanout passes the clamped k through', async () => {
    const seen: number[] = [];
    const j = {
      consensus: async (_p: unknown, _q: unknown, k: number) => {
        seen.push(k);
        return { proposition: prop(0.5)[0]!, agreement: 1, independent: k <= 1 };
      },
    };
    await consensusFanout(j, pointer, { kind: 'evaluate', rubric: 'plausibility', axis: 'epistemic' } as never, 4, budget(2));
    expect(seen).toEqual([2]);
  });
});
