#!/usr/bin/env tsx
/** D1 — Mission Intake: perception → grounding → belief formation from natural language. Seed: 42 */

import { createEnv } from '../src/kernel/env.js';
import { createOracleRegistry } from '../src/oracles/oracle.js';
import { createFacultyRegistry } from '../src/faculties/index.js';
import { createCognitiveLoop } from '../src/loop/index.js';
import { createLogStore } from '../src/log/store.js';
import { createEconomyStateFromEnv } from '../src/economy/index.js';
import { configDigest } from '../src/config/digest.js';

async function main() {
  const seed = 42;
  const logStore = createLogStore({ path: '.data/demo-d1.log', maxBytes: 10_000_000 });
  await logStore.open();

  const core = { seed, clock: { now: () => Date.now() } };
  const env = createEnv({ ...core, oracles: createOracleRegistry(), faculties: createFacultyRegistry(), log: logStore });
  const loop = createCognitiveLoop(env, null as any, null as any, createFacultyRegistry(), createOracleRegistry(), {
    maxIterations: 5, recordEnabled: true, contractsEnabled: false, repairEnabled: false, selfModelEnabled: false,
  });

  // Inject a simple task
  const economyState = createEconomyStateFromEnv(env, {});
  const task = { id: 'task-1', term: { toString: () => 'Navigate to target zone' }, kind: 'goal', truth: { f: 1, c: 0.9 }, weight: 1, activation: 1, source: 'perception', createdAt: env.clock.now(), lastAccessed: env.clock.now(), accessCount: 0, dependencies: [], derived: false, tags: ['grounding'] };
  loop.getContext().economyState = { ...economyState, tasks: new Map(economyState.tasks).set(task.id, task) };
  loop.getContext().economyState.bags.get('belief')?.add(task.id);

  await loop.run(5);
  await loop.close();
  await logStore.close();

  const digest = configDigest({ demo: 'd1', seed, steps: 5 });
  console.log(JSON.stringify({ demo: 'd1', seed, digest, steps: 5 }, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });