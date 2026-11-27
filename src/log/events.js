/**
 * Log Events — canonical event types for the append-only log.
 *
 * Every state mutation in the system is an event. Events are immutable,
 * totally ordered by stamp, and form the single source of truth for
 * replay, snapshot, and verification.
 */
import { z } from 'zod';
import { TaskTypeSchema, TaskBagKindSchema, } from '../schemas/task';
import { CognitiveEventSchema, TruthValueSchema, TermSchema, StampSchema, SourceQualitySchema, BudgetScopeIdSchema, TerminationReasonSchema, } from '../generated/schemas';
import { uuid, nonNegativeInt, timestamp, nonEmpty } from '@senars/config';
// Re-export schemas for consumers
export { CognitiveEventSchema, TruthValueSchema, TermSchema, StampSchema, TaskTypeSchema, TaskBagKindSchema, SourceQualitySchema, BudgetScopeIdSchema, TerminationReasonSchema, };
/** Envelope for a log entry: event + metadata. */
export const LogEntrySchema = z.object({
    /** Globally unique event ID. */
    id: uuid,
    /** Logical timestamp (monotonic counter). */
    seq: nonNegativeInt,
    /** Wall-clock timestamp. */
    ts: timestamp,
    /** The cognitive event payload. */
    event: CognitiveEventSchema,
    /** Causal parent event IDs (for derivation chains). */
    parents: z.array(uuid).default([]),
    /** Content hash for integrity verification. */
    hash: nonEmpty,
});
/** Compute the content hash of a log entry (excluding id, seq, hash). */
export const hashEntry = (entry) => {
    const canon = JSON.stringify({
        ts: entry.ts,
        event: entry.event,
        parents: entry.parents,
    });
    let hash = 0;
    for (let i = 0; i < canon.length; i++) {
        hash = ((hash << 5) - hash) + canon.charCodeAt(i);
        hash |= 0;
    }
    return `h${Math.abs(hash).toString(16).padStart(8, '0')}`;
};
/** Create a log entry from an event. */
export const createLogEntry = (event, options = {}) => {
    const ts = options.ts ?? Date.now();
    const parents = options.parents ?? [];
    return { ts, event, parents };
};
/** Event type guards for pattern matching. */
export const isTaskAdmittedEvent = (e) => e.type === 'task.admitted';
export const isDerivationAcceptedEvent = (e) => e.type === 'derivation.accepted';
export const isGatePassedEvent = (e) => e.type === 'gate.passed';
export const isGateFailedEvent = (e) => e.type === 'gate.failed';
export const isGateEvent = (e) => e.type === 'gate.passed' || e.type === 'gate.failed';
export const isBudgetConsumedEvent = (e) => e.type === 'budget.consumed';
export const isBudgetExhaustedEvent = (e) => e.type === 'budget.exhausted';
export const isBudgetEvent = (e) => e.type === 'budget.consumed' || e.type === 'budget.exhausted';
export const isProposalSubmittedEvent = (e) => e.type === 'proposal.submitted';
export const isProposalAdmittedEvent = (e) => e.type === 'proposal.admitted';
export const isProposalRejectedEvent = (e) => e.type === 'proposal.rejected';
export const isProposalEvent = (e) => e.type === 'proposal.submitted' || e.type === 'proposal.admitted' || e.type === 'proposal.rejected';
export const isSnapshotCreatedEvent = (e) => e.type === 'snapshot.created';
export const isSnapshotRestoredEvent = (e) => e.type === 'snapshot.restored';
export const isSnapshotEvent = (e) => e.type === 'snapshot.created' || e.type === 'snapshot.restored';
export const isDerivationMadeEvent = (e) => e.type === 'derivation.made';
export const isDerivationRecordEvent = (e) => e.type === 'derivation.record';
/**
 * A type allowlist as a membership test, or `undefined` for *every* type. The two
 * implementations and the subscription replay each built their own `Set`, and the
 * subscription's `types: []` matched nothing while a query's `types: []` matched
 * everything — the same argument, two answers, from one contract that documents
 * "empty or absent means every type".
 */
export const typeSetOf = (types) => types?.length ? new Set(types) : undefined;
/**
 * Whether a subscription admits an event: the allowlist first, then the caller's
 * own predicate. Written once because the replay path and the live-notify path
 * were two copies that had already drifted — replay ignored `fromId`.
 */
export const subscriptionAdmits = ({ types, filter }, event) => (types === undefined || types.has(event.type)) && (filter === undefined || filter(event));
