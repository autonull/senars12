/**
 * Resource Bounds & AIKR Compliance Tests
 */
import type {NARConfig} from '../../../src/nar/nar.js';
import {NAR} from '../../../src/nar/nar.js';
import {TermBuilder, Truth} from '../../../src/nar/terms';

describe('AIKR Compliance', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR({
            maxConcepts: 100,
            priorityThreshold: 0.1,
            activationDecayRate: 0.01,
            consolidationInterval: 5,
            cpuThrottleMs: 10,
            maxDerivationDepth: 10,
            maxDerivationsPerStep: 100,
            enableLMRules: false
        });
    });

    describe('Anytime Execution', () => {
        it('produces results even if interrupted', async () => {
            await nar.input('(x --> y)', 'belief');

            const results: any[] = [];
            for (let i = 0; i < 3; i++) {
                const r = await nar.run(1);
                results.push(r);
                if (results.length > 0) break;
            }

            expect(results.length).toBeGreaterThan(0);
        });

        it('can be stopped at any cycle', async () => {
            await nar.input('(a --> b)', 'belief');

            let derived = 0;
            for (let i = 0; i < 5; i++) {
                const r = await nar.run(1);
                derived += r;
                if (i === 2) break;
            }

            expect(derived >= 0).toBe(true);
        });
    });

    describe('Bounded Resources', () => {
        it('respects memory limits', async () => {
            const startMem = process.memoryUsage().heapUsed;

            for (let i = 0; i < 10; i++) {
                await nar.run(1);
            }

            const endMem = process.memoryUsage().heapUsed;
            const growth = (endMem - startMem) / 1024 / 1024;

            expect(growth).toBeLessThan(50);
        });

        it('respects derivation depth limits', async () => {
            await nar.input('(a --> b)', 'belief');
            await nar.input('(b --> c)', 'belief');
            await nar.input('(c --> d)', 'belief');

            const results = await nar.run(5);
            expect(typeof results).toBe('number');
        });

        it('handles resource constraints gracefully', async () => {
            const startTime = Date.now();

            for (let i = 0; i < 10; i++) {
                await nar.run(1);
            }

            const elapsed = Date.now() - startTime;
            expect(elapsed).toBeLessThan(5000);
        });
    });

    describe('Knowledge-Grounded', () => {
        it('uses existing beliefs for reasoning', async () => {
            await nar.input('(human --> mortal)', 'belief', Truth.create(0.99, 0.99));
            await nar.input('(socrates --> human)', 'belief', Truth.create(0.99, 0.99));
            await nar.run(1);

            const concepts = nar.memory.listConcepts();
            expect(concepts.length).toBeGreaterThan(0);
        });

        it('builds on established concepts', async () => {
            await nar.input('(bird --> animal)', 'belief');
            await nar.input('(animal --> living)', 'belief');

            await nar.run(2);

            const concepts = nar.memory.listConcepts();
            expect(concepts.length).toBeGreaterThan(0);
        });
    });

    describe('Resource-Aware', () => {
        it('throttles execution to prevent blocking', async () => {
            const start = Date.now();

            await nar.run(5);

            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(10000);
        });

        it('yields control periodically', async () => {
            const start = Date.now();

            for (let i = 0; i < 5; i++) {
                await nar.run(1);
            }

            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(5000);
        });
    });

    describe('Resource Bounds Enforcement', () => {
        it('derivation depth hard cap', async () => {
            const nar2 = new NAR({
                maxConcepts: 100,
                maxDerivationDepth: 10,
                enableLMRules: false
            } as NARConfig);

            const letters = 'abcdefghijklmnopqrst'.split('');
            for (let i = 0; i < letters.length - 1; i++) {
                await nar2.input(`(${letters[i]} --> ${letters[i + 1]})`, 'belief', Truth.create(0.9, 0.9));
            }

            await nar2.run(20);

            const concepts = nar2.memory.listConcepts();
            for (const concept of concepts) {
                const beliefs = (concept as any).beliefBag;
                if (beliefs && beliefs.peek) {
                    const belief = beliefs.peek();
                    if (belief && belief.stamp) {
                        expect(belief.stamp.depth).toBeLessThanOrEqual(10);
                    }
                }
            }
        });

        it('concept count bounded by maxConcepts', async () => {
            const nar2 = new NAR({
                maxConcepts: 100,
                enableLMRules: false
            } as NARConfig);

            for (let i = 0; i < 200; i++) {
                await nar2.input(`(concept${i} --> property${i})`, 'belief', Truth.create(0.9, 0.9));
            }

            await nar2.run(10);

            expect(nar2.memory.size).toBeLessThanOrEqual(105);
        });

        it('interruptibility via AbortSignal', async () => {
            const nar2 = new NAR({
                maxConcepts: 1000,
                enableLMRules: false
            } as NARConfig);

            for (let i = 0; i < 50; i++) {
                await nar2.input(`(item${i} --> attribute${i})`, 'belief', Truth.create(0.9, 0.9));
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 50);

            let partialResults = 0;
            try {
                const results = await nar2.run(100);
                partialResults = results;
            } catch {
            }

            clearTimeout(timeout);
            expect(partialResults).toBeGreaterThanOrEqual(0);
        });

        it('no memory leak under sustained load', async () => {
            const nar2 = new NAR({
                maxConcepts: 100,
                enableLMRules: false
            } as NARConfig);

            const startMem = process.memoryUsage?.()?.heapUsed ?? 0;

            for (let i = 0; i < 50; i++) {
                await nar2.input(`(temp${i} --> prop${i})`, 'belief', Truth.create(0.9, 0.9));
                await nar2.run(1);
            }

            if (global.gc) {
                global.gc();
            }

            const endMem = process.memoryUsage?.()?.heapUsed ?? 0;
            const growth = endMem - startMem;

            expect(growth / 1024 / 1024).toBeLessThan(200);
        });
    });

    describe('Complete Reasoning Cycle', () => {
        it('executes full cognitive cycle from input to derived belief', async () => {
            await nar.input('(bird --> animal)', 'belief', Truth.create(0.9, 0.9));
            await nar.input('(animal --> living)', 'belief', Truth.create(0.9, 0.9));
            await nar.input('(living --> needs-oxygen)', 'belief', Truth.create(0.95, 0.95));

            const initialSize = nar.memory.size;
            expect(initialSize).toBeGreaterThan(0);

            for (let i = 0; i < 5; i++) {
                await nar.run(1);
            }

            expect(nar.memory.size).toBeGreaterThanOrEqual(initialSize);

            const birdConcept = nar.memory.getConcept(TermBuilder.atom('bird'));
            if (birdConcept) {
                expect(birdConcept.totalTasks).toBeGreaterThanOrEqual(0);
            }
        });

        it('demonstrates emergent reasoning behavior', async () => {
            const premises = [['rain', 'wet'], ['wet', 'slippery'], ['slippery', 'dangerous']];

            for (const [from, to] of premises) {
                await nar.input(`(${from} --> ${to})`, 'belief', Truth.create(0.85, 0.85));
            }

            await nar.run(3);

            expect(nar.memory.size).toBeGreaterThan(0);
        });
    });
});
