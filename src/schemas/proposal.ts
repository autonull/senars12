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

import {
  nonEmpty,
  nonNegativeInt,
  positiveInt,
  unitInterval,
  validatorFor,
} from '../config';
import { z } from 'zod';
import { RulePatternSchema } from './common';
import { CognitiveEventBaseSchema, PROPOSER_ORIGIN } from './event-base';
import { RuleDeclarationSchema } from './rule-table';
import { TaskTypeSchema } from './task';
import { BeliefTruthSchema as TruthValueSchema } from '../util/truth-schema';
import { ProposalAdmittedEventSchema, ProposalRejectedEventSchema, ProposalRejection as EventProposalRejection } from './proposal-events';

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
  proposalId: nonEmpty,
  schemaVersion: positiveInt,
  /**
   * The committed revision the proposer observed. A proposal whose base is
   * behind the revision at the boundary is **stale** and is rejected — applying
   * it would resolve a conflict the proposer could not have seen (§3.3).
   */
  baseRevision: nonNegativeInt,
  /** Cycles between proposals: the trigger is a work budget, never a wall clock. */
  cyclesPerProposal: positiveInt,
  issuedAtCycle: nonNegativeInt,
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
    term: nonEmpty,
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
    ruleId: nonEmpty,
    name: nonEmpty,
    pattern: RulePatternSchema,
    /** The named truth function the rule dispatches through. */
    truthFn: nonEmpty,
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

/** Re-export event schemas from proposal-events to avoid circular dependency. */
export { ProposalAdmittedEventSchema, ProposalRejectedEventSchema } from './proposal-events';
export type { ProposalAdmittedEvent, ProposalRejectedEvent } from './proposal-events';

export const validateProposal = validatorFor(ProposalSchema, 'Proposal');
