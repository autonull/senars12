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
 * Games come from the arcade registry (nar/src/game/registry.ts) — a new game
 * is a `Game` implementation + one GameSpec (name, description, actionLegend).
 */

import type { ReasoningBudget } from '@senars/kernel/schemas';
import { startArcadeTickSpan } from '../nar/src/eval/arcade-trace.js';
import { BrierHarness } from '../nar/src/eval/brier-harness.js';
import {
  type ArcadeSession,
  isResumable,
  loadSession,
  saveSession,
  sessionKey,
} from '../nar/src/eval/session-state.js';
import { GameFocus } from '../nar/src/focus/GameFocus.js';
import { createArcadeRegistry, type Game, SeededRNG } from '../nar/src/game/index.js';
import type { Game as GameInterface } from '../nar/src/game/Game.js';
import { renderGame } from '../nar/src/game/render.js';
import {
  recordedProposals,
  recordingReflex,
  vetoAwareReflex,
  wrapReflex,
} from '../nar/src/reflex/adapters.js';
import { EpsilonGreedyReflex } from '../nar/src/reflex/EpsilonGreedyReflex.js';
import type { ActionProposal, Reflex } from '../nar/src/reflex/Reflex.js';
import { game2048HeuristicAction } from '../tests/nar/rl/baselines/2048.js';
import { snakeHeuristicAction } from '../tests/nar/rl/baselines/snake.js';
import { tetrisHeuristicPlacement } from '../tests/nar/rl/baselines/tetris.js';
import { ticTacToeHeuristicAction } from '../tests/nar/rl/baselines/tictactoe.js';

type Arm = 'manifold' | 'lm' | 'replica' | 'heuristic' | 'random' | 'nal';

const gameRegistry = createArcadeRegistry();

const parseArgs = (): {
  games: string[];
  arms: Arm[];
  episodes: number;
  seed: number;
  render: boolean;
  cognitive: boolean;
  resume: boolean;
  sessionPath: string;
  otel: boolean;
  distill: boolean;
} => {
  const get = (flag: string, fallback: string): string => {
    const i = process.argv.indexOf(flag);
    return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
  };
  const games = get('--games', gameRegistry.names().join(',')).split(',').filter(Boolean);
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
    distill: process.argv.includes('--distill'),
  };
};

/**
 * E7: honest domain rules the Negotiator can veto against (per game). Only
 * static traps are seeded — snake/2048/tetris/tictactoe traps are
 * state-conditional (their legalActions already exclude illegal moves), so
 * they run rule-free and grow their own via schema induction (G2) instead.
 */
const cognitiveRules: Partial<Record<string, Array<[string, string, { f: number; c: number }]>>> = {
  // GridWorld 'S..' starts on the top row: moving up (0) bumps the wall.
  gridworld: [['0', 'wall_bump', { f: 0.1, c: 0.95 }]],
  // Bandit arm 0 is the known-worst arm (mean 0.2 vs 0.5/0.8): honest prior.
  bandit: [['0', 'low_reward', { f: 0.1, c: 0.95 }]],
};

const heuristics: Partial<Record<string, (game: Game) => string | number>> = {
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

/** Cognitive arm construction — fail-closed per arm: skip with a note, never substitute. */
async function buildCognitiveArm(
  arm: 'manifold' | 'lm' | 'replica' | 'nal',
  gameName: string,
  dataset?: unknown
): Promise<{ reflex: Reflex; manifold: unknown; cache: unknown; headLoaded: boolean } | { note: string }> {
  // nal arm: NAL-rules + kernel gates over a plain epsilon-greedy reflex —
  // the falsifiable question is whether the Negotiator's vetoes help, not
  // whether the reflex is smart.
  if (arm === 'nal')
    return {
      reflex: new EpsilonGreedyReflex('nal-incumbent', { numArms: 10, epsilon: 0.1 }),
      manifold: undefined,
      cache: undefined,
      headLoaded: false,
    };
  const { createEmbeddingCache } = await import('../nar/src/lm/system-one/embedding-cache.js');
  const cache = createEmbeddingCache({});
  if (arm === 'manifold' || arm === 'replica') {
    let manifold: unknown;
    if (arm === 'manifold') {
      const { createManifold } = await import('../nar/src/lm/system-one/manifold.js');
      manifold = createManifold(cache, { abstainThreshold: 0.05 });
    } else {
      const endpoint = process.env.OPEN_REPLICA_ENDPOINT;
      if (!endpoint)
        return { note: 'replica arm: OPEN_REPLICA_ENDPOINT unset — skipped (fail-closed)' };
      const { createOpenSystemOneManifold } = await import(
        '../nar/src/lm/system-one/open-systemone-manifold.js'
      );
      manifold = createOpenSystemOneManifold({ endpoint, embeddingCache: cache });
    }
    const incumbent = new EpsilonGreedyReflex('incumbent', { numArms: 10, epsilon: 0.1 });
    // Tetris placement fan-out (W7): two-stage cascade — stage-1 coarse rank
    // over all placements in one batch, stage-2 fine `reflex_value` on top-K.
    const { ManifoldReflex } = await import('../nar/src/lm/system-one/manifold-reflex.js');
    // Distilled student: a reflex_value head trained from previous lm-arm play
    // (pnpm run demo:arcade -- --distill --arms lm) replaces the untrained stub.
    const HEAD_DIR = '.reports/arcade-heads/reflex_value';
    let headLoaded = false;
    try {
      const { loadHeadArtifacts } = await import('../nar/src/lm/system-one/train.js');
      const trainedHead = await loadHeadArtifacts(HEAD_DIR);
      (manifold as { registerHead: (h: unknown) => void }).registerHead(trainedHead);
      headLoaded = true;
    } catch {
      // No distilled head yet — untrained stub serves (honest fallback).
    }
    const reflex =
      gameName === 'tetris'
        ? new (await import('../nar/src/lm/system-one/cascade-reflex.js')).PlacementCascadeReflex(
            incumbent
          )
        : new ManifoldReflex(incumbent);
    return { reflex, manifold, cache, headLoaded };
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
  const promptTemplates: Partial<Record<string, string>> = {
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
      actionLegend: gameRegistry.get(gameName)?.actionLegend,
      promptTemplate: promptTemplates[gameName],
      dataset: dataset as never,
    }),
    manifold,
    cache,
    headLoaded: false,
  };
}

async function main(): Promise<void> {
  const { games, arms, episodes, seed, render, cognitive, resume, sessionPath, otel, distill } =
    parseArgs();
  if (otel) {
    const { initOtel } = await import('../nar/src/otel/index.js');
    initOtel({
      serviceName: 'senars-arcade',
      otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    });
  }
  const harness = new BrierHarness();
  const notes: string[] = [];
  const rng = new SeededRNG(seed);

  // Unknown game names are skipped with a note (fail loud, never silent).
  const unknownGames = games.filter((g) => !gameRegistry.has(g));
  const playableGames = games.filter((g) => gameRegistry.has(g));
  if (unknownGames.length > 0)
    notes.push(
      `unknown games skipped: ${unknownGames.join(',')} (available: ${gameRegistry.names().join(',')})`
    );

  // Distillation flywheel: the lm arm records its decisions into a dataset;
  // after play, a reflex_value head is trained and picked up by the manifold
  // arm (the cheap student) on the next run.
  let dataset: import('../nar/src/lm/system-one/distill.js').JudgmentDataset | undefined;
  if (arms.includes('lm') && arms.includes('manifold') && distill) {
    const { JudgmentDataset } = await import('../nar/src/lm/system-one/distill.js');
    dataset = new JudgmentDataset();
    dataset.setVectorSidecarPath('.reports/arcade-vectors');
    notes.push('distill: lm arm records decisions → .reports/arcade-vectors');
  }

  // G3 session resume: progress is persisted per (arm, game); a mismatched
  // config cannot resume (starts fresh with a note, never silently merged).
  const run = { seed, games: playableGames, arms, targetEpisodes: episodes };
  let completed: Record<string, number> = {};
  if (resume) {
    const saved = loadSession(sessionPath);
    if (saved && isResumable(saved, run)) {
      completed = saved.completed;
      notes.push(
        `resumed session: ${sessionPath} (${Object.entries(completed).reduce((a, [, n]) => a + n, 0)} episodes already done)`
      );
    } else {
      notes.push(
        `--resume: no resumable session at ${sessionPath} (missing or config mismatch) — starting fresh`
      );
    }
  }
  const persistProgress = (completed: Record<string, number>): void => {
    if (!resume) return;
    saveSession(sessionPath, { version: 1, ...run, completed });
  };

  for (const arm of arms) {
    for (const gameName of playableGames) {
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
          const game = gameRegistry.create(gameName, seed + e) as GameInterface<unknown, string | number>;
          let steps = 0;
          while (true) {
            const perception = game.observe();
            if (perception.terminal) break;
            if (steps >= 150) break;
            const legal = (game.legalActions(game.state()) as Array<string | number>).map(String);
            if (legal.length === 0) break;
            const t0 = performance.now();
            const action =
              arm === 'random' ? legal[rng.nextInt(legal.length)]! : String(heuristic!(game));
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

      // Cognitive arms: kernel-gated GameFocus play (A1 scheduler drive). The
      // nal arm forces cognitive mode regardless of --mode so it is always a
      // comparable arm in the summary table; GameFocus's own G2 schema
      // induction grows advisory rules from experience at episode end.
      const armCognitive = cognitive || arm === 'nal';
      const built = await buildCognitiveArm(arm, gameName, dataset);
      if ('note' in built) {
        notes.push(`${gameName}: ${built.note}`);
        continue;
      }
      if (built.headLoaded) notes.push(`${arm}/${gameName}: distilled reflex_value head active`);
      const recording = wrapReflex(built.reflex, vetoAwareReflex(), recordingReflex());
      let promotedCount = 0;
      for (let e = firstEpisode; e < episodes; e++) {
        const game = gameRegistry.create(gameName, seed + e) as GameInterface<unknown, string | number>;
        const focus = new GameFocus({
          focusId: `${arm}-${gameName}-${e}`,
          game,
          cognitive: armCognitive,
          schemaInduction: armCognitive,
        });
        if (armCognitive)
          for (const [action, consequence, truth] of cognitiveRules[gameName] ?? [])
            focus.seedRule(action, consequence, truth);
        focus.bindReflex(recording);
        if (built.manifold)
          focus.setReflexPrefetchContext?.({
            manifold: built.manifold as never,
            embeddingCache: built.cache as never,
            budget: BUDGET,
          });
        let steps = 0;
        while (true) {
          const perception = game.observe();
          if (perception.terminal) break;
          if (steps >= 150) break;
          const t0 = performance.now();
          const { gameOutcome } = await focus.step(10);
          const latencyMs = performance.now() - t0;
          steps++;
          if (!gameOutcome) continue;
          const top = recordedProposals(recording).reduce<ActionProposal | null>(
            (best, p) =>
              !best || p.value * p.confidence > best.value * best.confidence ? p : best,
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
            console.log(
              `\n[${arm}/${gameName}] step ${steps} → ${top?.action ?? 'n/a'} (p=${top?.confidence?.toFixed(2) ?? '-'})`
            );
            console.log(renderGame(game));
          }
          if (armCognitive && panel) {
            const d = panel.decision;
            console.log(
              `[panel] c${panel.cycle} proposals=[${panel.proposalActions.join(',')}] → ${d.action ?? '∅'} src=${d.source}${d.vetoedBy ? ` VETOED by ${d.vetoedBy}` : ''}${panel.handover ? ' HANDOVER' : ''} deriv=${panel.nalDerivations.length} w=${panel.focusWeight.toFixed(3)}`
            );
          }
        }
        focus.markEpisodeEnd();
        completed[sessionKey(arm, gameName)] = e + 1;
        persistProgress(completed);
        const reflexStats = built.reflex as {
          decisions?: number;
          failures?: number;
          served?: number;
        };
        if (typeof reflexStats.decisions === 'number')
          notes.push(
            `${arm}/${gameName} ep${e}: lm decisions=${reflexStats.decisions} served=${reflexStats.served ?? 'n/a'} fallback-serving failures=${reflexStats.failures}`
          );
        if (armCognitive) {
          const promoted = focus.getPromotedSchemas();
          if (promoted.length > promotedCount) {
            promotedCount = promoted.length;
            notes.push(
              `${arm}/${gameName} ep${e}: schema induction promoted ${promoted.map((s) => `${s.action}→${s.kind}`).join(',')}`
            );
          }
          const v = focus.getVetoStats();
          console.log(
            `[panel] episode ${e}: vetos=${v.totalVetos} rate=${v.vetoRate.toFixed(2)} justifications=${focus.getVetoJustifications().length}`
          );
        }
      }
    }
  }

  // Train the distilled student head from this run's lm-arm play.
  if (dataset && dataset.size > 0) {
    const { mkdirSync, rmSync } = await import('node:fs');
    const datasetPath = '.reports/arcade-dataset.jsonl';
    const sidecarPath = '.reports/arcade-vectors';
    const headDir = '.reports/arcade-heads/reflex_value';
    await dataset.flush(datasetPath);
    await dataset.flushVectors();
    const rows = await (await import('../nar/src/lm/system-one/train.js')).loadTrainingData({
      datasetPath,
      sidecarPath,
      headId: 'reflex_value',
      averageDuplicates: true,
    });
    if (rows.length > 0) {
      const model = (await import('../nar/src/lm/system-one/train.js')).trainHead(
        rows,
        { headId: 'reflex_value', rubric: 'reflex_value', axis: 'teleological' },
        { holdoutFraction: 0 }
      );
      rmSync(headDir, { recursive: true, force: true });
      mkdirSync(headDir, { recursive: true });
      const bundle = await (await import('../nar/src/lm/system-one/train.js')).writeHeadArtifacts(
        model,
        headDir
      );
      notes.push(
        `distill: trained reflex_value head (${rows.length} rows, ${bundle.modelDigest.slice(0, 19)}…) → ${headDir}; the manifold arm picks it up on the next run`
      );
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
