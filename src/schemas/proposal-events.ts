/**
 * Proposal event schemas — extracted to break circular dependency between
 * cognitive-events → proposal → truth.
 *
 * These are the event schemas emitted when proposals are admitted/rejected.
 * They are separate from the proposal wire contract (proposal.ts) so that
 * cognitive-events can import them without pulling in the full proposal module.
 */

import { z } from 'zod';
import { CognitiveEventBaseSchema, PROPOSER_ORIGIN } from './event-base.js';
import {
  nonEmpty,
  nonNegativeInt,
  positiveInt,
  validatorFor,
} from '../config';
import { RuleDeclarationSchema } from './rule-table.js';
import { RulePatternSchema } from './common.js';

/** What a proposal is about. The two kinds have separate payloads, not a flag. */
export const PROPOSAL_KINDS = ['content', 'rule'] as const;

export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

/** Rejection reasons — stable codes for programmatic handling. */
export const PROPOSAL_REJECTIONS = [
  'stale-base',
  'budget-exceeded',
  'schema-invalid',
  'duplicate',
  'conflict',
  'queue-overflow',
  'cancelled',
  'failed-schema',
] as const;

export type ProposalRejection = (typeof PROPOSAL_REJECTIONS)[number];

/** A proposal was rejected by the relevant gate. */
export const ProposalRejectedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('proposal.rejected'),
  engine: z.literal(PROPOSER_ORIGIN),
  payload: z.object({
    proposalId: nonEmpty,
    kind: z.enum(PROPOSAL_KINDS),
    reason: z.enum(PROPOSAL_REJECTIONS),
    detail: z.string(),
    /** The revision at the boundary the proposal was judged against. */
    observedRevision: nonNegativeInt,
  }),
});

/** A proposal was admitted by the relevant gate. */
export const ProposalAdmittedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('proposal.admitted'),
  engine: z.literal(PROPOSER_ORIGIN),
  payload: z.object({
    proposalId: nonEmpty,
    kind: z.enum(PROPOSAL_KINDS),
    schemaVersion: positiveInt,
    baseRevision: nonNegativeInt,
    /** The revision this admission produced. The event is the source of truth for it. */
    resultingRevision: positiveInt,
    /**
     * A rule admission carries the declaration it admitted, so the table can be
     * reconstructed from the log alone (TODO29.a §5.10). Absent for a content
     * proposal, which changes no table: its payload travels with the task it
     * admitted rather than in the table.
     */
    declaration: RuleDeclarationSchema.optional(),
    /** The proposer that issued it, for the operator-facing audit surface. */
    producer: z.string().optional(),
  }),
});

export type ProposalRejectedEvent = z.infer<typeof ProposalRejectedEventSchema>;
export type ProposalAdmittedEvent = z.infer<typeof ProposalAdmittedEventSchema>;