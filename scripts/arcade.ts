/**
 * TODO17 E3: the arcade demo — many games on one kernel-gated harness, one arm
 * per run, every tick rendered with its decision record, every claim recorded
 * into `.reports/arcade.{json,md}`.
 *
 * Usage:
 *   pnpm arcade -- --games snake,tetris --arms heuristic,random --episodes 5 --seed 7
 *   pnpm arcade -- --arms manifold           # local Judgment Manifold heads
 *   OPEN_REPLICA_ENDPOINT=... pnpm arcade -- --arms replica
 *   pnpm arcade -- --arms lm                 # real LM decisions (model-cached machines)
 */
import { BrierHarness } from '../nar/src/eval/brier-harness.js';
import { GameFocus } from '../nar/src/focus/GameFocus.js';
import { renderGame } from '../nar/src/game/render.js';
import {
  createBanditGame,
  createGame2048,
  createGridWorldGame,
  createSnakeGame,
  createTetrisGame,
  createTicTacToeGame,
  SeededRNG,
  type Game,
} from '../nar/src/game/index.js';
import { game2048HeuristicAction } from '../tests/nar/rl/baselines/2048.js';
import { snakeHeuristicAction } from '../tests/nar/rl/baselines/snake.js';
import { tetrisHeuristicPlacement } from '../tests/nar/rl/baselines/tetris.js';
import { ticTacToeHeuristicAction } from '../tests/nar/rl/baselines/tictactoe.js';
import { EpsilonGreedyReflex } from '../nar/src/reflex/EpsilonGreedyReflex.js';
import type { ActionProposal, Reflex } from '../nar/src/reflex/Reflex.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';

type GameName = 'snake' | 'tetris' | '2048' | 'tictactoe' | 'gridworld' | 'bandit';
type Arm = 'manifold' | 'lm' | 'replica' | 'heuristic' | 'random';

const parseArgs = (): { games: GameName[]; arms: Arm[]; episodes: number; seed: number; render: boolean } => {
  const get = (flag: string, fallback: string) =>
    process.argv[process.argv.indexOf(flag) + 1] ?? fallback;
  const games = get('--games', 'snake,tetris,2048,tictactoe,gridworld,bandit')
    .split(',')
    .filter(Boolean) as GameName[];
  const arms = get('--arms', 'heuristic,random').split(',').filter(Boolean) as Arm[];
  return {
    games,
    arms,
    episodes: Number(get('--episodes', '3')),
    seed: Number(get('--seed', '7')),
    render: process.argv.includes('--render'),
  };
};

const makeGames: Record<GameName, (seed: number) => Game> = {
  snake: (seed) => createSnakeGame({ seed, maxSteps: 120 }),
  tetris: (seed) => createTetrisGame({ seed, width: 10, height: 10, pieceCap: 30 }),
  '2048': (seed) => createGame2048({ seed }),
  tictactoe: (seed) => createTicTacToeGame({ seed }),
  gridworld: (seed) => createGridWorldGame({ id: 'grid', grid: ['S..', '..G'], seed }),
  bandit: (seed) => createBanditGame({ seed }),
};

const heuristics: Partial<Record<GameName, (game: Game) => string | number>> = {
  snake: (g) => snakeHeuristicAction(g as never),
  tetris: (g) => tetrisHeuristicPlacement(g as never),
  '2048': (g) => game2048HeuristicAction(g as never),
  tictactoe: (g) => ticTacToeHeuristicAction(g as never),
};

const BUDGET: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

/** Records the proposals served each tick so the harness can score confidence. */
class RecordingReflex implements Reflex {
  readonly id: string;
  lastProposals: ActionProposal[] = [];
  constructor(
    id: string,
    private readonly inner: Reflex
  ) {
    this.id = id;
  }
  propose(state: unknown, legalActions: unknown[]): ActionProposal[] {
    this.lastProposals = this.inner.propose(state, legalActions as never);
    return this.lastProposals;
  }
  learn(event: never): void {
    this.inner.learn(event);
  }
}

/** Cognitive arm construction — fail-closed per arm: skip with a note, never substitute. */
async function buildCognitiveArm(
  arm: 'manifold' | 'lm' | 'replica'
): Promise<{ reflex: Reflex; manifold: unknown; cache: unknown } | { note: string }> {
  const { createEmbeddingCache } = await import('../nar/src/lm/system-one/embedding-cache.js');
  const cache = createEmbeddingCache({});
  if (arm === 'manifold' || arm === 'replica') {
    let manifold: unknown;
    if (arm === 'manifold') {
      const { createManifold } = await import('../nar/src/lm/system-one/manifold.js');
      manifold = createManifold(cache, { abstainThreshold: 0.05 });
    } else {
      const endpoint = process.env.OPEN_REPLICA_ENDPOINT;
      if (!endpoint) return { note: 'replica arm: OPEN_REPLICA_ENDPOINT unset — skipped (fail-closed)' };
      const { createOpenSystemOneManifold } = await import(
        '../nar/src/lm/system-one/open-systemone-manifold.js'
      );
      manifold = createOpenSystemOneManifold({ endpoint, embeddingCache: cache });
    }
    const { ManifoldReflex } = await import('../nar/src/lm/system-one/manifold-reflex.js');
    return {
      reflex: new ManifoldReflex(new EpsilonGreedyReflex('incumbent', { numArms: 10, epsilon: 0.1 })),
      manifold,
      cache,
    };
  }
  // lm arm: real LM decisions under a GBNF action grammar
  if (!process.env.LM_LLAMACPP_MODEL)
    return { note: 'lm arm: LM_LLAMACPP_MODEL unset — skipped (fail-closed)' };
  const [{ createLMService }, { createLMServiceCortex }, { createDispatcher }, { LMReflex }] =
    await Promise.all([
      import('../nar/src/lm/lm-service.js'),
      import('../nar/src/lm/system-one/cortex-adapter.js'),
      import('../nar/src/lm/system-one/dispatcher.js'),
      import('../nar/src/lm/system-one/lm-reflex.js'),
    ]);
  const dispatcher = createDispatcher(true, {}, createLMServiceCortex({ lmService: createLMService() }));
  return {
    reflex: new LMReflex({
      fallback: new EpsilonGreedyReflex('lm-incumbent', { numArms: 10, epsilon: 0.1 }),
      dispatcher,
      embeddingCache: cache,
      budget: BUDGET,
    }),
    manifold: undefined,
    cache,
  };
}

async function main(): Promise<void> {
  const { games, arms, episodes, seed, render } = parseArgs();
  const harness = new BrierHarness();
  const notes: string[] = [];
  const rng = new SeededRNG(seed);

  for (const arm of arms) {
    for (const gameName of games) {
      // Pure arms: no kernel gates — direct game play (baseline controls).
      if (arm === 'heuristic' || arm === 'random') {
        const heuristic = heuristics[gameName];
        if (arm === 'heuristic' && !heuristic) {
          notes.push(`heuristic arm on ${gameName}: no baseline — skipped`);
          continue;
        }
        for (let e = 0; e < episodes; e++) {
          const game = makeGames[gameName](seed + e);
          let steps = 0;
          while (!game.state().terminal && steps < 150) {
            const legal = (game.legalActions(game.state()) as Array<string | number>).map(String);
            if (legal.length === 0) break;
            const t0 = performance.now();
            const action = arm === 'random' ? legal[rng.nextInt(legal.length)]! : String(heuristic!(game));
            const latencyMs = performance.now() - t0;
            const outcome = game.step(action as never);
            steps++;
            harness.record({
              arm,
              game: gameName,
              stateId: (game as { stateKey?: () => string }).stateKey?.() ?? String(steps),
              action,
              predicted: arm === 'heuristic' ? 0.8 : 1 / legal.length,
              observed: Math.max(0, Math.min(1, outcome.reward)),
              reward: outcome.reward,
              latencyMs,
              handover: false,
            });
            if (render) {
              console.log(`\n[${arm}/${gameName}] step ${steps} → ${action}`);
              console.log(renderGame(game));
            }
          }
        }
        continue;
      }

      // Cognitive arms: kernel-gated GameFocus play (A1 scheduler drive).
      const built = await buildCognitiveArm(arm);
      if ('note' in built) {
        notes.push(`${gameName}: ${built.note}`);
        continue;
      }
      const recording = new RecordingReflex(`${arm}-recording`, built.reflex);
      for (let e = 0; e < episodes; e++) {
        const game = makeGames[gameName](seed + e);
        const focus = new GameFocus({ focusId: `${arm}-${gameName}-${e}`, game });
        focus.bindReflex(recording);
        focus.setReflexPrefetchContext?.({
          manifold: built.manifold as never,
          embeddingCache: built.cache as never,
          budget: BUDGET,
        });
        let steps = 0;
        while (!game.state().terminal && steps < 150) {
          recording.lastProposals = [];
          const t0 = performance.now();
          const { gameOutcome } = await focus.step(10);
          const latencyMs = performance.now() - t0;
          steps++;
          if (!gameOutcome) continue;
          const top = recording.lastProposals.reduce<ActionProposal | null>(
            (best, p) => (!best || p.value * p.confidence > best.value * best.confidence ? p : best),
            null
          );
          harness.record({
            arm,
            game: gameName,
            stateId: (game as { stateKey?: () => string }).stateKey?.() ?? String(steps),
            action: gameOutcome.terminal || top ? String(top?.action ?? '') : '',
            predicted: top ? Math.max(0, Math.min(1, top.confidence)) : 0.5,
            observed: Math.max(0, Math.min(1, gameOutcome.reward)),
            reward: gameOutcome.reward,
            latencyMs,
            handover: focus.didLastTickHandover(),
          });
          if (render) {
            console.log(`\n[${arm}/${gameName}] step ${steps} → ${top?.action ?? 'n/a'} (p=${top?.confidence?.toFixed(2) ?? '-'})`);
            console.log(renderGame(game));
          }
        }
        focus.markEpisodeEnd();
      }
    }
  }

  await harness.writeReports();
  console.log('\n=== Arcade summary ===');
  for (const s of harness.summary()) {
    console.log(
      `${s.arm}: ticks=${s.ticks} brier=${s.brier.toFixed(4)} ece=${s.ece.toFixed(4)} meanReward=${s.meanReward.toFixed(4)} return=${s.return.toFixed(3)} handover=${(s.handoverRate * 100).toFixed(1)}%`
    );
  }
  for (const note of notes) console.log(`note: ${note}`);
  console.log('reports → .reports/arcade.{json,md}');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
