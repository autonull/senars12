import { BoundedMap, getOrInsert, weightedMean } from '@senars/util';

import type { Term } from '../../terms';
import type { RegisteredRule, RuleDependency, RulePattern, RuleStatistics } from '../types.js';

/** Hits older than this leave the recency set; the window is the map's TTL. */
const TEMPORAL_WINDOW_MS = 1000;

const encodePattern = (leftOp: string | undefined, rightOp: string | undefined): string =>
  `${leftOp ?? '*'}:${rightOp ?? '*'}`;

export class RuleIndex {
  private rulesByType = new Map<string, RegisteredRule[]>();
  private cache = new Map<string, RegisteredRule[]>();
  private hitStats = new Map<string, RuleStatistics>();
  private readonly recentRules = new BoundedMap<string, number>({
    maxSize: 1000,
    ttlMs: TEMPORAL_WINDOW_MS,
  });
  private dependencies = new Map<string, RuleDependency>();

  register(rule: RegisteredRule): void {
    const key = encodePattern(rule.pattern.left.op, rule.pattern.right.op);
    getOrInsert(this.rulesByType, key, () => []).push(rule);
    this.cache.clear();

    this.hitStats.set(rule.id, {
      hitCount: 0,
      lastHitTime: 0,
      successRate: 0,
      avgDuration: 0,
    });

    this.dependencies.set(rule.id, {
      ruleId: rule.id,
      dependsOn: [],
      producesFor: [],
    });
  }

  recordRuleHit(ruleId: string, success: boolean, duration: number): void {
    const stats = this.hitStats.get(ruleId);
    if (!stats) return;

    const now = Date.now();
    stats.hitCount++;
    stats.lastHitTime = now;
    const priorWeight = stats.hitCount - 1;
    stats.successRate = weightedMean(stats.successRate, priorWeight, success ? 1 : 0);
    stats.avgDuration = weightedMean(stats.avgDuration, priorWeight, duration);

    this.hitStats.set(ruleId, stats);

    this.recentRules.set(ruleId, now);
    this.recentRules.purgeExpired();
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
      if (rules)
        rules.forEach((r) => {
          results.add(r);
        });
    };

    addRules(`${k1}:${k2}`);
    if (k1 !== 'atom') addRules(`*:${k2}`);
    if (k2 !== 'atom') addRules(`${k1}:*`);
    addRules('*:*');

    this.recentRules.purgeExpired();
    const sorted = Array.from(results).sort((a, b) => {
      const aStats = this.hitStats.get(a.id);
      const bStats = this.hitStats.get(b.id);

      const aRecent = this.recentRules.has(a.id);
      const bRecent = this.recentRules.has(b.id);

      if (aRecent && !bRecent) return 1;
      if (!aRecent && bRecent) return -1;

      if (aStats && bStats) {
        return b.priority * bStats.successRate - a.priority * aStats.successRate;
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
