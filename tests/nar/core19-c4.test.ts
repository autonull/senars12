import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  currentIdCount,
  makeId,
  type RandomSource,
  SeededRNG,
  sequentialIdSource,
  type StatefulRandomSource,
} from '@senars/util';
import { createNAR, NAR } from '../../nar/src';
import { e2eNARConfig } from '../e2e/fixtures.js';
import { createSeNARSRegistry } from '../../nar/src/lm';
import { createLMService } from '../../nar/src/lm/lm-service';
import { persistGateLogs } from '../../nar/src/kernel/EventLogPersistence.js';
import { GateRegistry } from '../../nar/src/kernel/GateRegistry.js';
import { replayIntoMemory } from '../../nar/src/kernel/replay.js';
import { termParser } from '../../nar/src/terms/index.js';
import {
  type ConsistencyBoundary,
  decodeBoundary,
  encodeBoundary,
} from '../../nar/src/state/boundary.js';
import { encodeState } from '../../nar/src/state/codec.js';
import { readPersistedBoundary } from '../../nar/src/state/persisted.js';
import { NarEventBus } from '../../nar/src/types/events.js';

const testStateDir = join(process.cwd(), '.cache', 'test-core19-c4');

const priorityOf = (nar: ReturnType<typeof createNAR>, term: string): number | undefined =>
  nar.listConcepts().find((c) => c.term.toString() === term)?.priority;

const boundary: ConsistencyBoundary = {
  cycleCount: 7,
  pendingTasks: [{ term: '(a --> b).', type: 'belief' }],
  idHighWater: 42,
};

const narOptions = () => ({
  providerRegistry: createSeNARSRegistry(),
  lmService: createLMService(),
  persistState: true,
  statePath: testStateDir,
  maxConcepts: 500,
});

describe('CORE.19 C4 — consistency boundary codec', () => {
  it('round-trips the declared boundary through the state envelope', () => {
    expect(decodeBoundary(encodeBoundary(boundary))).toEqual(boundary);
  });

  it('refuses an unsupported schema version rather than guessing', () => {
    expect(() => decodeBoundary(encodeState('nar.boundary', 999, boundary))).toThrow(
      /Unsupported state version/
    );
  });

  it('restores an omitted field to its empty value, never an implied one', () => {
    expect(decodeBoundary(encodeState('nar.boundary', 1, { cycleCount: 3 }))).toEqual({
      cycleCount: 3,
      pendingTasks: [],
      idHighWater: 0,
    });
  });
});

describe('CORE.19 C4 — restart restores the declared boundary', () => {
  beforeEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
    await mkdir(testStateDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
  });

  it('resumes the cycle counter, concept priorities and id ledger, and announces it', async () => {
    const nar1 = createNAR(narOptions());
    await nar1.start();
    await nar1.believe('(cat --> animal).');
    await nar1.believe('(dog --> animal).');
    await nar1.run(5);

    const cycles = nar1.getCycleCount();
    const catPriority = priorityOf(nar1, '(cat --> animal)');
    const idBefore = currentIdCount();
    await nar1.stop();
    await nar1.dispose();

    const bus = new NarEventBus();
    const restored: Array<{ cycleCount: number; concepts: number; pendingTasks: number }> = [];
    bus.on('restore:state', (event) => restored.push(event));

    const nar2 = createNAR({ ...narOptions(), eventBus: bus });
    await nar2.start();

    expect(nar2.getCycleCount()).toBe(cycles);
    expect(priorityOf(nar2, '(cat --> animal)')).toBe(catPriority);
    expect(nar2.getBeliefs().length).toBeGreaterThan(0);
    expect(currentIdCount()).toBeGreaterThanOrEqual(idBefore);

    expect(restored).toHaveLength(1);
    expect(restored[0]).toEqual({
      cycleCount: cycles,
      concepts: expect.any(Number),
      pendingTasks: expect.any(Number),
    });

    await nar2.stop();
    await nar2.dispose();
  });

  it('announces nothing on a fresh start with no persisted state', async () => {
    const bus = new NarEventBus();
    const nar = createNAR({ ...narOptions(), eventBus: bus });
    const restored: unknown[] = [];
    bus.on('restore:state', (event) => restored.push(event));
    await nar.start();

    expect(nar.getCycleCount()).toBe(0);
    expect(restored).toHaveLength(0);

    await nar.stop();
    await nar.dispose();
  });
});

describe('CORE.19 C4.3 — restore replays the persisted gate log', () => {
  const freshStateDir = (): string => mkdtempSync(join(tmpdir(), 'core19-c4-3-'));

  const admit = (nar: ReturnType<typeof createNAR>): void => {
    nar.gates.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(a-->b).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
  };

  it('re-seeds the gate rings from the ledger, and does not re-append them', async () => {
    const statePath = freshStateDir();
    const nar1 = createNAR({ ...narOptions(), statePath });
    await nar1.start();
    nar1.gates.getActionGate().requestModeChange('propose-only', 'human', 'corr-c4-3');
    admit(nar1);
    expect(nar1.flushGateLogs()).toBeGreaterThanOrEqual(2);
    await nar1.stop();
    await nar1.dispose();

    const nar2 = createNAR({ ...narOptions(), statePath });
    await nar2.start();

    // The autonomy ring and the mode it ends at are restored together.
    const action = nar2.gates.getActionGate();
    expect(action.getAutonomyMode()).toBe('propose-only');
    expect(action.getAutonomyLog().some((e) => e.correlationId === 'corr-c4-3')).toBe(true);

    // The perception ring is re-seeded with the pre-restart admission.
    const perceptionTypes = new Set(nar2.gates.getPerceptionGate().getEventLog().map((e) => e.type));
    expect(perceptionTypes.has('task.admitted')).toBe(true);

    // Adopted: a flush re-appends nothing that was replayed.
    nar2.flushGateLogs();
    const entries = await nar2.getGateEventLedger()!.readEntries();
    expect(entries.filter((e) => e.correlationId === 'corr-c4-3')).toHaveLength(1);

    await nar2.stop();
    await nar2.dispose();
  });
});

describe('CORE.19 C4.4 — replay entropy is injectable', () => {
  const gateLog = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'core19-c4-4-'));
    const gatePath = join(dir, 'gate-events.jsonl');
    const registry = new GateRegistry();
    registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(a-->b).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    persistGateLogs(registry, gatePath);
    return gatePath;
  };

  it('mints task ids from the injected source, deterministically', async () => {
    const gatePath = gateLog();
    const withIds = (ids: () => string) =>
      replayIntoMemory({ gateEventsPath: gatePath, ids, clock: () => 0 });

    const first = await withIds(sequentialIdSource());
    const second = await withIds(sequentialIdSource());
    const beliefId = (memory: Awaited<ReturnType<typeof replayIntoMemory>>['memory']): string =>
      memory.getConcept(termParser.parse('(a-->b)'))!.getBeliefs()[0]!.id;

    expect(beliefId(first.memory)).toBe(beliefId(second.memory));
    expect(beliefId(first.memory)).toMatch(/^00000000-0000-4000-8000-/);
  });

  it('restores the ambient id source after the replay', async () => {
    const gatePath = gateLog();
    await replayIntoMemory({ gateEventsPath: gatePath, ids: sequentialIdSource() });
    const before = currentIdCount();
    const ambient = makeId();
    expect(ambient).not.toMatch(/^00000000-0000-4000-8000-/);
    expect(currentIdCount()).toBe(before + 1);
  });
});

describe('CORE.19 C4.1 — the owned RNG round-trips its position', () => {
  beforeEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
    await mkdir(testStateDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
  });

  const rngNar = (rng: RandomSource | StatefulRandomSource): NAR =>
    new NAR(
      e2eNARConfig({
        providerRegistry: createSeNARSRegistry(),
        lmService: createLMService(),
        persistState: true,
        statePath: testStateDir,
        rng,
      })
    );

  it('saves a stateful source position and resumes the exact stream', async () => {
    const rng1 = new SeededRNG(42);
    const nar1 = rngNar(rng1);
    await nar1.start();
    await nar1.believe('(cat --> animal).');
    await nar1.run(5);
    await nar1.stop();
    const savedState = rng1.getState();
    await nar1.dispose();

    const persisted = readPersistedBoundary(testStateDir);
    expect(typeof persisted?.rngState).toBe('number');
    expect(persisted?.rngState).toBe(savedState);

    const rng2 = new SeededRNG(1);
    const nar2 = rngNar(rng2);
    await nar2.start();
    expect(rng2.getState()).toBe(savedState);

    const reference = new SeededRNG(1);
    reference.setState(savedState);
    expect(rng2.next()).toBe(reference.next());

    await nar2.stop();
    await nar2.dispose();
  });

  it('omits RNG state for a bare random source (declared, not guessed)', async () => {
    const nar = rngNar(() => 0.5);
    await nar.start();
    await nar.believe('(a --> b).');
    await nar.run(2);
    await nar.stop();
    await nar.dispose();

    expect(readPersistedBoundary(testStateDir)?.rngState).toBeUndefined();
  });
});
