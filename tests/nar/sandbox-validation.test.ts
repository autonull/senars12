import { describe, expect, it } from 'vitest';
import { SelfRewardGate } from '../../nar/src/kernel/KernelRewardGate.js';
import { ProposalRouter, SandboxValidator } from '../../nar/src/governance/pipeline.js';

describe('todo7: sandbox validation', () => {
  it('validator approves in-range known knobs; rejects unknown/out-of-range/non-knob', () => {
    const v = new SandboxValidator();
    expect(v.validate(new SelfRewardGate().propose('knob-tune', { knob: 'rankingMaxAdmissions', value: 200 }, 'self-config-proposal')).approved).toBe(true);
    expect(v.validate(new SelfRewardGate().propose('knob-tune', { knob: 'nope', value: 1 }, 'self-config-proposal'))).toMatchObject({ approved: false });
    expect(v.validate(new SelfRewardGate().propose('knob-tune', { knob: 'rankingMaxAdmissions', value: 5000 }, 'self-config-proposal'))).toMatchObject({ approved: false });
    expect(v.validate(new SelfRewardGate().propose('schema-promotion', { schema: 's' }, 'self-config-proposal'))).toMatchObject({ approved: false });
  });
  it('validated knob-tune applies via actuator; unvalidated stays queued', () => {
    const gate = new SelfRewardGate();
    const router = new ProposalRouter();
    const validator = new SandboxValidator();
    const applied: Array<[string, number]> = [];
    const actuators = { applyKnob: (k: string, v: number) => { applied.push([k, v]); } };
    const ok = router.route(gate.propose('knob-tune', { knob: 'rankingMaxAdmissions', value: 200 }, 'self-config-proposal'), 'sandbox-execute', actuators, validator);
    expect(ok).toMatchObject({ route: 'auto-apply', applied: true });
    expect(applied).toEqual([['rankingMaxAdmissions', 200]]);
    const bad = router.route(gate.propose('knob-tune', { knob: 'rankingMaxAdmissions', value: 5000 }, 'self-config-proposal'), 'sandbox-execute', actuators, validator);
    expect(bad).toMatchObject({ route: 'sandbox-validate', applied: false });
    const noValidator = router.route(gate.propose('knob-tune', { knob: 'maxLoops', value: 3 }, 'self-config-proposal'), 'sandbox-execute', actuators);
    expect(noValidator.route).toBe('sandbox-validate');
    const locked = router.route(gate.propose('knob-tune', { knob: 'maxLoops', value: 3 }, 'self-config-proposal'), 'observe-only', actuators, validator);
    expect(locked.route).toBe('sandbox-validate');
    expect(router.getAwaitingValidation()).toHaveLength(3);
  });
});
