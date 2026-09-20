import { describe, expect, test } from 'vitest';
import { BanditGame } from '../../../nar/src/game/BanditGame.js';
import { GridWorldGame } from '../../../nar/src/game/GridWorldGame.js';

describe('Games (DQ2: Game is the only environment interface)', () => {
  describe('GridWorldGame slip', () => {
    const grid = ['S...', '.#..', '..#.', '...G'];

    test('basic navigation with slipProbability 0', () => {
      const game = new GridWorldGame({ grid, seed: 42, slipProbability: 0 });
      game.reset();
      let state = game.state();

      for (let i = 0; i < 3; i++) {
        const result = game.step(1); // right
        state = game.state();
        expect(result.reward).toBe(-0.01);
      }

      for (let i = 0; i < 3; i++) {
        const result = game.step(2); // down
        state = game.state();
        if (result.terminal) break;
        expect(result.reward).toBe(-0.01);
      }

      expect(state.row).toBe(3);
      expect(state.col).toBe(3);
    });

    test('slip causes stochastic transitions', () => {
      const game = new GridWorldGame({ grid, seed: 42, slipProbability: 1.0 });

      const results = new Set<number>();
      for (let i = 0; i < 100; i++) {
        game.reset();
        game.step(1); // Try to go right
        results.add(game.state().col);
      }
      expect(results.size).toBeGreaterThan(1);
    });

    test('slip probability is configurable', () => {
      const game = new GridWorldGame({ grid, seed: 42, slipProbability: 0.5 });
      expect(game.getSlipProbability()).toBe(0.5);
    });

    test('deterministic with same seed and zero slip', () => {
      const a = new GridWorldGame({ grid, seed: 7, slipProbability: 0 });
      const b = new GridWorldGame({ grid, seed: 7, slipProbability: 0 });
      const outcomeA = [a.step(1), a.step(2), a.step(1)];
      const outcomeB = [b.step(1), b.step(2), b.step(1)];
      expect(outcomeA.map((o) => o.reward)).toEqual(outcomeB.map((o) => o.reward));
      expect(a.state()).toEqual(b.state());
    });
  });

  describe('BanditGame drift', () => {
    test('arm means drift over time', () => {
      const game = new BanditGame({
        numArms: 3,
        armMeans: [0.2, 0.5, 0.8],
        drift: { changeInterval: 10, changeMagnitude: 0.1 },
        seed: 42,
      });

      const initialMeans = game.getCurrentMeans();
      expect(initialMeans).toEqual([0.2, 0.5, 0.8]);

      for (let i = 0; i < 15; i++) {
        game.step(0);
      }

      const driftedMeans = game.getCurrentMeans();
      const changed = driftedMeans.some((m: number, i: number) => Math.abs(m - (initialMeans[i] ?? 0)) > 0.01);
      expect(changed).toBe(true);
    });

    test('optimal arm can change', () => {
      const game = new BanditGame({
        numArms: 2,
        armMeans: [0.9, 0.1],
        drift: { changeInterval: 5, changeMagnitude: 0.5 },
        seed: 42,
      });

      expect(game.getOptimalArm()).toBe(0);

      for (let i = 0; i < 30; i++) {
        game.step(0);
      }

      expect([0, 1]).toContain(game.getOptimalArm());
    });

    test('stationary bandit never drifts', () => {
      const game = new BanditGame({ numArms: 2, armMeans: [0.3, 0.7], seed: 1 });
      for (let i = 0; i < 50; i++) {
        game.step(0);
      }
      expect(game.getCurrentMeans()).toEqual([0.3, 0.7]);
    });

    test('deterministic with same seed', () => {
      const a = new BanditGame({ numArms: 2, armMeans: [0.3, 0.7], seed: 9 });
      const b = new BanditGame({ numArms: 2, armMeans: [0.3, 0.7], seed: 9 });
      const ra = [a.step(0).reward, a.step(1).reward, a.step(0).reward];
      const rb = [b.step(0).reward, b.step(1).reward, b.step(0).reward];
      expect(ra).toEqual(rb);
    });
  });
});
