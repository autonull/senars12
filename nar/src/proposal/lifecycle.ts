/**
 * The proposal lifecycle (TODO29.a §3.3, §5.3).
 *
 * `docs/proposal-protocol.md` is where each of the eight decisions is written
 * down; this module is where they are **enforced**, and it is deliberately a pure
 * state machine over a sink of events — no gates, no memory, no NAR internals.
 * Everything the seam needs to be correct is a function of `(queued proposals,
 * committed revision, resolvable references)`, which is what makes it replayable
 * (A9) and testable without a cycle.
 *
 * The load-bearing properties, in the order §3.3 states them:
 *
 * 1. **Two queues, two overflow policies.** Content is regenerable, so it drops
 *    oldest and says so in a counter. A rule *is* the learned capability, so its
 *    queue refuses the newest with a recorded rejection the operator can see.
 *    One policy for both is the mistake a single `Proposal` interface invites.
 * 2. **A proposal is a request to a gate.** {@link ProposalLifecycle.judge} is a
 *    pure function returning a verdict; it mutates nothing. The caller routes
 *    the verdict through the gates.
 * 3. **Admission is one committed transition.** {@link ProposalLifecycle.commit}
 *    appends exactly one `proposal.admitted` event and advances the revision the
 *    next boundary judges against, so the log and the caller cannot disagree.
 * 4. **Application happens at a declared boundary.** `admit` is called from the
 *    `authorize` stage and nowhere else; "apply whenever it arrives" is not
 *    reachable from here.
 */

import type {
  CognitiveEvent,
  Proposal,
  ProposalRejectedEvent,
  ProposalRejection,
} from '@senars/core/schemas';
import { PROPOSAL_SCHEMA_VERSION, validateProposal } from '@senars/core/schemas';
import { BoundedRing, makeId } from '@senars/util';

/** Bounded depth of a seam's own log, matching the kernel gates' rings. */
export const PROPOSAL_LOG_CAPACITY = 1000;

/** How deep each queue may get before its own policy applies. */
export interface ProposalQueueLimits {
  /** Content drops its oldest above this depth; the displaced proposal is recorded. */
  maxPendingContent: number;
  /** A rule proposal is refused above this depth, never displaced. */
  maxPendingRules: number;
}

export const DEFAULT_QUEUE_LIMITS: ProposalQueueLimits = {
  maxPendingContent: 64,
  maxPendingRules: 16,
};

/** What the lifecycle needs to know about the world to judge a proposal. */
export interface ProposalBoundary {
  /** Whether a referenced term still resolves. A reference that does not is a rejection, not a salvage. */
  resolves(reference: string): boolean;
}

/** Where committed events go. The event log is the source of truth for the revision. */
export type ProposalEventSink = (event: CognitiveEvent) => void;

export type AdmissionVerdict =
  | { readonly admitted: true; readonly proposal: Proposal }
  | {
      readonly admitted: false;
      readonly proposal: Proposal;
      readonly reason: ProposalRejection;
      readonly detail: string;
    };

export interface ProposalLifecycleStats {
  /** The committed revision proposals are judged against. Derived from the log. */
  revision: number;
  contentPending: number;
  rulePending: number;
  /** Content proposals the drop-oldest policy displaced. Regenerable, so cheap. */
  contentDropped: number;
  /** Rule proposals the bounded queue refused. Never silent: each is recorded. */
  rulesRefused: number;
  /** Rejections recorded, by reason. The seam's whole audit surface. */
  rejected: number;
  /** Admissions committed. Equal to the `proposal.admitted` events in the log. */
  admitted: number;
}

export class ProposalLifecycle {
  private content: Proposal[] = [];
  private rules: Proposal[] = [];
  private revision = 0;
  private contentDropped = 0;
  private rulesRefused = 0;
  private rejected = 0;
  private admitted = 0;
  private readonly rejections = new Map<ProposalRejection, number>();

  constructor(
    private readonly limits: ProposalQueueLimits = DEFAULT_QUEUE_LIMITS,
    private readonly record: ProposalEventSink = () => {}
  ) {}

  /**
   * Rebuild a ledger from a recorded event stream. The revision comes from the
   * log rather than from a counter, which is what "the event that records
   * admission is the source of truth for the resulting table revision" means
   * operationally — an interruption between admission and index update loses
   * nothing, because the index is a projection of these events.
   */
  static fromEvents(
    events: readonly CognitiveEvent[],
    limits: ProposalQueueLimits = DEFAULT_QUEUE_LIMITS,
    record: ProposalEventSink = () => {}
  ): ProposalLifecycle {
    const lifecycle = new ProposalLifecycle(limits, record);
    for (const event of events) {
      if (event.type === 'proposal.admitted') {
        lifecycle.revision = event.payload.resultingRevision;
        lifecycle.admitted++;
      } else if (event.type === 'proposal.rejected') {
        lifecycle.countRejection(event.payload.reason);
      }
    }
    return lifecycle;
  }

  /**
   * The trigger is a **budget of cycles**, never a wall clock: a caller reaches
   * here because enough un-committed work accumulated, and `cyclesPerProposal`
   * on the envelope is the contract that says how much.
   *
   * Returns `true` when the proposal is queued. A content proposal above capacity
   * displaces the oldest and still returns `true` — the caller did nothing wrong.
   * A rule proposal above capacity is refused, and the refusal is recorded.
   */
  submit(proposal: Proposal): boolean {
    const parsed = validateProposal(proposal);
    if (parsed.kind === 'rule') {
      if (this.rules.length >= this.limits.maxPendingRules) {
        this.rulesRefused++;
        this.refuse(parsed, 'queue-overflow', `rule queue full at ${this.limits.maxPendingRules}`);
        return false;
      }
      this.rules.push(parsed);
      return true;
    }
    this.content.push(parsed);
    const over = this.content.length - this.limits.maxPendingContent;
    for (let i = 0; i < over; i++) {
      const displaced = this.content.shift();
      this.contentDropped++;
      if (displaced) this.refuse(displaced, 'queue-overflow', 'content drop-oldest');
    }
    return true;
  }

  /** The unit of work: one proposal per admission pass. */
  pending(): number {
    return this.content.length + this.rules.length;
  }

  /**
   * The applicability rule (§3.3), as a pure function of the boundary. A
   * proposal is checked against the committed revision, its schema version, and
   * whether everything it reads still resolves — in that order, because a stale
   * base is a different failure from an evicted reference and an operator needs
   * to tell them apart.
   */
  judge(proposal: Proposal, boundary: ProposalBoundary = { resolves: () => true }): AdmissionVerdict {
    const refused = (reason: ProposalRejection, detail: string): AdmissionVerdict => ({
      admitted: false,
      proposal,
      reason,
      detail,
    });
    if (proposal.schemaVersion !== PROPOSAL_SCHEMA_VERSION) {
      return refused(
        'schema-version',
        `schema v${proposal.schemaVersion} against a core at v${PROPOSAL_SCHEMA_VERSION}`
      );
    }
    if (proposal.baseRevision !== this.revision) {
      return refused(
        'stale-revision',
        `base r${proposal.baseRevision} against committed r${this.revision}`
      );
    }
    const missing = proposal.references.filter((reference) => !boundary.resolves(reference));
    if (missing.length > 0) {
      return refused('evicted-reference', `unresolved: ${missing.join(', ')}`);
    }
    if (proposal.kind === 'rule' && !proposal.payload.body) {
      return refused('failed-schema', 'a rule proposal requires a body');
    }
    return { admitted: true, proposal };
  }

  /**
   * Drain and judge everything queued at this boundary, then record a rejection
   * for each that did not clear. Both queues drain and each proposal takes its
   * own verdict, so one stale content proposal cannot take a fresh rule proposal
   * down with it.
   *
   * Judging is not committing: a verdict is a request the caller routes through
   * the gates, and only {@link commit} advances the revision.
   */
  admit(boundary: ProposalBoundary = { resolves: () => true }): AdmissionVerdict[] {
    const batch = [
      ...this.content.splice(0, this.content.length),
      ...this.rules.splice(0, this.rules.length),
    ];
    return batch.map((proposal) => {
      const verdict = this.judge(proposal, boundary);
      if (!verdict.admitted) this.refuse(proposal, verdict.reason, verdict.detail);
      return verdict;
    });
  }

  /**
   * The single committed state transition: one admitted proposal, one event, one
   * revision. The revision is assigned **here** rather than in `judge`, because a
   * boundary admits a batch and every admission in it advances the table — a
   * verdict that carried a revision would have been computed against a revision
   * its own predecessor had not reached yet.
   *
   * The returned revision is the one the event states, so the log and the caller
   * cannot disagree about what happened.
   */
  commit(verdict: AdmissionVerdict, correlationId: string = makeId()): number {
    if (!verdict.admitted) return -1;
    this.admitted++;
    this.revision++;
    this.record({
      type: 'proposal.admitted',
      engine: 'proposer',
      timestamp: Date.now(),
      correlationId,
      causationId: verdict.proposal.proposalId,
      payload: {
        proposalId: verdict.proposal.proposalId,
        kind: verdict.proposal.kind,
        schemaVersion: verdict.proposal.schemaVersion,
        baseRevision: verdict.proposal.baseRevision,
        resultingRevision: this.revision,
      },
    });
    return this.revision;
  }

  /** Withdraw a queued proposal before the boundary. Recorded, so a cancellation is not a silence. */
  cancel(proposalId: string): boolean {
    return this.withdraw(this.content, proposalId) || this.withdraw(this.rules, proposalId);
  }

  private withdraw(queue: Proposal[], proposalId: string): boolean {
    const at = queue.findIndex((proposal) => proposal.proposalId === proposalId);
    const [proposal] = queue.splice(at, 1);
    if (at < 0 || !proposal) return false;
    this.refuse(proposal, 'cancelled', 'cancelled before the boundary');
    return true;
  }

  stats(): ProposalLifecycleStats {
    return {
      revision: this.revision,
      contentPending: this.content.length,
      rulePending: this.rules.length,
      contentDropped: this.contentDropped,
      rulesRefused: this.rulesRefused,
      rejected: this.rejected,
      admitted: this.admitted,
    };
  }

  rejectionCounts(): ReadonlyMap<ProposalRejection, number> {
    return new Map(this.rejections);
  }

  /** The one place a rejection is counted and appended, so no rejection can be silent. */
  private refuse(proposal: Proposal, reason: ProposalRejection, detail: string): void {
    this.countRejection(reason);
    const event: ProposalRejectedEvent = {
      type: 'proposal.rejected',
      engine: 'proposer',
      timestamp: Date.now(),
      correlationId: makeId(),
      payload: {
        proposalId: proposal.proposalId,
        kind: proposal.kind,
        reason,
        detail,
        observedRevision: this.revision,
      },
    };
    this.record(event);
  }

  private countRejection(reason: ProposalRejection): void {
    this.rejected++;
    this.rejections.set(reason, (this.rejections.get(reason) ?? 0) + 1);
  }
}