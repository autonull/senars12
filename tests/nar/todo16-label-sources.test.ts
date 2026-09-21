import { describe, it, expect } from 'vitest';
import { JudgmentDataset } from '../../nar/src/lm/system-one/distill.js';
import {
  recordCorrectionLabel,
  recordDerivationOutcomeLabel,
  recordApprovalLabel,
  recordShadowVerdictLabel,
} from '../../nar/src/lm/system-one/label-sources.js';

describe('System One — Label Source Adapters (§9.1 flywheel wiring)', () => {
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
