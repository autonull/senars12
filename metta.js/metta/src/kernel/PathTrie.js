/**
 * PathTrie.js - Rule indexing with O(1) matching
 * Optimized: Linear scan for < 100 rules, trie for larger sets
 */

import {isExpression, isVariable} from './Term.js';

class TrieNode {
    constructor() {
        this.children = new Map();
        this.rules = [];
        this.isLeaf = false;
        this.hasVariableChild = false;
    }
}

export class PathTrie {
    constructor() {
        this.root = new TrieNode();
        this.rules = [];
        this.stats = {inserts: 0, lookups: 0, hits: 0, rebalances: 0};
        this._insertCount = 0;
        this._rebalanceThreshold = 10000;
        this._useLinearScan = true;
        this._linearScanThreshold = 100;
    }

    * _atomPath(atom, forInsert = true) {
        if (!atom) {
            return;
        }

        if (isVariable(atom)) {
            yield forInsert ? '$VAR' : atom.name;
        } else if (isExpression(atom)) {
            yield atom.operator?.name ?? atom.operator ?? '()';
            const comps = atom.components ?? [];
            yield comps.length;
            for (const comp of comps) {
                yield* this._atomPath(comp, forInsert);
            }
        } else {
            yield atom.name ?? atom;
        }
    }

    _quickMatch(pattern, atom) {
        if (!pattern || !atom) {
            return false;
        }

        const patternIsVar = isVariable(pattern);
        const atomIsVar = isVariable(atom);

        if (patternIsVar) {
            return true;
        }
        if (atomIsVar) {
            return false;
        }

        if (isExpression(pattern) && isExpression(atom)) {
            const pOp = pattern.operator?.name ?? pattern.operator;
            const aOp = atom.operator?.name ?? atom.operator;
            if (pOp !== aOp) {
                return false;
            }

            const pComps = pattern.components ?? [];
            const aComps = atom.components ?? [];
            if (pComps.length !== aComps.length) {
                return false;
            }

            for (let i = 0; i < pComps.length; i++) {
                if (!this._quickMatch(pComps[i], aComps[i])) {
                    return false;
                }
            }
            return true;
        }

        return (pattern.name ?? pattern) === (atom.name ?? atom);
    }

    insert(pattern, rule) {
        this.stats.inserts++;
        this._insertCount++;
        this.rules.push(rule);

        if (this._insertCount >= this._linearScanThreshold) {
            this._useLinearScan = false;
        }

        let curr = this.root;
        const path = Array.from(this._atomPath(pattern, true));

        for (const token of path) {
            if (!curr.children.has(token)) {
                curr.children.set(token, new TrieNode());
            }
            curr = curr.children.get(token);
            if (token === '$VAR') {
                curr.hasVariableChild = true;
            }
        }

        curr.isLeaf = true;
        curr.rules.push(rule);

        if (this._insertCount >= this._rebalanceThreshold) {
            this.rebalance();
        }
    }

    query(atom) {
        this.stats.lookups++;

        if (this._useLinearScan) {
            return this.rules.filter(rule => {
                const match = this._quickMatch(rule.pattern, atom);
                if (match) {
                    this.stats.hits++;
                }
                return match;
            });
        }

        const rules = [];
        const path = Array.from(this._atomPath(atom, false));

        const traverse = (node, depth) => {
            if (depth === path.length) {
                if (node.isLeaf) {
                    rules.push(...node.rules);
                    this.stats.hits += node.rules.length;
                }
                return;
            }

            const token = path[depth];
            if (node.children.has(token)) {
                traverse(node.children.get(token), depth + 1);
            }
            if (node.children.has('$VAR')) {
                traverse(node.children.get('$VAR'), depth + 1);
            }

            if (typeof token === 'string' && token.startsWith('$')) {
                for (const [key, childNode] of node.children.entries()) {
                    if (key !== '$VAR') {
                        traverse(childNode, depth + 1);
                    }
                }
            }
        };

        traverse(this.root, 0);
        return rules;
    }

    rebalance() {
        this.stats.rebalances++;
        this._insertCount = 0;

        queueMicrotask(() => {
            const compressNode = (node) => {
                for (const child of node.children.values()) {
                    compressNode(child);
                }
            };
            compressNode(this.root);
        });
    }

    getStats() {
        return {...this.stats, ruleCount: this.rules.length, usingLinearScan: this._useLinearScan};
    }

    clear() {
        this.root = new TrieNode();
        this.rules = [];
        this.stats = {inserts: 0, lookups: 0, hits: 0, rebalances: 0};
        this._insertCount = 0;
        this._useLinearScan = true;
    }
}
