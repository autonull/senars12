import { getOrInsert } from '@senars/util/collections';
const bucketKey = (left, right) => `${left}:${right}`;
/**
 * Dispatch, as an `InferenceTable`. One bucket per declared kind pair.
 *
 * Candidate order is a pure function of the registered set — declared priority,
 * then registration order — so it needs no cache invalidation. It once also
 * depended on hit statistics and a recency set, and `recordRuleHit` had no
 * caller outside tests, so that ordering was unreachable: a comparator branch
 * that only a test can reach is a comment (TODO29.a §10.1).
 */
export class RuleIndex {
    rulesByType = new Map();
    register(rule) {
        const bucket = getOrInsert(this.rulesByType, bucketKey(rule.pattern.left.op, rule.pattern.right.op), () => []);
        bucket.push(rule);
        // Descending priority; `sort` is stable, so equal priorities keep the order
        // they were registered in.
        bucket.sort((a, b) => b.priority - a.priority);
    }
    candidates(left, right) {
        return this.rulesByType.get(bucketKey(left, right)) ?? [];
    }
    clear() {
        this.rulesByType.clear();
    }
}
