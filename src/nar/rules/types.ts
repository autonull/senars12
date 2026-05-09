import type {Term} from '../terms';
import type {Truth} from '../terms';

export type TruthFn = (t1: Truth, t2: Truth) => Truth | null;

export type RulePattern = {
    left: { op?: string; subject?: string };
    right: { op?: string; subject?: string };
};

export type RuleFn = (premises: Term[]) => Term | null | undefined;

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

export interface RuleStatistics {
    hitCount: number;
    lastHitTime: number;
    successRate: number;
    avgDuration: number;
}

export interface RuleDependency {
    ruleId: string;
    dependsOn: string[];
    producesFor: string[];
}

export class RuleIndex {
    private rulesByType = new Map<string, RegisteredRule[]>();
    private cache = new Map<string, RegisteredRule[]>();
    private hitStats = new Map<string, RuleStatistics>();
    private recentRules = new Map<string, number>();
    private dependencies = new Map<string, RuleDependency>();
    private temporalWindow = 1000;

    register(rule: RegisteredRule): void {
        const key = encodePattern(rule.pattern.left.op, rule.pattern.right.op);
        const existing = this.rulesByType.get(key) ?? [];
        existing.push(rule);
        this.rulesByType.set(key, existing);
        this.cache.clear();

        this.hitStats.set(rule.id, {
            hitCount: 0,
            lastHitTime: 0,
            successRate: 0,
            avgDuration: 0
        });

        this.dependencies.set(rule.id, {
            ruleId: rule.id,
            dependsOn: [],
            producesFor: []
        });
    }

    recordRuleHit(ruleId: string, success: boolean, duration: number): void {
        const stats = this.hitStats.get(ruleId);
        if (!stats) return;

        const now = Date.now();
        stats.hitCount++;
        stats.lastHitTime = now;
        stats.successRate = (stats.successRate * (stats.hitCount - 1) + (success ? 1 : 0)) / stats.hitCount;
        stats.avgDuration = (stats.avgDuration * (stats.hitCount - 1) + duration) / stats.hitCount;

        this.hitStats.set(ruleId, stats);

        this.recentRules.set(ruleId, now);
        const cutoff = now - this.temporalWindow;
        for (const [id, time] of this.recentRules.entries()) {
            if (time < cutoff) {
                this.recentRules.delete(id);
            }
        }
    }

    getStatistics(): Map<string, RuleStatistics> {
        return new Map(this.hitStats);
    }

    getRuleDependencies(): Map<string, RuleDependency> {
        return new Map(this.dependencies);
    }

    addDependency(ruleId: string, dependsOn: string[], producesFor: string[]): void {
        const dep = this.dependencies.get(ruleId);
        if (dep) {
            dep.dependsOn = dependsOn;
            dep.producesFor = producesFor;
            this.dependencies.set(ruleId, dep);
        }
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

        const now = Date.now();
        const sorted = Array.from(results).sort((a, b) => {
            const aStats = this.hitStats.get(a.id);
            const bStats = this.hitStats.get(b.id);

            const aRecent = this.recentRules.has(a.id) && (now - (this.recentRules.get(a.id) || 0)) < this.temporalWindow;
            const bRecent = this.recentRules.has(b.id) && (now - (this.recentRules.get(b.id) || 0)) < this.temporalWindow;

            if (aRecent && !bRecent) return 1;
            if (!aRecent && bRecent) return -1;

            if (aStats && bStats) {
                return (b.priority * bStats.successRate) - (a.priority * aStats.successRate);
            }

            return b.priority - a.priority;
        });

        this.cache.set(cacheKey, sorted);
        return sorted;
    }

    clear(): void {
        this.rulesByType.clear();
        this.cache.clear();
        this.hitStats.clear();
        this.recentRules.clear();
        this.dependencies.clear();
    }
}