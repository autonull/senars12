/**
 * Zipper Tests
 */

import {describe, expect, it} from '@jest/globals';
import {exp, sym, Zipper} from '../../src/index.js';

describe('Zipper', () => {
    describe('Construction', () => {
        it('should create zipper from expression', () => {
            const atom = exp(sym('a'), [exp(sym('b'), [])]);
            const zipper = new Zipper(atom);
            expect(zipper).toBeDefined();
            expect(zipper.focus).toBe(atom);
        });

        it('should initialize path array', () => {
            const atom = exp(sym('a'), []);
            const zipper = new Zipper(atom);
            expect(zipper.path).toBeDefined();
            expect(zipper.depth).toBe(0);
        });
    });

    describe('Navigation', () => {
        it('should navigate down to first child', () => {
            const child = exp(sym('b'), []);
            const parent = exp(sym('a'), [child]);
            const zipper = new Zipper(parent);

            const result = zipper.down(0);
            expect(result).toBe(true);
            expect(zipper.focus).toBe(child);
        });

        it('should return false when no children', () => {
            const atom = exp(sym('leaf'), []);
            const zipper = new Zipper(atom);

            const result = zipper.down(0);
            expect(result).toBe(false);
        });

        it('should navigate up', () => {
            const child = exp(sym('b'), []);
            const parent = exp(sym('a'), [child]);
            const zipper = new Zipper(parent);

            zipper.down(0);
            const result = zipper.up();
            expect(result).toBe(true);
            expect(zipper.focus).toBe(parent);
        });

        it('should return false when at root', () => {
            const atom = exp(sym('root'), []);
            const zipper = new Zipper(atom);

            const result = zipper.up();
            expect(result).toBe(false);
        });

        it('should navigate right', () => {
            const child1 = exp(sym('b'), []);
            const child2 = exp(sym('c'), []);
            const parent = exp(sym('a'), [child1, child2]);
            const zipper = new Zipper(parent);

            zipper.down(0);
            const result = zipper.right();
            expect(result).toBe(true);
            expect(zipper.focus).toBe(child2);
        });

        it('should return false when at rightmost sibling', () => {
            const child = exp(sym('b'), []);
            const parent = exp(sym('a'), [child]);
            const zipper = new Zipper(parent);

            zipper.down(0);
            const result = zipper.right();
            expect(result).toBe(false);
        });
    });

    describe('Replace', () => {
        it('should replace focus with new atom', () => {
            const child = exp(sym('b'), []);
            const parent = exp(sym('a'), [child]);
            const zipper = new Zipper(parent);

            zipper.down(0);
            const newChild = exp(sym('new'), []);
            const result = zipper.replace(newChild);

            expect(result).toBeDefined();
            expect(result.components[0]).toBe(newChild);
        });

        it('should maintain structure after replace', () => {
            const child1 = exp(sym('b'), []);
            const child2 = exp(sym('c'), []);
            const parent = exp(sym('a'), [child1, child2]);
            const zipper = new Zipper(parent);

            zipper.down(1);
            const newChild = exp(sym('new'), []);
            const result = zipper.replace(newChild);

            expect(result.components[0]).toBe(child1);
            expect(result.components[1]).toBe(newChild);
        });

        it('should update root after replace', () => {
            const child = exp(sym('b'), []);
            const parent = exp(sym('a'), [child]);
            const zipper = new Zipper(parent);

            zipper.down(0);
            const newChild = exp(sym('new'), []);
            const result = zipper.replace(newChild);

            expect(zipper.root).toBe(result);
        });
    });

    describe('Deep Navigation', () => {
        it('should navigate to deepest leaf', () => {
            // Create nested expression: (a (b (c (d))))
            let deep = exp(sym('d'), []);
            deep = exp(sym('c'), [deep]);
            deep = exp(sym('b'), [deep]);
            const root = exp(sym('a'), [deep]);

            const zipper = new Zipper(root);

            // Navigate to deepest
            while (zipper.down(0)) {
            }

            expect(zipper.focus).toBeDefined();
            expect(zipper.depth).toBe(3);
        });

        it('should handle complex tree structures', () => {
            // Create tree: (a (b c) (d e f))
            const tree = exp(sym('a'), [
                exp(sym('b'), [exp(sym('c'), [])]),
                exp(sym('d'), [exp(sym('e'), []), exp(sym('f'), [])])
            ]);

            const zipper = new Zipper(tree);

            // Navigate around
            expect(zipper.down(0)).toBe(true);
            expect(zipper.down(0)).toBe(true);
            expect(zipper.up()).toBe(true);
            expect(zipper.right()).toBe(true);
            expect(zipper.focus.operator.name).toBe('d');
        });
    });

    describe('Path Tracking', () => {
        it('should track navigation path', () => {
            const child = exp(sym('b'), []);
            const parent = exp(sym('a'), [child]);
            const zipper = new Zipper(parent);

            zipper.down(0);
            expect(zipper.depth).toBe(1);
        });

        it('should have zero depth when at root', () => {
            const atom = exp(sym('root'), []);
            const zipper = new Zipper(atom);

            expect(zipper.depth).toBe(0);
        });

        it('should resize path array for deep navigation', () => {
            // Create very deep expression
            let deep = exp(sym('leaf'), []);
            for (let i = 0; i < 50; i++) {
                deep = exp(sym('level' + i), [deep]);
            }

            const zipper = new Zipper(deep);

            // Navigate deep - should resize path array
            while (zipper.down(0)) {
            }

            expect(zipper.path.length).toBeGreaterThan(32);
        });
    });

    describe('Edge Cases', () => {
        it('should handle single node tree', () => {
            const atom = exp(sym('single'), []);
            const zipper = new Zipper(atom);

            expect(zipper.down(0)).toBe(false);
            expect(zipper.up()).toBe(false);
            expect(zipper.right()).toBe(false);
        });

        it('should handle deeply nested structures', () => {
            // Create very deep expression
            let deep = exp(sym('leaf'), []);
            for (let i = 0; i < 100; i++) {
                deep = exp(sym('level' + i), [deep]);
            }

            const zipper = new Zipper(deep);
            let depth = 0;
            while (zipper.down(0)) {
                depth++;
            }

            expect(depth).toBe(100);
        });

        it('should handle null root', () => {
            const zipper = new Zipper(null);
            expect(zipper.focus).toBe(null);
            expect(zipper.down(0)).toBe(false);
        });
    });
});
