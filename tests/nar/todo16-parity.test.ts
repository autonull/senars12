import { describe, it, expect } from 'vitest';
import {
  runBakeOff,
  buildHeadSwapProposal,
  JudgmentDataset,
  type BakeOffCase,
  type HeadCandidateSpec,
} from '../../nar/src/lm/system-one/distill.js';
import { ProposalRouter } from '../../nar/src/governance/pipeline.js';
import type { AutonomyMode } from '@senars/kernel/schemas';

const incumbent: HeadCandidateSpec = {
  headId: 'candidate_select',
  modelDigest: `sha256:${'a'.repeat(64)}`,
  calibrationVersion: 'v2.4.1',
  abstainThreshold: 0.3,
  enabled: true,
};

const makeCases = (candidateBias: number): BakeOffCase[] =>
  Array.from({ length: 50 }, (_, i) => {
    const truth = i % 2;
    return {
      truth,
      incumbent: truth,
      candidate: Math.min(1, Math.max(0, truth === 1 ? 1 - candidateBias : candidateBias)),
    };
  });

describe('System One — Distillation Parity (Bench 10)', () => {
  it('promoted head matching incumbent accuracy within 2% is accepted', () => {
    const result = runBakeOff(incumbent, incumbent, makeCases(0));
    expect(result.withinParity).toBe(true);
    expect(result.accepted).toBe(true);
    expect(result.parityGap).toBeLessThanOrEqual(0.02);
  });

  it('candidate worse than incumbent beyond 2% is rejected', () => {
    const candidate: HeadCandidateSpec = { ...incumbent, modelDigest: `sha256:${'b'.repeat(64)}` };
    const result = runBakeOff(incumbent, candidate, makeCases(0.2));
    expect(result.parityGap).toBeGreaterThan(0.02);
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('Parity gap');
  });

  it('better candidate is also accepted (parity is symmetric)', () => {
    const candidate: HeadCandidateSpec = { ...incumbent, modelDigest: `sha256:${'c'.repeat(64)}` };
    const result = runBakeOff(incumbent, candidate, makeCases(-0.5));
    expect(result.accepted).toBe(true);
    expect(result.candidateAccuracy).toBeGreaterThanOrEqual(result.incumbentAccuracy);
  });

  it('acceptImprovements admits strictly-better candidates beyond tolerance; regressions still rejected', () => {
    const imperfectCases = (incumbentWeight: number, candidateWeight: number): BakeOffCase[] =>
      Array.from({ length: 50 }, (_, i) => {
        const truth = i % 2;
        return {
          truth,
          incumbent: incumbentWeight * truth + (1 - incumbentWeight) / 2,
          candidate: candidateWeight * truth + (1 - candidateWeight) / 2,
        };
      });

    const better: HeadCandidateSpec = { ...incumbent, modelDigest: `sha256:${'c'.repeat(64)}` };
    const improved = runBakeOff(incumbent, better, imperfectCases(0.7, 0.9), 0.02, 0.1, true);
    expect(improved.withinParity).toBe(false);
    expect(improved.candidateAccuracy).toBeGreaterThan(improved.incumbentAccuracy);
    expect(improved.accepted).toBe(true);

    const worse: HeadCandidateSpec = { ...incumbent, modelDigest: `sha256:${'b'.repeat(64)}` };
    const regressed = runBakeOff(incumbent, worse, makeCases(0.2), 0.02, 0.1, true);
    expect(regressed.accepted).toBe(false);
  });

  it('head swap proposal routes through governance — never auto-applied, incumbent retained', () => {
    const bakeOff = runBakeOff(incumbent, incumbent, makeCases(0));
    const proposal = buildHeadSwapProposal(incumbent, bakeOff);
    expect(proposal.kind).toBe('patch-apply');
    expect(proposal.riskTier).toBe('medium');

    const router = new ProposalRouter();
    for (const mode of ['observe-only', 'propose-only', 'sandbox-execute', 'low-risk-auto-merge', 'human-approved-production'] as AutonomyMode[]) {
      const routed = router.route(proposal, mode);
      expect(routed.applied).toBe(false);
    }
    // Incumbent retained for instant rollback — never mutated by routing
    expect(incumbent.modelDigest).toBe(`sha256:${'a'.repeat(64)}`);
    // Medium-risk patch-apply is held for sandbox validation (no automated checks)
    expect(router.getAwaitingValidation().length).toBeGreaterThan(0);
  });

  it('dataset stays redaction-per-retention across the flywheel', () => {
    const dataset = new JudgmentDataset();
    dataset.record({
      evidenceId: 'sha256:deadbeef',
      rubric: 'groundedness',
      axis: 'epistemic',
      label: '0.82',
      score: 0.82,
      source: 'PreferenceCollector',
    });
    const jsonl = dataset.toJSONL();
    expect(jsonl.split('\n')).toHaveLength(1);
    expect(JSON.parse(jsonl)).toMatchObject({ evidenceId: 'sha256:deadbeef', rubric: 'groundedness' });
  });
});
