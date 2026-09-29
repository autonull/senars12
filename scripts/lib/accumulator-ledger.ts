/**
 * The accumulator ledger (TODO28 §4.3).
 *
 * The property is worth having — TODO27's last pass alone turned up seven
 * unbounded containers on untrusted or unkeyed input. What the gate could not
 * do is *find* them. The old `unboundedAccumulators` metric walked a literal
 * array of two paths and asserted their text contained `LruCache` and matched
 * `/LruCache\(\{[^}]*maxSize/`, so it was a string check on two files: a new
 * unbounded accumulator anywhere else passed silently, and a file that did not
 * exist also "counted". It read as a repository-wide invariant and was green
 * for a reason unrelated to the property it named.
 *
 * A real detection rule was measured and rejected. A text scan for instance
 * fields assigned `new Map` / `new Set` / `[]` yields 574 candidates across the
 * six source roots, 302 of them unpruned — local variables, per-call scratch
 * space, and legitimately-scoped maps all included. A heuristic that noisy
 * cannot be a gate; it would be a gate people learn to ignore.
 *
 * So the audit set is stated as data, and the gate measures exactly what it
 * says: every site on this ledger is capacity-bounded. `accumulatorsAudited`
 * is a ratchet in the other direction — the ledger may grow, and shrinking it
 * fails. A new unbounded accumulator elsewhere is not caught automatically, and
 * nothing here claims it is; the next audit adds a row.
 */
export interface AccumulatorSite {
  /** Repo-relative source path. Its absence counts as unbounded. */
  readonly file: string;
  /** What the container holds — why it is on the ledger at all. */
  readonly holds: string;
}

export const ACCUMULATOR_LEDGER: readonly AccumulatorSite[] = [
  {
    file: 'nar/src/kernel/source-reputation.ts',
    holds: 'per-source reputation, keyed by a source id that arrives on the wire',
  },
  {
    file: 'nar/src/rl/impls/QBeliefStore.ts',
    holds: 'beliefs over state-action pairs, keyed by an untrusted stream',
  },
];
