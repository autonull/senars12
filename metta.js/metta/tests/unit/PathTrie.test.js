/**
 * PathTrie Tests
 */

import {beforeEach, describe, expect, it} from '@jest/globals';
import {exp, PathTrie, sym} from '../../src/index.js';

describe('PathTrie', () => {
    let trie;

    beforeEach(() => {
        trie = new PathTrie();
    });

    describe('Construction', () => {
        it('should create empty trie', () => {
            expect(trie).toBeDefined();
            expect(trie.root).toBeDefined();
        });

        it('should initialize with stats', () => {
            expect(trie.stats.inserts).toBe(0);
            expect(trie.stats.lookups).toBe(0);
        });
    });

    describe('Insertion', () => {
        it('should insert simple pattern', () => {
            const pattern = exp(sym('test'), []);
            const rule = {pattern, result: exp(sym('result'), [])};

            trie.insert(pattern, rule);
            expect(trie.stats.inserts).toBe(1);
        });

        it('should insert nested patterns', () => {
            const pattern = exp(sym('a'), [exp(sym('b'), [])]);
            const rule = {pattern, result: exp(sym('result'), [])};

            trie.insert(pattern, rule);
            expect(trie.stats.inserts).toBe(1);
        });

        it('should handle variable patterns', () => {
            const pattern = exp(sym('test'), [sym('$VAR')]);
            const rule = {pattern, result: exp(sym('result'), [])};

            trie.insert(pattern, rule);
            expect(trie.stats.inserts).toBe(1);
        });

        it('should insert multiple rules', () => {
            const rule1 = {pattern: exp(sym('a'), []), result: exp(sym('r1'), [])};
            const rule2 = {pattern: exp(sym('b'), []), result: exp(sym('r2'), [])};

            trie.insert(rule1.pattern, rule1);
            trie.insert(rule2.pattern, rule2);

            expect(trie.stats.inserts).toBe(2);
        });
    });

    describe('Query', () => {
        it('should find exact match', () => {
            const pattern = exp(sym('test'), []);
            const rule = {pattern, result: exp(sym('result'), [])};

            trie.insert(pattern, rule);

            const results = trie.query(pattern);
            expect(results).toContain(rule);
        });

        it('should return empty array for no match', () => {
            const pattern = exp(sym('test'), []);
            const rule = {pattern, result: exp(sym('result'), [])};

            trie.insert(pattern, rule);

            const query = exp(sym('other'), []);
            const results = trie.query(query);
            expect(results).toEqual([]);
        });

        it('should match variable patterns', () => {
            const pattern = exp(sym('test'), [sym('$VAR')]);
            const rule = {pattern, result: exp(sym('result'), [])};

            trie.insert(pattern, rule);

            // Query with simple symbol (matches variable wildcard)
            const query = exp(sym('test'), [sym('anything')]);
            const results = trie.query(query);
            expect(results).toContain(rule);
        });

        it('should return multiple matching rules', () => {
            const pattern1 = exp(sym('test'), []);
            const pattern2 = exp(sym('test'), [sym('$VAR')]);
            const rule1 = {pattern: pattern1, result: exp(sym('r1'), [])};
            const rule2 = {pattern: pattern2, result: exp(sym('r2'), [])};

            trie.insert(pattern1, rule1);
            trie.insert(pattern2, rule2);

            // Query with variable argument to match pattern2
            const query = exp(sym('test'), [sym('x')]);
            const results = trie.query(query);

            expect(results.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Statistics', () => {
        it('should track insertions', () => {
            const pattern = exp(sym('test'), []);
            const rule = {pattern, result: exp(sym('result'), [])};

            trie.insert(pattern, rule);
            trie.insert(pattern, {...rule, result: exp(sym('r2'), [])});

            expect(trie.stats.inserts).toBe(2);
        });

        it('should track queries', () => {
            const pattern = exp(sym('test'), []);
            const rule = {pattern, result: exp(sym('result'), [])};

            trie.insert(pattern, rule);
            trie.query(pattern);
            trie.query(pattern);

            expect(trie.stats.lookups).toBe(2);
        });

        it('should track hits', () => {
            const pattern = exp(sym('test'), []);
            const rule = {pattern, result: exp(sym('result'), [])};

            trie.insert(pattern, rule);
            trie.query(pattern);

            expect(trie.stats.hits).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Rebalancing', () => {
        it('should auto-rebalance when threshold exceeded', () => {
            trie._rebalanceThreshold = 10;

            for (let i = 0; i < 15; i++) {
                const pattern = exp(sym('test' + i), []);
                const rule = {pattern, result: exp(sym('r' + i), [])};
                trie.insert(pattern, rule);
            }

            expect(trie.stats.rebalances).toBeGreaterThanOrEqual(1);
        });

        it('should allow manual rebalance', () => {
            for (let i = 0; i < 5; i++) {
                const pattern = exp(sym('test' + i), []);
                const rule = {pattern, result: exp(sym('r' + i), [])};
                trie.insert(pattern, rule);
            }

            expect(() => trie.rebalance()).not.toThrow();
            expect(trie.root).toBeDefined();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty patterns', () => {
            const pattern = exp(sym('empty'), []);
            const rule = {pattern, result: exp(sym('result'), [])};

            trie.insert(pattern, rule);
            const results = trie.query(pattern);
            expect(results).toContain(rule);
        });

        it('should handle deeply nested patterns', () => {
            let pattern = exp(sym('leaf'), []);
            for (let i = 0; i < 10; i++) {
                pattern = exp(sym('level' + i), [pattern]);
            }

            const rule = {pattern, result: exp(sym('result'), [])};
            trie.insert(pattern, rule);

            const results = trie.query(pattern);
            expect(results).toContain(rule);
        });

        it('should handle wildcard variables', () => {
            // Pattern with variable in argument position
            const pattern = exp(sym('test'), [sym('$X')]);
            const rule = {pattern, result: exp(sym('result'), [])};

            trie.insert(pattern, rule);

            // Query with simple symbol (matches variable wildcard)
            const query1 = exp(sym('test'), [sym('a')]);
            const query2 = exp(sym('test'), [sym('b')]);

            expect(trie.query(query1).length).toBeGreaterThan(0);
            expect(trie.query(query2).length).toBeGreaterThan(0);
        });
    });
});
