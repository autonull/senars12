#!/usr/bin/env tsx
/** D8 — Side-by-Side Lanes: Arena A–D × fast/balanced/deliberate symmetric arms. Seed: 192021 */

import { createEnv } from '../src/kernel/env.js';
import { createOracleRegistry } from '../src/oracles/oracle.js';
import { createFacultyRegistry } from '../src/faculties/index.js';
import { createCognitiveLoop } from '../src/loop/index.js';
import { createLogStore } from '../src/log/store.js';
import { createEconomyStateFromEnv } from '../src/economy/index.js';
import { configDigest } from '../src/config/digest.js';

async function main() {
  const seed = 192021;
  const logStore = createLogStore({ path: '.data/demo-d8.log', maxBytes: 10_000_000 });
  await logStore.open();

  const core = { seed, clock: { now: () => Date.now() } };
  const env = createEnv({ ...core, oracles: createOracleRegistry(), faculties: createFacultyRegistry(), log: logStore });
  const loop = createCognitiveLoop(env, null as any, null as any, createFacultyRegistry(), createOracleRegistry(), {
    maxIterations: 40, recordEnabled: true, contractsEnabled: false, repairEnabled: false, selfModelEnabled: false,
  });

  const lanes = ['A-fast', 'B-balanced', 'C-deliberate', 'D-quality'];
  const economyState = createEconomyStateFromEnv(env, {});
  const tasks = new Map<string, any>();
  for (let i = 0; i < 40; i++) {
    const lane = lanes[i % 4];
    const task = { id: `task-${i}`, term: { toString: () => `Lane ${lane} step ${i}` }, kind: 'goal', truth: { f: 1, c: 0.9 }, weight: 1, activation: 1, source: 'perception', createdAt: env.clock.now(), lastAccessed: env.clock.now(), accessCount: 0, dependencies: [], derived: false, tags: ['arena', lane] };
    tasks.set(task.id, task);
  }
  loop.getContext().economyState = { ...economyState, tasks };
  for (const [, task] of tasks) loop.getContext().economyState.bags.get('belief')?.add(task.id);

  await loop.run(40);
  await loop.close();
  await logStore.close();

  const digest = configDigest({ demo: 'd8', seed, steps: 40, lanes });
  console.log(JSON.stringify({ demo: 'd8', seed, digest, steps: 40, lanes }, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });