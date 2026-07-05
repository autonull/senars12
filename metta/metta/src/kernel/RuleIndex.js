/**
 * RuleIndex.js - Multi-level rule indexing
 * Tier 2 optimization: Replaces linear scan with O(1) lookups
 */

import {isExpression, isSymbol, isVariable} from './Term.js';
import {BloomFilter} from './BloomFilter.js';
import {configManager} from '../config/config.js';

/**
 * Extract the root functor name from a pattern.
 * For `(f $x $y)` → `'f'`
 * For `((λ $p $b) $v)` → `'λ'`
 * For `(((|-> $p $b) $a) $v)` → `'|->'`
 */
function extractRootFunctor(atom) {
    if (!atom) return null;
    if (isSymbol(atom)) return atom.name;
    if (isVariable(atom)) return atom.name;
    if (isExpression(atom)) return extractRootFunctor(atom.operator);
    return null;
}

export class RuleIndex {
    constructor(config = {}) {
        this.enabled = config.enabled ?? configManager.get('indexing');

        // Level 1: Functor index (Map<string, Array<Rule>>)
        this.functorIndex = new Map();

        // Level 2: Functor + Arity (Map<string, Array<Rule>>)
        this.arityIndex = new Map();

        // Level 3: Signature (Map<string, Array<Rule>>)
        this.signatureIndex = new Map();

        // Level 4: Full pattern (Map<string, Array<Rule>>)
        this.patternIndex = new Map();

        // Bloom filter for fast negative lookups
        this.bloomFilter = new BloomFilter();

        // Statistics
        this.stats = {
            inserts: 0,
            lookups: 0,
            hits: 0,
            misses: 0,
            bloomFilterSaves: 0
        };

        // All rules (for iteration)
        this.allRules = [];
    }

    /**
     * Backward compatibility getter for bloom filter
     */
    get bloom() {
        return this.bloomFilter;
    }

    /**
     * Add a rule to the index
     */
    addRule(rule) {
        if (!this.enabled) {
            this.allRules.push(rule);
            return;
        }

        this.stats.inserts++;
        this.allRules.push(rule);

        const {pattern} = rule;
        if (!pattern) {
            return;
        }

        // Index by functor
        if (isExpression(pattern)) {
            const functor = extractRootFunctor(pattern) || (pattern.operator?.name || pattern.operator);
            this._addToIndex(this.functorIndex, functor, rule);

            // Index by functor + arity
            const arity = pattern.components?.length || 0;
            this._addToIndex(this.arityIndex, `${functor}/${arity}`, rule);

            // Index by signature (functor + arity + first arg type)
            const firstArg = pattern.components?.[0];
            const sig = this._getSignature(functor, arity, firstArg);
            this._addToIndex(this.signatureIndex, sig, rule);
        } else if (isSymbol(pattern)) {
            this._addToIndex(this.functorIndex, pattern.name, rule);
        }

        // Add to bloom filter (by functor for fast negative lookups)
        if (isExpression(pattern)) {
            const functor = extractRootFunctor(pattern) || (pattern.operator?.name || pattern.operator);
            this.bloomFilter.add(functor);
        } else if (isSymbol(pattern)) {
            this.bloomFilter.add(pattern.name);
        }
    }

    /**
     * Remove a rule from the index
     */
    removeRule(rule) {
        const idx = this.allRules.indexOf(rule);
        if (idx !== -1) {
            this.allRules.splice(idx, 1);
        }

        if (!this.enabled) {

        }

        // Note: Full removal from indexes would require reverse lookup
        // For now, we just remove from allRules (lazy deletion)
    }

    /**
     * Get rules matching a term's functor
     */
    rulesFor(term) {
        if (!this.enabled) {
            return this.allRules;
        }

        this.stats.lookups++;

        // If term's operator is an expression (like ((λ $x $body) $val)),
        // extract the root functor for lookup
        if (isExpression(term) && isExpression(term.operator)) {
            const rootFunctor = extractRootFunctor(term.operator);
            if (rootFunctor) {
                const rules = this.functorIndex.get(rootFunctor) || [];
                if (rules.length > 0) {
                    this.stats.hits++;
                    return rules;
                }
            }
        }

        // Fast negative check via bloom filter (by functor)
        let functor = null;
        if (isExpression(term)) {
            functor = term.operator?.name || term.operator;
        } else if (isSymbol(term)) {
            functor = term.name;
        }

        // If functor contains variables (like $x, $param), fall back to all rules
        // This allows unification to match patterns with different variable names
        if (typeof functor === 'string' && functor.includes('$')) {
            return this.allRules;
        }

        if (functor && !this.bloomFilter.has(functor)) {
            this.stats.misses++;
            this.stats.bloomFilterSaves++;
            return [];
        }

        let rules = [];

        if (isExpression(term)) {
            functor = term.operator?.name || term.operator;

            // If functor contains variables, return all rules for unification
            if (typeof functor === 'string' && functor.includes('$')) {
                return this.allRules;
            }

            rules = this.functorIndex.get(functor) || [];

            // Refine by arity if available
            const arity = term.components?.length || 0;
            const arityKey = `${functor}/${arity}`;
            const arityRules = this.arityIndex.get(arityKey);
            if (arityRules) {
                rules = arityRules;
            }
        } else if (isSymbol(term)) {
            rules = this.functorIndex.get(term.name) || [];
        }

        if (rules.length > 0) {
            this.stats.hits++;
        } else {
            this.stats.misses++;
        }

        return rules;
    }

    /**
     * Add to a sub-index
     */
    _addToIndex(index, key, rule) {
        if (!index.has(key)) {
            index.set(key, []);
        }
        index.get(key).push(rule);
    }

    /**
     * Get signature string for indexing
     */
    _getSignature(functor, arity, firstArg) {
        let type = 'other';
        if (isSymbol(firstArg)) {
            type = 'sym';
        } else if (isVariable(firstArg)) {
            type = 'var';
        } else if (isExpression(firstArg)) {
            type = 'exp';
        }
        return `${functor}/${arity}/${type}`;
    }

    /**
     * Clear all rules
     */
    clear() {
        this.allRules = [];
        this.functorIndex.clear();
        this.arityIndex.clear();
        this.signatureIndex.clear();
        this.patternIndex.clear();
        this.bloomFilter = new BloomFilter();
        this.stats = {inserts: 0, lookups: 0, hits: 0, misses: 0};
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            ruleCount: this.allRules.length,
            functorCount: this.functorIndex.size,
            arityCount: this.arityIndex.size,
            signatureCount: this.signatureIndex.size
        };
    }
}
