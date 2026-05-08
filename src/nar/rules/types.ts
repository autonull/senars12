import type {Term} from '../terms';
import type {Truth} from '../terms/truth';

export type RulePattern = {
  left: { op?: string; subject?: string };
  right: { op?: string; subject?: string };
};

export type RuleFn = (premises: any[]) => any;
export type TruthFn = (p1: Truth, p2: Truth) => Truth;

export interface RegisteredRule {
  id: string;
  pattern: RulePattern;
  apply: RuleFn;
  sync: boolean;
  priority: number;
  truthFn?: TruthFn;
}

export const RuleRegistry = {
    rules: new Map<string, RegisteredRule>(),
    register(rule: RegisteredRule): void {
        RuleRegistry.rules.set(rule.id, rule);
    },
    get(id: string): RegisteredRule | undefined {
        return RuleRegistry.rules.get(id);
    },
    getAll(): RegisteredRule[] {
        return Array.from(RuleRegistry.rules.values());
    },
    clear(): void {
        RuleRegistry.rules.clear();
    }
};

export const createRulePattern = (leftOp?: string, rightOp?: string): RulePattern => ({
    left: {op: leftOp},
    right: {op: rightOp}
});

const encodePattern = (leftOp: string | undefined, rightOp: string | undefined): string =>
  `${leftOp ?? '*'}:${rightOp ?? '*'}`;

export class RuleIndex {
  private rulesByType = new Map<string, RegisteredRule[]>();
  private cache = new Map<string, RegisteredRule[]>();

  register(rule: RegisteredRule): void {
    const key = encodePattern(rule.pattern.left.op, rule.pattern.right.op);
    const existing = this.rulesByType.get(key) ?? [];
    existing.push(rule);
    this.rulesByType.set(key, existing);
    this.cache.clear();
  }

  match(term1: Term, term2: Term): RegisteredRule[] {
    const cacheKey = `${term1.kind}:${term2.kind}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const k1 = term1.kind;
    const k2 = term2.kind;
    const results = new Set<RegisteredRule>();

    const addRules = (key: string): void => {
      const rules = this.rulesByType.get(key);
      if (rules) rules.forEach(r => results.add(r));
    };

    addRules(`${k1}:${k2}`);
    if (k1 !== 'atom') addRules(`*:${k2}`);
    if (k2 !== 'atom') addRules(`${k1}:*`);
    addRules('*:*');

    const sorted = Array.from(results).sort((a, b) => b.priority - a.priority);
    this.cache.set(cacheKey, sorted);
    return sorted;
  }

  clear(): void {
    this.rulesByType.clear();
    this.cache.clear();
  }
}