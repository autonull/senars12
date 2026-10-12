/**
 * Read a run's `TerminationReason` from the engine's spend summary (§5.7). The
 * summary states, per declared scope, whether a bound was hit and why; this keeps
 * only the scopes that actually refused work, so a run that spent within every
 * bound reports nothing rather than a wall of `none`.
 */

/** The slice of a spend summary this reads: each scope's raised reason. */
export type SpendSummary = Record<string, { terminationReason?: string }>;

export function spendTerminations(
  summary: SpendSummary | undefined
): Array<{ scope: string; reason: string }> {
  return Object.entries(summary ?? {})
    .filter(([, scope]) => !!scope.terminationReason && scope.terminationReason !== 'none')
    .map(([scope, { terminationReason }]) => ({ scope, reason: terminationReason as string }));
}
