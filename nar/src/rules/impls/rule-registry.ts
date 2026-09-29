import type { RegisteredRule } from '../types.js';

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
  },
};
