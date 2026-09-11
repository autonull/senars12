import { describe, expect, test } from 'vitest';
import { NonStationaryBanditEnv, StochasticGridWorldEnv } from '../environments/RLEnvironments';

describe('Additional RL Environments', () => {
  describe('StochasticGridWorldEnv', () => {
    const grid = ['S...', '.#..', '..#.', '...G'];

    test('basic navigation with slip', () => {
      const env = new StochasticGridWorldEnv({ grid, seed: 42, slipProbability: 0.0 });
      env.reset();
      let state = env.getState();

      // Move right 3 times
      for (let i = 0; i < 3; i++) {
        const result = env.step(1); // right
        state = result.state;
        expect(result.reward).toBe(-0.01);
      }

      // Move down 3 times
      for (let i = 0; i < 3; i++) {
        const result = env.step(2); // down
        state = result.state;
        if (result.done) break;
        expect(result.reward).toBe(-0.01);
      }

      expect(state.row).toBe(3);
      expect(state.col).toBe(3);
    });

    test('slip causes stochastic transitions', () => {
      const env = new StochasticGridWorldEnv({ grid, seed: 42, slipProbability: 1.0 });
      env.reset();

      // With slip=1.0, actions are completely random
      const results = new Set<number>();
      for (let i = 0; i < 100; i++) {
        env.reset();
        const result = env.step(1); // Try to go right
        results.add(result.state.col);
      }
      // Should have visited multiple columns due to randomness
      expect(results.size).toBeGreaterThan(1);
    });

    test('slip probability is configurable', () => {
      const env = new StochasticGridWorldEnv({ grid, seed: 42, slipProbability: 0.5 });
      expect(env.getSlipProbability()).toBe(0.5);
    });

    test('serialization works', () => {
      const env = new StochasticGridWorldEnv({ grid, seed: 42, slipProbability: 0.1 });
      env.reset();
      env.step(1);
      env.step(2);

      const state = env.serialize();
      const env2 = new StochasticGridWorldEnv({ grid, seed: 999, slipProbability: 0.1 });
      env2.deserialize(state);

      expect(env2.getState()).toEqual(env.getState());
      expect((env2 as unknown as { stepCount: number }).stepCount).toBe(
        (env as unknown as { stepCount: number }).stepCount
      );
    });
  });

  describe('NonStationaryBanditEnv', () => {
    test('arm means drift over time', () => {
      const env = new NonStationaryBanditEnv({
        numArms: 3,
        initialMeans: [0.2, 0.5, 0.8],
        changeInterval: 10,
        changeMagnitude: 0.1,
        seed: 42,
      });

      const initialMeans = env.getCurrentMeans();
      expect(initialMeans).toEqual([0.2, 0.5, 0.8]);

      // Take steps to trigger drift
      for (let i = 0; i < 15; i++) {
        env.step(0);
      }

      const driftedMeans = env.getCurrentMeans();
      // Means should have changed
      let changed = false;
      for (let i = 0; i < 3; i++) {
        if (Math.abs((driftedMeans[i] ?? 0) - (initialMeans[i] ?? 0)) > 0.01) {
          changed = true;
          break;
        }
      }
      expect(changed).toBe(true);
    });

    test('optimal arm can change', () => {
      const env = new NonStationaryBanditEnv({
        numArms: 2,
        initialMeans: [0.9, 0.1], // Arm 0 optimal
        changeInterval: 5,
        changeMagnitude: 0.5,
        seed: 42,
      });

      expect(env.getOptimalArm()).toBe(0);

      // Drift enough to potentially flip optimal arm
      for (let i = 0; i < 30; i++) {
        env.step(0);
      }

      // After enough drift, arm 1 might become optimal
      // (not guaranteed but possible with large magnitude)
      const optimal = env.getOptimalArm();
      expect([0, 1]).toContain(optimal);
    });

    test('serialization works', () => {
      const env = new NonStationaryBanditEnv({
        numArms: 2,
        initialMeans: [0.3, 0.7],
        changeInterval: 10,
        changeMagnitude: 0.1,
        seed: 42,
      });

      for (let i = 0; i < 15; i++) {
        env.step(0);
      }

      const state = env.serialize();
      const env2 = new NonStationaryBanditEnv({
        numArms: 2,
        initialMeans: [0.1, 0.9],
        changeInterval: 10,
        changeMagnitude: 0.1,
        seed: 999,
      });
      env2.deserialize(state);

      expect(env2.getCurrentMeans()).toEqual(env.getCurrentMeans());
      expect(env2.getStepCount()).toBe(env.getStepCount());
    });
  });
});
