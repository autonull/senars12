/**
 * JITCompiler Tests
 */

import {beforeEach, describe, expect, it} from '@jest/globals';
import {exp, JITCompiler, sym} from '../../src/index.js';

describe('JITCompiler', () => {
    let compiler;

    beforeEach(() => {
        compiler = new JITCompiler(5);
    });

    describe('Construction', () => {
        it('should create compiler with threshold', () => {
            expect(compiler).toBeDefined();
            expect(compiler.threshold).toBe(5);
        });

        it('should use default threshold', () => {
            const defaultCompiler = new JITCompiler();
            expect(defaultCompiler.threshold).toBe(50);
        });

        it('should initialize tracking maps', () => {
            expect(compiler.counts).toBeDefined();
            expect(compiler.compiled).toBeDefined();
            expect(compiler.stats.tracks).toBe(0);
        });
    });

    describe('Tracking', () => {
        it('should track atom calls', () => {
            const atom = exp(sym('test'), []);

            compiler.track(atom);
            compiler.track(atom);

            expect(compiler.counts.get('(test)')).toBe(2);
        });

        it('should compile after threshold', () => {
            const atom = exp(sym('test'), []);

            for (let i = 0; i < 5; i++) {
                compiler.track(atom);
            }

            const compiled = compiler.get(atom);
            expect(compiled).toBeDefined();
            expect(typeof compiled).toBe('function');
        });

        it('should not compile before threshold', () => {
            const atom = exp(sym('test'), []);

            for (let i = 0; i < 4; i++) {
                compiler.track(atom);
            }

            const compiled = compiler.get(atom);
            expect(compiled).toBeNull();
        });

        it('should track different atoms separately', () => {
            const atom1 = exp(sym('test1'), []);
            const atom2 = exp(sym('test2'), []);

            compiler.track(atom1);
            compiler.track(atom1);
            compiler.track(atom2);

            expect(compiler.counts.get('(test1)')).toBe(2);
            expect(compiler.counts.get('(test2)')).toBe(1);
        });

        it('should skip variables', () => {
            const variable = sym('$X');
            const result = compiler.track(variable);
            expect(result).toBeNull();
        });

        it('should skip bare symbols', () => {
            const symbol = sym('bare');
            const result = compiler.track(symbol);
            expect(result).toBeNull();
        });
    });

    describe('Compilation', () => {
        it('should return compiled function', () => {
            const atom = exp(sym('test'), []);

            for (let i = 0; i < 5; i++) {
                compiler.track(atom);
            }

            const compiled = compiler.get(atom);
            expect(typeof compiled).toBe('function');
        });

        it('should cache compiled functions', () => {
            const atom = exp(sym('test'), []);

            for (let i = 0; i < 5; i++) {
                compiler.track(atom);
            }

            const compiled1 = compiler.get(atom);
            const compiled2 = compiler.get(atom);

            expect(compiled1).toBe(compiled2);
        });

        it('should handle nested structures', () => {
            const atom = exp(sym('complex'), [
                exp(sym('nested'), [exp(sym('deep'), [])])
            ]);

            for (let i = 0; i < 5; i++) {
                compiler.track(atom);
            }

            const compiled = compiler.get(atom);
            expect(typeof compiled).toBe('function');
        });

        it('should return undefined when called', () => {
            const atom = exp(sym('test'), []);

            for (let i = 0; i < 5; i++) {
                compiler.track(atom);
            }

            const compiled = compiler.get(atom);
            const result = compiled({}, {});
            expect(result).toBeUndefined();
        });
    });

    describe('Term Key Generation', () => {
        it('should generate same key for identical structures', () => {
            const atom1 = exp(sym('test'), [exp(sym('child'), [])]);
            const atom2 = exp(sym('test'), [exp(sym('child'), [])]);

            const key1 = compiler._termKey(atom1);
            const key2 = compiler._termKey(atom2);

            expect(key1).toBe(key2);
        });

        it('should generate different keys for different structures', () => {
            const atom1 = exp(sym('test1'), []);
            const atom2 = exp(sym('test2'), []);

            const key1 = compiler._termKey(atom1);
            const key2 = compiler._termKey(atom2);

            expect(key1).not.toBe(key2);
        });

        it('should handle nested structures', () => {
            const atom1 = exp(sym('a'), [exp(sym('b'), [exp(sym('c'), [])])]);
            const atom2 = exp(sym('a'), [exp(sym('b'), [exp(sym('c'), [])])]);

            const key1 = compiler._termKey(atom1);
            const key2 = compiler._termKey(atom2);

            expect(key1).toBe(key2);
        });

        it('should handle symbols', () => {
            const sym1 = sym('test');
            const sym2 = sym('test');
            const sym3 = sym('other');

            const key1 = compiler._termKey(sym1);
            const key2 = compiler._termKey(sym2);
            const key3 = compiler._termKey(sym3);

            expect(key1).toBe(key2);
            expect(key1).not.toBe(key3);
        });

        it('should handle null', () => {
            const key = compiler._termKey(null);
            expect(key).toBe('');
        });
    });

    describe('Statistics', () => {
        it('should track total tracks', () => {
            const atom = exp(sym('test'), []);

            compiler.track(atom);
            compiler.track(atom);
            compiler.track(atom);

            expect(compiler.stats.tracks).toBe(3);
        });

        it('should track compilations', () => {
            const atom = exp(sym('test'), []);

            for (let i = 0; i < 5; i++) {
                compiler.track(atom);
            }

            expect(compiler.stats.compilations).toBe(1);
        });

        it('should track hits', () => {
            const atom = exp(sym('test'), []);

            for (let i = 0; i < 5; i++) {
                compiler.track(atom);
            }

            compiler.get(atom);
            compiler.get(atom);

            expect(compiler.stats.hits).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Edge Cases', () => {
        it('should handle null atoms', () => {
            expect(() => compiler.track(null)).not.toThrow();
            expect(compiler.get(null)).toBeNull();
        });

        it('should handle undefined atoms', () => {
            expect(() => compiler.track(undefined)).not.toThrow();
            expect(compiler.get(undefined)).toBeNull();
        });

        it('should handle grounded atoms', () => {
            const grounded = {
                type: 'grounded',
                value: 42,
                toString: () => 'grounded-42'
            };

            const result = compiler.track(grounded);
            expect(result).toBeNull(); // Grounded atoms are not compiled
        });

        it('should handle variables', () => {
            const variable = sym('$X');
            const result = compiler.track(variable);
            expect(result).toBeNull();
        });
    });

    describe('Performance', () => {
        it('should handle many atoms efficiently', () => {
            const atoms = [];
            for (let i = 0; i < 1000; i++) {
                atoms.push(exp(sym('test' + i), []));
            }

            const start = Date.now();
            for (const atom of atoms) {
                compiler.track(atom);
            }
            const trackTime = Date.now() - start;

            expect(trackTime).toBeLessThan(1000); // Should complete in under 1 second
        });

        it('should have fast key computation', () => {
            const atom = exp(sym('complex'), [
                exp(sym('nested'), [
                    exp(sym('deep'), [exp(sym('deeper'), [])])
                ])
            ]);

            const start = Date.now();
            for (let i = 0; i < 100; i++) {
                compiler._termKey(atom);
            }
            const keyTime = Date.now() - start;

            expect(keyTime).toBeLessThan(100); // Should complete in under 100ms
        });
    });
});
