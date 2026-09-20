import { describe, it, expect } from 'vitest';
import { SandboxValidator } from '../../nar/src/governance/pipeline.js';
import { SelfImprovementProposal, AutonomyMode } from '@senars/kernel/schemas';

describe('SystemOne Knob Validation', () => {
  const validator = new SandboxValidator();

  const makeProposal = (knob: string, value: number): SelfImprovementProposal => ({
    proposalId: 'test',
    kind: 'knob-tune',
    riskTier: 'medium',
    payload: { knob, value },
    rewardDomain: 'self-config-proposal',
    correlationId: 'test-correlation',
  });

  it('validates systemOne.budgets.maxJudgmentCallsPerCycle within bounds', () => {
    const result = validator.validate(makeProposal('systemOne.budgets.maxJudgmentCallsPerCycle', 16));
    expect(result.approved).toBe(true);
    expect(result.reason).toContain('within [1, 32]');
  });

  it('rejects systemOne.budgets.maxJudgmentCallsPerCycle out of bounds', () => {
    const result = validator.validate(makeProposal('systemOne.budgets.maxJudgmentCallsPerCycle', 100));
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('outside [1, 32]');
  });

  it('validates systemOne.budgets.maxConsensusPerCycle within bounds', () => {
    const result = validator.validate(makeProposal('systemOne.budgets.maxConsensusPerCycle', 4));
    expect(result.approved).toBe(true);
  });

  it('rejects systemOne.budgets.maxConsensusPerCycle out of bounds', () => {
    const result = validator.validate(makeProposal('systemOne.budgets.maxConsensusPerCycle', 20));
    expect(result.approved).toBe(false);
  });

  it('validates systemOne.budgets.maxLatencyMsPerJudgment within bounds', () => {
    const result = validator.validate(makeProposal('systemOne.budgets.maxLatencyMsPerJudgment', 50));
    expect(result.approved).toBe(true);
  });

  it('rejects systemOne.budgets.maxLatencyMsPerJudgment out of bounds', () => {
    const result = validator.validate(makeProposal('systemOne.budgets.maxLatencyMsPerJudgment', 500));
    expect(result.approved).toBe(false);
  });

  it('validates systemOne.budgets.maxTokensPerCycle within bounds', () => {
    const result = validator.validate(makeProposal('systemOne.budgets.maxTokensPerCycle', 8192));
    expect(result.approved).toBe(true);
  });

  it('rejects systemOne.budgets.maxTokensPerCycle out of bounds', () => {
    const result = validator.validate(makeProposal('systemOne.budgets.maxTokensPerCycle', 100000));
    expect(result.approved).toBe(false);
  });

  it('validates systemOne.budgets.maxMemoryMbPerCycle within bounds', () => {
    const result = validator.validate(makeProposal('systemOne.budgets.maxMemoryMbPerCycle', 512));
    expect(result.approved).toBe(true);
  });

  it('rejects systemOne.budgets.maxMemoryMbPerCycle out of bounds', () => {
    const result = validator.validate(makeProposal('systemOne.budgets.maxMemoryMbPerCycle', 5000));
    expect(result.approved).toBe(false);
  });

  it('validates systemOne.provisional.cInitial within bounds', () => {
    const result = validator.validate(makeProposal('systemOne.provisional.cInitial', 0.2));
    expect(result.approved).toBe(true);
  });

  it('rejects systemOne.provisional.cInitial out of bounds', () => {
    const result = validator.validate(makeProposal('systemOne.provisional.cInitial', 1.0));
    expect(result.approved).toBe(false);
  });

  it('validates systemOne.provisional.decayRate within bounds', () => {
    const result = validator.validate(makeProposal('systemOne.provisional.decayRate', 0.5));
    expect(result.approved).toBe(true);
  });

  it('rejects systemOne.provisional.decayRate out of bounds', () => {
    const result = validator.validate(makeProposal('systemOne.provisional.decayRate', 2.0));
    expect(result.approved).toBe(false);
  });

  it('validates systemOne.provisional.maxTtlMs within bounds', () => {
    const result = validator.validate(makeProposal('systemOne.provisional.maxTtlMs', 60000));
    expect(result.approved).toBe(true);
  });

  it('rejects systemOne.provisional.maxTtlMs out of bounds', () => {
    const result = validator.validate(makeProposal('systemOne.provisional.maxTtlMs', 1000000));
    expect(result.approved).toBe(false);
  });

  it('rejects unknown systemOne knob', () => {
    const result = validator.validate(makeProposal('systemOne.unknown.knob', 1));
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('Unknown systemOne knob');
  });

  it('rejects non-numeric value', () => {
    const result = validator.validate(makeProposal('systemOne.budgets.maxJudgmentCallsPerCycle', NaN));
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('Non-numeric value');
  });

  it('still validates existing cognitive knobs', () => {
    const result = validator.validate(makeProposal('maxDerivationsPerStep', 200));
    expect(result.approved).toBe(true);
  });

  it('still rejects invalid cognitive knobs', () => {
    const result = validator.validate(makeProposal('maxDerivationsPerStep', 10000));
    expect(result.approved).toBe(false);
  });

  it('rejects non-knob-tune proposals', () => {
    const result = validator.validate({
      proposalId: 'test',
      kind: 'patch-apply',
      riskTier: 'medium',
      payload: {},
      rewardDomain: 'self-patch-score',
      correlationId: 'test-correlation',
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('No automated checks');
  });
});