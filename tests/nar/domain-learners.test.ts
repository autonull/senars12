import { describe, expect, it } from 'vitest';
import { ConfigOptimizer, CrossDomainError, LearnerRegistry, PatchSelector, PreferenceRanker, ReflexLearner, SchedulerAdapter } from '../../nar/src/learning/domain-learners.js';
import { SelfRewardGate } from '../../nar/src/kernel/KernelRewardGate.js';
import { FocusBag } from '../../nar/src/focus/FocusBag.js';
import { Focus } from '../../nar/src/focus/Focus.js';

const focusBagWith = (id: string, weight: number): FocusBag => {
    const bag = new FocusBag({ capacity: 10 });
    bag.add(new Focus({ id, weight }));
    return bag;
};

describe('todo7: domain-scoped learners', () => {
  it('cross-domain events rejected', () => {
    const adapter = new SchedulerAdapter(new FocusBag({ capacity: 10 }));
    expect(() => adapter.learn({ domain: 'external-reflex', reward: 1 })).toThrow(CrossDomainError);
    expect(() => new LearnerRegistry().dispatch({ domain: 'self-scheduler', reward: 1 })).toThrow(CrossDomainError);
  });
  it('ReflexLearner delegates to reflex; registry dispatches by domain', () => {
    const seen: number[] = [];
    const learner = new ReflexLearner({ id: 'r', propose: () => [], learn: (e) => { seen.push(e.reward); } });
    const registry = new LearnerRegistry();
    registry.register(learner);
    registry.register(new SchedulerAdapter(new FocusBag({ capacity: 10 })));
    registry.dispatch({ domain: 'external-reflex', reward: 0.7 });
    expect(seen).toEqual([0.7]);
  });
  it('SchedulerAdapter nudges focus weight toward reward sign', () => {
    const bag = focusBagWith('f1', 0.5);
    const adapter = new SchedulerAdapter(bag, 0.1);
    adapter.learn({ domain: 'self-scheduler', reward: 1, focusId: 'f1' });
    expect(bag.getFocusWeights().get('f1')).toBeCloseTo(0.6);
    adapter.learn({ domain: 'self-scheduler', reward: -1, focusId: 'f1' });
    expect(bag.getFocusWeights().get('f1')).toBeCloseTo(0.5);
  });
  it('PreferenceRanker orders by mean reward', () => {
    const ranker = new PreferenceRanker();
    ranker.learn({ domain: 'self-explanation-rank', reward: 0.2, key: 'a' });
    ranker.learn({ domain: 'self-explanation-rank', reward: 0.9, key: 'b' });
    ranker.learn({ domain: 'self-explanation-rank', reward: 0.8, key: 'b' });
    expect(ranker.rank()).toEqual(['b', 'a']);
  });
  it('ConfigOptimizer/PatchSelector emit proposals, never direct mutation', () => {
    const gate = new SelfRewardGate();
    const knob = new ConfigOptimizer(gate).suggestKnob('taskDecayRate', 0.02);
    expect(knob).toMatchObject({ kind: 'knob-tune', riskTier: 'medium' });
    const patch = new PatchSelector(gate).scorePatch('refs/shadow/fix-1', 0.9);
    expect(patch).toMatchObject({ kind: 'patch-apply', riskTier: 'high' });
    expect(gate.pending()).toHaveLength(2);
  });
});
