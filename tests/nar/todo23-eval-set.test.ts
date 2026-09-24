import { describe, expect, it } from 'vitest';
import { DigestMismatchError } from '../../nar/src/lm/system-one/wasi-runtime.js';
import { JudgmentDataset, runBakeOff, type BakeOffCase } from '../../nar/src/lm/system-one/distill.js';
import {
  assertFrozenNonRegression,
  createFrozenEvalSet,
  digestRows,
  evalMetrics,
  EvalRegressionError,
  headMetrics,
  loadEvalSet,
  writeEvalSet,
  type FrozenEvalSet,
} from '../../nar/src/lm/system-one/eval-set.js';

const datasetWith = (
  rows: { rubric: string; score?: number; observed?: number; source: string }[]
): JudgmentDataset => {
  const d = new JudgmentDataset();
  for (const [i, r] of rows.entries()) {
    d.record({ evidenceId: `e${i}`, rubric: r.rubric, axis: 'epistemic', label: 'x', score: r.score, observed: r.observed, source: r.source });
  }
  return d;
};

const cases = (candidateBias: number): BakeOffCase[] =>
  Array.from({ length: 20 }, (_, i) => ({
    truth: i / 20,
    incumbent: i / 20,
    candidate: Math.min(1, Math.max(0, i / 20 + candidateBias)),
  }));

describe('frozen eval set', () => {
  it('excludes conversation-captured rows by construction and freezes the rest', () => {
    const dataset = datasetWith([
      { rubric: 'groundedness', score: 0.9, observed: 1, source: 'label' },
      { rubric: 'groundedness', score: 0.2, observed: 0, source: 'conversation' },
      { rubric: 'risk', score: 0.7, observed: 1, source: 'reflex' },
      { rubric: 'risk', score: 0.5, source: 'label' }, // no observed — unlabelable
    ]);
    const set = createFrozenEvalSet(dataset);
    expect(set.rows).toHaveLength(2);
    expect(set.rows.map((r) => r.headId).sort()).toEqual(['groundedness', 'risk']);
    expect(set.digest).toBe(digestRows(set.rows));
  });

  it('round-trips through disk and fails closed on tampering', async () => {
    const dataset = datasetWith([
      { rubric: 'groundedness', score: 0.9, observed: 1, source: 'label' },
      { rubric: 'groundedness', score: 0.2, observed: 0, source: 'label' },
    ]);
    const set = createFrozenEvalSet(dataset);
    const path = '.cache/test/eval-set.json';
    await writeEvalSet(set, path);
    const loaded = await loadEvalSet(path);
    expect(loaded.digest).toBe(set.digest);

    const tampered: FrozenEvalSet = { ...loaded, rows: [{ headId: 'groundedness', predicted: 0.01, observed: 0 }] };
    await writeEvalSet(tampered, path);
    await expect(loadEvalSet(path)).rejects.toThrow(DigestMismatchError);
  });

  it('computes Brier/ECE per set and per head', () => {
    const rows = [
      { headId: 'a', predicted: 1, observed: 1 },
      { headId: 'a', predicted: 0, observed: 0 },
      { headId: 'b', predicted: 1, observed: 0 },
    ];
    expect(evalMetrics(rows).brier).toBeCloseTo(1 / 3, 5);
    expect(headMetrics(rows).a!.brier).toBe(0);
    expect(headMetrics(rows).b!.brier).toBe(1);
  });

  it('promotion gate throws on frozen-set regression', () => {
    expect(() =>
      assertFrozenNonRegression({ brier: 0.1, ece: 0, count: 10 }, { brier: 0.11, ece: 0, count: 10 })
    ).not.toThrow();
    expect(() =>
      assertFrozenNonRegression({ brier: 0.1, ece: 0, count: 10 }, { brier: 0.2, ece: 0, count: 10 })
    ).toThrow(EvalRegressionError);
  });

  it('runBakeOff rejects candidates that regress on the frozen set', () => {
    const ok = runBakeOff(undefined, { headId: 'h', modelDigest: 'x', calibrationVersion: 'v', abstainThreshold: 0.5, enabled: true }, cases(0), 0.02, 0.1, false, { cases: cases(0) });
    expect(ok.accepted).toBe(true);
    expect(ok.frozen?.nonRegression).toBe(true);

    const regressed = runBakeOff(undefined, { headId: 'h', modelDigest: 'x', calibrationVersion: 'v', abstainThreshold: 0.5, enabled: true }, cases(0), 0.02, 0.1, false, { cases: cases(0.5) });
    expect(regressed.accepted).toBe(false);
    expect(regressed.reason).toMatch(/Frozen-set regression/);
  });
});
