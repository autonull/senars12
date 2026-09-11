import { describe, expect, test } from 'vitest';
import { BanditEnv, GridWorldEnv } from '../environments/RLEnvironments';
import { EpsilonGreedy, UCB1 } from './bandit';
import { QLearning, SARSA } from './gridworld';

describe('Baseline RL Algorithms - Independent of SeNARS', () => {
  describe('Bandit Baselines', () => {
    test('Epsilon-Greedy solves 2-armed bandit', () => {
      const env = new BanditEnv({
        numArms: 2,
        armMeans: [0.3, 0.8], // Arm 1 is optimal
        seed: 42,
      });
      const agent = new EpsilonGreedy({ numArms: 2, epsilon: 0.1, seed: 123 });

      const rewards: number[] = [];
      for (let ep = 0; ep < 500; ep++) {
        env.reset();
        const r = agent.runEpisode(env, 100);
        rewards.push(r);
      }

      // Should learn to prefer arm 1
      const counts = agent.getCounts();
      expect(counts[1]!).toBeGreaterThan(counts[0]!);
      // Average reward should be close to optimal arm mean (0.8)
      const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
      expect(avgReward).toBeGreaterThan(0.6);
    });

    test('UCB1 solves 2-armed bandit', () => {
      const env = new BanditEnv({
        numArms: 2,
        armMeans: [0.2, 0.7],
        seed: 42,
      });
      const agent = new UCB1({ numArms: 2, c: 2.0, seed: 123 });

      const rewards: number[] = [];
      for (let ep = 0; ep < 500; ep++) {
        env.reset();
        const r = agent.runEpisode(env, 100);
        rewards.push(r);
      }

      const counts = agent.getCounts();
      expect(counts[1]!).toBeGreaterThan(counts[0]!);
      const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
      expect(avgReward).toBeGreaterThan(0.5);
    });

    test('Epsilon-Greedy is deterministic with same seed', () => {
      const env1 = new BanditEnv({ numArms: 3, armMeans: [0.1, 0.5, 0.9], seed: 1 });
      const agent1 = new EpsilonGreedy({ numArms: 3, epsilon: 0.1, seed: 1 });

      const env2 = new BanditEnv({ numArms: 3, armMeans: [0.1, 0.5, 0.9], seed: 1 });
      const agent2 = new EpsilonGreedy({ numArms: 3, epsilon: 0.1, seed: 1 });

      for (let i = 0; i < 50; i++) {
        env1.reset();
        env2.reset();
        const a1 = agent1.selectAction();
        const a2 = agent2.selectAction();
        expect(a1).toBe(a2);
      }
    });

    test('Epsilon-Greedy state serialization works', () => {
      const env = new BanditEnv({ numArms: 2, armMeans: [0.3, 0.8], seed: 42 });
      const agent = new EpsilonGreedy({ numArms: 2, epsilon: 0.1, seed: 123 });

      agent.runEpisode(env, 50);
      const state = agent.getState();

      const agent2 = new EpsilonGreedy({ numArms: 2, epsilon: 0.1, seed: 999 });
      agent2.setState(state);

      expect(agent2.getQValues()).toEqual(agent.getQValues());
      expect(agent2.getCounts()).toEqual(agent.getCounts());
    });
  });

  describe('GridWorld Baselines', () => {
    const gridConfig = {
      grid: ['S...', '.#..', '..#.', '...G'],
      seed: 42,
    };

    test('Q-Learning solves deterministic GridWorld', () => {
      const env = new GridWorldEnv(gridConfig);
      const agent = new QLearning({
        alpha: 0.1,
        gamma: 0.99,
        epsilon: 0.1,
        seed: 123,
      });

      // Train
      for (let ep = 0; ep < 500; ep++) {
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

      // Should reach goal (reward ~1)
      expect(totalReward).toBeGreaterThan(0.5);
    });

    test('SARSA solves deterministic GridWorld', () => {
      const env = new GridWorldEnv(gridConfig);
      const agent = new SARSA({
        alpha: 0.1,
        gamma: 0.99,
        epsilon: 0.1,
        seed: 123,
      });

      for (let ep = 0; ep < 500; ep++) {
        agent.runEpisode(env, 50);
      }

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

      expect(totalReward).toBeGreaterThan(0.5);
    });

    test('Q-Learning is deterministic with same seed', () => {
      const env1 = new GridWorldEnv(gridConfig);
      const agent1 = new QLearning({ alpha: 0.1, gamma: 0.99, epsilon: 0.1, seed: 42 });

      const env2 = new GridWorldEnv(gridConfig);
      const agent2 = new QLearning({ alpha: 0.1, gamma: 0.99, epsilon: 0.1, seed: 42 });

      for (let ep = 0; ep < 20; ep++) {
        env1.reset();
        env2.reset();
        const r1 = agent1.runEpisode(env1, 20);
        const r2 = agent2.runEpisode(env2, 20);
        expect(r1).toBe(r2);
      }
    });

    test('Q-Learning state serialization works', () => {
      const env = new GridWorldEnv(gridConfig);
      const agent = new QLearning({ alpha: 0.1, gamma: 0.99, epsilon: 0.1, seed: 123 });

      agent.runEpisode(env, 30);
      const state = agent.getState();

      const agent2 = new QLearning({ alpha: 0.1, gamma: 0.99, epsilon: 0.1, seed: 999 });
      agent2.setState(state);

      expect(agent2.getMetrics().totalSteps).toBe(agent.getMetrics().totalSteps);
      expect(agent2.getQTable().size).toBe(agent.getQTable().size);
    });
  });
});
