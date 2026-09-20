#!/usr/bin/env node
/**
 * C3 demo: pure-System-One RL on GridWorldGame — no NAR, no RuleProcessor,
 * no kernel gates. Only EmbeddingCache + JudgmentManifold (+ optional
 * JudgmentDataset labels). Run: pnpm exec tsx scripts/rl-manifold.ts [episodes]
 */
import { EmbeddingCache } from '../nar/src/lm/system-one/embedding-cache.js';
import { createManifold } from '../nar/src/lm/system-one/manifold.js';
import { ManifoldRLAgent } from '../nar/src/lm/system-one/manifold-rl-agent.js';
import { GridWorldGame } from '../nar/src/game/GridWorldGame.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';

const episodes = Number(process.argv[2] ?? 20);
const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};
const grid = ['S...', '.#..', '..#.', '...G'];

const cache = new EmbeddingCache({ maxSize: 1000, ttlMs: 600_000 });
await cache.warmup(['gridworld']);
const manifold = createManifold(cache, { abstainThreshold: 0.05 });

const agent = new ManifoldRLAgent({ cache, manifold, budget, epsilon: 0.1 });

const rewards: number[] = [];
for (let ep = 0; ep < episodes; ep++) {
  const game = new GridWorldGame({ grid, seed: ep });
  rewards.push(await agent.runEpisode(game, 30));
}

const avg = rewards.reduce((a, b) => a + b, 0) / rewards.length;
console.log(`ManifoldRLAgent over ${episodes} GridWorld episodes:`);
console.log(`  avg reward: ${avg.toFixed(4)}  min: ${Math.min(...rewards).toFixed(2)}  max: ${Math.max(...rewards).toFixed(2)}`);
console.log(`  policy: eps-greedy (untrained hash heads — see Bench 20/21 for fitted regimes)`);
