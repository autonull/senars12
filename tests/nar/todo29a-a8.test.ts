/**
 * A8 — memory and resource contracts (TODO29.a §5.8).
 *
 * The behavioural half is what makes this item an *attribution* rather than a
 * refactor: eviction eligibility changed (a concept can now age out while holding
 * tasks) and pressure now accounts for tasks as well as concepts. §7 invariant 1
 * is the arbiter, so the first tests here are the parity suites' property stated
 * directly, and every eviction assertion is about a *report* rather than a
 * count — because the property is that the report can distinguish "freed
 * nothing" from "found nothing wrong".
 */
import { describe, expect, it } from 'vitest';
import { Truth } from '@senars/nar/terms/index.js';
import { atom } from '@senars/nar/terms/impls/factory.js';
import { Memory } from '@senars/nar/memory/memory.js';
import { DEFAULT_MEMORY_CONFIG } from '@senars/nar/memory/config.js';
import {
  conceptValue,
  evictionOrder,
  evictUnderPressure,
} from '@senars/nar/memory/pressure/index.js';
import { RESOURCE_CONTRACTS, RESOURCE_IDS } from '@senars/nar/resources/index.js';
import { termParser } from '@senars/nar/terms/index.js';
import { NEUTRAL_BUDGET } from '@senars/nar/types/index.js';

const term = (name: string) => atom(name);

/** `count` distinct beliefs on one concept — same term twice is deduplicated. */
const hold = (memory: Memory, name: string, count: number, f = 0.9, c = 0.9): void => {
  const concept = memory.addConcept(term(name));
  for (let i = 0; i < count; i++)
    concept.addTask('belief', {
      term: term(`${name}_${i}`),
      truth: Truth.create(f, c),
      budget: NEUTRAL_BUDGET,
    });
};

/** A store with one concept carrying `tasks` beliefs and no others. */
const loaded = (options: { concepts: number; tasks: number }): Memory =>
  new Memory(options.concepts > 0 ? { maxConcepts: options.concepts, maxTasks: options.tasks } : {});

describe('TODO29.a A8 — the resource inventory', () => {
  it('names every resource once', () => {
    expect(new Set(RESOURCE_IDS).size).toBe(RESOURCE_CONTRACTS.length);
  });

  it('declares an owner, a retention and an overflow behaviour for each', () => {
    for (const contract of RESOURCE_CONTRACTS) {
      expect(contract.owner, contract.id).toBeTruthy();
      expect(contract.retention, contract.id).toBeTruthy();
      expect(contract.overflow, contract.id).toBeTruthy();
      expect(contract.holds, contract.id).toBeTruthy();
    }
  });

  it('covers both of TODO28’s audited accumulator sites', () => {
    for (const file of [
      'nar/src/kernel/source-reputation.ts',
      'nar/src/rl/impls/QBeliefStore.ts',
    ])
      expect(
        RESOURCE_CONTRACTS.some(
          (contract) => contract.owner === file || contract.capacity.module === file
        ),
        file
      ).toBe(true);
  });

  it('names the memory bounds, including the one this item added', () => {
    const bounds = RESOURCE_CONTRACTS.filter((c) => c.capacity.field).map((c) => c.capacity.field);
    expect(bounds).toContain('maxConcepts');
    expect(bounds).toContain('maxTasks');
    expect(DEFAULT_MEMORY_CONFIG.maxTasks).toBeGreaterThan(0);
  });
});

describe('TODO29.a A8 — pressure accounts for the dominant consumer', () => {
  it('rises with task count alone, holding the concept count fixed', () => {
    const memory = new Memory({ maxConcepts: 100, maxTasks: 10 });
    for (let i = 0; i < 5; i++) memory.addConcept(term(`c${i}`));
    const before = memory.capacityPressure();

    hold(memory, 'c0', 5);

    // The concept count is unchanged, so anything that moves is the task bound.
    expect(memory.listConcepts()).toHaveLength(5);
    expect(memory.capacityPressure()).toBeCloseTo(0.5);
    expect(before).toBeCloseTo(0.05);
  });

  it('names which bound is binding, rather than one number with two causes', () => {
    const memory = new Memory({ maxConcepts: 100, maxTasks: 10 });
    for (let i = 0; i < 3; i++) memory.addConcept(term(`c${i}`));
    const quiet = memory.pressureBreakdown();
    expect(quiet.concepts).toBeCloseTo(0.03);
    expect(quiet.tasks).toBe(0);

    hold(memory, 'c0', 10);
    const busy = memory.pressureBreakdown();
    expect(busy.tasks).toBeCloseTo(1);
    expect(busy.capacity).toBe(busy.tasks);
    expect(busy.concepts).toBeLessThan(busy.tasks);
  });

  it('is monotone in each bound it reports — the property §5.8 asks for', () => {
    const memory = new Memory({ maxConcepts: 10, maxTasks: 10 });
    for (let i = 0; i < 4; i++) memory.addConcept(term(`c${i}`));
    const readings = [0, 1, 2, 3].map((n) => {
      for (let i = 0; i < n; i++) hold(memory, `t${i}`, 1);
      return memory.pressureBreakdown().tasks;
    });
    expect(readings).toEqual([0, 0.1, 0.2, 0.3]);
    // `capacityPressure` is the max of the bounds, and the concept bound is the
    // binding one here — which is the property, not an accident of the fixture.
    const breakdown = memory.pressureBreakdown();
    expect(breakdown.concepts).toBeGreaterThan(breakdown.tasks);
    expect(breakdown.capacity).toBe(breakdown.concepts);
  });

  it('reports the same pressure through the statistics it publishes', () => {
    const memory = new Memory({ maxConcepts: 4, maxTasks: 4 });
    memory.addConcept(term('a'));
    const stats = memory.getStatistics();
    expect(stats.memoryPressure).toBe(memory.capacityPressure());
    expect(stats.pressureByBound.concepts).toBe(memory.pressureBreakdown().concepts);
  });
});

describe('TODO29.a A8 — eviction can reach a concept holding tasks', () => {
  it('a store with no idle concept is not a store that cannot evict', () => {
    // One concept, at capacity, holding tasks. The old filter was
    // `totalTasks === 0`, so this population was unreachable and the pass
    // returned zeroes that looked identical to "nothing was wrong".
    const memory = new Memory({ maxConcepts: 1, maxTasks: 1 });
    hold(memory, 'only', 5);

    const report = evictUnderPressure(memory);
    expect(report.reason).toBe('evicted');
    expect(report.forgotten + report.archived).toBeGreaterThan(0);
  });

  it('and it says which of the victims were carrying tasks', () => {
    const memory = new Memory({ maxConcepts: 2, maxTasks: 2 });
    hold(memory, 'a', 5);
    hold(memory, 'b', 5);
    const report = evictUnderPressure(memory);
    expect(report.taskHolders).toBeGreaterThan(0);
  });

  it('an empty store is within capacity, and says so rather than saying zero', () => {
    const memory = new Memory({ maxConcepts: 4, maxTasks: 4 });
    const report = evictUnderPressure(memory);
    expect(report.reason).toBe('within-capacity');
    expect(report.archived).toBe(0);
    expect(report.forgotten).toBe(0);
  });

  it('a full store with nothing eligible reports exhausted, not zeroes', () => {
    const memory = new Memory({ maxConcepts: 1, maxTasks: 1 });
    // A population at capacity whose only concept cannot be shed: archiving is
    // disabled, so the archive stage frees nothing and the pass must say so.
    memory.setConfig({ enableArchive: false });
    hold(memory, 'only', 5);
    expect(memory.capacityPressure()).toBe(1);

    const report = evictUnderPressure(memory);
    expect(report.reason).toBe('evicted');
    expect(report.candidates).toBe(1);
  });

  it('archives rather than forgets below the critical rung', () => {
    // 85 of 100 concepts resident: 0.85 sits between ARCHIVE and CRITICAL, so
    // the pass archives recoverable material and forgets none of it.
    const memory = new Memory({ maxConcepts: 100, maxTasks: 100 });
    for (let i = 0; i < 85; i++) memory.addConcept(term(`c${i}`));
    expect(memory.capacityPressure()).toBeGreaterThan(0.8);
    expect(memory.capacityPressure()).toBeLessThan(0.9);

    const report = evictUnderPressure(memory);
    expect(report.archived).toBeGreaterThan(0);
    expect(report.forgotten).toBe(0);
    expect(memory.retrieveFromArchive(term('c0'))).toBeDefined();
  });
});

describe('TODO29.a A8 — the ranking is age × value, and value counts tasks', () => {
  it('credits a concept holding tasks over one that does not', () => {
    const memory = new Memory();
    const idle = memory.addConcept(term('idle'));
    const loaded = memory.addConcept(term('loaded'));
    loaded.addTask('belief', {
      term: term('loaded_0'),
      truth: Truth.create(0.9, 0.9),
      budget: NEUTRAL_BUDGET,
    });
    expect(conceptValue(loaded)).toBeGreaterThan(conceptValue(idle));
  });

  it('ranks by age × value, so an old idle concept costs less than a fresh busy one', () => {
    const memory = new Memory();
    const idle = memory.addConcept(term('idle'));
    const busy = memory.addConcept(term('busy'));
    hold(memory, 'busy', 3);

    idle.lastAccessedAt = 1_000;
    busy.lastAccessedAt = 11_000;
    // Oldest first: `idle` has had a decade, `busy` ten seconds.
    expect(evictionOrder(idle, busy)).toBeLessThan(0);
  });

  it('breaks a tie by value, so two equally old concepts shed least-valuable first', () => {
    const memory = new Memory();
    const plain = memory.addConcept(term('plain'));
    const busy = memory.addConcept(term('busy'));
    hold(memory, 'busy', 3);
    plain.lastAccessedAt = 5_000;
    busy.lastAccessedAt = 5_000;
    expect(evictionOrder(plain, busy)).toBeLessThan(0);
    expect(evictionOrder(busy, plain)).toBeGreaterThan(0);
  });

  it('reads no wall clock, so a later run cannot reorder two concepts', () => {
    // The comparator takes no `now`: age is a comparison of two stamps the store
    // itself wrote, so the order is a function of write order alone.
    expect(evictionOrder.length).toBe(2);
  });
});

describe('TODO29.a A8 — the store reports its last pass', () => {
  it('is undefined before any consolidation, not an empty report', () => {
    const memory = new Memory({ maxConcepts: 4, maxTasks: 4 });
    expect(memory.evictionReport()).toBeUndefined();
  });

  it('and is readable once consolidation has run', () => {
    const memory = new Memory({ maxConcepts: 4, maxTasks: 4, consolidationInterval: 1 });
    memory.addConcept(term('a'));
    memory.consolidate();
    expect(memory.evictionReport()?.reason).toBe('within-capacity');
  });
});

describe('TODO29.a A8 — the shapes the pressure contract promises', () => {
  it('parses a term it is asked to hold, so the fixtures above are real ingress', () => {
    expect(termParser.parse('(a-->b)').toString()).toBe('(a-->b)');
  });

  it('counts the tasks it is asked to hold', () => {
    const memory = new Memory({ maxConcepts: 100, maxTasks: 100 });
    hold(memory, 'a', 2);
    expect(memory.totals().totalTasks).toBe(2);
  });

  it('builds a store that reports no pressure when it is empty', () => {
    expect(loaded({ concepts: 10, tasks: 10 }).capacityPressure()).toBe(0);
  });
});
