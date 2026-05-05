import type { Term } from '../terms/index.js';
import type { RegisteredRule, RulePattern, RuleFn } from './types.js';
import type { Guard } from './guards.js';
import { RuleRegistry, createRulePattern } from './types.js';
import { NALRules } from './nal.js';
import { RuleProcessor } from './processor.js';
import { composeRules, sequenceRules } from './compose.js';

class TrieNode<V> {
    children = new Map<string, TrieNode<V>>();
    values: V[] = [];

    getOrCreate(key: string): TrieNode<V> {
        let child = this.children.get(key);
        if (!child) {
            child = new TrieNode<V>();
            this.children.set(key, child);
        }
        return child;
    }

    getNode(key: string): TrieNode<V> | undefined {
        return this.children.get(key);
    }
}

export class RuleIndex {
    private trie = new TrieNode<RegisteredRule>();

    register(rule: RegisteredRule): void {
        const path = encodePattern(rule.pattern);
        let node: TrieNode<RegisteredRule> = this.trie;
        for (const key of path) {
            node = node.getOrCreate(key);
        }
        node.values.push(rule);
    }

    match(term1: Term, term2: Term): RegisteredRule[] {
        const keys1 = term1.kind === 'atom' ? ['*'] : [term1.kind];
        const keys2 = term2.kind === 'atom' ? ['*'] : [term2.kind];
        const patterns: string[][] = [];

        for (const k1 of keys1) {
            for (const k2 of keys2) {
                patterns.push([k1, k2]);
            }
        }

        const results: RegisteredRule[] = [];

        for (const pattern of patterns) {
            let node: TrieNode<RegisteredRule> = this.trie;
            let found = true;

            for (const key of pattern) {
                const nextNode = node.getNode(key) ?? node.getNode('*');
                if (!nextNode) {
                    found = false;
                    break;
                }
                node = nextNode;
            }

            if (found && node.values.length > 0) {
                results.push(...node.values);
            }
        }

        return results.sort((a, b) => b.priority - a.priority);
    }

    clear(): void {
        this.trie = new TrieNode<RegisteredRule>();
    }
}

export const ruleIndex = new RuleIndex();

function encodePattern(pattern: RulePattern): string[] {
    return [pattern.left.op ?? '*', pattern.right.op ?? '*'];
}

export function matchRules(term1: Term, term2: Term): RegisteredRule[] {
    return ruleIndex.match(term1, term2);
}

export { RuleRegistry, createRulePattern, NALRules, RuleProcessor, RuleFn, Guard, composeRules, sequenceRules };
