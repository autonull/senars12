import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { computeEvidenceId, promoteProvisional, JudgmentDataset } from '../../nar/src/lm/system-one/distill.js';
import { seedTruth } from '../../nar/src/lm/system-one/seed.js';
import { Truth } from '../../nar/src/terms/truth.js';
import type { JudgmentProposition, EvaluateProposition } from '../../nar/src/lm/system-one/types.js';

const makeEvaluateProposition = (score: number, ece = 0.02): EvaluateProposition => ({
  kind: 'evaluate',
  axis: 'epistemic',
  score,
  queryId: 'q1' as never,
  backendId: 'b' as never,
  modelDigest: 'm' as never,
  calibration: { version: 'v1' as never, ece },
  latencyMs: 1,
  cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
  tier: 1,
  abstained: false,
});

describe('System One — Evidence Laundering Prevention (Bench 7)', () => {
  it('evidenceId is anchored to the utterance, not the judgment', () => {
    const a1 = computeEvidenceId('utt-1', 'span-0');
    const a2 = computeEvidenceId('utt-1', 'span-0');
    const b = computeEvidenceId('utt-2', 'span-0');
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
  });

  it('different source spans of the same utterance yield distinct evidence ids', () => {
    expect(computeEvidenceId('utt-1', 'span-0')).not.toBe(computeEvidenceId('utt-1', 'span-1'));
  });

  it('N-fold re-judging the same evidence does not inflate confidence', () => {
    const proposition = makeEvaluateProposition(0.8);
    let truth = Truth.create(0.5, 0.5);
    for (let i = 0; i < 20; i++) truth = promoteProvisional(truth, proposition);
    expect(truth.c).toBeLessThanOrEqual(Truth.MAX_CONFIDENCE);
    expect(truth.f).toBeCloseTo(0.8, 1);
  });

  it('confidence stays bounded regardless of repetition count', () => {
    const proposition = makeEvaluateProposition(0.99, 0.01);
    let truth = promoteProvisional(undefined, proposition);
    for (let i = 0; i < 100; i++) {
      truth = promoteProvisional(truth, proposition);
      expect(truth.c).toBeLessThanOrEqual(Truth.MAX_CONFIDENCE);
    }
  });

  it('evidence-weighted revision respects the source-quality ceiling', () => {
    // TERTIARY quality (0.4 ceiling) — seedTruth caps authority
    const truth = seedTruth(makeEvaluateProposition(0.95), 'TERTIARY');
    expect(truth.c).toBeLessThanOrEqual(0.4);
  });

  it('judgment dataset stores only hashes and labels, never raw text', () => {
    const dataset = new JudgmentDataset(join(tmpdir(), 'test-evidence-base'));
    const evidenceId = computeEvidenceId('secret utterance text', 'span-0');
    dataset.record({
      evidenceId,
      rubric: 'task_type',
      axis: 'epistemic',
      label: 'belief',
      source: 'FeedbackLearner',
    });
    const serialized = JSON.stringify(dataset.all());
    expect(serialized).not.toContain('secret utterance text');
    expect(serialized).toContain(evidenceId);
  });
});
