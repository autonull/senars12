#!/usr/bin/env tsx
/** D9 — Compounding: knowledge accumulates across episodes (skills, schemas, beliefs). Seed: 222324 */

import { createEnv } from '../src/kernel/env.js';
import { createOracleRegistry } from '../src/oracles/oracle.js';
import { createFacultyRegistry } from '../src/faculties/index.js';
import { createCognitiveLoop } from '../src/loop/index.js';
import { createLogStore } from '../src/log/store.js';
import { createEconomyStateFromEnv } from '../src/economy/index.js';
import { configDigest } from '../src/config/digest.js';

async function main() {
  const seed = 222324;
  const logStore = createLogStore({ path: '.data/demo-d9.log', maxBytes: 10_000_000 });
  await logStore.open();

  const core = { seed, clock: { now: () => Date.now() } };
  const env = createEnv({ ...core, oracles: createOracleRegistry(), faculties: createFacultyRegistry(), log: logStore });
  const loop = createCognitiveLoop(env, null as any, null as any, createFacultyRegistry(), createOracleRegistry(), {
    maxIterations: 25, recordEnabled: true, contractsEnabled: false, repairEnabled: false, selfModelEnabled: false,
  });

  const economyState = createEconomyStateFromEnv(env, {});
  const tasks = new Map<string, any>();
  for (let i = 0; i < 25; i++) {
    const task = { id: `task-${i}`, term: { toString: () => `Accumulate knowledge chunk ${i}` }, kind: 'goal', truth: { f: 1, c: 0.9 }, weight: 1, activation: 1, source: 'perception', createdAt: env.clock.now(), lastAccessed: env.clock.now(), accessCount: 0, dependencies: [], derived: false, tags: ['compounding'] };
    tasks.set(task.id, task);
  }
  loop.getContext().economyState = { ...economyState, tasks };
  for (const [, task] of tasks) loop.getContext().economyState.bags.get('belief')?.add(task.id);

  await loop.run(25);
  await loop.close();
  await logStore.close();

  const digest = configDigest({ demo: 'd9', seed, steps: 25 });
  console.log(JSON.stringify({ demo: 'd9', seed, digest, steps: 25 }, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });