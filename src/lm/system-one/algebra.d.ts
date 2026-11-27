import { SenarsError } from '@senars/errors';
import type { JudgmentProposition, JudgmentQuery, SynthesisQuery } from './types';
export declare class AlgebraPurityError extends SenarsError {
    readonly queryKind: string;
    constructor(message: string, queryKind: string, options?: ErrorOptions);
}
export declare function assertJudgmentQuery(query: JudgmentQuery | SynthesisQuery): asserts query is JudgmentQuery;
export declare function isJudgmentQuery(query: JudgmentQuery | SynthesisQuery): query is JudgmentQuery;
export declare function isSynthesisQuery(query: JudgmentQuery | SynthesisQuery): query is SynthesisQuery;
export declare function validateBatchQueries(queries: readonly (JudgmentQuery | SynthesisQuery)[]): JudgmentQuery[];
/**
 * R6 safety floor — injection/assertion at high criticality must fail closed.
 *
 * One predicate for three call sites: the decider's chunk short-circuit and
 * veto band, and the dispatcher's abstain-override on both the tier-1 result
 * and the tier-3 fallback. The copies had already begun to disagree — the
 * dispatcher's two inlines tested criticality first and guarded a possibly
 * absent query, the decider's ordered the conjunction differently — and a
 * disagreement here is a query that abstains on one tier and blocks on another.
 * `undefined` is accepted so an index miss cannot read as a floor query.
 */
export declare function isSafetyFloor(query: JudgmentQuery | undefined): boolean;
/**
 * A veto score above every confidence band threshold, so the router blocks on a
 * proposition whose calibration says nothing about this query. Spelled once: the
 * number and the abstain it overrides are the fail-closed policy, and a caller
 * that reached for a band threshold of its own would be tuning the floor.
 */
export declare const SAFETY_FLOOR_VETO_SCORE = 0.99;
/**
 * Rewrite a proposition to fail closed, keeping its provenance. Typed as a
 * whole-union rewrite rather than guarded by a `kind === 'evaluate'` check: a
 * safety-floor query is an evaluate query, and a narrowing guard that somehow
 * did not match would then *skip the veto*, which is the one outcome this path
 * must not produce. The cast is the deliberate price of that.
 */
export declare function failClosed(proposition: JudgmentProposition): JudgmentProposition;
//# sourceMappingURL=algebra.d.ts.map