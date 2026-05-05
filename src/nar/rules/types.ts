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

    register(rule: RegisteredRule): void {
        this.rules.set(rule.id, rule);
    },

    get(id: string): RegisteredRule | undefined {
        return this.rules.get(id);
    },

    getAll(): RegisteredRule[] {
        return Array.from(this.rules.values());
    },

    clear(): void {
        this.rules.clear();
    }
};

export function createRulePattern(leftOp?: string, rightOp?: string): RulePattern {
    return {
        left: { op: leftOp },
        right: { op: rightOp }
    };
}

export function encodePattern(pattern: RulePattern): string[] {
    return [
        pattern.left.op ?? '*',
        pattern.right.op ?? '*'
    ];
}