import { describe, expect, it } from 'vitest';
import { SelfRewardGate } from '../../nar/src/kernel/KernelRewardGate.js';
import { ProposalRouter } from '../../nar/src/governance/pipeline.js';

describe('todo7: proposal routing', () => {
  it('submit queues; drain empties', () => {
    const gate = new SelfRewardGate();
    gate.submit('focus-weight', { focusId: 'f1', weight: 0.7 }, 'self-scheduler');
    expect(gate.pending()).toHaveLength(1);
    expect(gate.drain()).toHaveLength(1);
    expect(gate.pending()).toHaveLength(0);
  });
  it('low-risk focus-weight auto-applies with actuator; clamps via authority', () => {
    const gate = new SelfRewardGate();
    const router = new ProposalRouter();
    const applied: Array<[string, number]> = [];
    const p = gate.propose('focus-weight', { focusId: 'f1', weight: 9 }, 'self-scheduler');
    const r = router.route(p, 'sandbox-execute', { applyFocusWeight: (id, w) => applied.push([id, Math.max(0, Math.min(1, w))]) });
    expect(r).toMatchObject({ route: 'auto-apply', applied: true });
    expect(applied).toEqual([['f1', 1]]);
  });
  it('medium → sandbox-validate; high → human-approval; low in observe-only → human', () => {
    const gate = new SelfRewardGate();
    const router = new ProposalRouter();
    expect(router.route(gate.propose('knob-tune', { knob: 'k', value: 1 }, 'self-config-proposal'), 'low-risk-auto-merge').route).toBe('sandbox-validate');
    expect(router.route(gate.propose('patch-apply', { diff: 'x' }, 'self-patch-score'), 'low-risk-auto-merge').route).toBe('human-approval');
    expect(router.route(gate.propose('focus-weight', { focusId: 'f', weight: 0.5 }, 'self-scheduler'), 'observe-only', { applyFocusWeight: () => { throw new Error('must not apply'); } }).route).toBe('human-approval');
    expect(router.getAwaitingValidation()).toHaveLength(1);
    expect(router.getAwaitingApproval()).toHaveLength(2);
  });
});
