/**
 * Obligation 5 (W1): a seeded end-to-end run is byte-identical.
 *
 * Two fresh seeds-identical environments, two economies, two loops; the
 * observable event stream and the config digest must agree byte for byte.
 * This is the kill criterion: if the living slice cannot replay, the core
 * premise is false.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { configDigest } from '../../src/config/digest';
import { createEconomyScheduler, type Economy, type EconomyTask, type SchedulerConfig } from '../../src/economy/index';
import { createFacultyRegistry } from '../../src/faculties/specs';
import { createOracleRegistry } from '../../src/oracles/oracle';
import { createEnv, createEnvCore, type Env } from '../../src/kernel/env';
import { createCognitiveLoop, LOOP_EVENTS, type LoopEvent } from '../../src/loop/index';
import { createLogStore } from '../../src/log/store';
import { createOraclePinStore, withOraclePin } from '../../src/oracles/pins';
import { termInterner } from '../../src/kernel/terms/intern';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

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
  readonly logEvents: any[];
  readonly digest: string;
  readonly oraclePins: any[];
}

const LOG_DIR = join(process.cwd(), 'data', 'test-log');
const PIN_DIR = join(process.cwd(), 'data', 'test-oracle-pins');

const cleanup = () => {
  try { rmSync(LOG_DIR, { recursive: true, force: true }); } catch {}
  try { rmSync(PIN_DIR, { recursive: true, force: true }); } catch {}
};

const replay = async (seed: number, initialTime = 0, logStore?: any, pinStore?: any): Promise<Replay> => {
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

  // Wire loop events to log if logStore provided
  if (logStore) {
    const { wireLoopToLog } = await import('../../src/loop/log-adapter');
    wireLoopToLog(loop, { handleEvent: (e: LoopEvent) => logStore.append(e as any) } as any);
  }

  await loop.run(3);
  await loop.close();

  // Collect oracle pins if pinStore provided
  const oraclePins = pinStore ? await pinStore.getPinsForOperation('engine.tau-prolog') : [];

  return { env, events, logEvents: [], digest: configDigest({ events, seed }), oraclePins };
};

describe('W1 — seeded end-to-end replay', () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

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

  it('replays byte-identically with log store', async () => {
    const logStore1 = createLogStore({ dir: join(LOG_DIR, 'run1'), syncOnAppend: false });
    const logStore2 = createLogStore({ dir: join(LOG_DIR, 'run2'), syncOnAppend: false });
    await logStore1.open();
    await logStore2.open();

    const first = await replay(42, 0, logStore1);
    const second = await replay(42, 0, logStore2);

    await logStore1.close();
    await logStore2.close();

    // Read all log entries and compare
    const firstEntries = await logStore1.readRange(1, logStore1.getCurrentSeq());
    const secondEntries = await logStore2.readRange(1, logStore2.getCurrentSeq());

    expect(JSON.stringify(secondEntries)).toBe(JSON.stringify(firstEntries));
    expect(second.digest).toBe(first.digest);
  });

  it('replays byte-identically with oracle pins', async () => {
    const pinStore1 = createOraclePinStore({ dir: join(PIN_DIR, 'run1') });
    const pinStore2 = createOraclePinStore({ dir: join(PIN_DIR, 'run2') });
    await pinStore1.open();
    await pinStore2.open();

    const first = await replay(42, 0, undefined, pinStore1);
    const second = await replay(42, 0, undefined, pinStore2);

    await pinStore1.close();
    await pinStore2.close();

    // Compare oracle pins
    expect(JSON.stringify(second.oraclePins)).toBe(JSON.stringify(first.oraclePins));
    expect(second.digest).toBe(first.digest);
  });

  it('replays byte-identically with both log store and oracle pins', async () => {
    const logStore1 = createLogStore({ dir: join(LOG_DIR, 'run1-full'), syncOnAppend: false });
    const logStore2 = createLogStore({ dir: join(LOG_DIR, 'run2-full'), syncOnAppend: false });
    const pinStore1 = createOraclePinStore({ dir: join(PIN_DIR, 'run1-full') });
    const pinStore2 = createOraclePinStore({ dir: join(PIN_DIR, 'run2-full') });

    await logStore1.open();
    await logStore2.open();
    await pinStore1.open();
    await pinStore2.open();

    const first = await replay(42, 0, logStore1, pinStore1);
    const second = await replay(42, 0, logStore2, pinStore2);

    await logStore1.close();
    await logStore2.close();
    await pinStore1.close();
    await pinStore2.close();

    // Compare log entries
    const firstEntries = await logStore1.readRange(1, logStore1.getCurrentSeq());
    const secondEntries = await logStore2.readRange(1, logStore2.getCurrentSeq());
    expect(JSON.stringify(secondEntries)).toBe(JSON.stringify(firstEntries));

    // Compare oracle pins
    const firstPins = await pinStore1.getPinsForOperation('engine.tau-prolog');
    const secondPins = await pinStore2.getPinsForOperation('engine.tau-prolog');
    expect(JSON.stringify(secondPins)).toBe(JSON.stringify(firstPins));

    expect(second.digest).toBe(first.digest);
  });
});