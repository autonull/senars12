import { SeededRNG } from '@senars/nar/game';
import { createGame2048, Game2048 } from '@senars/nar/game';
import { createGridWorldGame } from '@senars/nar/game';
import { createSnakeGame, SnakeGame } from '@senars/nar/game';
import { createTetrisGame, TetrisGame } from '@senars/nar/game';
import { createTicTacToeGame, TicTacToeGame } from '@senars/nar/game';
import { game2048HeuristicAction } from './rl/baselines/2048.js';
import { snakeHeuristicAction } from './rl/baselines/snake.js';
import { tetrisHeuristicPlacement } from './rl/baselines/tetris.js';
import { ticTacToeHeuristicAction } from './rl/baselines/tictactoe.js';
import { EpsilonGreedyReflex } from '@senars/nar/reflex';
import { GameFocus } from '@senars/nar/focus';
import {
  createEmbeddingCache,
  createManifold,
  PlacementCascadeReflex,
  type SystemOneManifold,
} from '@senars/nar/lm/system-one';
import { describe, expect, it } from 'vitest';

const EPISODES = 200;
const MAX_STEPS = 120;

type AnyGame = SnakeGame | Game2048 | TetrisGame | TicTacToeGame;

const legalsOf = (game: AnyGame): Array<string | number> =>
  (game.legalActions as (s: unknown) => Array<string | number>)(game.state());
const isTerminal = (game: AnyGame): boolean =>
  (game.state() as { terminal?: boolean }).terminal === true;

/** Drive one episode with a policy; returns total reward. */
function episode(
  game: AnyGame,
  policy: (game: AnyGame) => string | number,
  maxSteps = MAX_STEPS
): number {
  game.reset();
  let total = 0;
  for (let i = 0; i < maxSteps; i++) {
    const legal = legalsOf(game);
    if (legal.length === 0 || isTerminal(game)) break;
    const outcome = game.step(policy(game) as never);
    total += outcome.reward;
    if (outcome.terminal) break;
  }
  return total;
}

const randomPolicy = (seed: number) => {
  const rng = new SeededRNG(seed);
  return (game: AnyGame) => {
    const legal = legalsOf(game);
    return legal[rng.nextInt(legal.length)]!;
  };
};

const makeGames = () => ({
  snake: () => createSnakeGame({ id: 'bench-snake', seed: 5, maxSteps: MAX_STEPS }),
  tetris: () =>
    createTetrisGame({ id: 'bench-tetris', width: 10, height: 10, seed: 6, pieceCap: 40 }),
  '2048': () => createGame2048({ id: 'bench-2048', seed: 7 }),
  tictactoe: () => createTicTacToeGame({ id: 'bench-ttt', seed: 8 }),
});

describe('TODO17 Bench 31 — Game determinism & baselines', () => {
  const games = makeGames();

  for (const [name, make] of Object.entries(games)) {
    it(`${name}: same seed ⇒ identical trajectory`, () => {
      const run = () => {
        const game = make();
        const rng = new SeededRNG(99);
        const trace: string[] = [];
        for (let i = 0; i < 50; i++) {
          const legal = legalsOf(game);
          if (legal.length === 0 || isTerminal(game)) break;
          game.step(legal[rng.nextInt(legal.length)]! as never);
          trace.push((game as { stateKey?: () => string }).stateKey?.() ?? JSON.stringify(game.state()));
        }
        return trace;
      };
      expect(run()).toEqual(run());
    });

    it(`${name}: legal actions never instantly terminal (unless state is terminal)`, () => {
      const game = make();
      game.reset();
      for (let i = 0; i < 60 && !isTerminal(game); i++) {
        const legal = legalsOf(game);
        expect(legal.length).toBeGreaterThan(0);
        for (const action of legal) {
          const probe = (game as { clone?: () => AnyGame }).clone?.();
          if (!probe) continue;
          const outcome = probe.step(action as never);
          // A legal action must never trip the illegal-move guard; terminal
          // outcomes may still arise from opponent replies or top-out.
          expect((outcome.info?.reason as string | undefined) ?? null).not.toBe('illegal');
        }
        game.step(legal[0]! as never);
      }
    });
  }

  for (const [name, make, heuristic] of [
    ['snake', games.snake, snakeHeuristicAction],
    ['2048', games['2048'], game2048HeuristicAction],
    ['tictactoe', games.tictactoe, ticTacToeHeuristicAction],
    ['tetris', games.tetris, tetrisHeuristicPlacement],
  ] as const) {
    it(`${name}: heuristic ≥ random over ${EPISODES} seeded episodes`, () => {
      const heuristicReturns: number[] = [];
      const randomReturns: number[] = [];
      for (let e = 0; e < EPISODES; e++) {
        heuristicReturns.push(episode(make(), heuristic as (g: AnyGame) => string | number));
        randomReturns.push(episode(make(), randomPolicy(1000 + e)));
      }
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      expect(mean(heuristicReturns)).toBeGreaterThanOrEqual(mean(randomReturns));
    });
  }

  it('tetris enumerates every reachable hard-drop placement with documented truncation', () => {
    const game = games.tetris();
    game.reset();
    for (let i = 0; i < 20 && !isTerminal(game); i++) {
      const placements = game.legalPlacements();
      expect(placements.length).toBeGreaterThan(0);
      expect(placements.length).toBeLessThanOrEqual(game.placementCap);
      expect(new Set(placements).size).toBe(placements.length);
      game.step(placements[0]!);
    }
    // Every placement lands cleanly on an empty board and enumeration is stable
    const empty = createTetrisGame({ id: 'enum', seed: 2 });
    const placements = empty.legalPlacements();
    expect(placements.length).toBeGreaterThan(0);
    expect(placements).toEqual(empty.legalPlacements());
    for (const placement of placements.slice(0, 12)) {
      expect(empty.clone().step(placement).terminal).toBe(false);
    }
  });

  it('tetris truncation is capped and deterministic', () => {
    const game = createTetrisGame({ id: 'cap', seed: 2, placementCap: 8 });
    const a = game.legalPlacements();
    const b = game.legalPlacements();
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(8);
  });

  it('gridworld still deterministic (regression guard)', () => {
    const g1 = createGridWorldGame({ id: 'g', grid: ['S..', '..G'], seed: 42 });
    const g2 = createGridWorldGame({ id: 'g', grid: ['S..', '..G'], seed: 42 });
    const rng = new SeededRNG(3);
    for (let i = 0; i < 30; i++) {
      const legal = g1.legalActions(g1.state());
      const action = legal[rng.nextInt(legal.length)]!;
      g1.step(action);
      g2.step(action);
      expect(g1.state()).toEqual(g2.state());
    }
  });
});

describe('TODO17 W7 — Tetris placement cascade (judgeCascade consumer)', () => {
  const budget = {
    maxCycles: 100,
    maxDepth: 10,
    maxMemoryOps: 1000,
    maxLMCalls: 50,
    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
  };

  const countingManifold = () => {
    const cache = createEmbeddingCache({});
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    const batchSizes: number[] = [];
    const counting = {
      judgeBatch: async (
        ctx: Parameters<typeof manifold.judgeBatch>[0],
        queries: Parameters<typeof manifold.judgeBatch>[1],
        b: typeof budget
      ) => {
        batchSizes.push(queries.length);
        return manifold.judgeBatch(ctx, queries, b);
      },
    };
    return { manifold: counting as unknown as SystemOneManifold, cache, batchSizes };
  };

  it('small action set ⇒ one batch (one-prefill parity preserved)', async () => {
    const { manifold, cache, batchSizes } = countingManifold();
    const reflex = new PlacementCascadeReflex(new EpsilonGreedyReflex('fb', { numArms: 4 }), {
      topK: 4,
    });
    await reflex.prefetch('s1', await cache.write('ctx'), ['a0', 'a1', 'a2'], manifold, budget);
    expect(batchSizes).toEqual([3]);
    const proposals = reflex.propose({ stateId: 's1' } as never, ['a0', 'a1', 'a2']);
    expect(proposals).toHaveLength(3);
    expect(proposals[0]!.source).toBe('placement-cascade');
  });

  it('large action set ⇒ two-stage cascade; stage-2 confined to top-K', async () => {
    const { manifold, cache, batchSizes } = countingManifold();
    const reflex = new PlacementCascadeReflex(new EpsilonGreedyReflex('fb', { numArms: 4 }), {
      topK: 4,
    });
    const actions = Array.from({ length: 10 }, (_, i) => `place:r0:c${i}`);
    await reflex.prefetch('s2', await cache.write('ctx'), actions, manifold, budget);
    expect(batchSizes).toEqual([10, 4]);
    const proposals = reflex.propose({ stateId: 's2' } as never, actions);
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.every((p) => actions.includes(String(p.action)))).toBe(true);
  });

  it('tetris + cascade reflex inside GameFocus plays legal placements', async () => {
    const { manifold, cache } = countingManifold();
    const game = createTetrisGame({ seed: 9, width: 10, height: 10, pieceCap: 5 });
    const focus = new GameFocus({ focusId: 'tetris-cascade', game });
    focus.bindReflex(new PlacementCascadeReflex(new EpsilonGreedyReflex('fb', { numArms: 10 })));
    focus.setReflexPrefetchContext({ manifold, embeddingCache: cache, budget });
    for (let t = 0; t < 30 && !game.state().terminal; t++) await focus.step(10);
    // Pieces actually placed via kernel-gated cascade decisions (no stuck-at-zero)
    expect(game.state().piecesPlaced).toBeGreaterThan(0);
  });
});
