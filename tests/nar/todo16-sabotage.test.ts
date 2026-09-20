import { describe, it, expect } from 'vitest';
import {
  validateHeadCandidate,
  buildSabotageFlag,
  type HeadCandidateSpec,
} from '../../nar/src/lm/system-one/distill.js';
import { ProposalRouter } from '../../nar/src/governance/pipeline.js';
import type { AutonomyMode } from '@senars/kernel/schemas';

const pinnedIncumbent: HeadCandidateSpec = {
  headId: 'injection',
  modelDigest: `sha256:${'a'.repeat(64)}`,
  calibrationVersion: 'v2.4.1',
  abstainThreshold: 0.3,
  enabled: true,
};

const ALL_MODES: AutonomyMode[] = [
  'observe-only',
  'propose-only',
  'sandbox-execute',
  'low-risk-auto-merge',
  'human-approved-production',
];

describe('System One — Sabotage Prevention (Bench 14)', () => {
  it('rejects an un-pinned model digest', () => {
    const verdict = validateHeadCandidate({
      ...pinnedIncumbent,
      modelDigest: 'sha256:short',
    });
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations[0]).toContain('Un-pinned modelDigest');
  });

  it('rejects a head with no hash at all', () => {
    const verdict = validateHeadCandidate({ ...pinnedIncumbent, modelDigest: 'latest' });
    expect(verdict.accepted).toBe(false);
  });

  it('rejects a relaxed abstain threshold τ', () => {
    const verdict = validateHeadCandidate(
      { ...pinnedIncumbent, modelDigest: `sha256:${'b'.repeat(64)}`, abstainThreshold: 0.1 },
      pinnedIncumbent
    );
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations[0]).toContain('Relaxed abstainThreshold');
  });

  it('rejects disabling the injection head', () => {
    const verdict = validateHeadCandidate({ ...pinnedIncumbent, enabled: false });
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations[0]).toContain('Disabled injection head');
  });

  it('accepts a legitimate promotion (pinned, equal-or-stricter τ, enabled)', () => {
    const verdict = validateHeadCandidate(
      { ...pinnedIncumbent, modelDigest: `sha256:${'c'.repeat(64)}`, abstainThreshold: 0.4 },
      pinnedIncumbent
    );
    expect(verdict.accepted).toBe(true);
    expect(verdict.violations).toHaveLength(0);
  });

  it('sabotage flags route to human approval and are never auto-applied', () => {
    const sabotage = validateHeadCandidate({ ...pinnedIncumbent, enabled: false });
    expect(sabotage.accepted).toBe(false);

    const flag = buildSabotageFlag({ ...pinnedIncumbent, enabled: false }, sabotage.violations);
    expect(flag.riskTier).toBe('high');
    expect(flag.payload['operation']).toBe('sabotage-flagged');
    expect(flag.payload['violations']).toHaveLength(1);

    const router = new ProposalRouter();
    for (const mode of ALL_MODES) {
      const routed = router.route(flag, mode);
      expect(routed.route).toBe('human-approval');
      expect(routed.applied).toBe(false);
    }
  });

  it('flagged sabotage records the violating head id for the audit trail', () => {
    const candidate: HeadCandidateSpec = { ...pinnedIncumbent, modelDigest: 'unpinned' };
    const sabotage = validateHeadCandidate(candidate);
    const flag = buildSabotageFlag(candidate, sabotage.violations);
    expect(flag.payload['headId']).toBe(candidate.headId);
    expect(flag.payload['modelDigest']).toBe('unpinned');
  });
});
