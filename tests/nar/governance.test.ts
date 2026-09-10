import { describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { PatchRiskClassifier, GovernancePolicyEngine } from '../../nar/src/governance/pipeline.js';

const base = {
    proposalId: uuidv4(),
    patchRef: 'refs/shadow/fix-1',
    baseCommit: 'abc',
    patchDiff: 'diff --git a/test.ts b/test.ts\n+console.log("test")',
    ciResults: { test: true, typecheck: true, lint: true, durationMs: 1000 },
    riskSelfAssessment: 'LOW' as const,
    affectedComponents: ['tools'] as const,
    affectedFiles: ['nar/src/tools/sleep.ts'],
    linesAdded: 10,
    linesRemoved: 5,
    coverageDelta: 0,
    rationale: 'fix',
    timestamp: Date.now(),
    agentSignature: 'sig',
};

describe('todo7: governance pipeline', () => {
  it('guardrail touch → HIGH; clean patch → LOW', () => {
    const c = new PatchRiskClassifier();
    const high = c.classify({ ...base, proposalId: uuidv4(), affectedFiles: ['nar/src/kernel/KernelRewardGate.ts'] });
    expect(high.risk).toBe('HIGH');
    expect(high.score).toBeGreaterThanOrEqual(50);
    const low = c.classify({ ...base, proposalId: uuidv4(), affectedFiles: ['nar/src/tools/sleep.ts'] });
    expect(low.risk).toBe('LOW');
  });
  it('critical component → HIGH', () => {
    const c = new PatchRiskClassifier();
    const high = c.classify({ ...base, proposalId: uuidv4(), affectedFiles: ['x.ts'], affectedComponents: ['approval-logic'] });
    expect(high.risk).toBe('HIGH');
    expect(high.score).toBeGreaterThanOrEqual(40);
  });
  it('large churn and coverage drop raise score', () => {
    const c = new PatchRiskClassifier();
    const r = c.classify({ ...base, proposalId: uuidv4(), affectedFiles: ['nar/src/tools/x.ts'], linesAdded: 400, linesRemoved: 200, coverageDelta: -8 });
    expect(r.score).toBe(25);
    expect(r.risk).toBe('MEDIUM');
  });
  it('policy: HIGH always human; LOW auto-merges only in low-risk-auto-merge', () => {
    const e = new GovernancePolicyEngine();
    expect(e.decide({ risk: 'HIGH', score: 90, factors: [] }, 'low-risk-auto-merge').action).toBe('REQUIRE_HUMAN_REVIEW');
    expect(e.decide({ risk: 'LOW', score: 0, factors: [] }, 'sandbox-execute').action).toBe('REQUIRE_HUMAN_REVIEW');
    expect(e.decide({ risk: 'LOW', score: 0, factors: [] }, 'low-risk-auto-merge').action).toBe('AUTO_MERGE');
    expect(e.decide({ risk: 'MEDIUM', score: 25, factors: [] }, 'low-risk-auto-merge')).toMatchObject({ action: 'CREATE_PR', reviewers: 1 });
    expect(e.decide({ risk: 'LOW', score: 0, factors: [] }, 'human-approved-production').action).toBe('REQUIRE_HUMAN_REVIEW');
  });
  it('record emits audit event', () => {
    const e = new GovernancePolicyEngine();
    const proposal = { ...base, proposalId: uuidv4(), affectedFiles: ['a.ts'] };
    const ev = e.record(proposal, { risk: 'LOW', score: 0, factors: [] }, { action: 'AUTO_MERGE', reason: 'ok' }, 'low-risk-auto-merge');
    expect(ev).toMatchObject({ decision: 'AUTO_MERGED', riskLevel: 'LOW', decidedBy: 'governance-runner' });
  });
});
