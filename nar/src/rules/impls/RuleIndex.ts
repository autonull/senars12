import { BoundedMap, getOrInsert, weightedMean } from '@senars/util';

import type { Term } from '../../terms';
import type { RegisteredRule, RuleDependency, RuleStatistics } from '../types.js';

/** Hits older than this leave the recency set; the window is the map's TTL. */
const TEMPORAL_WINDOW_MS = 1000;

const encodePattern = (leftOp: string | undefined, rightOp: string | undefined): string =>
  `${leftOp ?? '*'}:${rightOp ?? '*'}`;

export class RuleIndex {
  private rulesByType = new Map<string, RegisteredRule[]>();
  /**
   * Candidate order, memoised per term-kind pair. The candidate *set* is fully
   * determined by the pair of kinds, but the *order* is not: it is a function of
   * hit statistics and the recency set, both of which move. Each entry therefore
   * carries the ranking epoch it was ordered at, and a stale entry is
   * re-ordered rather than served — a cache that ignores the state its ordering
   * was computed from freezes the ranking for the life of the process.
   */
  private ordered = new Map<
    string,
    { epoch: number; orderedAt: number; rules: RegisteredRule[] }
  >();
  private rankingEpoch = 0;
  private hitStats = new Map<string, RuleStatistics>();
  private readonly recentRules = new BoundedMap<string, number>({
    maxSize: 1000,
    ttlMs: TEMPORAL_WINDOW_MS,
  });
  private dependencies = new Map<string, RuleDependency>();

  register(rule: RegisteredRule): void {
    const key = encodePattern(rule.pattern.left.op, rule.pattern.right.op);
    getOrInsert(this.rulesByType, key, () => []).push(rule);
    this.ordered.clear();
    this.rankingEpoch++;

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
    this.rankingEpoch++;
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
    const memo = this.ordered.get(cacheKey);
    // Recency demotion is the one time-dependent input to the ordering, so the
    // memo is only valid until the window it was ordered within can have closed.
    if (
      memo &&
      memo.epoch === this.rankingEpoch &&
      Date.now() - memo.orderedAt < TEMPORAL_WINDOW_MS
    ) {
      return memo.rules;
    }

    const rules = this.candidatesFor(term1.kind, term2.kind);
    this.ordered.set(cacheKey, { epoch: this.rankingEpoch, orderedAt: Date.now(), rules });
    return rules;
  }

  private candidatesFor(left: Term['kind'], right: Term['kind']): RegisteredRule[] {
    const results = new Set<RegisteredRule>();

    const addRules = (key: string): void => {
      const rules = this.rulesByType.get(key);
      if (rules)
        rules.forEach((r) => {
          results.add(r);
        });
    };

    addRules(`${left}:${right}`);
    if (left !== 'atom') addRules(`*:${right}`);
    if (right !== 'atom') addRules(`${left}:*`);
    addRules('*:*');

    this.recentRules.purgeExpired();

    return Array.from(results).sort((a, b) => {
      // Recency demotion: a rule that just fired yields to one that has not.
      const aRecent = this.recentRules.has(a.id);
      const bRecent = this.recentRules.has(b.id);
      if (aRecent !== bRecent) return aRecent ? 1 : -1;

      // Declared priority is the primary order. Observed success only breaks
      // ties: weighting priority by a success rate that starts at zero for
      // every rule collapses the comparator to a constant and orders nothing,
      // so a rule with no track record would never be ranked at all.
      const byPriority = b.priority - a.priority;
      if (byPriority !== 0) return byPriority;
      return (
        (this.hitStats.get(b.id)?.successRate ?? 0) - (this.hitStats.get(a.id)?.successRate ?? 0)
      );
    });
  }

  clear(): void {
    this.rulesByType.clear();
    this.ordered.clear();
    this.hitStats.clear();
    this.recentRules.clear();
    this.dependencies.clear();
  }
}
