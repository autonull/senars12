import { describe, expect, it } from 'vitest';
import { createNAR } from '@senars/nar';
import { Truth } from '@senars/nar/terms/impls/Truth.js';

describe('M5: Reward → Policy Learning', () => {
  it('reward changes a policy observable, never Truth', async () => {
    const nar = await createNAR({
      enableRLFP: true,
      rlfp: { optimizeInterval: 5 }, // Optimize every 5 cycles for test
      maxConcepts: 1000,
      maxTasks: 5000,
    });

    await nar.start();

    const learner = nar.getRLFP();
    expect(learner).toBeDefined();

    if (!learner) {
      await nar.dispose();
      return;
    }

    // Pin a belief to verify epistemic firewall holds
    const pinnedTerm = '(pinned --> belief)';
    await nar.believe(`${pinnedTerm}. %0.8;0.9%`);
    const beliefs = nar.getBeliefs();
    const pinnedBelief = beliefs.find(b => b.term.toString() === pinnedTerm);
    const originalTruth = pinnedBelief?.truth;

    // Record baseline strategy priority (policy observable)
    const beforeStats = learner.policyOptimizerPublic.getStrategyStats('user_feedback');
    expect(beforeStats).not.toBeNull();
    const beforePriority = beforeStats!.priority ?? 1.0;

    // Provide multiple negative reward signals (simulating bad outcomes)
    // Need at least 10 for PolicyOptimizer to optimize
    for (let i = 0; i < 12; i++) {
      await nar.reward(-0.5, `negative-outcome-${i}`);
    }

    // Run cycles to allow policy optimization (optimizeInterval=5, so 20 cycles = 4 optimizations)
    await nar.run(20);

    // Check that strategy priority changed (policy moved)
    const afterStats = learner.policyOptimizerPublic.getStrategyStats('user_feedback');
    expect(afterStats).not.toBeNull();
    const afterPriority = afterStats!.priority ?? 1.0;
    expect(afterPriority).not.toBe(beforePriority);

    // Verify epistemic firewall: pinned belief's truth unchanged by reward path
    const beliefsAfter = nar.getBeliefs();
    const pinnedBeliefAfter = beliefsAfter.find(b => b.term.toString() === pinnedTerm);
    expect(pinnedBeliefAfter?.truth).toEqual(originalTruth);

    await nar.dispose();
  });

  it('positive reward also moves policy', async () => {
    const nar = await createNAR({
      enableRLFP: true,
      rlfp: { optimizeInterval: 5 }, // Optimize every 5 cycles for test
      maxConcepts: 1000,
      maxTasks: 5000,
    });

    await nar.start();

    const learner = nar.getRLFP();
    expect(learner).toBeDefined();

    if (!learner) {
      await nar.dispose();
      return;
    }

    const beforeStats = learner.policyOptimizerPublic.getStrategyStats('user_feedback');
    expect(beforeStats).not.toBeNull();
    const beforePriority = beforeStats!.priority ?? 1.0;

    // Provide multiple positive reward signals (must be > 0.8 to trigger priority increase)
    for (let i = 0; i < 12; i++) {
      await nar.reward(0.9, `positive-outcome-${i}`);
    }

    // Run cycles to allow policy optimization
    await nar.run(20);

    const afterStats = learner.policyOptimizerPublic.getStrategyStats('user_feedback');
    expect(afterStats).not.toBeNull();
    const afterPriority = afterStats!.priority ?? 1.0;
    expect(afterPriority).not.toBe(beforePriority);

    await nar.dispose();
  });

  it('reward gate rejects truth-confidence targets (epistemic firewall)', async () => {
    const nar = await createNAR({
      enableRLFP: true,
      maxConcepts: 1000,
      maxTasks: 5000,
    });

    await nar.start();

    const rewardGate = nar.gates.getRewardGate();
    expect(rewardGate).toBeDefined();

    // Attempt to target truth-confidence should be rejected
    const result = rewardGate.process({
      eventId: 'test-firewall',
      rewardSignal: 0.5,
      rewardType: 'extrinsic',
      targetType: 'truth-confidence',
      targetId: 'some-belief',
      domain: 'external-reflex',
    });

    expect(result.accepted).toBe(false);
    expect(result.epistemicFirewallViolation).toBe(true);

    await nar.dispose();
  });
});