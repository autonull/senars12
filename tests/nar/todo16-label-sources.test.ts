import { describe, it, expect } from 'vitest';
import { JudgmentDataset } from '../../nar/src/lm/system-one/distill.js';
import {
  recordCorrectionLabel,
  recordDerivationOutcomeLabel,
  recordApprovalLabel,
  recordShadowVerdictLabel,
} from '../../nar/src/lm/system-one/label-sources.js';
import { FeedbackLearner } from '../../nar/src/learning/feedback.js';

describe('System One — Label Source Adapters (§9.1 flywheel wiring)', () => {
  it('FeedbackLearner corrections land in the dataset as hashes, never raw text', () => {
    const dataset = new JudgmentDataset();
    const learner = new FeedbackLearner();
    learner.setDistillationDataset(dataset);

    learner.onCorrection('The cat is on the mat', '<cat --> on_mat>.', '<cat --> on_mat>. %1.00;0.90%');
    learner.onCorrection('The cat is on the mat', '<cat --> on_mat>.', '<cat --> off_mat>. %1.00;0.90%');

    expect(dataset.size).toBe(2);
    const serialized = JSON.stringify(dataset.all());
    expect(serialized).not.toContain('cat');
    expect(serialized).not.toContain('mat');
    expect(serialized).not.toContain('<cat --> on_mat>');
    for (const label of dataset.all()) {
      expect(label.source).toBe('FeedbackLearner.onCorrection');
      expect(label.rubric).toBe('task_type');
    }
  });

  it('derivation outcomes are labeled per rule', () => {
    const dataset = new JudgmentDataset();
    const learner = new FeedbackLearner();
    learner.setDistillationDataset(dataset);

    learner.onDerivationOutcome({ newBeliefs: [{ term: 'rule:lm-narsese-translation' }] }, 'accepted');
    learner.onDerivationOutcome({ newBeliefs: [{ term: 'rule:lm-narsese-translation' }] }, 'rejected');

    expect(dataset.size).toBe(2);
    const [accepted, rejected] = dataset.all();
    expect(accepted!.label).toBe('accepted');
    expect(rejected!.label).toBe('rejected');
    expect(accepted!.evidenceId).not.toBe(rejected!.evidenceId);
  });

  it('feedback hooks stay inert without an attached dataset', () => {
    const learner = new FeedbackLearner();
    expect(() =>
      learner.onCorrection('test sentence', '<a --> b>.', '<a --> b>. %1.00;0.90%')
    ).not.toThrow();
    expect(() => learner.onDerivationOutcome({ newBeliefs: [] }, 'accepted')).not.toThrow();
  });

  it('approval and shadow-verdict adapters record teleological/epistemic labels', () => {
    const dataset = new JudgmentDataset();
    recordApprovalLabel(dataset, { action: 'delete_file', approved: false });
    recordShadowVerdictLabel(dataset, { derivationId: 'd1', verdict: 'conflict' });

    const [approval, shadow] = dataset.all();
    expect(approval!.axis).toBe('teleological');
    expect(approval!.rubric).toBe('risk');
    expect(shadow!.axis).toBe('epistemic');
    expect(shadow!.rubric).toBe('conflict');
    expect(JSON.stringify(dataset.all())).not.toContain('delete_file');
  });

  it('same-source events on different evidence anchor to distinct ids', () => {
    const dataset = new JudgmentDataset();
    recordCorrectionLabel(dataset, { originalNL: 'one sentence', correctedNarsese: 'x' });
    recordCorrectionLabel(dataset, { originalNL: 'another sentence', correctedNarsese: 'y' });
    const [a, b] = dataset.all();
    expect(a!.evidenceId).not.toBe(b!.evidenceId);
  });
});
