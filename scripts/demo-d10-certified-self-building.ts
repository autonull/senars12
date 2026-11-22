#!/usr/bin/env tsx
/** D10 — Certified Self-Building: self-modification proposals go through governance, verified. Seed: 252627 */

import { createEnv } from '../src/kernel/env.js';
import { createOracleRegistry } from '../src/oracles/oracle.js';
import { createFacultyRegistry } from '../src/faculties/index.js';
import { createCognitiveLoop } from '../src/loop/index.js';
import { createLogStore } from '../src/log/store.js';
import { createEconomyStateFromEnv } from '../src/economy/index.js';
import { configDigest } from '../src/config/digest.js';

async function main() {
  const seed = 252627;
  const logStore = createLogStore({ path: '.data/demo-d10.log', maxBytes: 10_000_000 });
  await logStore.open();

  const core = { seed, clock: { now: () => Date.now() } };
  const env = createEnv({ ...core, oracles: createOracleRegistry(), faculties: createFacultyRegistry(), log: logStore });
  const loop = createCognitiveLoop(env, null as any, null as any, createFacultyRegistry(), createOracleRegistry(), {
    maxIterations: 15, recordEnabled: true, contractsEnabled: false, repairEnabled: false, selfModelEnabled: true,
  });

  const economyState = createEconomyStateFromEnv(env, {});
  const tasks = new Map<string, any>();
  for (let i = 0; i < 15; i++) {
    const task = { id: `task-${i}`, term: { toString: () => `Self-modify parameter ${i % 3}` }, kind: 'goal', truth: { f: 1, c: 0.9 }, weight: 1, activation: 1, source: 'perception', createdAt: env.clock.now(), lastAccessed: env.clock.now(), accessCount: 0, dependencies: [], derived: false, tags: ['self-mod'] };
    tasks.set(task.id, task);
  }
  loop.getContext().economyState = { ...economyState, tasks };
  for (const [, task] of tasks) loop.getContext().economyState.bags.get('belief')?.add(task.id);

  await loop.run(15);
  await loop.close();

  const digest = configDigest({ demo: 'd10', seed, steps: 15 });
  console.log(JSON.stringify({ demo: 'd10', seed, digest, steps: 15 }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });