import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { currentIdCount } from '@senars/util';
import { createNAR } from '../../nar/src';
import { createSeNARSRegistry } from '../../nar/src/lm';
import { createLMService } from '../../nar/src/lm/lm-service';
import {
  type ConsistencyBoundary,
  decodeBoundary,
  encodeBoundary,
} from '../../nar/src/state/boundary.js';
import { encodeState } from '../../nar/src/state/codec.js';
import { NarEventBus } from '../../nar/src/types/events.js';

const testStateDir = join(process.cwd(), '.cache', 'test-core19-c4');

const priorityOf = (nar: ReturnType<typeof createNAR>, term: string): number | undefined =>
  nar.listConcepts().find((c) => c.term.toString() === term)?.priority;

const boundary: ConsistencyBoundary = {
  cycleCount: 7,
  pendingTasks: [{ term: '(a --> b).', type: 'belief' }],
  idHighWater: 42,
};

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

  const narOptions = () => ({
    providerRegistry: createSeNARSRegistry(),
    lmService: createLMService(),
    persistState: true,
    statePath: testStateDir,
    maxConcepts: 500,
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
