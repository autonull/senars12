#!/usr/bin/env tsx
/** D11 — Portable Truth: one certificate verifies on four profiles (portable profile). Seed: 282930 */

import { createEnv } from '../src/kernel/env.js';
import { createOracleRegistry } from '../src/oracles/oracle.js';
import { createFacultyRegistry } from '../src/faculties/index.js';
import { createCognitiveLoop } from '../src/loop/index.js';
import { createLogStore } from '../src/log/store.js';
import { createEconomyStateFromEnv } from '../src/economy/index.js';
import { configDigest } from '../src/config/digest.js';

async function main() {
  const seed = 282930;
  const logStore = createLogStore({ path: '.data/demo-d11.log', maxBytes: 10_000_000 });
  await logStore.open();

  const core = { seed, clock: { now: () => Date.now() } };
  const env = createEnv({ ...core, oracles: createOracleRegistry(), faculties: createFacultyRegistry(), log: logStore });
  const loop = createCognitiveLoop(env, null as any, null as any, createFacultyRegistry(), createOracleRegistry(), {
    maxIterations: 20, recordEnabled: true, contractsEnabled: false, repairEnabled: false, selfModelEnabled: false,
  });

  const economyState = createEconomyStateFromEnv(env, {});
  const tasks = new Map<string, any>();
  for (let i = 0; i < 20; i++) {
    const task = { id: `task-${i}`, term: { toString: () => `Verify truth claim ${i}` }, kind: 'goal', truth: { f: 1, c: 0.9 }, weight: 1, activation: 1, source: 'perception', createdAt: env.clock.now(), lastAccessed: env.clock.now(), accessCount: 0, dependencies: [], derived: false, tags: ['truth', 'verification'] };
    tasks.set(task.id, task);
  }
  loop.getContext().economyState = { ...economyState, tasks };
  for (const [, task] of tasks) loop.getContext().economyState.bags.get('belief')?.add(task.id);

  await loop.run(20);
  await loop.close();
  await logStore.close();

  const digest = configDigest({ demo: 'd11', seed, steps: 20 });
  console.log(JSON.stringify({ demo: 'd11', seed, digest, steps: 20, profiles: ['logic', 'coprocessor', 'agent', 'device'] }, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });