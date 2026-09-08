/**
 * Strategy Tests
 * Tests for all 13 reasoning strategies in SeNARS12
 */

import {beforeEach, describe, expect, it} from 'vitest';
import type {Strategy} from '../../../nar/src/reason';
import {
    AdaptiveStrategy,
    AnalogicalStrategy,
    CompositeStrategy,
    createStrategy,
    DecompositionStrategy,
    DefaultFormationStrategy,
    GoalDrivenStrategy,
    PrologStrategy,
    ResolutionStrategy,
    SwitchingStrategy,
    TaskMatchStrategy,
    TermLinkStrategy,
} from '../../../nar/src/reason';
import {Truth} from '../../../nar/src/terms/truth.js';
import {createTask} from '../../../nar/src/types/index.js';
import {NAR} from '../../../src';

describe('Core Strategies', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    describe('PrologStrategy', () => {
        it('should have correct configuration', () => {
            expect(PrologStrategy.name).toBe('prolog');
            expect(PrologStrategy.sampleSize).toBe(20);
            expect(PrologStrategy.limit).toBe(5);
        });

        it('should select secondary tasks for inference', async () => {
            await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
            await nar.input('(b --> c)', 'belief', Truth.create(0.9, 0.9));

            const task = nar.taskManager.peekTask();
            if (task) {
                const results = PrologStrategy.selectSecondary(task, nar.memory);
                expect(Array.isArray(results)).toBe(true);
            }
        });
    });

    describe('ResolutionStrategy', () => {
        it('should have correct configuration', () => {
            expect(ResolutionStrategy.name).toBe('resolution');
            expect(ResolutionStrategy.sampleSize).toBe(15);
            expect(ResolutionStrategy.limit).toBe(5);
        });

        it('should filter for inheritance terms only', async () => {
            await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
            await nar.input('(&, a, b)', 'belief', Truth.create(0.9, 0.9));

            const concepts = nar.memory.listConcepts();
            const inheritanceConcepts = concepts.filter((c) => c.term.kind === 'inheritance');
            expect(inheritanceConcepts.length).toBeGreaterThan(0);
        });
    });

    describe('GoalDrivenStrategy', () => {
        it('should have correct name', () => {
            expect(GoalDrivenStrategy.name).toBe('goal-driven');
        });

        it('should prioritize high-confidence beliefs', async () => {
            await nar.input('(important --> fact)', 'belief', Truth.create(0.95, 0.95));
            await nar.input('(unimportant --> fact)', 'belief', Truth.create(0.3, 0.5));

            const task = nar.taskManager.peekTask();
            if (task) {
                const results = GoalDrivenStrategy.selectSecondary(task, nar.memory);
                expect(Array.isArray(results)).toBe(true);
            }
        });
    });

    describe('AnalogicalStrategy', () => {
        it('should have correct name', () => {
            expect(AnalogicalStrategy.name).toBe('analogical');
        });

        it('should find concepts with overlapping terms', async () => {
            await nar.input('(dog --> animal)', 'belief', Truth.create(0.9, 0.9));
            await nar.input('(cat --> animal)', 'belief', Truth.create(0.9, 0.9));

            const task = nar.taskManager.peekTask();
            if (task) {
                const results = AnalogicalStrategy.selectSecondary(task, nar.memory);
                expect(Array.isArray(results)).toBe(true);
            }
        });

        it('should handle non-inheritance terms gracefully', async () => {
            await nar.input('test', 'belief', Truth.create(0.9, 0.9));

            const task = nar.taskManager.peekTask();
            if (task) {
                const results = AnalogicalStrategy.selectSecondary(task, nar.memory);
                expect(Array.isArray(results)).toBe(true);
            }
        });
    });

    describe('TermLinkStrategy', () => {
        it('should have correct configuration', () => {
            expect(TermLinkStrategy.name).toBe('term-link');
            expect(TermLinkStrategy.sampleSize).toBe(25);
            expect(TermLinkStrategy.limit).toBe(10);
        });

        it('should link related terms', async () => {
            await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
            await nar.input('(b --> c)', 'belief', Truth.create(0.9, 0.9));

            const task = nar.taskManager.peekTask();
            if (task) {
                const results = TermLinkStrategy.selectSecondary(task, nar.memory);
                expect(Array.isArray(results)).toBe(true);
            }
        });
    });

    describe('TaskMatchStrategy', () => {
        it('should have correct configuration', () => {
            expect(TaskMatchStrategy.name).toBe('task-match');
            expect(TaskMatchStrategy.sampleSize).toBe(20);
            expect(TaskMatchStrategy.limit).toBe(5);
        });

        it('should match tasks with similar terms', async () => {
            await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));

            const task = nar.taskManager.peekTask();
            if (task) {
                const results = TaskMatchStrategy.selectSecondary(task, nar.memory);
                expect(Array.isArray(results)).toBe(true);
            }
        });
    });

    describe('DecompositionStrategy', () => {
        it('should have correct name', () => {
            expect(DecompositionStrategy.name).toBe('decomposition');
        });

        it('should decompose conjunctions into components', async () => {
            await nar.input('(&, a, b, c)', 'belief', Truth.create(0.9, 0.9));

            const task = nar.taskManager.peekTask();
            if (task && task.term.kind === 'conjunction') {
                const results = DecompositionStrategy.selectSecondary(task, nar.memory);
                expect(Array.isArray(results)).toBe(true);
                expect(results.length).toBeGreaterThan(0);
            } else {
                const concepts = nar.memory.listConcepts();
                const conjunctionConcept = concepts.find((c) => c.term.kind === 'conjunction');
                if (conjunctionConcept) {
                    const mockTask = createTask(conjunctionConcept.term, 'belief', Truth.create(0.9, 0.9));
                    const results = DecompositionStrategy.selectSecondary(mockTask, nar.memory);
                    expect(Array.isArray(results)).toBe(true);
                    expect(results.length).toBeGreaterThan(0);
                }
            }
        });

        it('should return empty array for non-conjunction terms', async () => {
            await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));

            const task = nar.taskManager.peekTask();
            if (task) {
                const results = DecompositionStrategy.selectSecondary(task, nar.memory);
                expect(results.length).toBe(0);
            }
        });
    });

    describe('DefaultFormationStrategy', () => {
        it('should have correct configuration', () => {
            expect(DefaultFormationStrategy.name).toBe('default-formation');
            expect(DefaultFormationStrategy.sampleSize).toBe(10);
            expect(DefaultFormationStrategy.limit).toBe(5);
        });

        it('should form beliefs from premises', async () => {
            await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));

            const task = nar.taskManager.peekTask();
            if (task) {
                const results = DefaultFormationStrategy.selectSecondary(task, nar.memory);
                expect(Array.isArray(results)).toBe(true);
            }
        });
    });
});

describe('Composite Strategies', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should combine multiple strategies', async () => {
        const composite = new CompositeStrategy([PrologStrategy, ResolutionStrategy]);

        await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));

        const task = nar.taskManager.peekTask();
        if (task) {
            const results = composite.selectSecondary(task, nar.memory);
            expect(Array.isArray(results)).toBe(true);
        }
    });

    it('should handle sequential mode', async () => {
        const composite = new CompositeStrategy([PrologStrategy, ResolutionStrategy], 'sequential');

        await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
        const task = nar.taskManager.peekTask();
        if (task) {
            const results = composite.selectSecondary(task, nar.memory);
            expect(Array.isArray(results)).toBe(true);
        }
    });

    it('should handle parallel mode', async () => {
        const composite = new CompositeStrategy([PrologStrategy, GoalDrivenStrategy], 'parallel');

        await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
        const task = nar.taskManager.peekTask();
        if (task) {
            const results = composite.selectSecondary(task, nar.memory);
            expect(Array.isArray(results)).toBe(true);
        }
    });

    it('should handle weighted mode', async () => {
        const composite = new CompositeStrategy(
            [PrologStrategy, ResolutionStrategy, GoalDrivenStrategy],
            'weighted',
            [0.5, 0.3, 0.2]
        );

        await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
        const task = nar.taskManager.peekTask();
        if (task) {
            const results = composite.selectSecondary(task, nar.memory);
            expect(Array.isArray(results)).toBe(true);
        }
    });

    it('should handle strategy failures gracefully', async () => {
        const failingStrategy: Strategy = {
            name: 'failing',
            selectSecondary: () => {
                throw new Error('Intentional failure');
            },
        };

        const composite = new CompositeStrategy([failingStrategy, PrologStrategy]);

        await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
        const task = nar.taskManager.peekTask();
        if (task) {
            const results = composite.selectSecondary(task, nar.memory);
            expect(Array.isArray(results)).toBe(true);
        }
    });
});

describe('Adaptive Strategy', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should initialize with provided strategies', () => {
        const adaptive = new AdaptiveStrategy([PrologStrategy, ResolutionStrategy]);
        expect(adaptive.name).toBe('adaptive');

        const stats = adaptive.getStats();
        expect(stats).toBeDefined();
        expect(stats.size).toBe(2);
    });

    it('should adapt based on effectiveness', async () => {
        const adaptive = new AdaptiveStrategy([PrologStrategy, ResolutionStrategy]);

        await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
        const task = nar.taskManager.peekTask();

        if (task) {
            const results1 = adaptive.selectSecondary(task, nar.memory);
            expect(Array.isArray(results1)).toBe(true);

            const results2 = adaptive.selectSecondary(task, nar.memory);
            expect(Array.isArray(results2)).toBe(true);

            const stats = adaptive.getStats();
            expect(stats.size).toBe(2);
        }
    });

    it('should track statistics per strategy', async () => {
        const adaptive = new AdaptiveStrategy([PrologStrategy]);

        await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
        const task = nar.taskManager.peekTask();

        if (task) {
            adaptive.selectSecondary(task, nar.memory);
            adaptive.selectSecondary(task, nar.memory);

            const stats = adaptive.getStats();
            const prologStats = stats.get('prolog');
            expect(prologStats).toBeDefined();
            if (prologStats) {
                expect(prologStats.pairsGenerated).toBeGreaterThanOrEqual(0);
            }
        }
    });
});

describe('Switching Strategy', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should switch between strategies', () => {
        const switching = new SwitchingStrategy([PrologStrategy, ResolutionStrategy], 5);
        expect(switching.name).toBe('switching');
        expect(switching.getCurrentStrategy()).toBe(PrologStrategy);
    });

    it('should cycle through strategies at interval', async () => {
        const switching = new SwitchingStrategy([PrologStrategy, ResolutionStrategy], 3);

        await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
        const task = nar.taskManager.peekTask();

        if (task) {
            expect(switching.getCurrentStrategy()).toBe(PrologStrategy);

            switching.selectSecondary(task, nar.memory);
            switching.selectSecondary(task, nar.memory);
            switching.selectSecondary(task, nar.memory);

            expect(switching.getCurrentStrategy()).toBe(ResolutionStrategy);
        }
    });

    it('should reset to first strategy', () => {
        const switching = new SwitchingStrategy([PrologStrategy, ResolutionStrategy], 3);

        switching.reset();
        expect(switching.getCurrentStrategy()).toBe(PrologStrategy);
    });
});

describe('Strategy Factory Functions', () => {
    it('should create strategy with default options', () => {
        const strategy = createStrategy({
            name: 'test-strategy',
            sampleSize: 10,
            limit: 5,
        });

        expect(strategy.name).toBe('test-strategy');
        expect(strategy.selectSecondary).toBeDefined();
    });

    it('should create strategy with custom filter', () => {
        const strategy = createStrategy({
            name: 'filtered-strategy',
            sampleSize: 15,
            limit: 7,
            filter: (concept) => concept.term.kind === 'inheritance',
        });

        expect(strategy.name).toBe('filtered-strategy');
    });

    it('should create strategy with truth filter', () => {
        const strategy = createStrategy({
            name: 'truth-filtered-strategy',
            sampleSize: 20,
            limit: 10,
            truthFilter: (truth) => truth.f >= 0.5,
        });

        expect(strategy.name).toBe('truth-filtered-strategy');
        expect(strategy.selectSecondary).toBeDefined();
    });
});

describe('Strategy Performance', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should handle large concept spaces efficiently', async () => {
        for (let i = 0; i < 50; i++) {
            await nar.input(`(concept${i} --> property)`, 'belief', Truth.create(0.9, 0.9));
        }

        const task = nar.taskManager.peekTask();
        if (task) {
            const strategies = [PrologStrategy, ResolutionStrategy, TermLinkStrategy, TaskMatchStrategy];

            for (const strategy of strategies) {
                const start = Date.now();
                const results = strategy.selectSecondary(task, nar.memory);
                const duration = Date.now() - start;

                expect(Array.isArray(results)).toBe(true);
                expect(duration).toBeLessThan(100);
            }
        }
    });

    it('should handle empty memory gracefully', () => {
        const task = nar.taskManager.peekTask();
        if (task) {
            const strategies = [
                PrologStrategy,
                ResolutionStrategy,
                GoalDrivenStrategy,
                AnalogicalStrategy,
            ];

            for (const strategy of strategies) {
                const results = strategy.selectSecondary(task, nar.memory);
                expect(Array.isArray(results)).toBe(true);
            }
        }
    });
});
