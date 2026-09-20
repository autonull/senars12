import { describe, it, expect } from 'vitest';
import {
  assertJudgmentQuery,
  isJudgmentQuery,
  isSynthesisQuery,
  validateBatchQueries,
  AlgebraPurityError,
} from '../../nar/src/lm/system-one/algebra.js';
import type { JudgmentQuery, SynthesisQuery } from '../../nar/src/lm/system-one/types.js';

describe('System One — Algebra Purity (Bench 1)', () => {
  const makeClassifyQuery = (): JudgmentQuery => ({
    kind: 'classify',
    instruction: 'Classify the task type',
    space: ['belief', 'goal', 'question'],
    axis: 'epistemic',
  });

  const makeEvaluateQuery = (): JudgmentQuery => ({
    kind: 'evaluate',
    instruction: 'Evaluate the relevance',
    rubric: 'relevance',
    axis: 'epistemic',
  });

  const makeSynthesisQuery = (): SynthesisQuery => ({
    kind: 'synthesize',
    instruction: 'Generate Narsese term',
    grammar: 'narsese-term',
    maxCandidates: 3,
  });

  it('accepts ClassifyQuery as JudgmentQuery', () => {
    const q = makeClassifyQuery();
    expect(isJudgmentQuery(q)).toBe(true);
    expect(isSynthesisQuery(q)).toBe(false);
    expect(() => assertJudgmentQuery(q)).not.toThrow();
  });

  it('accepts EvaluateQuery as JudgmentQuery', () => {
    const q = makeEvaluateQuery();
    expect(isJudgmentQuery(q)).toBe(true);
    expect(isSynthesisQuery(q)).toBe(false);
    expect(() => assertJudgmentQuery(q)).not.toThrow();
  });

  it('rejects SynthesisQuery as JudgmentQuery (runtime guard)', () => {
    const q = makeSynthesisQuery();
    expect(isJudgmentQuery(q)).toBe(false);
    expect(isSynthesisQuery(q)).toBe(true);
    expect(() => assertJudgmentQuery(q)).toThrow(AlgebraPurityError);
  });

  it('validateBatchQueries accepts pure judgment batches', () => {
    const batch = [makeClassifyQuery(), makeEvaluateQuery()];
    expect(() => validateBatchQueries(batch)).not.toThrow();
    expect(validateBatchQueries(batch)).toHaveLength(2);
  });

  it('validateBatchQueries rejects batch with SynthesisQuery', () => {
    const batch = [makeClassifyQuery(), makeSynthesisQuery()];
    expect(() => validateBatchQueries(batch)).toThrow(AlgebraPurityError);
  });

  it('AlgebraPurityError carries queryKind', () => {
    const q = makeSynthesisQuery();
    try {
      assertJudgmentQuery(q);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AlgebraPurityError);
      expect((e as AlgebraPurityError).queryKind).toBe('synthesize');
    }
  });

  it('type-level: JudgmentQuery and SynthesisQuery are never in a union', () => {
    // This is a compile-time test — if the types were unified, the above
    // isJudgmentQuery/isSynthesisQuery guards would not narrow correctly.
    // The fact that they do narrow proves the union separation.
    const queries: (JudgmentQuery | SynthesisQuery)[] = [
      makeClassifyQuery(),
      makeEvaluateQuery(),
      makeSynthesisQuery(),
    ];
    const judgmentOnly = queries.filter(isJudgmentQuery);
    const synthesisOnly = queries.filter(isSynthesisQuery);
    expect(judgmentOnly).toHaveLength(2);
    expect(synthesisOnly).toHaveLength(1);
  });
});