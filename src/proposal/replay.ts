/**
 * Proposal replay (TODO29.a §5.9, A9).
 *
 * **The fixture is the event log the kernel already keeps.** A proposal is an
 * untrusted write attempt, so inventing a parallel fixture format would be the
 * same mistake as inventing a parallel budget system in A7: a second
 * representation of state that can disagree with the first. This module therefore
 * extends the existing reducer with `proposal.*` event kinds and nothing else —
 * `replayCognitiveState` folds the same log, and `RuleTableStore.fromEvents`
 * rebuilds the table from the same admissions.
 *
 * Three properties are load-bearing, and all three are the reason this is a
 * module rather than a loop inside `replayIntoMemory`:
 *
 * 1. **The reduction is a pure function of the log.** No clock, no ids, no
 *    memory, no provider — so replaying a recorded stream twice produces the
 *    same value, and a difference between two replays is a difference in the
 *    log rather than in the run.
 * 2. **A version mismatch fails loudly.** `PROPOSAL_SCHEMA_VERSION` is the
 *    proposal schema's own version and a recorded stream carries the version it
 *    was written under. Coercing a mismatch would silently mis-apply a fixture
 *    recorded against a different contract, which §5.9 names as the *first*
 *    thing in this repository where that can happen.
 * 3. **The revision comes from the log, not from a counter.** Replaying a stream
 *    recorded against revision *R* reconstructs *R*; a caller whose committed
 *    revision is *R+1* is stale by exactly one and the lifecycle's own
 *    applicability rule refuses it. The check belongs here so it cannot be
 *    skipped by a caller that replays without a lifecycle.
 */

import type { CognitiveEvent, ProposalRejection, RuleDeclaration } from '@senars/core/schemas';
import { PROPOSAL_SCHEMA_VERSION } from '@senars/core/schemas';
import { unique } from '@senars/util';
import { SenarsError } from '@senars/util/errors';

/** One admission, as the log states it. */
export interface ReplayedAdmission {
  readonly proposalId: string;
  readonly kind: 'content' | 'rule';
  readonly baseRevision: number;
  readonly resultingRevision: number;
  readonly producer?: string;
  readonly declaration?: RuleDeclaration;
}

/** One rejection, with the reason the seam recorded. Rejections are not silent. */
export interface ReplayedRejection {
  readonly proposalId: string;
  readonly kind: 'content' | 'rule';
  readonly reason: ProposalRejection;
  readonly observedRevision: number;
}

/** The whole reduction. Every field is a function of the event list. */
export interface ProposalReplayState {
  /** The committed revision the log ends at. Zero for an empty stream. */
  readonly revision: number;
  readonly admissions: readonly ReplayedAdmission[];
  readonly rejections: readonly ReplayedRejection[];
  readonly rejectedByReason: Readonly<Record<string, number>>;
  /** Rule declarations in admission order — the table, without a table. */
  readonly declarations: readonly RuleDeclaration[];
  /** Distinct schema versions the stream was recorded under. Must be one. */
  readonly schemaVersions: readonly number[];
}

/** A recorded stream this build cannot reduce. Never coerced. */
export class ProposalReplayError extends SenarsError {
  constructor(
    readonly detail: string,
    readonly events: readonly CognitiveEvent[],
    options?: ErrorOptions
  ) {
    super(`proposal replay refused: ${detail}`, 'INVALID_EVENT', { detail }, options);
    this.name = 'ProposalReplayError';
  }
}

export const isProposalEvent = (event: CognitiveEvent): boolean =>
  event.type === 'proposal.admitted' || event.type === 'proposal.rejected';

export const isProposalStream = (events: readonly CognitiveEvent[]): boolean =>
  events.some(isProposalEvent);

/**
 * The versions a stream was recorded under, from the admissions. A stream with
 * no admission carries no version, which is not a mismatch — an empty log is a
 * legitimate replay at revision 0.
 */
export const recordedSchemaVersions = (events: readonly CognitiveEvent[]): number[] =>
  unique(
    events
      .filter((e) => e.type === 'proposal.admitted')
      .map((e) => (e as { payload: { schemaVersion: number } }).payload.schemaVersion)
  ).sort((a, b) => a - b);

/**
 * The reduction. Pure: given the same log it returns the same value, twice, in
 * any process, with no provider constructed and no entropy drawn.
 *
 * @throws ProposalReplayError when the stream was recorded under a schema
 * version this build does not speak — a stream from a future commit must not
 * replay against incompatible state.
 */
export function replayProposalStream(events: readonly CognitiveEvent[]): ProposalReplayState {
  const versions = recordedSchemaVersions(events);
  const incompatible = versions.filter((version) => version !== PROPOSAL_SCHEMA_VERSION);
  if (incompatible.length > 0) {
    throw new ProposalReplayError(
      `stream recorded under schema v${incompatible.join(', v')} against a core at v${PROPOSAL_SCHEMA_VERSION}`,
      events.filter(isProposalEvent)
    );
  }

  const admissions: ReplayedAdmission[] = [];
  const rejections: ReplayedRejection[] = [];
  const rejectedByReason: Record<string, number> = {};
  let revision = 0;

  for (const event of events) {
    if (event.type === 'proposal.admitted') {
      admissions.push({
        proposalId: event.payload.proposalId,
        kind: event.payload.kind,
        baseRevision: event.payload.baseRevision,
        resultingRevision: event.payload.resultingRevision,
        producer: event.payload.producer,
        declaration: event.payload.declaration,
      });
      revision = event.payload.resultingRevision;
    } else if (event.type === 'proposal.rejected') {
      rejections.push({
        proposalId: event.payload.proposalId,
        kind: event.payload.kind,
        reason: event.payload.reason,
        observedRevision: event.payload.observedRevision,
      });
      rejectedByReason[event.payload.reason] = (rejectedByReason[event.payload.reason] ?? 0) + 1;
    }
  }

  return {
    revision,
    admissions,
    rejections,
    rejectedByReason,
    declarations: admissions
      .map((admission) => admission.declaration)
      .filter((declaration): declaration is RuleDeclaration => declaration !== undefined),
    schemaVersions: versions,
  };
}

/**
 * The staleness rule as a check a caller cannot skip: a stream recorded against
 * revision *R* is refused against a committed revision *R+1*. This is the
 * §5.9 acceptance clause "a proposal stream recorded against revision *R* is
 * rejected against *R+1*", and it is deliberately here rather than only in
 * `ProposalLifecycle.judge`, because a replay that reconstructs a table does not
 * necessarily construct a lifecycle.
 *
 * Returns the offending proposals rather than throwing, so the caller can
 * record a rejection per proposal — which is what the seam does at a boundary.
 */
export function staleAdmissions(
  events: readonly CognitiveEvent[],
  committedRevision: number
): ReplayedAdmission[] {
  return replayProposalStream(events).admissions.filter(
    (admission) => admission.resultingRevision > committedRevision
  );
}
