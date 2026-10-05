import { HistoryEntrySchema } from '@senars/util';
import { z } from 'zod';
import { unitInterval } from '@senars/util/config';

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

/**
 * The task budget — the five numbers that cross every boundary. The zod form
 * validates what an untrusted proposer sends on `task.admitted`; the inferred
 * type is the shape the engine holds, so the validator and the domain type
 * cannot name different fields.
 */
export const BudgetSchema = z.object({
  priority: unitInterval,
  durability: unitInterval,
  quality: unitInterval,
  cycles: z.number().int().nonnegative(),
  depth: z.number().int().nonnegative(),
});

export type Budget = Readonly<z.infer<typeof BudgetSchema>>;

export type { HistoryEntry } from '@senars/util';
/**
 * One turn of conversation history. Owned by `@senars/util`, which is where the
 * session ledger's `ConversationSession` declares it; re-exported here so the
 * schema layer stays the one place a kernel contract's shape is reached for.
 */
export { HistoryEntrySchema };

/**
 * Whether a derivation's premises are independent of the conclusion they support.
 * The admitted event records the check the kernel ran; the derivation record
 * records what the rule asserted. Same question, and the answer's vocabulary was
 * written out in both — so the two could disagree about what `unknown` means.
 */
export const INDEPENDENCE = ['independent', 'dependent', 'unknown'] as const;

export const IndependenceSchema = z.enum(INDEPENDENCE);

export type Independence = (typeof INDEPENDENCE)[number];
