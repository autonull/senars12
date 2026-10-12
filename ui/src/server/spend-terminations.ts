/**
 * Read a run's `TerminationReason` from the engine's spend summary (§5.7). The
 * summary states, per declared scope, whether a bound was hit and why; this keeps
 * only the scopes that actually refused work, so a run that spent within every
 * bound reports nothing rather than a wall of `none`.
 */

/** The slice of a spend summary this reads: each scope's raised reason. */
export type SpendSummary = Record<string, { ceiling?: number; spent?: number; terminationReason?: string }>;

export function spendTerminations(
  summary: SpendSummary | undefined
): Array<{ scope: string; reason: string }> {
  return Object.entries(summary ?? {})
    .filter(([, scope]) => !!scope.terminationReason && scope.terminationReason !== 'none')
    .map(([scope, { terminationReason }]) => ({ scope, reason: terminationReason as string }));
}

/** Merge multiple spend summaries by taking the max ceiling/spent per scope
 *  and preserving any terminationReason (once a scope is exhausted, it stays exhausted). */
export function mergeSpendSummaries(...summaries: Array<SpendSummary | undefined>): SpendSummary {
  const merged: SpendSummary = {};
  for (const summary of summaries) {
    if (!summary) continue;
    for (const [scope, data] of Object.entries(summary)) {
      const existing = merged[scope];
      if (!existing) {
        merged[scope] = { ...data };
      } else {
        merged[scope] = {
          ceiling: Math.max(existing.ceiling ?? 0, data.ceiling ?? 0),
          spent: Math.max(existing.spent ?? 0, data.spent ?? 0),
          terminationReason: existing.terminationReason ?? data.terminationReason,
        };
      }
    }
  }
  return merged;
}
