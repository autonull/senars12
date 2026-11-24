/**
 * Log Events — canonical event types for the append-only log.
 *
 * Every state mutation in the system is an event. Events are immutable,
 * totally ordered by stamp, and form the single source of truth for
 * replay, snapshot, and verification.
 */

import type { UUID, TimestampMs } from '../generated/schemas';
import { z } from 'zod';
import {
  TaskTypeSchema,
  type TaskType,
  TaskBagKindSchema,
  type TaskBagKind,
} from '../schemas/task';
import {
  CognitiveEventSchema,
  type CognitiveEvent,
  TruthValueSchema,
  type TruthValue,
  TermSchema,
  type Term,
  StampSchema,
  type Stamp,
  SourceQualitySchema,
  type SourceQuality,
  BudgetScopeIdSchema,
  type BudgetScopeId,
  TerminationReasonSchema,
  type TerminationReason,
  type DerivationStep,
  type DerivationRecord,
} from '../generated/schemas';
import { uuid, nonNegativeInt, timestamp, nonEmpty } from '@senars/util/config';

export type {
  UUID,
  TimestampMs,
  CognitiveEvent,
  TruthValue,
  Term,
  Stamp,
  TaskType,
  TaskBagKind,
  SourceQuality,
  BudgetScopeId,
  TerminationReason,
  DerivationStep,
  DerivationRecord,
};

// Re-export schemas for consumers
export {
  CognitiveEventSchema,
  TruthValueSchema,
  TermSchema,
  StampSchema,
  TaskTypeSchema,
  TaskBagKindSchema,
  SourceQualitySchema,
  BudgetScopeIdSchema,
  TerminationReasonSchema,
};

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

export type LogEntry = z.infer<typeof LogEntrySchema>;

/** Compute the content hash of a log entry (excluding id, seq, hash). */
export const hashEntry = (entry: Omit<LogEntry, 'id' | 'seq' | 'hash'>): string => {
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
export const createLogEntry = (
  event: CognitiveEvent,
  options: { parents?: UUID[]; ts?: TimestampMs } = {}
): Omit<LogEntry, 'id' | 'seq' | 'hash'> => {
  const ts = options.ts ?? Date.now();
  const parents = options.parents ?? [];
  return { ts, event, parents };
};

/** Event type guards for pattern matching. */
export const isTaskAdmittedEvent = (e: CognitiveEvent): e is CognitiveEvent & { type: 'task.admitted' } =>
  e.type === 'task.admitted';

export const isDerivationAcceptedEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'derivation.accepted' }> =>
  e.type === 'derivation.accepted';

export const isGatePassedEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'gate.passed' }> =>
  e.type === 'gate.passed';

export const isGateFailedEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'gate.failed' }> =>
  e.type === 'gate.failed';

export const isGateEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'gate.passed' | 'gate.failed' }> =>
  e.type === 'gate.passed' || e.type === 'gate.failed';

export const isBudgetConsumedEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'budget.consumed' }> =>
  e.type === 'budget.consumed';

export const isBudgetExhaustedEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'budget.exhausted' }> =>
  e.type === 'budget.exhausted';

export const isBudgetEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'budget.consumed' | 'budget.exhausted' }> =>
  e.type === 'budget.consumed' || e.type === 'budget.exhausted';

export const isProposalSubmittedEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'proposal.submitted' }> =>
  e.type === 'proposal.submitted';

export const isProposalAdmittedEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'proposal.admitted' }> =>
  e.type === 'proposal.admitted';

export const isProposalRejectedEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'proposal.rejected' }> =>
  e.type === 'proposal.rejected';

export const isProposalEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'proposal.submitted' | 'proposal.admitted' | 'proposal.rejected' }> =>
  e.type === 'proposal.submitted' || e.type === 'proposal.admitted' || e.type === 'proposal.rejected';

export const isSnapshotCreatedEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'snapshot.created' }> =>
  e.type === 'snapshot.created';

export const isSnapshotRestoredEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'snapshot.restored' }> =>
  e.type === 'snapshot.restored';

export const isSnapshotEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'snapshot.created' | 'snapshot.restored' }> =>
  e.type === 'snapshot.created' || e.type === 'snapshot.restored';

export const isDerivationMadeEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'derivation.made' }> =>
  e.type === 'derivation.made';

export const isDerivationRecordEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: 'derivation.record' }> =>
  e.type === 'derivation.record';

/**
 * EventLog interface for the unified log store.
 */
export interface EventLog {
  append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent>;

  subscribe(options?: {
    filter?: (event: CognitiveEvent) => boolean;
    fromId?: string;
    types?: string[];
  }): AsyncIterable<CognitiveEvent>;

  query(query: EventLogQuery): Promise<CognitiveEvent[]>;

  getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]>;

  close(): Promise<void>;

  getSnapshot<T>(projectionName: string, version: number): Promise<T | null>;

  saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void>;
}

/**
 * Configuration for EventLog.
 */
export interface EventLogConfig {
  maxEvents?: number;
  maxEventSize?: number;
}

/**
 * Filtered read of the log. All fields optional, and the *unfiltered* read is
 * `getRange('', '')` — this exists so a caller that bounds its read can say so,
 * and so an implementation with an index can filter and limit in the store
 * rather than materializing the log and discarding most of it.
 */
export interface EventLogQuery {
  correlationId?: string;
  /** Type allowlist. Empty or absent means *every* type, so `[]` is not "nothing". */
  types?: string[];
  /** Inclusive `[from, to]` on `timestamp`; absent means unbounded. */
  timeRange?: [number, number];
  /** Keep the most recent `limit` matching events, still returned in id order. */
  limit?: number;
}

/**
 * A type allowlist as a membership test, or `undefined` for *every* type. The two
 * implementations and the subscription replay each built their own `Set`, and the
 * subscription's `types: []` matched nothing while a query's `types: []` matched
 * everything — the same argument, two answers, from one contract that documents
 * "empty or absent means every type".
 */
export const typeSetOf = (types?: readonly string[]): ReadonlySet<string> | undefined =>
  types?.length ? new Set(types) : undefined;

/** What a subscription filters on — the allowlist and the caller's own predicate. */
export interface SubscriptionFilter {
  types?: ReadonlySet<string>;
  filter?: (event: CognitiveEvent) => boolean;
}

/**
 * Whether a subscription admits an event: the allowlist first, then the caller's
 * own predicate. Written once because the replay path and the live-notify path
 * were two copies that had already drifted — replay ignored `fromId`.
 */
export const subscriptionAdmits = ({ types, filter }: SubscriptionFilter, event: CognitiveEvent) =>
  (types === undefined || types.has(event.type)) && (filter === undefined || filter(event));