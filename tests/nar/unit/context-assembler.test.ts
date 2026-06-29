import { beforeEach, describe, expect, test } from 'vitest';
import type { NAR } from '../../../src';
import { ContextAssembler, TranslationCache } from '../../../nar/src/nl';

describe('ContextAssembler', () => {
  let cache: TranslationCache;
  let assembler: ContextAssembler;

  beforeEach(() => {
    cache = new TranslationCache();
    assembler = new ContextAssembler(cache);
  });

  test('assembles context from empty NAR', () => {
    const mockNar = {
      getBeliefs: () => [],
      getGoals: () => [],
      getStatistics: () => ({ memoryPressure: 0, totalConcepts: 0 }),
    } as unknown as NAR;

    const ctx = assembler.assemble(mockNar, 'test input');

    expect(ctx.beliefs).toEqual([]);
    expect(ctx.recentDerivations).toEqual([]);
    expect(ctx.activeGoals).toEqual([]);
    expect(ctx.memoryHealth).toEqual({ pressure: 0, totalConcepts: 0 });
    expect(ctx.recentExamples).toEqual([]);
  });

  test('assembles context with beliefs', () => {
    const mockBelief = {
      term: { toString: () => 'bird --> animal' },
      truth: { f: 0.9, c: 0.8 },
    };
    const mockNar = {
      getBeliefs: () => [mockBelief],
      getGoals: () => [],
      getStatistics: () => ({ memoryPressure: 0.1, totalConcepts: 2 }),
    } as unknown as NAR;

    const ctx = assembler.assemble(mockNar, 'bird is animal');

    expect(ctx.beliefs!.length).toBeGreaterThan(0);
    expect(ctx.memoryHealth?.totalConcepts).toBe(2);
  });

  test('extracts related beliefs based on input words', () => {
    const birdBelief = {
      term: { toString: () => 'bird --> animal' },
      truth: { f: 0.9, c: 0.8 },
    };
    const carBelief = {
      term: { toString: () => 'car --> vehicle' },
      truth: { f: 0.9, c: 0.8 },
    };
    const mockNar = {
      getBeliefs: () => [birdBelief, carBelief],
      getGoals: () => [],
      getStatistics: () => ({ memoryPressure: 0.1, totalConcepts: 2 }),
    } as unknown as NAR;

    const ctx = assembler.assemble(mockNar, 'tell me about bird');

    const birdFound = ctx.beliefs?.some((b) => b.includes('bird'));
    const carFound = ctx.beliefs?.some((b) => b.includes('car'));
    expect(birdFound).toBe(true);
    expect(carFound).toBe(false);
  });

  test('includes relevant translation examples', () => {
    cache.record('birds are animals', {
      beliefs: [{ narsese: '(bird --> animal). :1.0:0.9' }],
      questions: [],
      goals: [],
      summary: 'test',
    });

    const mockNar = {
      getBeliefs: () => [],
      getGoals: () => [],
      getStatistics: () => ({ memoryPressure: 0, totalConcepts: 0 }),
    } as unknown as NAR;

    const ctx = assembler.assemble(mockNar, 'birds are animals');

    expect(ctx.recentExamples?.length).toBeGreaterThan(0);
  });

  test('extracts active goals', () => {
    const mockGoal = {
      term: { toString: () => '(self --> curious)!' },
    };
    const mockNar = {
      getBeliefs: () => [],
      getGoals: () => [mockGoal],
      getStatistics: () => ({ memoryPressure: 0, totalConcepts: 0 }),
    } as unknown as NAR;

    const ctx = assembler.assemble(mockNar, 'test');

    expect(ctx.activeGoals).toContain('(self --> curious)!');
  });
});
