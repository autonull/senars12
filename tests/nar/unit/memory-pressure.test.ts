import { describe, expect, it } from 'vitest';
import { Memory } from '@senars/nar/memory';
import { PRESSURE } from '@senars/nar/constants';
import { atom, TermBuilder } from '@senars/nar/terms';
import { evictUnderPressure } from '@senars/nar/memory/pressure';

/** A concept carrying no tasks, which is the only kind eviction may shed. */
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

    expect(evictUnderPressure(memory)).toEqual({ archived: 0, forgotten: 0 });
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

  it('never sheds a concept carrying an outstanding task', () => {
    const memory = new Memory({ maxConcepts: 4 });
    for (let i = 0; i < 4; i++) {
      memory.addConcept(busyTerm(i));
      memory.addTask(busyTerm(i), 'belief');
    }
    const before = memory.size;

    evictUnderPressure(memory);
    expect(memory.size).toBe(before);
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
