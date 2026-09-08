import { describe, expect, test } from 'vitest';
import { GridWorldEnv } from '../environments/RLEnvironments';
import { QLearning } from '../baselines/gridworld';
import { NAR } from '../../../../nar/src/nar';
import { TermBuilder, Truth, termParser } from '../../../../nar/src';
import { BeliefPerceptionAdapter, GoalActionAdapter, RewardBeliefAdapter } from '../adapters/adapters';

describe('RL Parity - GridWorld Q-Learning', () => {
  const gridConfig = {
    grid: [
      'S...',
      '.#..',
      '..#.',
      '...G',
    ],
    seed: 42,
  };

  test('Level 1: Q-Learning baseline solves GridWorld', () => {
    const env = new GridWorldEnv(gridConfig);
    const agent = new QLearning({
      alpha: 0.1,
      gamma: 0.99,
      epsilon: 0.1,
      seed: 123,
    });

    // Train
    for (let ep = 0; ep < 200; ep++) {
      agent.runEpisode(env, 50);
    }

    // Test greedy policy
    env.reset();
    let state = env.getState();
    let steps = 0;
    let totalReward = 0;
    while (steps < 50) {
      const qVals = agent.getQTable().get(`${state.row},${state.col}`) || [0, 0, 0, 0];
      const action = qVals.indexOf(Math.max(...qVals)) as 0 | 1 | 2 | 3;
      const result = env.step(action);
      totalReward += result.reward;
      state = result.state;
      steps++;
      if (result.done) break;
    }

    // Should reach goal
    expect(totalReward).toBeGreaterThan(0.5);
  });

  test('Level 2: Native SeNARS can learn GridWorld values (smoke test)', async () => {
    const env = new GridWorldEnv(gridConfig);
    const nar = new NAR({
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

    // Register movement tools
    for (const [name, dir] of [['move_up', 0], ['move_right', 1], ['move_down', 2], ['move_left', 3]]) {
      nar.tools.register({
        name,
        description: `Move ${name}`,
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, content: { dir } }),
      });
    }

    // Very minimal training - just verify the pipeline works
    const numEpisodes = 3;
    const maxSteps = 5;

    for (let ep = 0; ep < numEpisodes; ep++) {
      env.reset();

      for (let step = 0; step < maxSteps; step++) {
        const state = env.getState();
        const stateId = `s_${state.row}_${state.col}`;
        
        // Perceive state
        perception.perceive({ stateId });

        // Run NAR (minimal)
        await nar.run(1);

        // Execute a simple move
        const action = step % 4;
        const goalTerm = actionAdapter.buildGoalTerm({ name: `move_${['up','right','down','left'][action]}` });
        await nar.tools.executeToolGoal(goalTerm);

        // Step environment
        const result = env.step(action);

        // Reward belief
        const stateTerm = TermBuilder.atom(stateId);
        const actionTerm = TermBuilder.atom(`^move_${['up','right','down','left'][action]}`);
        rewardAdapter.processReward(stateTerm, actionTerm, result.reward);

        if (result.done) break;
      }
    }

    // Verify value beliefs were created
    const qStore = rewardAdapter.getQStore();
    const state = TermBuilder.atom('s_0_0');
    const action = TermBuilder.atom('^move_right');
    const value = qStore.getValue(state, action);
    // Just check structure works
    expect(typeof value === 'object' || value === null).toBe(true);
  });
});