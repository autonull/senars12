import { z } from 'zod';

/**
 * Shared structural fragments — the shapes two or more kernel contracts
 * spell identically, homed here so they cannot drift apart.
 *
 * `truth` owns the epistemic pair; this module owns the composites built
 * from it plus the rule-table pattern both the table artifact and the
 * proposal seam validate.
 */

/** One side of a rule pattern: the term kind the dispatch cell keys on. */
export const RulePatternSideSchema = z.object({ op: z.string().min(1) });

export type RulePatternSide = z.infer<typeof RulePatternSideSchema>;

/**
 * A rule pattern as data: both kinds are required, because a wildcard
 * bucket is not a dispatch cell. Shared by the table artifact
 * (`rule-table`) and the admission seam (`proposal`).
 */
export const RulePatternSchema = z.object({
  left: RulePatternSideSchema,
  right: RulePatternSideSchema,
});

export type RulePattern = z.infer<typeof RulePatternSchema>;

/** One turn of conversation history, as persisted by session ledgers. */
export const HistoryEntrySchema = z.object({
  role: z.enum(['user', 'agent', 'system']),
  content: z.string(),
  timestamp: z.number(),
});

export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;
