import {Memory} from '../../memory';
import {isAtomic, type Term, TermBuilder, Truth} from '../../terms';
import {createBudget} from '../../types';

describe('Memory', () => {
    let mem: Memory;

    beforeEach(() => {
        mem = new Memory({
            maxConcepts: 100,
            priorityThreshold: 0.5,
            activationDecayRate: 0.01,
            consolidationInterval: 10
        });
    });

    const getAtom = (term: Term) => (isAtomic(term) ? term.symbol : 'compound');

    describe('addConcept', () => {
        test('adds new concept', () => {
            const term = TermBuilder.atom('bird');
            const concept = mem.addConcept(term);
            expect(getAtom(concept.term)).toBe('bird');
            expect(mem.size).toBe(1);
        });

        test('returns existing concept', () => {
            const term = TermBuilder.atom('bird');
            const c1 = mem.addConcept(term);
            const c2 = mem.addConcept(term);
            expect(c1).toBe(c2);
            expect(mem.size).toBe(1);
        });
    });

    describe('getConcept', () => {
        test('returns concept by term', () => {
            const term = TermBuilder.atom('bird');
            mem.addConcept(term);
            expect(mem.getConcept(term)).toBeDefined();
        });

        test('returns undefined for unknown term', () => {
            const term = TermBuilder.atom('unknown');
            expect(mem.getConcept(term)).toBeUndefined();
        });
    });

    describe('addTask', () => {
        test('adds belief task', () => {
            const term = TermBuilder.atom('bird');
            const result = mem.addTask(term, 'belief', Truth.TRUE, createBudget(0.8));
            expect(result).toBe(true);
            expect(mem.getConcept(term)?.beliefBag.size).toBe(1);
        });

        test('adds goal task', () => {
            const term = TermBuilder.atom('fly');
            const result = mem.addTask(term, 'goal', undefined, createBudget(0.9));
            expect(result).toBe(true);
            expect(mem.getConcept(term)?.goalBag.size).toBe(1);
        });
    });

    describe('removeConcept', () => {
        test('removes existing concept', () => {
            const term = TermBuilder.atom('bird');
            mem.addConcept(term);
            expect(mem.removeConcept(term)).toBe(true);
            expect(mem.size).toBe(0);
        });

        test('returns false for unknown', () => {
            const term = TermBuilder.atom('unknown');
            expect(mem.removeConcept(term)).toBe(false);
        });
    });

    describe('consolidate', () => {
        test('decays and removes low priority after interval', () => {
            const term = TermBuilder.atom('bird');
            mem.addTask(term, 'belief', Truth.TRUE, createBudget(0.1));

            for (let i = 0; i < 50; i++) mem.consolidate();

            expect(mem.size).toBeLessThanOrEqual(1);
        });

        test('keeps high priority concepts', () => {
            const term = TermBuilder.atom('bird');
            mem.addTask(term, 'belief', Truth.TRUE, createBudget(0.9));

            for (let i = 0; i < 50; i++) mem.consolidate();

            expect(mem.size).toBe(1);
        });
    });

    describe('forgetting', () => {
        test('removes oldest when at capacity', () => {
            const smallMem = new Memory({
                maxConcepts: 1,
                priorityThreshold: 0.5,
                activationDecayRate: 0.01,
                consolidationInterval: 10
            });
            smallMem.addTask(TermBuilder.atom('a'), 'belief', Truth.TRUE, createBudget(0.5));
            smallMem.addTask(TermBuilder.atom('b'), 'belief', Truth.TRUE, createBudget(0.5));

            expect(smallMem.size).toBe(1);
        });
    });

    describe('sample', () => {
        test('returns concepts sorted by priority', () => {
            const a = TermBuilder.atom('a');
            const b = TermBuilder.atom('b');
            mem.addTask(a, 'belief', Truth.TRUE, createBudget(0.5));
            mem.addTask(b, 'belief', Truth.TRUE, createBudget(0.5));
            mem.addTask(b, 'belief', Truth.TRUE, createBudget(0.5));

            const top = mem.sample(2);
            expect(top).toHaveLength(2);
            const topTerm = top[0];
            expect(topTerm && getAtom(topTerm.term)).toBe('b');
        });
    });
});