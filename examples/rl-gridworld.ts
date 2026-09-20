/**
 * Pure-System-One RL — a GridWorld driven by the Judgment Manifold alone
 * (no NAR, no RuleProcessor, no NAL). Run: `pnpm tsx examples/rl-gridworld.ts`
 */
import { ManifoldRLAgent } from '../nar/src/lm/system-one/manifold-rl-agent.js';
import { createManifold } from '../nar/src/lm/system-one/manifold.js';
import { EmbeddingCache } from '../nar/src/lm/system-one/embedding-cache.js';
import { GridWorldGame } from '../nar/src/game/GridWorldGame.js';
import type { GridWorldState } from '../nar/src/game/GridWorldEnv.js';
import type { JudgmentHead, JudgmentQuery } from '../nar/src/lm/system-one/types.js';

const budget = {
  maxCycles: 100, maxDepth: 10, maxMemoryOps: 1000, maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const GOAL = { row: 3, col: 3 };
const digest = (s: GridWorldState) =>
  JSON.stringify({ row: s.row, col: s.col, distanceToGoal: Math.abs(s.row - GOAL.row) + Math.abs(s.col - GOAL.col) });

const cache = new EmbeddingCache({ maxSize: 1000, ttlMs: 60_000 });
const manifold = createManifold(cache);

// A hand-specified value head (a trained head from the distillation pipeline slots in here)
const valueHead: JudgmentHead = {
  rubric: 'reflex_value',
  axis: 'teleological',
  fitted: true,
  async evaluate(_embedding: Float32Array, query: JudgmentQuery) {
    const action = Number(query.instruction.match(/action (\S+)$/)?.[1]);
    return { score: action === 1 || action === 3 ? 0.6 : 0.4, abstained: false }; // prefer right/down
  },
};
manifold.registerHead(valueHead);

const game = new GridWorldGame({ grid: ['S...', '.#..', '..#.', '...G'], seed: 42, maxSteps: 50 });
const agent = new ManifoldRLAgent({ cache, manifold, budget, epsilon: 0.1 });

let total = 0;
for (let episode = 1; episode <= 10; episode++) {
  let steps = 0;
  while (steps < 50) {
    const { action } = await agent.decide(game);
    const outcome = game.step(action);
    total += outcome.reward;
    steps++;
    if (outcome.terminal) break;
  }
  console.log(`episode ${episode}: reward=${total.toFixed(1)}`);
  game.reset();
}
