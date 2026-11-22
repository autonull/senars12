#!/usr/bin/env tsx
/** D2 — Repair Loop: contradiction detection → repair → re-derive. Seed: 123 */

import { createEnv } from '../src/kernel/env.js';
import { createOracleRegistry } from '../src/oracles/oracle.js';
import { createFacultyRegistry } from '../src/faculties/index.js';
import { createCognitiveLoop } from '../src/loop/index.js';
import { createLogStore } from '../src/log/store.js';
import { createEconomyStateFromEnv } from '../src/economy/index.js';
import { configDigest } from '../src/config/digest.js';

async function main() {
  const seed = 123;
  const logStore = createLogStore({ path: '.data/demo-d2.log', maxBytes: 10_000_000 });
  await logStore.open();

  const core = { seed, clock: { now: () => Date.now() } };
  const env = createEnv({ ...core, oracles: createOracleRegistry(), faculties: createFacultyRegistry(), log: logStore });
  const loop = createCognitiveLoop(env, null as any, null as any, createFacultyRegistry(), createOracleRegistry(), {
    maxIterations: 10, recordEnabled: true, contractsEnabled: false, repairEnabled: true, selfModelEnabled: false,
  });

  // Inject contradictory beliefs as tasks
  const economyState = createEconomyStateFromEnv(env, {});
  const task1 = { id: 'task-1', term: { toString: () => 'Target at (5,5)' }, kind: 'belief', truth: { f: 1, c: 0.9 }, weight: 1, activation: 1, source: 'perception', createdAt: env.clock.now(), lastAccessed: env.clock.now(), accessCount: 0, dependencies: [], derived: false, tags: ['grounding'] };
  const task2 = { id: 'task-2', term: { toString: () => 'Target at (10,10)' }, kind: 'belief', truth: { f: 1, c: 0.9 }, weight: 1, activation: 1, source: 'perception', createdAt: env.clock.now(), lastAccessed: env.clock.now(), accessCount: 0, dependencies: [], derived: false, tags: ['grounding'] };
  loop.getContext().economyState = { ...economyState, tasks: new Map(economyState.tasks).set(task1.id, task1).set(task2.id, task2) };
  loop.getContext().economyState.bags.get('belief')?.add(task1.id);
  loop.getContext().economyState.bags.get('belief')?.add(task2.id);

  await loop.run(10);
  await loop.close();

  const digest = configDigest({ demo: 'd2', seed, steps: 10 });
  console.log(JSON.stringify({ demo: 'd2', seed, digest, steps: 10 }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });