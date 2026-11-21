/**
 * Obligation 5 (W1): a seeded end-to-end run is byte-identical.
 *
 * Two fresh seeds-identical environments, two economies, two loops; the
 * observable event stream and the config digest must agree byte for byte.
 * This is the kill criterion: if the living slice cannot replay, the core
 * premise is false.
 */

import { describe, expect, it } from 'vitest';
import { configDigest } from '../../src/config/digest.js';
import { createEconomyScheduler, type Economy, type EconomyTask, type SchedulerConfig } from '../../src/economy/index.js';
import { createFacultyRegistry } from '../../src/faculties/specs.js';
import { createOracleRegistry } from '../../src/oracles/oracle.js';
import { createEnv, createEnvCore, type Env } from '../../src/kernel/env.js';
import { createCognitiveLoop, LOOP_EVENTS, type LoopEvent } from '../../src/loop/index.js';
import { termInterner } from '../../src/kernel/terms/intern.js';

const makeTask = (id: string, term: string, createdAt: number): EconomyTask => ({
  id,
  term: termInterner.constant(term),
  kind: 'belief',
  truth: { f: 1, c: 0.9 },
  weight: 1,
  activation: 1,
  source: 'perception',
  createdAt,
  lastAccessed: createdAt,
  accessCount: 0,
  dependencies: [],
  derived: false,
  tags: ['grounding'],
});

interface Replay {
  readonly env: Env;
  readonly events: LoopEvent[];
  readonly digest: string;
}

const replay = async (seed: number, initialTime = 0): Promise<Replay> => {
  const core = createEnvCore({ seed, initialTime: initialTime as never });
  const scheduler = createEconomyScheduler({ seed, clock: core.clock } satisfies Partial<SchedulerConfig>);
  const economy: Economy = {
    addTask: (task) => scheduler.addTask(task),
    removeTask: (id) => scheduler.removeTask(id),
    updateTask: (id, updates) => scheduler.updateTask(id, updates),
    getTask: (id) => scheduler.getTask(id),
    getTasksByKind: (kind) => scheduler.getTasksByKind(kind),
    getAllTasks: () => scheduler.getAllTasks(),
    schedule: (successors) => scheduler.schedule(successors),
    getState: () => scheduler.getState(),
    getStats: () => scheduler.getStats(),
    activateOverlay: (overlay) => scheduler.activateOverlay(overlay),
    deactivateOverlay: (id) => scheduler.deactivateOverlay(id),
    setSeed: (next) => scheduler.setSeed(next),
    on: (type, listener) => scheduler.on(type, listener),
  };
  const env = createEnv({
    ...core,
    oracles: createOracleRegistry(),
    faculties: createFacultyRegistry(),
    economy,
  });

  const task = makeTask('task-1', 'grounding', env.clock.now());
  economy.addTask(task);

  const loop = createCognitiveLoop(env, economy, scheduler, createFacultyRegistry(), createOracleRegistry(), {
    maxIterations: 3,
    recordEnabled: false,
    contractsEnabled: false,
    repairEnabled: false,
    selfModelEnabled: false,
  });

  const events: LoopEvent[] = [];
  for (const type of LOOP_EVENTS) loop.onEvent(type, (event) => events.push(event));

  await loop.run(3);
  await loop.close();

  return { env, events, digest: configDigest({ events, seed }) };
};

describe('W1 — seeded end-to-end replay', () => {
  it('replays byte-identically from the same seed', async () => {
    const first = await replay(42);
    const second = await replay(42);
    expect(JSON.stringify(second.events)).toBe(JSON.stringify(first.events));
    expect(second.digest).toBe(first.digest);
  });

  it('separates different initial times', async () => {
    const first = await replay(42, 0);
    const shifted = await replay(42, 1000);
    expect(JSON.stringify(shifted.events)).not.toBe(JSON.stringify(first.events));
  });

  it('advances the deterministic clock only through the environment', async () => {
    const core = createEnvCore({ seed: 7 });
    const start = core.clock.now();
    core.clock.advance(10);
    expect(core.clock.now()).toBe(start + 10);
  });
});
