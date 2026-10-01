import { getOrInsert } from '@senars/util';

import type { Term } from '../../terms';
import type { InferenceTable, RegisteredRule, RuleDependency } from '../types.js';

const bucketKey = (left: Term['kind'], right: Term['kind']): string => `${left}:${right}`;

/**
 * Dispatch, as an `InferenceTable`. One bucket per declared kind pair.
 *
 * Candidate order is a pure function of the registered set — declared priority,
 * then registration order — so it needs no cache invalidation. It once also
 * depended on hit statistics and a recency set, and `recordRuleHit` had no
 * caller outside tests, so that ordering was unreachable: a comparator branch
 * that only a test can reach is a comment (TODO29.a §10.1).
 */
export class RuleIndex implements InferenceTable {
  private rulesByType = new Map<string, RegisteredRule[]>();
  private dependencies = new Map<string, RuleDependency>();

  register(rule: RegisteredRule): void {
    const bucket = getOrInsert(
      this.rulesByType,
      bucketKey(rule.pattern.left.op, rule.pattern.right.op),
      () => []
    );
    bucket.push(rule);
    // Descending priority; `sort` is stable, so equal priorities keep the order
    // they were registered in.
    bucket.sort((a, b) => b.priority - a.priority);

    this.dependencies.set(rule.id, { ruleId: rule.id, dependsOn: [], producesFor: [] });
  }

  candidates(left: Term['kind'], right: Term['kind']): readonly RegisteredRule[] {
    return this.rulesByType.get(bucketKey(left, right)) ?? [];
  }

  addDependency(ruleId: string, dependsOn: string[], producesFor: string[]): void {
    const dep = this.dependencies.get(ruleId);
    if (dep) this.dependencies.set(ruleId, { ...dep, dependsOn, producesFor });
  }

  getRuleDependencies(): Map<string, RuleDependency> {
    return new Map(this.dependencies);
  }

  clear(): void {
    this.rulesByType.clear();
    this.dependencies.clear();
  }
}