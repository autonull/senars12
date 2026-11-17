/**
 * Log Events — canonical event types for the append-only log.
 *
 * Every state mutation in the system is an event. Events are immutable,
 * totally ordered by stamp, and form the single source of truth for
 * replay, snapshot, and verification.
 */

import type { UUID, TimestampMs } from '../generated/schemas.js';
import { z } from 'zod';
import {
  CognitiveEventSchema,
  type CognitiveEvent,
  TruthValueSchema,
  type TruthValue,
  TermSchema,
  type Term,
  StampSchema,
  type Stamp,
  TaskTypeSchema,
  type TaskType,
  TaskBagKindSchema,
  type TaskBagKind,
  SourceQualitySchema,
  type SourceQuality,
  BudgetScopeIdSchema,
  type BudgetScopeId,
  TerminationReasonSchema,
  type TerminationReason,
} from '../generated/schemas.js';

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
  id: z.string().uuid(),
  /** Logical timestamp (monotonic counter). */
  seq: z.number().int().nonnegative(),
  /** Wall-clock timestamp. */
  ts: z.number().int().positive(),
  /** The cognitive event payload. */
  event: CognitiveEventSchema,
  /** Causal parent event IDs (for derivation chains). */
  parents: z.array(z.string().uuid()).default([]),
  /** Content hash for integrity verification. */
  hash: z.string().min(1),
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