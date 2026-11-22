#!/usr/bin/env tsx
/** D7 — Continuous Seeded World: byte-identical replay from same seed. Seed: 161718 */

import { createEnv } from '../src/kernel/env.js';
import { createOracleRegistry } from '../src/oracles/oracle.js';
import { createFacultyRegistry } from '../src/faculties/index.js';
import { createCognitiveLoop } from '../src/loop/index.js';
import { createLogStore } from '../src/log/store.js';
import { createEconomyStateFromEnv } from '../src/economy/index.js';
import { configDigest } from '../src/config/digest.js';

async function run(seed: number, path: string) {
  const logStore = createLogStore({ path, maxBytes: 10_000_000 });
  await logStore.open();
  const core = { seed, clock: { now: () => Date.now() } };
  const env = createEnv({ ...core, oracles: createOracleRegistry(), faculties: createFacultyRegistry(), log: logStore });
  const loop = createCognitiveLoop(env, null as any, null as any, createFacultyRegistry(), createOracleRegistry(), {
    maxIterations: 30, recordEnabled: true, contractsEnabled: false, repairEnabled: false, selfModelEnabled: false,
  });
  const economyState = createEconomyStateFromEnv(env, {});
  const tasks = new Map<string, any>();
  for (let i = 0; i < 30; i++) {
    const task = { id: `task-${i}`, term: { toString: () => `World step ${i}` }, kind: 'goal', truth: { f: 1, c: 0.9 }, weight: 1, activation: 1, source: 'perception', createdAt: env.clock.now(), lastAccessed: env.clock.now(), accessCount: 0, dependencies: [], derived: false, tags: ['world'] };
    tasks.set(task.id, task);
  }
  loop.getContext().economyState = { ...economyState, tasks };
  for (const [, task] of tasks) loop.getContext().economyState.bags.get('belief')?.add(task.id);
  await loop.run(30);
  await loop.close();
  await logStore.close();
  return configDigest({ demo: 'd7', seed, steps: 30 });
}

async function main() {
  const seed = 161718;
  const [digest1, digest2] = await Promise.all([
    run(seed, '.data/demo-d7-run1.log'),
    run(seed, '.data/demo-d7-run2.log'),
  ]);
  console.log(JSON.stringify({ demo: 'd7', seed, digest1, digest2, replayIdentical: digest1 === digest2 }, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });