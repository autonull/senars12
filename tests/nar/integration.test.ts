import { NAR } from '../../src/nar/nar.js';
import { atom } from '../../src/nar/terms/types.js';
import { Truth } from '../../src/nar/terms/truth.js';
import { Memory } from '../../src/nar/memory/memory.js';
import { Bag } from '../../src/nar/memory/bag.js';
import { Concept } from '../../src/nar/memory/concept.js';
import { TaskManager } from '../../src/nar/task/manager.js';
import { createTask } from '../../src/nar/task/task.js';
import { Reasoner } from '../../src/nar/reason/reasoner.js';
import { BagStrategy, ExhaustiveStrategy } from '../../src/nar/reason/strategy.js';
import { RuleProcessor } from '../../src/nar/rules/processor.js';
import { unify } from '../../src/nar/terms/unifier.js';
import { TermCache } from '../../src/nar/terms/cache.js';

describe('NAR Integration Tests', () => {
    describe('Term System', () => {
        test('TermCache basic operations', () => {
            const cache = new TermCache(3);
            const term1 = { kind: 'atom' as const, symbol: 'test', hash: 123 };
            const term2 = { kind: 'atom' as const, symbol: 'test2', hash: 456 };

            cache.set(term1);
            expect(cache.get(123)).toBe(term1);
            expect(cache.get(456)).toBeUndefined();
            expect(cache.hitRate).toBe(0.5);
            expect(cache.size).toBe(1);

            cache.set(term2);
            expect(cache.size).toBe(2);
        });

        test('TermCache eviction', () => {
            const cache = new TermCache(2);
            cache.set({ hash: 1, kind: 'atom', symbol: 'a' } as any);
            cache.set({ hash: 2, kind: 'atom', symbol: 'b' } as any);
            cache.set({ hash: 3, kind: 'atom', symbol: 'c' } as any);

            expect(cache.size).toBe(2);
        });

        test('unify variables', () => {
            const a = atom('$x');
            const b = atom('cat');
            const result = unify(a, b);
            expect(result).toEqual({ '$x': b });
        });

        test('unify compound terms', () => {
            const t1 = { kind: 'inheritance' as const, args: [atom('$x'), atom('animal')], hash: 0 };
            const t2 = { kind: 'inheritance' as const, args: [atom('bird'), atom('animal')], hash: 0 };
            const result = unify(t1, t2);
            expect(result?.['$x']).toEqual(atom('bird'));
        });
    });

    describe('Memory System', () => {
        test('Bag add and remove', () => {
            const bag = new Bag<number>(3);
            expect(bag.add(1, 0.9)).toBe(true);
            expect(bag.add(2, 0.8)).toBe(true);
            expect(bag.size).toBe(2);
            expect(bag.peek()).toBe(1);
        });

        test('Bag priority ordering', () => {
            const bag = new Bag<number>(3);
            bag.add(1, 0.5);
            bag.add(2, 0.9);
            bag.add(3, 0.7);
            expect(bag.peek()).toBe(2);
        });

        test('Concept creation and task addition', () => {
            const concept = new Concept(atom('bird'));
            const taskData = { term: atom('bird'), truth: Truth.NEUTRAL, budget: 0.9 };

            expect(concept.addTask('belief', taskData)).toBe(true);
            expect(concept.priority).toBeGreaterThan(0);
            expect(concept.totalTasks).toBe(1);
        });

        test('Concept activation decay', () => {
            const concept = new Concept(atom('test'));
            concept.boost(0.5);
            expect(concept.priority).toBe(0.5);
            concept.decay(0.1);
            expect(concept.priority).toBe(0.45);
        });

        test('Memory concepts management', () => {
            const memory = new Memory({ maxConcepts: 10, priorityThreshold: 0.1, activationDecayRate: 0.01, consolidationInterval: 5 });
            memory.addTask(atom('bird'), 'belief', Truth.NEUTRAL, 0.9);
            memory.addTask(atom('animal'), 'belief', Truth.NEUTRAL, 0.8);

            expect(memory.size).toBe(2);
            const concept = memory.getConcept(atom('bird'));
            expect(concept).toBeDefined();
            expect(concept?.term.symbol).toBe('bird');
        });

        test('Memory consolidation', () => {
            const memory = new Memory({ maxConcepts: 10, priorityThreshold: 0.5, activationDecayRate: 0.1, consolidationInterval: 1 });
            memory.addTask(atom('test'), 'belief', Truth.NEUTRAL, 0.3);
            memory.consolidate();
            expect(memory.size).toBe(1);
        });

        test('Memory sample', () => {
            const memory = new Memory({ maxConcepts: 100, priorityThreshold: 0, activationDecayRate: 0.01, consolidationInterval: 10 });
            for (let i = 0; i < 20; i++) {
                memory.addTask(atom(`term${i}`), 'belief', Truth.NEUTRAL, 0.5 + Math.random() * 0.5);
            }
            const sample = memory.sample(5);
            expect(sample.length).toBe(5);
        });
    });

    describe('Task System', () => {
        test('createTask generates valid task', () => {
            const task = createTask(atom('test'), 'belief', Truth.NEUTRAL, 0.9);

            expect(task.term).toEqual(atom('test'));
            expect(task.type).toBe('belief');
            expect(task.truth).toBe(Truth.NEUTRAL);
            expect(task.budget).toBe(0.9);
            expect(task.stamp.id).toBeDefined();
            expect(task.derived).toBe(false);
        });

        test('TaskManager add and process', () => {
            const memory = new Memory();
            const manager = new TaskManager(memory);

            const task = createTask(atom('test'), 'belief', Truth.NEUTRAL);
            manager.addTask(task);

            expect(manager.size).toBe(1);

            const processed = manager.processPending();
            expect(processed.length).toBe(1);
            expect(manager.size).toBe(0);
        });
    });

    describe('Reasoner', () => {
        test('Reasoner step generates derivations', async () => {
            const memory = new Memory({ maxConcepts: 100, priorityThreshold: 0, activationDecayRate: 0.01, consolidationInterval: 10 });
            memory.addTask(atom('A'), 'belief', Truth.NEUTRAL, 0.9);
            memory.addTask(atom('B'), 'belief', Truth.NEUTRAL, 0.9);

            const processor = new RuleProcessor();
            const reasoner = new Reasoner(memory, processor, BagStrategy, { cpuThrottleMs: 10, maxDerivationDepth: 5, maxDerivationsPerStep: 100 });

            const results = await reasoner.step(1000, 10);
            expect(Array.isArray(results)).toBe(true);
        });

        test('Strategy selection', () => {
            const memory = new Memory({ maxConcepts: 100, priorityThreshold: 0, activationDecayRate: 0.01, consolidationInterval: 10 });
            memory.addTask(atom('A'), 'belief', Truth.NEUTRAL, 0.9);

            const task = createTask(atom('A'), 'belief', Truth.NEUTRAL, 0.9);
            const bagResults = BagStrategy.selectSecondary(task, memory);
            const exhaustiveResults = ExhaustiveStrategy.selectSecondary(task, memory);

            expect(bagResults.length).toBeLessThanOrEqual(10);
            expect(exhaustiveResults.length).toBeLessThanOrEqual(100);
        });
    });

    describe('NAR Integration', () => {
        test('NAR constructor creates all components', () => {
            const nar = new NAR();

            expect(nar.memory).toBeDefined();
            expect(nar.taskManager).toBeDefined();
            expect(nar.reasoner).toBeDefined();
        });

        test('NAR input accepts string terms', async () => {
            const nar = new NAR();
            await nar.input('bird', 'belief');

            expect(nar.memory.size).toBeGreaterThan(0);
        });

        test('NAR input accepts typed terms', async () => {
            const nar = new NAR();
            await nar.input(atom('swan'), 'belief');

            expect(nar.memory.size).toBeGreaterThan(0);
        });

        test('NAR run executes reasoning cycles', async () => {
            const nar = new NAR();
            await nar.input('bird', 'belief');
            await nar.input('swan', 'belief');

            const derived = await nar.run(5);
            expect(typeof derived).toBe('number');
        });

        test('NAR getConcept retrieves concept', async () => {
            const nar = new NAR();
            await nar.input('test', 'belief');

            const concept = nar.getConcept(atom('test'));
            expect(concept).toBeDefined();
            expect(concept?.term.symbol).toBe('test');
        });

        test('NAR handles multiple input types', async () => {
            const nar = new NAR();
            await nar.input('fact1', 'belief');
            await nar.input('goal1', 'goal');
            await nar.input('question1', 'question');

            expect(nar.memory.size).toBe(3);
        });

        test('NAR with custom config', () => {
            const nar = new NAR({ maxConcepts: 500, priorityThreshold: 0.3, activationDecayRate: 0.02, consolidationInterval: 5, cpuThrottleMs: 5, maxDerivationDepth: 8, maxDerivationsPerStep: 500 });

            expect(nar.memory.size).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        test('Memory handles duplicate concepts', () => {
            const memory = new Memory({ maxConcepts: 5, priorityThreshold: 0, activationDecayRate: 0.01, consolidationInterval: 10 });
            memory.addTask(atom('test'), 'belief', Truth.NEUTRAL, 0.9);
            memory.addTask(atom('test'), 'belief', Truth.NEUTRAL, 0.8);

            expect(memory.size).toBe(1);
        });

        test('Memory forgetting when full', () => {
            const memory = new Memory({ maxConcepts: 2, priorityThreshold: 0, activationDecayRate: 0.01, consolidationInterval: 10 });
            memory.addTask(atom('a'), 'belief', Truth.NEUTRAL, 0.5);
            memory.addTask(atom('b'), 'belief', Truth.NEUTRAL, 0.3);
            memory.addTask(atom('c'), 'belief', Truth.NEUTRAL, 0.9);

            expect(memory.size).toBeLessThanOrEqual(2);
        });

        test('NAR handles empty run', async () => {
            const nar = new NAR();
            const derived = await nar.run(1);
            expect(derived).toBe(0);
        });
    });
});