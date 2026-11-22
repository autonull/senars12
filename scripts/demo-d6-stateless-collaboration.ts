#!/usr/bin/env tsx
/** D6 — Stateless Collaboration: two agents share log, no shared state. Seed: 131415 */

import { createEnv } from '../src/kernel/env.js';
import { createOracleRegistry } from '../src/oracles/oracle.js';
import { createFacultyRegistry } from '../src/faculties/index.js';
import { createCognitiveLoop } from '../src/loop/index.js';
import { createLogStore } from '../src/log/store.js';
import { createEconomyStateFromEnv } from '../src/economy/index.js';
import { configDigest } from '../src/config/digest.js';

async function main() {
  const seed = 131415;
  const logStore = createLogStore({ path: '.data/demo-d6.log', maxBytes: 10_000_000 });
  await logStore.open();

  const core = { seed, clock: { now: () => Date.now() } };

  // Agent A
  const envA = createEnv({ ...core, oracles: createOracleRegistry(), faculties: createFacultyRegistry(), log: logStore });
  const loopA = createCognitiveLoop(envA, null as any, null as any, createFacultyRegistry(), createOracleRegistry(), {
    maxIterations: 10, recordEnabled: true, contractsEnabled: false, repairEnabled: false, selfModelEnabled: false,
  });
  const economyStateA = createEconomyStateFromEnv(envA, {});
  const tasksA = new Map<string, any>();
  for (let i = 0; i < 10; i++) {
    const task = { id: `A-task-${i}`, term: { toString: () => `Agent A task ${i}` }, kind: 'goal', truth: { f: 1, c: 0.9 }, weight: 1, activation: 1, source: 'perception', createdAt: envA.clock.now(), lastAccessed: envA.clock.now(), accessCount: 0, dependencies: [], derived: false, tags: ['collaboration'] };
    tasksA.set(task.id, task);
  }
  loopA.getContext().economyState = { ...economyStateA, tasks: tasksA };
  for (const [, task] of tasksA) loopA.getContext().economyState.bags.get('belief')?.add(task.id);

  // Agent B
  const envB = createEnv({ ...core, oracles: createOracleRegistry(), faculties: createFacultyRegistry(), log: logStore });
  const loopB = createCognitiveLoop(envB, null as any, null as any, createFacultyRegistry(), createOracleRegistry(), {
    maxIterations: 10, recordEnabled: true, contractsEnabled: false, repairEnabled: false, selfModelEnabled: false,
  });
  const economyStateB = createEconomyStateFromEnv(envB, {});
  const tasksB = new Map<string, any>();
  for (let i = 0; i < 10; i++) {
    const task = { id: `B-task-${i}`, term: { toString: () => `Agent B task ${i}` }, kind: 'goal', truth: { f: 1, c: 0.9 }, weight: 1, activation: 1, source: 'perception', createdAt: envB.clock.now(), lastAccessed: envB.clock.now(), accessCount: 0, dependencies: [], derived: false, tags: ['collaboration'] };
    tasksB.set(task.id, task);
  }
  loopB.getContext().economyState = { ...economyStateB, tasks: tasksB };
  for (const [, task] of tasksB) loopB.getContext().economyState.bags.get('belief')?.add(task.id);

  await loopA.run(10);
  await loopB.run(10);
  await loopA.close();
  await loopB.close();

  const digest = configDigest({ demo: 'd6', seed, steps: 20 });
  console.log(JSON.stringify({ demo: 'd6', seed, digest, steps: 20 }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });