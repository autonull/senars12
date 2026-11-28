import type { Term } from '../../terms';
import type { InferenceTable, RegisteredRule } from '../types';
/**
 * Dispatch, as an `InferenceTable`. One bucket per declared kind pair.
 *
 * Candidate order is a pure function of the registered set — declared priority,
 * then registration order — so it needs no cache invalidation. It once also
 * depended on hit statistics and a recency set, and `recordRuleHit` had no
 * caller outside tests, so that ordering was unreachable: a comparator branch
 * that only a test can reach is a comment (TODO29.a §10.1).
 */
export declare class RuleIndex implements InferenceTable {
    private rulesByType;
    register(rule: RegisteredRule): void;
    candidates(left: Term['kind'], right: Term['kind']): readonly RegisteredRule[];
    clear(): void;
}
//# sourceMappingURL=RuleIndex.d.ts.map