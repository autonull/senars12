/**
 * Performance Benchmarks for MeTTa Implementation
 * Tests various performance aspects and scalability
 *
 * NOTE: These tests are timing-dependent and may fail on slower systems.
 * They are disabled by default. Run manually when needed.
 */

import {MeTTaInterpreter} from '../../src/index.js';

describe.skip('MeTTa Performance Benchmarks', () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new MeTTaInterpreter({loadStdlib: false});
    });

    describe('Basic Operation Performance', () => {
        test('arithmetic operations performance', () => {
            const start = performance.now();
            for (let i = 0; i < 1000; i++) {
                const result = interpreter.run(`(^ &+ ${i} ${i + 1})`);
                expect(result[0].name).toBe(`${i + i + 1}`);
            }
            const end = performance.now();
            const duration = end - start;

            // Should complete within reasonable time (e.g., under 10 seconds for 1000 operations)
            expect(duration).toBeLessThan(10000);
            console.log(`1000 arithmetic operations took ${duration.toFixed(2)}ms`);
        });

        test('comparison operations performance', () => {
            const start = performance.now();
            for (let i = 0; i < 1000; i++) {
                const result = interpreter.run(`(^ &== ${i} ${i})`);
                expect(result[0].name).toBe('True');
            }
            const end = performance.now();
            const duration = end - start;

            expect(duration).toBeLessThan(10000);
            console.log(`1000 comparison operations took ${duration.toFixed(2)}ms`);
        });
    });

    describe('Rule Application Performance', () => {
        test('simple rule application speed', () => {
            // Add a simple rule
            interpreter.space.addRule(
                interpreter.parser.parse('(square $x)'),
                interpreter.parser.parse('(^ &* $x $x)')
            );

            const start = performance.now();
            for (let i = 1; i <= 100; i++) {
                const result = interpreter.run(`(square ${i})`);
                const expected = i * i;
                expect(parseInt(result[0].name)).toBe(expected);
            }
            const end = performance.now();
            const duration = end - start;

            expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
            console.log(`100 rule applications took ${duration.toFixed(2)}ms`);
        });

        test('multiple rules performance', () => {
            // Add multiple rules
            for (let i = 0; i < 10; i++) {
                interpreter.space.addRule(
                    interpreter.parser.parse(`(func-${i} $x)`),
                    interpreter.parser.parse(`(^ &+ $x ${i})`)
                );
            }

            const start = performance.now();
            for (let j = 0; j < 100; j++) {
                const result = interpreter.run(`(func-${j % 10} ${(j * 2)})`);
                const expected = (j * 2) + (j % 10);
                expect(parseInt(result[0].name)).toBe(expected);
            }
            const end = performance.now();
            const duration = end - start;

            expect(duration).toBeLessThan(5000);
            console.log(`100 rule applications with 10 different rules took ${duration.toFixed(2)}ms`);
        });
    });

    describe('Space Operations Performance', () => {
        test('large space performance', () => {
            // Add many atoms to the space
            const start = performance.now();
            for (let i = 0; i < 1000; i++) {
                const atom = interpreter.parser.parse(`(test-atom-${i} ${i * 2})`);
                interpreter.space.add(atom);
            }
            const addDuration = performance.now() - start;

            // Verify we have the right number of atoms
            expect(interpreter.space.size()).toBeGreaterThanOrEqual(1000);

            // Test querying performance
            const queryStart = performance.now();
            for (let i = 0; i < 100; i++) {
                // This is a simple test - actual querying depends on implementation
                const atomCount = interpreter.space.size();
                expect(atomCount).toBeGreaterThanOrEqual(1000);
            }
            const queryDuration = performance.now() - queryStart;

            expect(addDuration).toBeLessThan(5000);
            expect(queryDuration).toBeLessThan(2000);

            console.log(`Adding 1000 atoms took ${addDuration.toFixed(2)}ms`);
            console.log(`Querying 100 times took ${queryDuration.toFixed(2)}ms`);
        });

        test('bulk operations performance', () => {
            const start = performance.now();

            // Bulk add and remove operations
            for (let i = 0; i < 500; i++) {
                const atom = interpreter.parser.parse(`(bulk-test ${i})`);
                interpreter.space.add(atom);

                // Remove every 10th atom to create churn
                if (i % 10 === 0) {
                    interpreter.space.remove(atom);
                }
            }

            const end = performance.now();
            const duration = end - start;

            expect(duration).toBeLessThan(5000);
            console.log(`500 bulk add/remove operations took ${duration.toFixed(2)}ms`);
        });
    });

    describe('Complex Expression Performance', () => {
        test('deep expression evaluation', () => {
            // Create a deeply nested expression
            let expr = '0';
            for (let i = 1; i <= 20; i++) {
                expr = `(^ &+ ${i} ${expr})`;
            }

            const start = performance.now();
            const result = interpreter.run(expr);
            const end = performance.now();
            const duration = end - start;

            // The result should be the sum 0+1+2+...+19+20 = 210
            const expectedSum = (20 * 21) / 2; // Sum formula: n*(n+1)/2
            expect(parseInt(result[0].name)).toBe(expectedSum);

            expect(duration).toBeLessThan(5000);
            console.log(`Deep expression (depth 20) evaluation took ${duration.toFixed(2)}ms`);
        });

        test('large list processing', () => {
            // Create a moderately large list
            let listStr = '()';
            for (let i = 0; i < 50; i++) {
                listStr = `(: ${i} ${listStr})`;
            }

            // Add a rule to process the list
            interpreter.space.addRule(
                interpreter.parser.parse('(sum-list ())'),
                interpreter.parser.parse('0')
            );
            interpreter.space.addRule(
                interpreter.parser.parse('(sum-list (: $head $tail))'),
                interpreter.parser.parse('(^ &+ $head (sum-list-aux $tail))')
            );
            interpreter.space.addRule(
                interpreter.parser.parse('(sum-list-aux ())'),
                interpreter.parser.parse('0')
            );
            interpreter.space.addRule(
                interpreter.parser.parse('(sum-list-aux (: $head $tail))'),
                interpreter.parser.parse('(^ &+ $head (sum-list-aux $tail))')
            );

            const start = performance.now();
            const result = interpreter.run(`(sum-list ${listStr})`);
            const end = performance.now();
            const duration = end - start;

            // The sum of 0+1+2+...+49 = 49*50/2 = 1225
            expect(parseInt(result[0].name)).toBe(1225);

            expect(duration).toBeLessThan(10000);
            console.log(`Processing list with 50 elements took ${duration.toFixed(2)}ms`);
        });
    });

    describe('Reduction Engine Performance', () => {
        test('many reduction steps performance', () => {
            // Create a rule that requires multiple reduction steps
            interpreter.space.addRule(
                interpreter.parser.parse('(counter 0 $acc)'),
                interpreter.parser.parse('$acc')
            );
            interpreter.space.addRule(
                interpreter.parser.parse('(counter $n $acc)'),
                interpreter.parser.parse('(counter (- $n 1) (^ &+ $acc 1))')
            );

            const start = performance.now();
            const result = interpreter.run('(counter 100 0)');
            const end = performance.now();
            const duration = end - start;

            expect(parseInt(result[0].name)).toBe(100);
            expect(duration).toBeLessThan(5000);
            console.log(`Counter with 100 steps took ${duration.toFixed(2)}ms`);
        });

        test('reduction with branching', () => {
            // Create rules that create branching in evaluation
            interpreter.space.addRule(
                interpreter.parser.parse('(branch-test $n)'),
                interpreter.parser.parse('(^ &if (^ &> $n 0) (^ &- $n 1) $n)')
            );

            const start = performance.now();
            for (let i = 0; i < 50; i++) {
                const result = interpreter.run(`(branch-test ${i})`);
                // Should return i-1 for positive numbers, i for 0
                const expected = i > 0 ? i - 1 : 0;
                expect(parseInt(result[0].name)).toBe(expected);
            }
            const end = performance.now();
            const duration = end - start;

            expect(duration).toBeLessThan(5000);
            console.log(`50 branching operations took ${duration.toFixed(2)}ms`);
        });
    });

    describe('Memory Usage Patterns', () => {
        test('memory growth during intensive operations', () => {
            const initialMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;

            // Perform intensive operations
            for (let i = 0; i < 1000; i++) {
                const result = interpreter.run(`(^ &* ${i} ${i + 1})`);
                expect(result[0]).toBeDefined();
            }

            const finalMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
            const memoryGrowth = finalMemory - initialMemory;

            // Memory growth should be reasonable (less than 100MB for this test)
            expect(Math.abs(memoryGrowth)).toBeLessThan(100 * 1024 * 1024);
            console.log(`Memory growth during intensive operations: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);
        });
    });

    describe('Scalability Tests', () => {
        test('performance under load - multiple interpreters', async () => {
            const start = performance.now();

            // Create multiple interpreters and run operations in parallel
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(
                    new Promise(resolve => {
                        const interp = new MeTTaInterpreter({loadStdlib: false});

                        // Add a rule to each interpreter
                        interp.space.addRule(
                            interp.parser.parse('(work $x)'),
                            interp.parser.parse('(^ &* $x $x)')
                        );

                        // Run operations
                        for (let j = 0; j < 100; j++) {
                            const result = interp.run(`(work ${j})`);
                            expect(result[0]).toBeDefined();
                        }

                        resolve(true);
                    })
                );
            }

            await Promise.all(promises);

            const end = performance.now();
            const duration = end - start;

            expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
            console.log(`5 interpreters with 100 operations each took ${duration.toFixed(2)}ms`);
        });
    });
});
