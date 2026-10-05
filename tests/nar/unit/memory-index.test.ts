import type { Concept as ConceptType } from '@senars/nar/memory/concept.js';
import { TermBuilder, Truth } from '../../../nar/src';
import { Concept, MemoryIndex } from '../../../nar/src/memory';

function createTestConcept(symbol: string): ConceptType {
  const concept = new Concept(TermBuilder.atom(symbol));
  concept.addTask('belief', {
    term: TermBuilder.atom(symbol),
    truth: Truth.TRUE,
    budget: { priority: 0.5, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
  });
  return concept;
}

describe('MemoryIndex', () => {
  let index: MemoryIndex;

  beforeEach(() => {
    index = new MemoryIndex({ enableAtomicIndex: true, enableTemporalIndex: true });
  });

  describe('getByAtomic', () => {
    test('returns empty array for unknown symbol', () => {
      expect(index.getByAtomic('Unknown')).toEqual([]);
    });

    test('returns multiple concepts for the same symbol', () => {
      const c1 = createTestConcept('Multi');
      const c2 = createTestConcept('Multi');
      index.index(c1);
      index.index(c2);

      expect(index.getByAtomic('Multi')).toHaveLength(2);
    });

    test('a compound term is not findable by a symbol it mentions', () => {
      const compound = TermBuilder.inheritance(TermBuilder.atom('A'), TermBuilder.atom('B'))!;
      index.index(new Concept(compound));

      expect(index.getByAtomic('A')).toEqual([]);
      expect(index.getByAtomic('B')).toEqual([]);
    });
  });

  describe('getByTemporal', () => {
    test('returns empty for a time range with no concepts', () => {
      const old = Date.now() - 1_000_000;
      expect(index.getByTemporal([old, old + 1000])).toEqual([]);
    });

    test('returns concepts admitted inside the range', () => {
      const concept = createTestConcept('Timed');
      const timestamp = Date.now();
      index.index(concept, timestamp);

      expect(index.getByTemporal([timestamp - 100, timestamp + 100])).toContain(concept);
    });

    test('buckets by the admission second, not the query', () => {
      const concept = createTestConcept('Second');
      index.index(concept, 1_700_000_000_000);

      expect(index.getByTemporal([1_700_000_000_000, 1_700_000_000_999])).toContain(concept);
      expect(index.getByTemporal([1_700_000_001_000, 1_700_000_001_999])).toEqual([]);
    });
  });

  describe('index', () => {
    test('does not maintain a family it was not configured for', () => {
      const unindexed = new MemoryIndex({ enableAtomicIndex: false, enableTemporalIndex: false });
      const concept = createTestConcept('Off');

      unindexed.index(concept, 1_700_000_000_000);

      expect(unindexed.stats).toEqual({ atomic: 0, temporal: 0 });
      expect(unindexed.getByAtomic('Off')).toEqual([]);
    });

    test('re-indexing the same concept does not duplicate it', () => {
      const concept = createTestConcept('Twice');
      index.index(concept);
      index.index(concept);

      expect(index.getByAtomic('Twice')).toEqual([concept]);
    });
  });

  describe('remove', () => {
    test('releases both keys', () => {
      const concept = createTestConcept('RemoveMe');
      const timestamp = Date.now();
      index.index(concept, timestamp);
      index.remove(concept);

      expect(index.getByAtomic('RemoveMe')).toEqual([]);
      expect(index.getByTemporal([timestamp - 100, timestamp + 100])).toEqual([]);
    });

    test('leaves a sibling sharing the same keys', () => {
      const kept = createTestConcept('Shared');
      const dropped = createTestConcept('Shared');
      const timestamp = Date.now();
      index.index(kept, timestamp);
      index.index(dropped, timestamp);

      index.remove(dropped);

      expect(index.getByAtomic('Shared')).toEqual([kept]);
      expect(index.getByTemporal([timestamp - 100, timestamp + 100])).toEqual([kept]);
    });

    test('is idempotent and safe for a concept never indexed', () => {
      const concept = createTestConcept('Unindexed');
      expect(() => index.remove(concept)).not.toThrow();

      index.index(concept);
      index.remove(concept);
      expect(() => index.remove(concept)).not.toThrow();
    });

    test('releases a bucket once its last concept is gone', () => {
      const a = createTestConcept('A');
      const b = createTestConcept('B');
      index.index(a);
      index.index(b);
      expect(index.stats.atomic).toBe(2);

      index.remove(a);
      index.remove(b);
      expect(index.stats.atomic).toBe(0);
    });
  });

  describe('clear', () => {
    test('clears both families', () => {
      index.index(createTestConcept('A'), 1_700_000_000_000);
      index.index(createTestConcept('B'), 1_700_000_000_000);
      index.clear();

      expect(index.stats).toEqual({ atomic: 0, temporal: 0 });
      expect(index.getByTemporal([1_699_999_000_000, 1_700_001_000_000])).toEqual([]);
    });
  });
});
