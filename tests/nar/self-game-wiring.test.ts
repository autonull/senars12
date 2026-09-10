import { describe, expect, it } from 'vitest';
import { createSelfMetaGame } from '../../nar/src/game/SelfMetaGame.js';
import { SelfMetaGameImpl } from '../../nar/src/game/SelfMetaGame.js';
import { FocusBag } from '../../nar/src/focus/FocusBag.js';
import { Focus } from '../../nar/src/focus/Focus.js';
import { LearnerRegistry, SchedulerAdapter } from '../../nar/src/learning/domain-learners.js';
import { SelfRewardGate } from '../../nar/src/kernel/KernelRewardGate.js';
import type { FocusStepReport } from '../../nar/src/focus/Focus.js';

const report = (focusId: string, derivations: number, tasksProcessed: number): FocusStepReport => ({
    focusId, cycle: 1, budgetAllocated: 10, tasksProcessed, derivations,
    beliefsAdded: 0, goalsAdded: 0, questionsAdded: 0,
    gates: { perceptions: 0, actions: 0, rewards: 0 }, timestamp: Date.now(),
});

const setup = (weight: number) => {
    const focusBag = new FocusBag({ capacity: 10 });
    focusBag.add(new Focus({ id: 'f1', weight }));
    const game = createSelfMetaGame({ id: 'self', observesFocuses: ['f1'], focusBag, gameFocuses: new Map() });
    return { focusBag, game };
};

describe('todo7: self-game outcome wiring', () => {
  it('productive focus gains weight; idle report changes nothing', () => {
    const { focusBag, game } = setup(0.5);
    const registry = new LearnerRegistry();
    registry.register(new SchedulerAdapter(focusBag));
    const rewardGate = new SelfRewardGate();
    game.attachScheduler(registry, rewardGate);
    game.recordFocusStepReport(report('f1', 8, 10));
    expect(focusBag.getFocusWeights().get('f1')).toBeGreaterThan(0.5);
    const gate2 = setup(0.5);
    const r2 = new LearnerRegistry();
    r2.register(new SchedulerAdapter(gate2.focusBag));
    gate2.game.attachScheduler(r2, new SelfRewardGate());
    gate2.game.recordFocusStepReport(report('f1', 0, 0));
    expect(gate2.focusBag.getFocusWeights().get('f1')).toBe(0.5);
  });
  it('unattached game is a no-op; firewall marks self-reward proposal-bound', () => {
    const { focusBag, game } = setup(0.5);
    game.recordFocusStepReport(report('f1', 8, 10));
    expect(focusBag.getFocusWeights().get('f1')).toBe(0.5);
    const check = new SelfRewardGate().process({
        eventId: '00000000-0000-4000-8000-000000000000', rewardSignal: 0.5, rewardType: 'intrinsic',
        targetType: 'policy-weights', targetId: 'f1', domain: 'self-scheduler',
    });
    expect(check).toMatchObject({ accepted: true, mutationApplied: false, requiresProposal: true });
    expect(SelfMetaGameImpl.schedulerReward(report('f1', 0, 0))).toBe(0);
  });
});
