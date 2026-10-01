import { describe, expect, it } from 'vitest';
import { Memory } from '@senars/nar/memory';
import { PRESSURE } from '@senars/nar/constants';
import { atom, TermBuilder } from '@senars/nar/terms';
import { evictUnderPressure } from '@senars/nar/memory/pressure';

/**
 * A concept carrying no tasks — the only kind **archiving** may shed. Forgetting
 * reaches further (TODO29.a §5.8), and the distinction is the point of the two
 * tests at the bottom of this file.
 */
const idleTerm = (i: number) => atom(`idle_${i}`);
const busyTerm = (i: number) => TermBuilder.inheritance(atom('cat'), atom(`animal_${i}`))!;

describe('memory pressure', () => {
  it('reports the same pressure through both accessors', () => {
    const memory = new Memory({ maxConcepts: 10 });
    for (let i = 0; i < 5; i++) memory.addConcept(idleTerm(i));

    expect(memory.getMemoryPressure()).toBe(memory.capacityPressure());
    expect(memory.getMemoryPressure()).toBeCloseTo(0.5);
    expect(memory.getStatistics().memoryPressure).toBe(memory.capacityPressure());
  });

  it('treats a zero-capacity store as fully pressured', () => {
    expect(new Memory({ maxConcepts: 0 }).capacityPressure()).toBe(1);
  });

  it('does not evict below the archive rung', () => {
    const memory = new Memory({ maxConcepts: 100 });
    for (let i = 0; i < 80; i++) memory.addConcept(idleTerm(i));

    expect(evictUnderPressure(memory)).toMatchObject({ archived: 0, forgotten: 0 });
    expect(memory.size).toBe(80);
  });

  it('actually relieves pressure when archiving', () => {
    const memory = new Memory({ maxConcepts: 10 });
    for (let i = 0; i < 10; i++) memory.addConcept(idleTerm(i));

    const before = memory.capacityPressure();
    expect(before).toBeGreaterThan(PRESSURE.ARCHIVE);

    const { archived } = evictUnderPressure(memory);
    expect(archived).toBeGreaterThan(0);

    // The archive is a way out of the live store, not a shadow copy of it.
    expect(memory.size).toBeLessThan(10);
    expect(memory.capacityPressure()).toBeLessThan(before);
  });

  it('restores an archived concept as the same live instance', () => {
    const memory = new Memory({ maxConcepts: 4 });
    const archived = memory.addConcept(idleTerm(0));
    archived.writeAttention({ reason: 'assign', value: 0 });
    expect(memory.archiveConcept(archived)).toBe(true);
    expect(memory.getConcept(archived.term)).toBeUndefined();

    const restored = memory.retrieveFromArchive(archived.term);
    expect(restored).toBe(archived);
    expect(memory.getConcept(archived.term)).toBe(archived);
  });

  /**
   * Archiving never takes a concept with an unanswered task, because archiving is
   * recoverable and hiding a question is not the same as shedding a cost.
   *
   * 17 of 20 sits between ARCHIVE and CRITICAL, so the pass archives and forgets
   * nothing — the forget stage is not what this test is about.
   */
  it('never archives a concept carrying an outstanding task', () => {
    const memory = new Memory({ maxConcepts: 20 });
    for (let i = 0; i < 17; i++) {
      memory.addConcept(busyTerm(i));
      memory.addTask(busyTerm(i), 'belief');
    }
    const before = memory.size;
    expect(memory.capacityPressure()).toBeCloseTo(0.85);

    const report = evictUnderPressure(memory);
    expect(report.archived).toBe(0);
    expect(report.forgotten).toBe(0);
    expect(report.idle).toBe(0);
    expect(report.reason).toBe('exhausted');
    expect(memory.size).toBe(before);
  });

  /**
   * Forgetting does reach them, and only above the critical rung. This inverted
   * on purpose: the candidate set used to be `totalTasks === 0`, which made the
   * filter anti-correlated with pressure — the busier the store, the less
   * eviction could reach — so a store could sit at capacity beside a policy that
   * provably could not act, and report `{ archived: 0, forgotten: 0 }`, which is
   * indistinguishable from a pass that found nothing wrong (TODO29.a §5.8).
   */
  it('forgets a concept carrying tasks once nothing idle remains', () => {
    const memory = new Memory({ maxConcepts: 4, maxTasks: 4 });
    for (let i = 0; i < 4; i++) {
      memory.addConcept(busyTerm(i));
      memory.addTask(busyTerm(i), 'belief');
    }
    const before = memory.size;
    expect(memory.capacityPressure()).toBe(1);

    const report = evictUnderPressure(memory);
    expect(report.idle).toBe(0);
    expect(report.reason).toBe('evicted');
    expect(report.taskHolders).toBeGreaterThan(0);
    expect(memory.size).toBeLessThan(before);
  });

  it('and says `exhausted` rather than zeroes when a pass freed nothing', () => {
    const memory = new Memory({ maxConcepts: 4, maxTasks: 4 });
    memory.setConfig({ enableArchive: false, enableIndexing: false });
    const concept = memory.addConcept(idleTerm(0));
    concept.writeAttention({ reason: 'assign', value: 1 });
    // One concept, attention saturated, at a capacity it cannot shed from
    // because forgetting is capped below the critical rung.
    memory.setConfig({ maxConcepts: 1, maxTasks: 1 });
    expect(memory.capacityPressure()).toBe(1);
    const report = evictUnderPressure(memory);
    expect(['evicted', 'exhausted']).toContain(report.reason);
    if (report.reason === 'exhausted') expect(report.candidates).toBe(1);
  });

  it('scales the shed batch to how far past the rung occupancy sits', () => {
    const shedAt = (maxConcepts: number) => {
      const memory = new Memory({ maxConcepts });
      for (let i = 0; i < maxConcepts; i++) memory.addConcept(idleTerm(i));
      return evictUnderPressure(memory).archived;
    };

    expect(shedAt(10)).toBeLessThan(shedAt(20));
  });

  it('reports forgetting as needed only above the archive rung', () => {
    const filled = (count: number) => {
      const memory = new Memory({ maxConcepts: 100 });
      for (let i = 0; i < count; i++) memory.addConcept(idleTerm(i));
      return memory;
    };

    expect(filled(85).checkHealth().forgettingNeeded).toBe(true);
    expect(filled(75).checkHealth().forgettingNeeded).toBe(false);
  });
});
