import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import { describe, expect, it } from 'vitest';
import type { GridWorldState } from '../../nar/src/game/GridWorldEnv.js';
import { GridWorldGame } from '../../nar/src/game/GridWorldGame.js';
import { SeededRNG } from '../../nar/src/game/SeededRNG.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { ManifoldRLAgent } from '../../nar/src/lm/system-one/manifold-rl-agent.js';
import { recordReflexOutcome } from '../../nar/src/lm/system-one/reflex-label-source.js';
import type { JudgmentHead, JudgmentQuery } from '../../nar/src/lm/system-one/types.js';
import { QLearning } from './rl/baselines/gridworld.js';

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

function distanceToGoal(state: GridWorldState): number {
  return Math.abs(state.row - GOAL.row) + Math.abs(state.col - GOAL.col);
}

function stateDigest(state: GridWorldState): string {
  // Must byte-match GridWorldGame.observe()'s features key order
  return JSON.stringify({ row: state.row, col: state.col, goalRow: state.goalRow, goalCol: state.goalCol, distanceToGoal: distanceToGoal(state) });
}

function allCells(): GridWorldState[] {
  const cells: GridWorldState[] = [];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) cells.push({ row, col, goalRow: 3, goalCol: 3 });
  return cells;
}

/** Distill a tabular Q-learner into an oracle `reflex_value` head (Bench 20 harness proof). */
async function makeOracleHead(cache: EmbeddingCache, qTable: Map<string, number[]>) {
  const centroids: { embedding: Float32Array; key: string }[] = [];
  for (const cell of allCells()) {
    const pointer = await cache.write(stateDigest(cell));
    const embedding = cache.read(pointer);
    if (embedding) centroids.push({ embedding, key: `${cell.row},${cell.col}` });
  }
  const head: JudgmentHead = {
    rubric: 'reflex_value',
    axis: 'teleological',
    fitted: true,
    async evaluate(embedding: Float32Array, query: JudgmentQuery) {
      const action = Number(query.instruction.match(/action (\S+)$/)?.[1]);
      let best = centroids[0];
      let bestDot = -Infinity;
      for (const c of centroids) {
        let dot = 0;
        for (let i = 0; i < embedding.length; i++) dot += embedding[i]! * c.embedding[i]!;
        if (dot > bestDot) {
          bestDot = dot;
          best = c;
        }
      }
      const q = qTable.get(best!.key)?.[action] ?? 0;
      return { score: Math.max(0, q), abstained: false };
    },
  };
  return head;
}

function randomEpisode(game: GridWorldGame, rng: SeededRNG, maxSteps = 30): number {
  game.reset();
  let total = 0;
  for (let i = 0; i < maxSteps; i++) {
    const legal = game.legalActions(game.state());
    const action = legal[Math.floor(rng.next() * legal.length)]!;
    const outcome = game.step(action);
    total += outcome.reward;
    if (outcome.terminal) break;
  }
  return total;
}

describe('System One RL Harness — no NAR in the loop (Bench 20)', () => {
  it('registered oracle head beats random over 50 episodes; untrained heads do not regress below random', async () => {
    const cache = new EmbeddingCache({ maxSize: 1000, ttlMs: 600_000 });
    await cache.warmup(allCells().map(stateDigest));

    // Distill tabular Q from the baseline Q-learner
    const baselineGame = new GridWorldGame({ grid, seed: 1 });
    const qAgent = new QLearning({ alpha: 0.2, gamma: 0.99, epsilon: 0.15, seed: 7 });
    for (let ep = 0; ep < 300; ep++) qAgent.runEpisode(baselineGame, 30);

    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    manifold.registerHead(await makeOracleHead(cache, qAgent.getQTable()));

    const oracleRewards: number[] = [];
    const agent = new ManifoldRLAgent({ cache, manifold, budget, epsilon: 0.05 });
    for (let ep = 0; ep < 50; ep++) {
      oracleRewards.push(await agent.runEpisode(new GridWorldGame({ grid, seed: ep }), 30));
    }

    const randomRewards: number[] = [];
    const randomRng = new SeededRNG(11);
    for (let ep = 0; ep < 50; ep++) {
      randomRewards.push(randomEpisode(new GridWorldGame({ grid, seed: ep }), randomRng));
    }

    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(oracleRewards)).toBeGreaterThan(avg(randomRewards));

    // Untrained regime (Z2): default heads are unfitted ⇒ mask/floor pass-through;
    // the untrained agent must not regress below random.
    const plainManifold = createManifold(cache, { abstainThreshold: 0.05 });
    const untrainedAgent = new ManifoldRLAgent({
      cache,
      manifold: plainManifold,
      budget,
      epsilon: 0.05,
      rng: new SeededRNG(23).next.bind(new SeededRNG(23)),
    });
    const untrainedRewards: number[] = [];
    for (let ep = 0; ep < 50; ep++) {
      untrainedRewards.push(
        await untrainedAgent.runEpisode(new GridWorldGame({ grid, seed: ep }), 30)
      );
    }
    expect(avg(untrainedRewards)).toBeGreaterThanOrEqual(avg(randomRewards) - 0.1);
  }, 120_000);

  it('reward labels are recorded hash-only with a vector sidecar', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 600_000 });
    await cache.warmup(['x']);
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    const dataset = new (await import('../../nar/src/lm/system-one/distill.js')).JudgmentDataset();
    const sidecar = mkdtempSync(join(tmpdir(), 's1-vectors-'));
    dataset.setVectorSidecarPath(sidecar);

    const agent = new ManifoldRLAgent({ cache, manifold, budget, dataset, epsilon: 0.2 });
    await agent.runEpisode(new GridWorldGame({ grid, seed: 3 }), 10);

    expect(dataset.size).toBeGreaterThan(0);
    for (const label of dataset.all()) {
      expect(label.rubric).toBe('reflex_value');
      expect(label.evidenceId).toMatch(/^[0-9a-f]{16,}$/);
      expect(label.source).toBe('manifold-rl-agent');
      expect(label.label).toMatch(/^\d+$/); // action id, not raw text
      expect(JSON.stringify(label)).not.toContain('S...');
    }

    const flushed = await dataset.flushVectors();
    expect(flushed).toBeGreaterThan(0);
    const files = readdirSync(sidecar);
    expect(files.length).toBeGreaterThan(0);
    const bytes = readFileSync(join(sidecar, files[0]!));
    expect(bytes.byteLength % 4).toBe(0);
    expect(bytes.byteLength / 4).toBe(384);

    // direct label-source adapter also works
    const before = dataset.size;
    recordReflexOutcome(dataset, {
      stateDigest: 'sX',
      action: '1',
      reward: 1,
      source: 'test',
    });
    expect(dataset.size).toBe(before + 1);
  }, 60_000);
});
