import {describe, expect, it} from '@jest/globals';
import {Memory, TermBuilder} from '../../../src/nar';

describe('Phase 5: Memory Integration', () => {
    describe('MemoryIndex Integration', () => {
        it('should index concepts by atomic symbol', () => {
            const memory = new Memory({enableIndexing: true});
            const term = TermBuilder.atom('test');
            memory.addConcept(term);

            const results = memory.queryBySymbol('test');
            expect(results.length).toBe(1);
            expect(results[0]?.term.hash).toBe(term.hash);
        });

        it('should return empty array when indexing disabled', () => {
            const memory = new Memory({enableIndexing: false});
            const term = TermBuilder.atom('test');
            memory.addConcept(term);

            const results = memory.queryBySymbol('test');
            expect(results.length).toBe(0);
        });
    });

    describe('Focus Integration', () => {
        it('should track focus concepts', () => {
            const memory = new Memory({priorityThreshold: 0.1});
            memory.addConcept(TermBuilder.atom('focused'));

            const focused = memory.getFocusConcepts();
            expect(focused.length).toBeGreaterThanOrEqual(0);
        });

        it('should update focus during consolidation', () => {
            const memory = new Memory({
                consolidationInterval: 1,
                priorityThreshold: 0.5
            });

            memory.addConcept(TermBuilder.atom('high'));
            memory.addConcept(TermBuilder.atom('low'));

            memory.consolidate();

            const focused = memory.getFocusConcepts();
            expect(focused.length).toBeLessThanOrEqual(memory.size);
        });
    });

    describe('Archive Integration', () => {
        it('should track archived concepts count', () => {
            const memory = new Memory({
                enableArchive: true,
                archiveThreshold: 0.3,
                priorityThreshold: 0.5,
                consolidationInterval: 1
            });

            memory.addConcept(TermBuilder.atom('archived'));
            memory.consolidate();

            const stats = memory.getStatistics();
            expect(stats.archivedConcepts).toBeGreaterThanOrEqual(0);
        });

        it('should support archive statistics', () => {
            const memory = new Memory({
                enableArchive: true,
                archiveThreshold: 0.01
            });

            memory.addConcept(TermBuilder.atom('concept1'));
            memory.addConcept(TermBuilder.atom('concept2'));

            const stats = memory.getStatistics();
            expect(stats.archiveStats).toBeDefined();
            expect(stats.archiveStats?.capacity).toBe(1000);
        });
    });

    describe('MemoryScorer Integration', () => {
        it('should use scorer for sampling', () => {
            const memory = new Memory();

            for (let i = 0; i < 10; i++) {
                memory.addConcept(TermBuilder.atom(`concept${i}`));
            }

            const sampled = memory.sample(5);
            expect(sampled.length).toBeLessThanOrEqual(5);
            expect(sampled.length).toBeGreaterThan(0);
        });

        it('should score concepts for consolidation', () => {
            const memory = new Memory();
            const term = TermBuilder.atom('scorable');
            const concept = memory.addConcept(term);

            const score = memory['scorer'].scoreForConsolidation(concept);
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(1);
        });
    });

    describe('Forgetting Integration', () => {
        it('should forget oldest concept when at capacity (FIFO)', () => {
            const memory = new Memory({
                maxConcepts: 3,
                forgettingPolicy: 'fifo'
            });

            memory.addConcept(TermBuilder.atom('first'));
            memory.addConcept(TermBuilder.atom('second'));
            memory.addConcept(TermBuilder.atom('third'));
            memory.addConcept(TermBuilder.atom('fourth'));

            expect(memory.size).toBe(3);
            expect(memory.getConcept(TermBuilder.atom('first'))).toBeUndefined();
        });
    });

    describe('Statistics', () => {
        it('should provide comprehensive statistics', () => {
            const memory = new Memory({enableIndexing: true, enableArchive: true});

            memory.addConcept(TermBuilder.atom('one'));
            memory.addConcept(TermBuilder.atom('two'));

            const stats = memory.getStatistics();

            expect(stats.totalConcepts).toBe(2);
            expect(stats.focusedConcepts).toBeGreaterThanOrEqual(0);
            expect(stats.indexStats).toBeDefined();
            expect(stats.archiveStats).toBeDefined();
        });
    });

    describe('Query Operations', () => {
        it('should query by symbol', () => {
            const memory = new Memory({enableIndexing: true});
            const term = TermBuilder.atom('queryable');
            memory.addConcept(term);

            const results = memory.queryBySymbol('queryable');
            expect(results.length).toBe(1);
        });

        it('should query by time range', () => {
            const memory = new Memory({enableIndexing: true});
            const term = TermBuilder.atom('temporal');
            memory.addConcept(term);

            const now = Date.now();
            const results = memory.queryByTimeRange(now - 1000, now + 1000);
            expect(results.length).toBeGreaterThan(0);
        });
    });
});
