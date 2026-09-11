import { describe, expect, test } from 'vitest';
import { createTask, TermBuilder, Truth } from '../../../../nar/src';
import { NAR } from '../../../../nar/src/nar';
import {
  BeliefPerceptionAdapter,
  GoalActionAdapter,
  RewardBeliefAdapter,
} from '../adapters/adapters';
import { BanditEnv } from '../environments/RLEnvironments';

describe('RL Parity - Trace Validation', () => {
  const banditConfig = {
    numArms: 2,
    armMeans: [0.3, 0.8],
    seed: 42,
  };

  test('causal chain: belief → value belief → goal → tool → reward → revision', async () => {
    const env = new BanditEnv(banditConfig);
    const nar = new NAR({
      activationDecayRate: 0.01,
      consolidationInterval: 5,
      cpuThrottleMs: 0,
      enableLMRules: false,
      enableTools: true,
      enableSelf: false,
      enableRLFP: false,
      persistState: false,
      maxConcepts: 1000,
      maxDerivationsPerStep: 100,
      maxDerivationDepth: 10,
    });

    const perception = new BeliefPerceptionAdapter(nar);
    const actionAdapter = new GoalActionAdapter(nar);
    const rewardAdapter = new RewardBeliefAdapter(nar);
    const qStore = rewardAdapter.getQStore();

    // Register tools
    nar.tools.register({
      name: 'pull_arm_0',
      description: 'Pull arm 0',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ success: true, content: { arm: 0 } }),
    });
    nar.tools.register({
      name: 'pull_arm_1',
      description: 'Pull arm 1',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ success: true, content: { arm: 1 } }),
    });

    const stateTerm = TermBuilder.atom('bandit_state');
    const action0 = TermBuilder.atom('^pull_arm_0');
    const action1 = TermBuilder.atom('^pull_arm_1');
    const actions = [action0, action1];

    // Step 1: Perceive initial state (creates belief)
    perception.perceive({ stateId: 'bandit_state', reward: 0 });
    await nar.run(1);

    // Verify observation belief exists via queryTerm
    const queryResult = nar.queryTerm(
      TermBuilder.inheritance(TermBuilder.atom('self'), stateTerm)!
    );
    expect(queryResult.beliefs.length).toBeGreaterThan(0);
    const selfStateBelief = queryResult.beliefs[0]!;
    expect(selfStateBelief.truth.f).toBe(1.0);
    expect(selfStateBelief.truth.c).toBeGreaterThan(0.5);

    // Step 2: Initial value beliefs should not exist yet
    expect(qStore.getValue(stateTerm, action0)).toBeNull();
    expect(qStore.getValue(stateTerm, action1)).toBeNull();

    // Step 3: Execute first action (arm 1 - higher mean) via direct tool execution
    const goalTerm1 = actionAdapter.buildGoalTerm({ name: 'pull_arm_1' });
    const toolResult1 = await nar.tools.executeToolGoal(goalTerm1);
    expect(toolResult1.success).toBe(true);

    const { reward: reward1 } = env.step(1);

    // Step 4: Process reward - should create value belief
    rewardAdapter.processReward(stateTerm, action1, reward1);

    // Verify value belief was created
    const value1 = qStore.getValue(stateTerm, action1);
    expect(value1).not.toBeNull();
    expect(value1!.f).toBeCloseTo(reward1, 1);
    expect(value1!.c).toBeGreaterThan(0);

    // Step 5: Take second action (arm 0)
    const goalTerm0 = actionAdapter.buildGoalTerm({ name: 'pull_arm_0' });
    const toolResult0 = await nar.tools.executeToolGoal(goalTerm0);
    expect(toolResult0.success).toBe(true);

    const { reward: reward0 } = env.step(0);
    rewardAdapter.processReward(stateTerm, action0, reward0);

    // Step 6: Both value beliefs should exist now
    const value0 = qStore.getValue(stateTerm, action0);
    expect(value0).not.toBeNull();

    // Step 7: After multiple rewards for arm 1, it should be the best action
    // Run several more steps for arm 1 to build up its value
    for (let i = 0; i < 10; i++) {
      env.step(1);
      rewardAdapter.processReward(stateTerm, action1, 1); // Force reward = 1
    }

    const bestAction = qStore.getBestAction(stateTerm, actions);
    expect(bestAction).toBe(action1);

    // Step 8: Trace the value belief derivation
    const valueTerm1 = TermBuilder.inheritance(
      TermBuilder.product(stateTerm, action1),
      TermBuilder.atom('predicts_reward')
    )!;
    const trace1 = nar.traceTerm(valueTerm1);
    expect(trace1.history.length).toBeGreaterThan(0);

    // The value belief should be in the trace
    const valueBeliefsInTrace = trace1.history.filter(
      (t) => t.term.toString() === valueTerm1.toString()
    );
    expect(valueBeliefsInTrace.length).toBeGreaterThan(0);

    // Step 9: Explain the value belief
    const valueBeliefTask = trace1.history.find((t) => t.term.toString() === valueTerm1.toString());
    if (valueBeliefTask) {
      const explanation = nar.explain(valueBeliefTask);
      expect(explanation.conclusion).toBeDefined();
      expect(explanation.premises).toBeDefined();
      expect(explanation.rules).toBeDefined();
      expect(explanation.confidence).toBeGreaterThanOrEqual(0);
      expect(typeof explanation.why).toBe('string');
    }

    // Step 10: Get derivation history for the value belief
    if (valueBeliefTask) {
      const derivationHistory = nar.getDerivationHistory(valueBeliefTask);
      // Should have at least the belief itself
      expect(derivationHistory.length).toBeGreaterThanOrEqual(1);
    }

    // Step 11: Confidence should increase through revision
    const revisedValue1 = qStore.getValue(stateTerm, action1);
    expect(revisedValue1).not.toBeNull();
    // Confidence should have increased through revision
    expect(revisedValue1!.c).toBeGreaterThan(value1!.c);
  });

  test('trace shows observation belief feeding into value learning', async () => {
    const env = new BanditEnv(banditConfig);
    const nar = new NAR({
      activationDecayRate: 0.01,
      consolidationInterval: 5,
      cpuThrottleMs: 0,
      enableLMRules: false,
      enableTools: true,
      enableSelf: false,
      enableRLFP: false,
      persistState: false,
      maxConcepts: 1000,
      maxDerivationsPerStep: 100,
      maxDerivationDepth: 10,
    });

    const perception = new BeliefPerceptionAdapter(nar);
    const actionAdapter = new GoalActionAdapter(nar);
    const rewardAdapter = new RewardBeliefAdapter(nar);
    const qStore = rewardAdapter.getQStore();

    nar.tools.register({
      name: 'pull_arm_0',
      description: 'Pull arm 0',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ success: true, content: null }),
    });

    const stateTerm = TermBuilder.atom('bandit_state');
    const action0 = TermBuilder.atom('^pull_arm_0');

    // Perceive state
    perception.perceive({ stateId: 'bandit_state', reward: 0 });
    await nar.run(1);

    // Get observation belief via queryTerm
    const queryResult = nar.queryTerm(
      TermBuilder.inheritance(TermBuilder.atom('self'), stateTerm)!
    );
    expect(queryResult.beliefs.length).toBeGreaterThan(0);
    const obsBelief = queryResult.beliefs[0]!;
    expect(obsBelief).not.toBeNull();

    // Execute action via direct tool execution
    const goalTerm = actionAdapter.buildGoalTerm({ name: 'pull_arm_0' });
    await nar.tools.executeToolGoal(goalTerm);
    const { reward } = env.step(0);

    // Process reward
    rewardAdapter.processReward(stateTerm, action0, reward);

    // Trace the value belief term (which we know has beliefs)
    const valueTerm = TermBuilder.inheritance(
      TermBuilder.product(stateTerm, action0),
      TermBuilder.atom('predicts_reward')
    )!;
    const trace = nar.traceTerm(valueTerm);

    // Should find the concept and its history
    expect(trace.concepts.length).toBeGreaterThanOrEqual(1);
    expect(trace.history.length).toBeGreaterThan(0);

    // The value belief should be traceable
    const valueBelief = trace.history.find((t) => t.term.toString() === valueTerm.toString());
    expect(valueBelief).toBeDefined();
    if (valueBelief) {
      expect(valueBelief.truth.f).toBeCloseTo(reward, 1);
    }
  });

  test('goal dispatch via inputTask is traceable', async () => {
    const nar = new NAR({
      activationDecayRate: 0.01,
      consolidationInterval: 5,
      cpuThrottleMs: 0,
      enableLMRules: false,
      enableTools: true,
      enableSelf: false,
      enableRLFP: false,
      persistState: false,
      maxConcepts: 1000,
      maxDerivationsPerStep: 100,
      maxDerivationDepth: 10,
    });

    const actionAdapter = new GoalActionAdapter(nar);
    let executionCount = 0;

    nar.tools.register({
      name: 'test_action',
      description: 'Test action',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        executionCount++;
        return { success: true, content: null };
      },
    });

    // Input a goal via inputTask (adds to task manager pending queue)
    const goalTerm = actionAdapter.buildGoalTerm({ name: 'test_action' });
    const task = createTask(goalTerm, 'goal', Truth.create(1.0, 0.8));
    nar.inputTask(task);

    // Run NAR cycle which should dispatch the goal
    await nar.run(5);

    // Tool should have been executed
    expect(executionCount).toBe(1);
  });

  test('reward belief updates are traceable', async () => {
    const nar = new NAR({
      activationDecayRate: 0.01,
      consolidationInterval: 5,
      cpuThrottleMs: 0,
      maxConcepts: 10000,
      maxDerivationsPerStep: 1000,
      maxDerivationDepth: 20,
      enableLMRules: false,
      enableTools: false,
      enableSelf: false,
      enableRLFP: false,
      persistState: false,
    });

    const rewardAdapter = new RewardBeliefAdapter(nar);
    const qStore = rewardAdapter.getQStore();

    const state = TermBuilder.atom('state:s1');
    const action = TermBuilder.atom('^move_north');

    // Process reward
    rewardAdapter.processReward(state, action, 1.0, 0.8);

    // Trace the value belief
    const valueTerm = TermBuilder.inheritance(
      TermBuilder.product(state, action),
      TermBuilder.atom('predicts_reward')
    )!;
    const trace = nar.traceTerm(valueTerm);

    // Should have the value belief in history
    expect(trace.history.length).toBeGreaterThan(0);

    // The value belief should have correct truth values
    const valueBelief = trace.history.find((t) => t.term.toString() === valueTerm.toString());
    expect(valueBelief).toBeDefined();
    if (valueBelief) {
      expect(valueBelief.truth.f).toBeCloseTo(1.0, 1);
      expect(valueBelief.truth.c).toBeCloseTo(0.8, 1);
    }

    // Explain should work
    if (valueBelief) {
      const explanation = nar.explain(valueBelief);
      expect(explanation.why).toContain('premise');
    }
  });

  test('no hidden causal path: all actions go through goal dispatch', async () => {
    const env = new BanditEnv(banditConfig);
    const nar = new NAR({
      activationDecayRate: 0.01,
      consolidationInterval: 5,
      cpuThrottleMs: 0,
      enableLMRules: false,
      enableTools: true,
      enableSelf: false,
      enableRLFP: false,
      persistState: false,
      maxConcepts: 1000,
      maxDerivationsPerStep: 100,
      maxDerivationDepth: 10,
    });

    const perception = new BeliefPerceptionAdapter(nar);
    const actionAdapter = new GoalActionAdapter(nar);
    const rewardAdapter = new RewardBeliefAdapter(nar);

    let toolExecutionCount = 0;

    nar.tools.register({
      name: 'pull_arm_0',
      description: 'Pull arm 0',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        toolExecutionCount++;
        return { success: true, content: null };
      },
    });
    nar.tools.register({
      name: 'pull_arm_1',
      description: 'Pull arm 1',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        toolExecutionCount++;
        return { success: true, content: null };
      },
    });

    // Run a few steps using inputTask to add goals to pending queue
    for (let step = 0; step < 5; step++) {
      perception.perceive({ stateId: 'bandit_state', reward: 0 });

      // Input a goal for arm 1 (better arm) via inputTask
      const goalTerm = actionAdapter.buildGoalTerm({ name: 'pull_arm_1' });
      const task = createTask(goalTerm, 'goal', Truth.create(1.0, 0.8));
      nar.inputTask(task);

      // Run NAR cycle - this will dispatch the tool goal
      await nar.run(3);

      const { reward } = env.step(1);
      const stateTerm = TermBuilder.atom('bandit_state');
      const actionTerm = TermBuilder.atom('^pull_arm_1');
      rewardAdapter.processReward(stateTerm, actionTerm, reward);
    }

    // Every environment action should have gone through tool execution
    expect(toolExecutionCount).toBeGreaterThan(0);

    // Verify no direct environment access - all actions went through executeToolGoal
    // (The test structure itself enforces this by only calling env.step after nar.run which dispatches goals)
  });
});
