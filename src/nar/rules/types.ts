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

  register(rule: RegisteredRule): void {
    const path = encodePattern(rule.pattern);
    let node: TrieNode<RegisteredRule> = this.trie;
    for (const key of path) {
      node = node.getOrCreate(key);
    }
    node.values.push(rule);
  }

  match(term1: Term, term2: Term): RegisteredRule[] {
    const keys1 = term1.kind === 'atom' ? ['*', 'atom'] : ['*', term1.kind];
    const keys2 = term2.kind === 'atom' ? ['*', 'atom'] : ['*', term2.kind];
    const results: RegisteredRule[] = [];
    const seen = new Set<string>();

    for (const k1 of keys1) {
      for (const k2 of keys2) {
        const key = `${k1}-${k2}`;
        if (seen.has(key)) continue;

        let node: TrieNode<RegisteredRule> = this.trie;
        let found = true;

        for (const keyPart of [k1, k2]) {
          const nextNode = node.getNode(keyPart) ?? node.getNode('*');
          if (!nextNode) { found = false; break; }
          node = nextNode;
        }

        if (found) {
          for (const rule of node.values) {
            if (!seen.has(rule.id)) {
              seen.add(rule.id);
              results.push(rule);
            }
          }
        }
      }
    }

    return results.sort((a, b) => b.priority - a.priority);
  }

  clear(): void {
    this.trie = new TrieNode<RegisteredRule>();
  }
}