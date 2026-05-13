import {Concept, MemoryIndex} from '../../../src/nar/memory';
import type {Concept as ConceptType} from '../../memory/concept';
import {TermBuilder, Truth, termsEqual} from '../../../src/nar/terms';

function createTestConcept(symbol: string, priority = 0.5): ConceptType {
    const concept = new Concept(TermBuilder.atom(symbol));
    (concept as any)._priority = priority;
    concept.addTask('belief', {
        term: TermBuilder.atom(symbol),
        truth: Truth.TRUE,
        budget: {priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0}
    });
    return concept;
}

describe('MemoryIndex', () => {
    let index: MemoryIndex;

    beforeEach(() => {
        index = new MemoryIndex({
            enableAtomicIndex: true,
            enableTemporalIndex: true,
            enableActivationIndex: true,
            enableInverseIndex: true,
            enableSimilarityIndex: true
        });
    });

    describe('index and retrieval', () => {
        test('indexes atomic symbols', () => {
            const concept = createTestConcept('A');
            index.index(concept);

            const results = index.getByAtomic('A');
            expect(results).toHaveLength(1);
            expect(results[0]!.term.toString()).toBe('A');
        });

        test('indexes by temporal range', () => {
            const concept = createTestConcept('T');
            const timestamp = Date.now();
            index.index(concept, timestamp);

            const results = index.getByTemporal([timestamp - 1000, timestamp + 1000]);
            expect(results.length).toBeGreaterThan(0);
        });

        test('indexes by inverse term', () => {
            const concept = createTestConcept('TestConcept');
            index.index(concept);

            const results = index.getByInverse(concept.term);
            expect(results).toBeDefined();
        });

        test('indexes similar concepts', () => {
            const concept = createTestConcept('Similar');
            index.index(concept);

            const results = index.findSimilarConcepts(TermBuilder.atom('Similar'), 5);
            expect(results.length).toBeGreaterThan(0);
        });
    });

    describe('getByAtomic', () => {
        test('returns empty array for unknown symbol', () => {
            const results = index.getByAtomic('Unknown');
            expect(results).toEqual([]);
        });

        test('returns multiple concepts for same symbol', () => {
            const c1 = createTestConcept('Multi');
            const c2 = createTestConcept('Multi');
            index.index(c1);
            index.index(c2);

            const results = index.getByAtomic('Multi');
            expect(results.length).toBe(2);
        });
    });

    describe('getByTemporal', () => {
        test('returns empty for time range with no concepts', () => {
            const oldTimestamp = Date.now() - 1000000;
            const results = index.getByTemporal([oldTimestamp, oldTimestamp + 1000]);
            expect(results).toEqual([]);
        });

        test('returns concepts within time range', () => {
            const concept = createTestConcept('Timed');
            const timestamp = Date.now();
            index.index(concept, timestamp);

            const results = index.getByTemporal([timestamp - 100, timestamp + 100]);
            expect(results.length).toBeGreaterThan(0);
        });
    });

    describe('getBySimilarity', () => {
        test('returns concepts above threshold', () => {
            const concept = createTestConcept('HighPriority', 0.9);
            index.index(concept);

            const results = index.getBySimilarity(concept.term, 0.5);
            expect(results.length).toBeGreaterThan(0);
        });

        test('returns empty for unknown hash', () => {
            const results = index.getBySimilarity(TermBuilder.atom("nonexistent"), 0.5);
            expect(results).toEqual([]);
        });
    });

    describe('findSimilarConcepts', () => {
        test('returns similar concepts by term hash', () => {
            const concept = createTestConcept('Findable', 0.7);
            index.index(concept);

            const results = index.findSimilarConcepts(TermBuilder.atom('Findable'), 10);
            expect(results).toBeDefined();
        });

        test('returns empty when similarity index disabled', () => {
            const disabledIndex = new MemoryIndex({
                enableAtomicIndex: true,
                enableTemporalIndex: true,
                enableActivationIndex: true,
                enableInverseIndex: true,
                enableSimilarityIndex: false
            });
            const concept = createTestConcept('Test');
            disabledIndex.index(concept);

            const results = disabledIndex.findSimilarConcepts(TermBuilder.atom('Test'));
            expect(results).toEqual([]);
        });

        test('searches all clusters when exact hash not found', () => {
            const concept = createTestConcept('SearchTest', 0.8);
            index.index(concept);

            const results = index.findSimilarConcepts(TermBuilder.atom('SearchTest'), 5);
            expect(results.length).toBeGreaterThan(0);
        });
    });

    describe('activation tracking', () => {
        test('gets activation for concept', () => {
            const concept = new Concept(TermBuilder.atom('Active'));
            concept.addTask('belief', {
                term: TermBuilder.atom('Active'),
                truth: Truth.TRUE,
                budget: {priority: 0.5, durability: 0.8, quality: 0.9, cycles: 0, depth: 0}
            });
            index.index(concept);

            const activation = index.getActivation(concept);
            expect(activation).toBeGreaterThan(0);
        });

        test('updates activation', () => {
            const concept = createTestConcept('Update', 0.5);
            index.index(concept);

            index.updateActivation(concept, 0.8);
            expect(index.getActivation(concept)).toBe(0.8);
        });

        test('returns 0 for unindexed concept', () => {
            const concept = createTestConcept('NotIndexed');
            expect(index.getActivation(concept)).toBe(0);
        });
    });

    describe('remove', () => {
        test('removes concept from all indexes', () => {
            const concept = createTestConcept('RemoveMe');
            index.index(concept);
            index.remove(concept);

            expect(index.getByAtomic('RemoveMe')).toEqual([]);
        });

        test('removes from similarity index', () => {
            const concept = createTestConcept('SimRemove');
            index.index(concept);
            index.remove(concept);

            const results = index.findSimilarConcepts(TermBuilder.atom('SimRemove'));
            const stillPresent = results.some(c => c === concept);
            expect(stillPresent).toBe(false);
        });
    });

    describe('clear', () => {
        test('clears all indexes', () => {
            index.index(createTestConcept('A'));
            index.index(createTestConcept('B'));
            index.clear();

            expect(index.getByAtomic('A')).toEqual([]);
            expect(index.getByAtomic('B')).toEqual([]);
        });
    });

    describe('stats', () => {
        test('reports index sizes', () => {
            index.index(createTestConcept('Stats1'));
            index.index(createTestConcept('Stats2'));

            const stats = index.stats;
            expect(stats.atomic).toBeGreaterThan(0);
            expect(stats.temporal).toBeGreaterThan(0);
            expect(stats.activation).toBeGreaterThan(0);
        });
    });

    describe('indexByInverse', () => {
        test('indexes compound terms with subterms', () => {
            const compound = TermBuilder.inheritance(TermBuilder.atom('A'), TermBuilder.atom('B'));
            const concept = new Concept(compound);
            concept.addTask('belief', {
                term: compound,
                truth: Truth.TRUE,
                budget: {priority: 0.5, durability: 0.8, quality: 0.9, cycles: 0, depth: 0}
            });
            index.index(concept);

            const results = index.getBySubterm(compound);
            expect(results).toBeDefined();
        });
    });

    describe('cluster similarity', () => {
        test('calculates cluster similarity correctly', () => {
            const c1 = createTestConcept('Cat');
            const c2 = createTestConcept('Dog');
            index.index(c1);
            index.index(c2);

            const cluster = (index as any).similarityIndex.get(c1.term);
            if (cluster) {
                const similarity = (index as any).calculateClusterSimilarity(cluster, TermBuilder.atom('Cat'));
                expect(similarity).toBe(1);
            }
        });

        test('returns 0 for disjoint symbols', () => {
            const c1 = createTestConcept('X');
            const c2 = createTestConcept('Y');
            index.index(c1);
            index.index(c2);

            const cluster = (index as any).similarityIndex.get(c1.term);
            if (cluster) {
                const similarity = (index as any).calculateClusterSimilarity(cluster, TermBuilder.atom('Z'));
                expect(similarity).toBe(0);
            }
        });
    });
});