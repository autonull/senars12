import { describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { KernelRewardGate, ExternalRewardGate, SelfRewardGate } from '../../nar/src/kernel/KernelRewardGate.js';
import { KernelActionGate } from '../../nar/src/kernel/KernelActionGate.js';

describe('todo7: reward domain split', () => {
  it('external rewards apply directly; self rewards require proposal', () => {
    const gate = new KernelRewardGate();
    const ext = gate.process({ eventId: uuidv4(), rewardSignal: 0.5, rewardType: 'extrinsic', targetType: 'policy-weights', targetId: 't', domain: 'external-reflex' });
    expect(ext).toMatchObject({ accepted: true, mutationApplied: true });
    expect(ext.requiresProposal).toBeUndefined();
    const self = gate.process({ eventId: uuidv4(), rewardSignal: 0.5, rewardType: 'contradiction-reduction', targetType: 'policy-weights', targetId: 't', domain: 'self-scheduler' });
    expect(self).toMatchObject({ accepted: true, mutationApplied: false, requiresProposal: true });
    const blocked = gate.process({ eventId: uuidv4(), rewardSignal: 0.5, rewardType: 'extrinsic', targetType: 'truth-confidence', targetId: 'b', domain: 'self-scheduler' });
    expect(blocked.accepted).toBe(false);
  });
  it('ExternalRewardGate ingests; SelfRewardGate builds risk-tiered proposals', () => {
    const ext = new ExternalRewardGate().ingest({ rewardSignal: 0.8, rewardType: 'extrinsic', targetId: 'focus-1' });
    expect(ext.accepted).toBe(true);
    const low = new SelfRewardGate().propose('focus-weight', { w: 0.5 }, 'self-scheduler');
    expect(low.riskTier).toBe('low');
    const high = new SelfRewardGate().propose('patch-apply', { diff: 'x' }, 'self-patch-score');
    expect(high.riskTier).toBe('high');
  });
});

describe('todo7: autonomy state machine', () => {
  it('enforces legal transitions and approval authority', () => {
    const gate = new KernelActionGate();
    expect(gate.requestModeChange('sandbox-execute', 'system').changed).toBe(false);
    expect(gate.requestModeChange('propose-only', 'system').changed).toBe(true);
    expect(gate.requestModeChange('sandbox-execute', 'system').changed).toBe(true);
    expect(gate.requestModeChange('human-approved-production', 'system').changed).toBe(false);
    expect(gate.requestModeChange('low-risk-auto-merge', 'human', 'c1').changed).toBe(true);
    expect(gate.requestModeChange('human-approved-production', 'external-governance', 'c2').changed).toBe(true);
    expect(gate.getAutonomyMode()).toBe('human-approved-production');
    expect(gate.getAutonomyLog()).toHaveLength(4);
  });
});
