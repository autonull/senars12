import {
  consumeCycles,
  consumeDepth,
  consumeLMCalls,
  consumeMemoryOps,
  createBudgetSlice,
  isExhausted,
  pressure,
  remainingAll,
} from '../../kernel/src/budget.js';
import { cosine, cosineNormalized, jaccard, normalize } from '../../nar/src/utils/similarity.js';
import { describe, expect, it } from 'vitest';

const slice = (cycles: number, depth: number, memoryOps: number, llmCalls: number) =>
  createBudgetSlice({ id: 'b', totalCycles: cycles, totalDepth: depth, totalMemoryOps: memoryOps, totalLMCalls: llmCalls });

describe('budget slice accounting', () => {
  it('terminates with the dimension-specific reason and leaves consumption untouched', () => {
    const b = slice(2, 1, 1, 3);

    expect(consumeCycles(b, 2)).toBe(true);
    expect(consumeCycles(b, 1)).toBe(false);
    expect(b.terminationReason).toBe('cycle-budget');
    expect(b.consumed.cycles).toBe(2);

    for (const [consume, reason, key] of [
      [consumeDepth, 'depth-budget', 'depth'],
      [consumeMemoryOps, 'memory-budget', 'memoryOps'],
      [consumeLMCalls, 'llm-budget', 'llmCalls'],
    ] as const) {
      const d = slice(1, 1, 1, 1);
      expect(consume(d, 1)).toBe(true);
      expect(consume(d, 1)).toBe(false);
      expect(d.terminationReason).toBe(reason);
      expect(d.consumed[key]).toBe(1);
    }
  });

  it('remaining and pressure agree across every dimension', () => {
    const b = slice(10, 10, 10, 10);
    expect(remainingAll(b)).toEqual({ cycles: 10, depth: 10, memoryOps: 10, llmCalls: 10 });
    expect(pressure(b)).toBe(0);
    expect(isExhausted(b)).toBe(false);

    b.consumed.llmCalls = 10;
    expect(remainingAll(b).llmCalls).toBe(0);
    expect(pressure(b)).toBe(1);
    expect(isExhausted(b)).toBe(true);
  });
});

describe('similarity primitives', () => {
  it('cosineNormalized matches cosine and agrees with itself', () => {
    const a = [1, 2, 3, 4];
    const b = [4, 3, 2, 1];
    const q = normalize(a);
    expect(cosineNormalized(q, b)).toBeCloseTo(cosine(a, b), 12);
    expect(cosineNormalized(q, a)).toBeCloseTo(1, 12);
  });

  it('degenerate vectors score zero', () => {
    expect(cosineNormalized(normalize([0, 0, 0]), [1, 2, 3])).toBe(0);
    expect(cosineNormalized(normalize([1, 2, 3]), [0, 0, 0])).toBe(0);
  });

  it('jaccard is symmetric and scale-ordered', () => {
    const small = new Set(['a']);
    const large = new Set(['a', 'b', 'c']);
    expect(jaccard(small, large)).toBe(jaccard(large, small));
    expect(jaccard(small, large)).toBeCloseTo(1 / 3, 12);
    expect(jaccard(new Set(), new Set())).toBe(0);
    expect(jaccard(new Set(), new Set(['a']))).toBe(0);
  });
});
