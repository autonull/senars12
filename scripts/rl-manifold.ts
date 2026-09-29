#!/usr/bin/env node
/**
 * C3 demo: pure-System-One RL on GridWorldGame — no NAR, no RuleProcessor,
 * no kernel gates. Only EmbeddingCache + JudgmentManifold (+ optional
 * JudgmentDataset labels). Run: pnpm exec tsx scripts/rl-manifold.ts [episodes]
 */
import { mean } from '@senars/util';
import { EmbeddingCache } from '../nar/src/lm/system-one/embedding-cache.js';
import { GridWorldGame } from '../nar/src/game/GridWorldGame.js';
import { createManifold } from '../nar/src/lm/system-one/manifold.js';
import { ManifoldRLAgent } from '../nar/src/lm/system-one/manifold-rl-agent.js';
import { createSystemOneBudget } from '../nar/src/lm/system-one/types.js';
import { loadConfig } from '../src/config/index.js';

const episodes = Number(process.argv[2] ?? 20);
const budget = createSystemOneBudget();
const grid = ['S...', '.#..', '..#.', '...G'];

const cache = new EmbeddingCache({ maxSize: 1000, ttlMs: 600_000 });
await cache.warmup(['gridworld']);
const manifold = createManifold(cache, { abstainThreshold: 0.05 });

const appConfig = await loadConfig().catch(() => null);
const rlConfig = appConfig?.systemOne?.rl;
const agent = new ManifoldRLAgent({
  cache,
  manifold,
  budget,
  policy: rlConfig?.policy ?? 'eps-greedy',
  epsilon: rlConfig?.epsilon ?? 0.1,
  ucbC: rlConfig?.ucbC ?? 0.5,
  feasibilityMask: rlConfig?.feasibilityMask ?? true,
  riskFloor: rlConfig?.riskFloor ?? 0.8,
  labelOutcomes: rlConfig?.labelOutcomes ?? true,
});

const rewards: number[] = [];
for (let ep = 0; ep < episodes; ep++) {
  const game = new GridWorldGame({ grid, seed: ep });
  rewards.push(await agent.runEpisode(game, 30));
}

const avg = mean(rewards);
console.log(`ManifoldRLAgent over ${episodes} GridWorld episodes:`);
console.log(
  `  avg reward: ${avg.toFixed(4)}  min: ${Math.min(...rewards).toFixed(2)}  max: ${Math.max(...rewards).toFixed(2)}`
);
console.log(
  `  policy: ${rlConfig?.policy ?? 'eps-greedy'} ε=${rlConfig?.epsilon ?? 0.1} (untrained hash heads — see Bench 20/21 for fitted regimes)`
);
