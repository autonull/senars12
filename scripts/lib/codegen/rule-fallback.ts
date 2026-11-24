/**
 * `rule:has-fallback` — every model-backed rule declares a symbolic body, and
 * that body is what runs when the model call fails (TODO29.a §5.1 step 8).
 *
 * The path was implemented and nothing required it, so a new `P` rule with no
 * symbolic body was accepted silently and degraded to producing nothing. This is
 * the check that turns the implemented path into a required one, and it asserts
 * both halves: the declaration exists, and a failing provider reaches it.
 *
 * Pure verdict logic, so the gate and the tests read the same rule (§10.1: a
 * gate ships with a test that proves it can fail).
 */

/** What the gate can see about one rule without running it. */
export interface FallbackSubject {
  readonly id: string;
  /** Whether the rule was built with a symbolic body. */
  readonly hasFallback: boolean;
  /**
   * `lm.fallback` events emitted by one `apply` over a provider that fails every
   * call. Undefined means the probe was not run for this rule.
   */
  readonly fallbackRuns?: number;
}

export interface FallbackFailure {
  readonly kind: 'missing-fallback' | 'fallback-not-run';
  readonly ruleId: string;
  readonly detail: string;
}

/** A rule with no declared body, and a rule whose declared body never ran. */
export const checkFallbacks = (subjects: readonly FallbackSubject[]): readonly FallbackFailure[] =>
  subjects.flatMap((subject) => {
    if (!subject.hasFallback)
      return [
        {
          kind: 'missing-fallback' as const,
          ruleId: subject.id,
          detail: 'no symbolic body declared',
        },
      ];
    if (subject.fallbackRuns === undefined) return [];
    if (subject.fallbackRuns > 0) return [];
    return [
      {
        kind: 'fallback-not-run' as const,
        ruleId: subject.id,
        detail: 'a failing provider reached no symbolic body',
      },
    ];
  });
