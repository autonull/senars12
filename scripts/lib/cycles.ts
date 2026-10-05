/**
 * The cycle-budget verdict, kept apart from the dpdm measurement so the rule is
 * testable without a dependency-graph run.
 *
 * A one-sided budget is a ceiling nobody can fail. `deps:gate`'s baseline sat 21
 * cycles above its measurement for two passes, so a graph carrying 21 *new*
 * cycles passed the gate meant to catch new cycles. The obligation to move the
 * baseline belongs at commit time, but the check for having forgotten belongs
 * here: slack is reported as loudly as regression, because slack is what made
 * the regression invisible.
 */
export type CycleVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'regression';
      readonly over: number;
      readonly chains: readonly string[];
    }
  | { readonly ok: false; readonly reason: 'slack'; readonly slack: number };

/**
 * Compare a measured cycle count against its baseline.
 *
 * `chains` is only consulted for a regression, so the caller may omit it when it
 * has not paid to collect the chains.
 */
export const checkCycleBudget = (
  count: number,
  baseline: number,
  chains: readonly string[] = []
): CycleVerdict => {
  if (count > baseline) {
    return {
      ok: false,
      reason: 'regression',
      over: count - baseline,
      chains: chains.slice(baseline),
    };
  }
  return count < baseline ? { ok: false, reason: 'slack', slack: baseline - count } : { ok: true };
};
