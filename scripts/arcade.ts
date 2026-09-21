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
 *   pnpm arcade -- --arms lm --resume        # resume an interrupted tournament
 *                                            # (--session PATH, default .reports/arcade-session.json)
 */
import { BrierHarness } from '../nar/src/eval/brier-harness.js';
import {
  isResumable,
  loadSession,
  saveSession,
  sessionKey,
  type ArcadeSession,
} from '../nar/src/eval/session-state.js';
import { startArcadeTickSpan } from '../nar/src/eval/arcade-trace.js';
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

const parseArgs = (): {
  games: GameName[];
  arms: Arm[];
  episodes: number;
  seed: number;
  render: boolean;
  cognitive: boolean;
  resume: boolean;
  sessionPath: string;
} => {
  const get = (flag: string, fallback: string): string => {
    const i = process.argv.indexOf(flag);
    return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
  };
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
    cognitive: get('--mode', 'default') === 'cognitive',
    resume: process.argv.includes('--resume'),
    sessionPath: get('--session', '.reports/arcade-session.json'),
    otel: process.argv.includes('--otel'),
  };
};

/** E7: honest domain rules the Negotiator can veto against (per game). */
const cognitiveRules: Partial<Record<GameName, Array<[string, string, { f: number; c: number }]>>> = {
  // GridWorld 'S..' starts on the top row: moving up (0) bumps the wall.
  gridworld: [['0', 'wall_bump', { f: 0.1, c: 0.95 }]],
};

const makeGames: Record<GameName, (seed: number) => Game> = {
  snake: (seed) => createSnakeGame({ seed, maxSteps: 120 }),
  tetris: (seed) => createTetrisGame({ seed, width: 10, height: 10, pieceCap: 30 }),
  '2048': (seed) => createGame2048({ seed }),
  tictactoe: (seed) => createTicTacToeGame({ seed }),
  gridworld: (seed) => createGridWorldGame({ id: 'grid', grid: ['S..', '..G'], seed }),
  bandit: (seed) => createBanditGame({ seed, armMeans: [0.2, 0.5, 0.8] }),
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
  /** Forward the attend-stage prefetch so semantic reflexes (LMReflex) actually run. */
  async prefetch(
    stateId: string,
    context: unknown,
    legalActions: readonly string[],
    manifold: unknown,
    budget: ReasoningBudget,
    observation?: unknown
  ): Promise<void> {
    const p = this.inner as {
      prefetch?: (
        stateId: string,
        context: unknown,
        legalActions: readonly string[],
        manifold: unknown,
        budget: ReasoningBudget,
        observation?: unknown
      ) => Promise<void>;
    };
    if (typeof p.prefetch === 'function') {
      await p.prefetch(stateId, context, legalActions, manifold, budget, observation);
    }
  }
}

/** Cognitive arm construction — fail-closed per arm: skip with a note, never substitute. */
async function buildCognitiveArm(
  arm: 'manifold' | 'lm' | 'replica',
  gameName: GameName
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
    const incumbent = new EpsilonGreedyReflex('incumbent', { numArms: 10, epsilon: 0.1 });
    // Tetris placement fan-out (W7): two-stage cascade — stage-1 coarse rank
    // over all placements in one batch, stage-2 fine `reflex_value` on top-K.
    const { ManifoldReflex } = await import('../nar/src/lm/system-one/manifold-reflex.js');
    const reflex =
      gameName === 'tetris'
        ? new (
            await import('../nar/src/lm/system-one/cascade-reflex.js')
          ).PlacementCascadeReflex(incumbent)
        : new ManifoldReflex(incumbent);
    return { reflex, manifold, cache };
  }
  // lm arm: real LM decisions under a GBNF action grammar, judged by the
  // manifold (tier 1) so candidates get calibrated ranking — the synth output
  // alone is first-token-biased.
  if (!process.env.LM_LLAMACPP_MODEL)
    return { note: 'lm arm: LM_LLAMACPP_MODEL unset — skipped (fail-closed)' };
  const [
    { createLMService },
    { createLMServiceCortex },
    { createDispatcher },
    { LMReflex },
    { createManifold },
  ] = await Promise.all([
    import('../nar/src/lm/lm-service.js'),
    import('../nar/src/lm/system-one/cortex-adapter.js'),
    import('../nar/src/lm/system-one/dispatcher.js'),
    import('../nar/src/lm/system-one/lm-reflex.js'),
    import('../nar/src/lm/system-one/manifold.js'),
  ]);
  const lmService = createLMService();
  const manifold = createManifold(cache, { abstainThreshold: 0.05 });
  const actionLegends: Partial<Record<GameName, string>> = {
    snake: 'Actions: 0=up, 1=right, 2=down, 3=left. Goal: reach the apple (headR/appleR, headC/appleC converge). Never reverse into your own body.',
  };
  const promptTemplates: Partial<Record<GameName, string>> = {
    tictactoe:
      'You are X in tic-tac-toe. Cells 0-8 (0=top-left, 1=top-center, 2=top-right, 3=middle-left, 4=center, 5=middle-right, 6=bottom-left, 7=bottom-center, 8=bottom-right).\nBoard: {cell0} {cell1} {cell2} / {cell3} {cell4} {cell5} / {cell6} {cell7} {cell8} (0=empty, 1=X you, 2=O opponent).\n\nWhich empty cell should X take to win or block? Answer with only the cell number.',
    gridworld:
      'You control a robot on a grid. It is at row {row}, col {col}. The goal is at row {goalRow}, col {goalCol}. Moving up decreases row, right increases col, down increases row, left decreases col.\n\nWhich move (0=up, 1=right, 2=down, 3=left) brings the robot closest to the goal? Answer with only the number.',
  };
  const dispatcher = createDispatcher(
    true,
    { tier1Manifold: manifold, embeddingCache: cache },
    createLMServiceCortex({ lmService })
  );
  return {
    reflex: new LMReflex({
      fallback: new EpsilonGreedyReflex('lm-incumbent', { numArms: 10, epsilon: 0.1 }),
      dispatcher,
      embeddingCache: cache,
      budget: BUDGET,
      actionLegend: actionLegends[gameName],
      promptTemplate: promptTemplates[gameName],
    }),
    manifold,
    cache,
  };
}

async function main(): Promise<void> {
  const { games, arms, episodes, seed, render, cognitive, resume, sessionPath, otel } = parseArgs();
  if (otel) {
    const { initOtel } = await import('../nar/src/otel/index.js');
    initOtel({ serviceName: 'senars-arcade', otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT });
  }
  const harness = new BrierHarness();
  const notes: string[] = [];
  const rng = new SeededRNG(seed);

  // G3 session resume: progress is persisted per (arm, game); a mismatched
  // config cannot resume (starts fresh with a note, never silently merged).
  const run = { seed, games, arms, targetEpisodes: episodes };
  let completed: Record<string, number> = {};
  if (resume) {
    const saved = loadSession(sessionPath);
    if (saved && isResumable(saved, run)) {
      completed = saved.completed;
      notes.push(`resumed session: ${sessionPath} (${Object.entries(completed).reduce((a, [, n]) => a + n, 0)} episodes already done)`);
    } else {
      notes.push(`--resume: no resumable session at ${sessionPath} (missing or config mismatch) — starting fresh`);
    }
  }
  const persistProgress = (completed: Record<string, number>): void => {
    if (!resume) return;
    saveSession(sessionPath, { version: 1, ...run, completed });
  };

  for (const arm of arms) {
    for (const gameName of games) {
      const firstEpisode = completed[sessionKey(arm, gameName)] ?? 0;
      if (firstEpisode >= episodes) continue;
      if (firstEpisode > 0) notes.push(`${arm}/${gameName}: resuming at episode ${firstEpisode}`);
      // Pure arms: no kernel gates — direct game play (baseline controls).
      if (arm === 'heuristic' || arm === 'random') {
        const heuristic = heuristics[gameName];
        if (arm === 'heuristic' && !heuristic) {
          notes.push(`heuristic arm on ${gameName}: no baseline — skipped`);
          continue;
        }
        for (let e = firstEpisode; e < episodes; e++) {
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
            startArcadeTickSpan(arm, gameName, steps).finish({
              action,
              latencyMs,
              reward: outcome.reward,
              terminal: outcome.terminal,
              handover: false,
            });
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
          completed[sessionKey(arm, gameName)] = e + 1;
          persistProgress(completed);
        }
        continue;
      }

      // Cognitive arms: kernel-gated GameFocus play (A1 scheduler drive).
      const built = await buildCognitiveArm(arm, gameName);
      if ('note' in built) {
        notes.push(`${gameName}: ${built.note}`);
        continue;
      }
      const recording = new RecordingReflex(`${arm}-recording`, built.reflex);
      for (let e = firstEpisode; e < episodes; e++) {
        const game = makeGames[gameName](seed + e);
        const focus = new GameFocus({ focusId: `${arm}-${gameName}-${e}`, game, cognitive });
        if (cognitive)
          for (const [action, consequence, truth] of cognitiveRules[gameName] ?? [])
            focus.seedRule(action, consequence, truth);
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
          const panel = focus.getPanelLog().at(-1);
          startArcadeTickSpan(arm, gameName, steps).finish({
            action: top?.action,
            latencyMs,
            reward: gameOutcome.reward,
            terminal: gameOutcome.terminal,
            handover: focus.didLastTickHandover(),
            decision: panel?.decision,
          });
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
          if (cognitive && panel) {
            const d = panel.decision;
            console.log(
              `[panel] c${panel.cycle} proposals=[${panel.proposalActions.join(',')}] → ${d.action ?? '∅'} src=${d.source}${d.vetoedBy ? ` VETOED by ${d.vetoedBy}` : ''}${panel.handover ? ' HANDOVER' : ''} deriv=${panel.nalDerivations.length} w=${panel.focusWeight.toFixed(3)}`
            );
          }
        }
        focus.markEpisodeEnd();
        completed[sessionKey(arm, gameName)] = e + 1;
        persistProgress(completed);
        const reflexStats = built.reflex as { decisions?: number; failures?: number; served?: number };
        if (typeof reflexStats.decisions === 'number')
          notes.push(
            `${arm}/${gameName} ep${e}: lm decisions=${reflexStats.decisions} served=${reflexStats.served ?? 'n/a'} fallback-serving failures=${reflexStats.failures}`
          );
        if (cognitive) {
          const v = focus.getVetoStats();
          console.log(
            `[panel] episode ${e}: vetos=${v.totalVetos} rate=${v.vetoRate.toFixed(2)} justifications=${focus.getVetoJustifications().length}`
          );
        }
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
