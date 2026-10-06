import { SenarsError } from '@senars/util/errors';
import type { JudgmentProposition, JudgmentQuery, SynthesisQuery } from './types.js';

export class AlgebraPurityError extends SenarsError {
  constructor(
    message: string,
    readonly queryKind: string,
    options?: ErrorOptions
  ) {
    super(message, 'CROSS_DOMAIN', { queryKind }, options);
    this.name = 'AlgebraPurityError';
  }
}

function isSynthesisQueryInternal(query: JudgmentQuery | SynthesisQuery): query is SynthesisQuery {
  return (query as SynthesisQuery).kind === 'synthesize';
}

export function assertJudgmentQuery(
  query: JudgmentQuery | SynthesisQuery
): asserts query is JudgmentQuery {
  if (isSynthesisQueryInternal(query)) {
    throw new AlgebraPurityError(
      'SynthesisQuery passed where JudgmentQuery required — algebra purity violation',
      'synthesize'
    );
  }
}

export function isJudgmentQuery(query: JudgmentQuery | SynthesisQuery): query is JudgmentQuery {
  return !isSynthesisQueryInternal(query);
}

export function isSynthesisQuery(query: JudgmentQuery | SynthesisQuery): query is SynthesisQuery {
  return isSynthesisQueryInternal(query);
}

export function validateBatchQueries(
  queries: readonly (JudgmentQuery | SynthesisQuery)[]
): JudgmentQuery[] {
  for (const q of queries) {
    assertJudgmentQuery(q);
  }
  return queries as JudgmentQuery[];
}

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
export function isSafetyFloor(query: JudgmentQuery | undefined): boolean {
  return (
    query !== undefined &&
    query.kind === 'evaluate' &&
    (query.rubric === 'injection' || query.rubric === 'assertion') &&
    (query.criticality === 'high' || query.criticality === 'critical')
  );
}

/**
 * A veto score above every confidence band threshold, so the router blocks on a
 * proposition whose calibration says nothing about this query. Spelled once: the
 * number and the abstain it overrides are the fail-closed policy, and a caller
 * that reached for a band threshold of its own would be tuning the floor.
 */
export const SAFETY_FLOOR_VETO_SCORE = 0.99;

/**
 * Rewrite a proposition to fail closed, keeping its provenance. Typed as a
 * whole-union rewrite rather than guarded by a `kind === 'evaluate'` check: a
 * safety-floor query is an evaluate query, and a narrowing guard that somehow
 * did not match would then *skip the veto*, which is the one outcome this path
 * must not produce. The cast is the deliberate price of that.
 */
export function failClosed(proposition: JudgmentProposition): JudgmentProposition {
  return {
    ...proposition,
    score: SAFETY_FLOOR_VETO_SCORE,
    abstained: false,
    tier: 1,
  } as JudgmentProposition;
}
