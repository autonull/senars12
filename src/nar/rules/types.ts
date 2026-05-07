import type { Term } from '../terms/index.js';

export type RulePattern = {
  left: { op?: string; subject?: string };
  right: { op?: string; subject?: string };
};

export type RuleFn = (premises: any[]) => any;

export interface RegisteredRule {
  id: string;
  pattern: RulePattern;
  apply: RuleFn;
  sync: boolean;
  priority: number;
}

export const RuleRegistry = {
  rules: new Map<string, RegisteredRule>(),
  register(rule: RegisteredRule): void { RuleRegistry.rules.set(rule.id, rule); },
  get(id: string): RegisteredRule | undefined { return RuleRegistry.rules.get(id); },
  getAll(): RegisteredRule[] { return Array.from(RuleRegistry.rules.values()); },
  clear(): void { RuleRegistry.rules.clear(); }
};

export const createRulePattern = (leftOp?: string, rightOp?: string): RulePattern => ({
  left: { op: leftOp },
  right: { op: rightOp }
});

export const encodePattern = (pattern: RulePattern): string[] => [
  pattern.left.op ?? '*',
  pattern.right.op ?? '*'
];

class TrieNode<V> {
  children = new Map<string, TrieNode<V>>();
  values: V[] = [];
  getOrCreate(key: string): TrieNode<V> {
    const child = this.children.get(key) ?? new TrieNode<V>();
    if (!this.children.has(key)) this.children.set(key, child);
    return child;
  }
  getNode(key: string): TrieNode<V> | undefined {
    return this.children.get(key);
  }
}

export class RuleIndex {
  private trie = new TrieNode<RegisteredRule>();
  private cache = new Map<string, RegisteredRule[]>();

  register(rule: RegisteredRule): void {
    const path = encodePattern(rule.pattern);
    let node: TrieNode<RegisteredRule> = this.trie;
    for (const key of path) {
      node = node.getOrCreate(key);
    }
    node.values.push(rule);
    this.cache.clear();
  }

  match(term1: Term, term2: Term): RegisteredRule[] {
    const cacheKey = `${term1.kind}:${term2.kind}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const k1 = term1.kind === 'atom' ? '*' : term1.kind;
    const k2 = term2.kind === 'atom' ? '*' : term2.kind;
    const results: RegisteredRule[] = [];
    const seen = new Set<string>();

    for (const first of [k1, '*']) {
      for (const second of [k2, '*']) {
        let node: TrieNode<RegisteredRule> | undefined = this.trie;
        let nextNode = node.getNode(first);
        if (nextNode) {
          nextNode = nextNode.getNode(second) ?? node.getNode('*');
          if (nextNode) {
            node = nextNode;
          }
        } else {
          nextNode = node.getNode('*');
          if (!nextNode) continue;
          node = nextNode.getNode(second) ?? nextNode.getNode('*');
          if (!node) continue;
        }

        for (const rule of node.values) {
          if (!seen.has(rule.id)) {
            seen.add(rule.id);
            results.push(rule);
          }
        }
      }
    }

    const sorted = results.toSorted((a, b) => b.priority - a.priority);
    this.cache.set(cacheKey, sorted);
    return sorted;
  }

  clear(): void {
    this.trie = new TrieNode<RegisteredRule>();
    this.cache.clear();
  }
}