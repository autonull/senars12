import { describe, it, expect } from 'vitest';
import { ManifoldRLAgent } from '../../nar/src/lm/system-one/manifold-rl-agent.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { JudgmentDataset, runBakeOff } from '../../nar/src/lm/system-one/distill.js';
import { recordReflexOutcome } from '../../nar/src/lm/system-one/reflex-label-source.js';
import {
  loadTrainingData,
  trainHead,
  writeHeadArtifacts,
  loadHeadArtifacts,
  pearson,
} from '../../nar/src/lm/system-one/train.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import { GridWorldGame } from '../../nar/src/game/GridWorldGame.js';
import type { GridWorldState } from '../../nar/src/game/GridWorldGame.js';
import { QLearning } from './rl/baselines/gridworld.js';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const grid = ['S...', '.#..', '..#.', '...G'];
const ROWS = 4;
const COLS = 4;
const GOAL = { row: 3, col: 3 };
const GAMMA = 0.99;

function distanceToGoal(state: GridWorldState): number {
  return Math.abs(state.row - GOAL.row) + Math.abs(state.col - GOAL.col);
}

function stateDigest(state: GridWorldState): string {
  return JSON.stringify({ row: state.row, col: state.col, goalRow: state.goalRow, goalCol: state.goalCol, distanceToGoal: distanceToGoal(state) });
}

function allCells(): GridWorldState[] {
  const cells: GridWorldState[] = [];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) cells.push({ row, col, goalRow: 3, goalCol: 3 });
  return cells;
}

function randomEpisode(game: GridWorldGame, maxSteps = 30): number {
  game.reset();
  let total = 0;
  for (let i = 0; i < maxSteps; i++) {
    const legal = game.legalActions(game.state());
    const action = legal[Math.floor(Math.random() * legal.length)]!;
    const outcome = game.step(action);
    total += outcome.reward;
    if (outcome.terminal) break;
  }
  return total;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Play the tabular-Q baseline, recording (state, action, MC-return) labels with state embeddings. */
async function collectDistillationDataset(cache: EmbeddingCache, episodes: number, basePath: string) {
  const dataset = new JudgmentDataset(basePath);
  const outcomeMeans = new Map<string, number>();
  const outcomeSums = new Map<string, { sum: number; count: number }>();
  const game = new GridWorldGame({ grid, seed: 1 });
  const agent = new QLearning({ alpha: 0.2, gamma: GAMMA, epsilon: 0.15, seed: 7 });

  for (let ep = 0; ep < episodes; ep++) {
    game.reset();
    const steps: { state: GridWorldState; action: number; reward: number }[] = [];
    for (let t = 0; t < 30; t++) {
      const state = game.state();
      const action = agent.selectAction(state);
      const outcome = game.step(action);
      agent.update(state, action, outcome.reward, game.state(), outcome.terminal);
      steps.push({ state, action, reward: outcome.reward });
      if (outcome.terminal) break;
    }
    // Backward Monte-Carlo return attribution — the training target for reflex_value.
    let g = 0;
    for (let t = steps.length - 1; t >= 0; t--) {
      g = steps[t]!.reward + GAMMA * g;
      const digest = stateDigest(steps[t]!.state);
      const embedding = await cache.write(digest).then((p) => cache.read(p));
      recordReflexOutcome(dataset, {
        stateDigest: digest,
        action: String(steps[t]!.action),
        reward: g,
        source: 'tabular-q-distill',
        embedding,
      });
      const key = `${digest}|${steps[t]!.action}`;
      const acc = outcomeSums.get(key) ?? { sum: 0, count: 0 };
      acc.sum += g;
      acc.count++;
      outcomeSums.set(key, acc);
    }
  }
  for (const [key, { sum, count }] of outcomeSums) outcomeMeans.set(key, sum / count);
  return { dataset, outcomeMeans };
}

describe('Reflex-Value Distillation Loop (Bench 21)', () => {
  it('play → dataset → trained digest-pinned head → beats random & untrained; value correlation with tabular Q', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 's1-distill-'));
    const datasetPath = join(tmp, 'dataset.jsonl');
    const headDir = join(tmp, 'heads', 'reflex_value');

    const cache = new EmbeddingCache({ maxSize: 1000, ttlMs: 600_000 });
    await cache.warmup(allCells().map(stateDigest));

    // 1. Play episodes → dataset (hash-only labels + inline vectors)
    const { dataset, outcomeMeans } = await collectDistillationDataset(cache, 300, tmp);
    expect(dataset.size).toBeGreaterThan(500);
    await dataset.flush(datasetPath);

    // 2. Train the reflex_value head from the inline vector JSONL
    const rows = await loadTrainingData({ datasetPath, headId: 'reflex_value' });
    expect(rows.length).toBeGreaterThan(0);
    const model = trainHead(rows, { headId: 'reflex_value', rubric: 'reflex_value', axis: 'teleological' }, { holdoutFraction: 0 });

    // 3. Digest-pinned artifacts
    const bundle = await writeHeadArtifacts(model, headDir);
    expect(bundle.modelDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    const trainedHead = await loadHeadArtifacts(headDir, bundle.modelDigest);
    expect(trainedHead.fitted).toBe(true);

    // 4. Value parity with the tabular-Q baseline on the same grid.
    // Ceiling: corr(labelMean MC returns, Q) — what the recorded outcomes can support.
    // The trained head must (a) reproduce the recorded outcome table near-exactly and
    // (b) stay within 2% of that ceiling's correlation with tabular Q.
    const game = new GridWorldGame({ grid, seed: 1 });
    const qAgent = new QLearning({ alpha: 0.2, gamma: GAMMA, epsilon: 0.15, seed: 7 });
    for (let ep = 0; ep < 300; ep++) qAgent.runEpisode(game, 30);
    const qTable = qAgent.getQTable();

    const candidates: number[] = [];
    const labelMeans: number[] = [];
    const qValues: number[] = [];
    const cachePointers = new Map<string, Awaited<ReturnType<EmbeddingCache['write']>>>();
    for (const cell of allCells()) {
      const pointer = await cache.write(stateDigest(cell));
      cachePointers.set(stateDigest(cell), pointer);
      const embedding = cache.read(pointer);
      if (!embedding) continue;
      for (const action of [0, 1, 2, 3]) {
        const mean = outcomeMeans.get(`${stateDigest(cell)}|${action}`);
        if (mean === undefined) continue;
        candidates.push(trainedHead.score(embedding, String(action)));
        labelMeans.push(clamp01(mean));
        qValues.push(clamp01(qTable.get(`${cell.row},${cell.col}`)?.[action] ?? 0));
      }
    }
    console.log("DBG corrFit", pearson(candidates, labelMeans).toFixed(3), "corrQ", pearson(candidates, qValues).toFixed(3), "ceiling", pearson(labelMeans, qValues).toFixed(3));
    expect(pearson(candidates, labelMeans)).toBeGreaterThan(0.98);
    const ceilingCorr = pearson(labelMeans, qValues);
    expect(pearson(candidates, qValues)).toBeGreaterThanOrEqual(ceilingCorr - 0.02);

    // Bake-off parity: the trained candidate reproduces the recorded outcome table
    // (exact label-mean incumbent) within the 2% regression tolerance.
    const bakeOffCases = allCells().flatMap((cell) =>
      [0, 1, 2, 3].map((action) => {
        const mean = outcomeMeans.get(`${stateDigest(cell)}|${action}`);
        if (mean === undefined) return null;
        return {
          truth: clamp01(mean),
          incumbent: clamp01(mean),
          candidate: trainedHead.score(cache.read(cachePointers.get(stateDigest(cell))!)!, String(action)),
        };
      }).filter((c) => c !== null)
    );
    const bakeOff = runBakeOff(
      undefined,
      { headId: 'reflex_value', modelDigest: bundle.modelDigest, calibrationVersion: 'v2.4.1', abstainThreshold: 0, enabled: true },
      bakeOffCases
    );
    expect(bakeOff.accepted).toBe(true);

    // 5. Policy check: trained head drives the agent past random and the untrained regime
    const trainedManifold = createManifold(cache, { abstainThreshold: 0.05 });
    trainedManifold.registerHead(trainedHead);
    const trainedAgent = new ManifoldRLAgent({ cache, manifold: trainedManifold, budget, epsilon: 0.05 });
    const trainedRewards: number[] = [];
    for (let ep = 0; ep < 50; ep++) {
      trainedRewards.push(await trainedAgent.runEpisode(new GridWorldGame({ grid, seed: ep }), 30));
    }

    const plainManifold = createManifold(cache, { abstainThreshold: 0.05 });
    const untrainedAgent = new ManifoldRLAgent({ cache, manifold: plainManifold, budget, epsilon: 0.05 });
    const untrainedRewards: number[] = [];
    for (let ep = 0; ep < 50; ep++) {
      untrainedRewards.push(await untrainedAgent.runEpisode(new GridWorldGame({ grid, seed: ep }), 30));
    }

    const randomRewards: number[] = [];
    for (let ep = 0; ep < 50; ep++) {
      randomRewards.push(randomEpisode(new GridWorldGame({ grid, seed: ep })));
    }

    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(trainedRewards)).toBeGreaterThan(avg(randomRewards));
    expect(avg(trainedRewards)).toBeGreaterThan(avg(untrainedRewards));
  }, 300_000);
});
