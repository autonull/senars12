/**
 * The proposal seam's wire contract (TODO29.a §3.3, §5.3).
 *
 * A proposal is a **request to a gate**, so everything here is data — no closure
 * over NAR internals, no term objects, no rule implementations. A proposer on the
 * other side of the seam hands this shape over and knows nothing else about the
 * core.
 *
 * The content/rule distinction is in the **type**, not a field. `kind` selects a
 * `discriminatedUnion` arm whose payload is a distinct object with distinct
 * fields, so a rule payload cannot be read as a content payload and the routing
 * is decided by the compiler rather than by a `if` at the seam. One queue with one
 * policy for both is the mistake this shape forecloses.
 */

import { parseOrThrow } from '@senars/util';
import { z } from 'zod';
import { RulePatternSchema } from './common.js';
import { CognitiveEventBaseSchema, PROPOSER_ORIGIN } from './event-base.js';
import { RuleDeclarationSchema } from './rule-table.js';
import { TaskTypeSchema } from './task.js';
import { TruthValueSchema } from './truth.js';
import { unitInterval } from '@senars/util/config';

/**
 * The wire version of the proposal contract. A run recorded against one version
 * must not replay against another, so the version travels on every proposal and
 * a mismatch is rejected loudly rather than coerced (§5.14, decision 7).
 *
 * **v2 (TODO29.a §5.12) — terms are canonical.** A v1 proposal may carry
 * `--x. %0.8%`, a term key no construction path can produce since the term layer
 * reached a canonical form. That is a migration rather than a detail, so v1 is
 * rejected loudly here rather than admitted and silently deduplicated; TODO30
 * owns re-keying the stored terms.
 */
export const PROPOSAL_SCHEMA_VERSION = 2;

/** What a proposal is about. The two kinds have separate payloads, not a flag. */
export const PROPOSAL_KINDS = ['content', 'rule'] as const;

const EnvelopeSchema = z.object({
  proposalId: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  /**
   * The committed revision the proposer observed. A proposal whose base is
   * behind the revision at the boundary is **stale** and is rejected — applying
   * it would resolve a conflict the proposer could not have seen (§3.3).
   */
  baseRevision: z.number().int().nonnegative(),
  /** Cycles between proposals: the trigger is a work budget, never a wall clock. */
  cyclesPerProposal: z.number().int().positive(),
  issuedAtCycle: z.number().int().nonnegative(),
  /**
   * Terms this proposal read. On the envelope because both kinds read them and
   * the applicability rule checks them identically — hoisting it also leaves the
   * two payloads disjoint, so neither can be read as the other.
   */
  references: z.array(z.string()),
});

/**
 * A formalized claim about a term. It is **not** a truth value to be written: it
 * is admitted through `PerceptionGate` at the source-quality ceiling like any
 * other ingress, so `provisionalConfidence` survives the payload change (§3.3).
 */
export const ContentProposalSchema = EnvelopeSchema.extend({
  kind: z.literal('content'),
  payload: z.object({
    taskType: TaskTypeSchema,
    term: z.string().min(1),
    truth: TruthValueSchema.optional(),
  }),
});

/**
 * A reaction: pattern, truth function, priority. It lands in the rule table, so
 * its cost of dropping is the learned capability itself — which is why the rule
 * queue refuses loudly rather than overflowing (§5.3).
 */
export const RuleProposalSchema = EnvelopeSchema.extend({
  payload: z.object({
    ruleId: z.string().min(1),
    name: z.string().min(1),
    pattern: RulePatternSchema,
    /** The named truth function the rule dispatches through. */
    truthFn: z.string().min(1),
    priority: unitInterval,
    /** The NAL rule body implementation name (e.g., 'nal.deduction'). Optional in wire format; validated at the boundary. */
    body: z.string().optional(),
    /** Pure-NAL symbolic fallback name for LM failure escalation (e.g., 'lm-narsese-translation'). Optional in wire format; validated at the boundary. */
    symbolicFallback: z.string().optional(),
  }),
  kind: z.literal('rule'),
});

export const ProposalSchema = z.discriminatedUnion('kind', [
  ContentProposalSchema,
  RuleProposalSchema,
]);

export type ContentProposal = z.infer<typeof ContentProposalSchema>;
export type RuleProposal = z.infer<typeof RuleProposalSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;

/** Why a proposal did not land. Every value is an operator-visible outcome. */
export const PROPOSAL_REJECTIONS = [
  'schema-version',
  'stale-revision',
  'evicted-reference',
  'queue-overflow',
  'cancelled',
  'failed-schema',
] as const;

export type ProposalRejection = (typeof PROPOSAL_REJECTIONS)[number];

export const ProposalRejectedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('proposal.rejected'),
  engine: z.literal(PROPOSER_ORIGIN),
  payload: z.object({
    proposalId: z.string(),
    kind: z.enum(PROPOSAL_KINDS),
    reason: z.enum(PROPOSAL_REJECTIONS),
    detail: z.string(),
    /** The revision at the boundary the proposal was judged against. */
    observedRevision: z.number().int().nonnegative(),
  }),
});

export const ProposalAdmittedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('proposal.admitted'),
  engine: z.literal(PROPOSER_ORIGIN),
  payload: z.object({
    proposalId: z.string(),
    kind: z.enum(PROPOSAL_KINDS),
    schemaVersion: z.number().int().positive(),
    baseRevision: z.number().int().nonnegative(),
    /** The revision this admission produced. The event is the source of truth for it. */
    resultingRevision: z.number().int().positive(),
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

export const validateProposal = (input: unknown): Proposal =>
  parseOrThrow(ProposalSchema, 'Proposal', input);
