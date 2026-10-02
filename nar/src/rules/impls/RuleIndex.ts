import { getOrInsert } from '@senars/util';

import type { Term } from '../../terms';
import type { InferenceTable, RegisteredRule } from '../types.js';

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
  }

  candidates(left: Term['kind'], right: Term['kind']): readonly RegisteredRule[] {
    return this.rulesByType.get(bucketKey(left, right)) ?? [];
  }

  clear(): void {
    this.rulesByType.clear();
  }
}