/**
 * The rule table's artifact schema (TODO29.a §5.10).
 *
 * **What this makes true.** The rule set used to be whatever the import graph
 * contained: `registration.ts` mutated a module-global `RuleRegistry` as an
 * import side effect, so "which rules are loaded" was not a fact anyone could
 * state, version, diff or revert. This module is where a table stops being that
 * and becomes an **artifact** — data with a schema version, so it can be loaded,
 * validated, recorded, compared and rolled back.
 *
 * **The declaration is data; the implementation is code.** An entry names a
 * pattern, a priority and a truth function — never a closure. The body is
 * resolved by name at load time through a {@link RuleImplementationResolver},
 * which is what lets an artifact be serialised into an event log at all. That
 * split is also the honest boundary of this item: a rule may be *learned* (its
 * declaration admitted, versioned, reverted) only to the extent that its body
 * is implemented; a name that resolves to nothing is refused with a recorded
 * reason rather than admitted as a rule that derives nothing.
 */

import { parseOrThrow } from '@senars/util';
import { nonEmpty, nonNegativeInt, positiveInt } from '@senars/util/config';
import { z } from 'zod';
import { RulePatternSchema } from './common.js';
import { TaskTypeSchema } from './task.js';

/**
 * The wire version of the rule-table artifact. A table recorded against one
 * version must not load against another, exactly as `PROPOSAL_SCHEMA_VERSION`
 * does for proposals — the two are independent, because a proposal is a
 * *request* to change the table and the table is the *result*.
 */
export const RULE_TABLE_SCHEMA_VERSION = 1;

/** The shipped built-in table's own version, independent of the schema shape. */
export const BUILTIN_RULE_ARTIFACT_VERSION = 'builtin/1';

/** How an entry came to exist. The three kinds have different revert stories. */
export const RuleProvenanceSchema = z.discriminatedUnion('kind', [
  /** Shipped with the code. Its body is a named NAL function. */
  z.object({ kind: z.literal('builtin') }),
  /** Admitted from a `proposal.admitted` event. Reverting it is a table operation. */
  z.object({
    kind: z.literal('proposal'),
    /** The proposal that produced it — the same id as the committed event. */
    proposalId: nonEmpty,
    /** The producer that proposed it, for the operator-facing audit surface. */
    producer: nonEmpty.optional(),
  }),
  /** Deserialised from a persisted artifact rather than built in. */
  z.object({ kind: z.literal('import'), source: nonEmpty }),
]);

export type RuleProvenance = z.infer<typeof RuleProvenanceSchema>;

/**
 * One rule, as data. The pattern's `op` is a term kind, required on both sides:
 * a wildcard bucket is not a dispatch cell (TODO29.a §5.6), and a rule that
 * does not declare its kinds does not register.
 */
export const RuleDeclarationSchema = z.object({
  ruleId: nonEmpty,
  description: z.string(),
  ...RulePatternSchema.shape,
  /** The name of the truth function the rule dispatches through, e.g. `deduction`. */
  truthFn: nonEmpty,
  /** The name the body resolves under, e.g. `deduction` in `NALRules`. */
  body: nonEmpty,
  priority: z.number(),
  taskType: TaskTypeSchema.optional(),
});

export type RuleDeclaration = z.infer<typeof RuleDeclarationSchema>;

/**
 * One entry of a table at one revision. The identity fields are what make
 * "revertable" a state-machine property rather than a claim: an entry knows the
 * revision it entered at, the base revision it was admitted against, and where
 * it came from — so a prior revision is restorable from the artifact alone,
 * with no import graph and no replay of the admission sequence.
 */
export const RuleArtifactEntrySchema = RuleDeclarationSchema.extend({
  /** The artifact version this entry was declared under. */
  artifactVersion: nonEmpty,
  /** The table revision this entry became part of. Monotonic. */
  ruleSetRevision: nonNegativeInt,
  /** The base revision the admission was judged against; `null` for a builtin. */
  parentRevision: nonNegativeInt.nullable(),
  /** The declaration's own schema version, so one entry can be migrated alone. */
  ruleSchemaVersion: positiveInt,
  provenance: RuleProvenanceSchema,
  /** The `proposal.admitted` event, when there was one. The log and the table cannot disagree. */
  eventId: z.string().optional(),
});

export type RuleArtifactEntry = z.infer<typeof RuleArtifactEntrySchema>;

/** A whole table at a revision: the unit that is loaded, recorded and restored. */
export const RuleTableSchema = z.object({
  schemaVersion: positiveInt,
  artifactVersion: nonEmpty,
  /** The revision this artifact states. Not inferred from the entries. */
  revision: nonNegativeInt,
  entries: z.array(RuleArtifactEntrySchema),
});

export type RuleTable = z.infer<typeof RuleTableSchema>;

/** What changed between two revisions. Every list is enumerable, so a revert is a decision. */
export interface RuleTableDiff {
  readonly from: number;
  readonly to: number;
  readonly added: readonly string[];
  readonly removed: readonly string[];
  /** Rules present at both revisions whose declaration changed. */
  readonly superseded: readonly string[];
  readonly unchanged: number;
}

export const validateRuleTable = (input: unknown): RuleTable =>
  parseOrThrow(RuleTableSchema, 'RuleTable', input);

/** Why a table could not be loaded. Each is a loud failure, never a coercion. */
export const RULE_TABLE_REJECTIONS = [
  'schema-version',
  'artifact-version',
  'duplicate-rule-id',
  'unresolved-body',
  'empty-id',
] as const;

export type RuleTableRejection = (typeof RULE_TABLE_REJECTIONS)[number];

export interface RuleTableFault {
  readonly ruleId: string;
  readonly reason: RuleTableRejection;
  readonly detail: string;
}
