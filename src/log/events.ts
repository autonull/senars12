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
export const isTaskAdmittedEvent = (e: CognitiveEvent): e is CognitiveEvent & { type: 'TaskAdmitted' } =>
  e.type === 'TaskAdmitted';

export const isDerivationAcceptedEvent = (e: CognitiveEvent): e is CognitiveEvent & { type: 'DerivationAccepted' } =>
  e.type === 'DerivationAccepted';

export const isGateEvent = (e: CognitiveEvent): e is CognitiveEvent & { type: 'GatePassed' | 'GateFailed' } =>
  e.type === 'GatePassed' || e.type === 'GateFailed';

export const isBudgetEvent = (e: CognitiveEvent): e is CognitiveEvent & { type: 'BudgetConsumed' | 'BudgetExhausted' } =>
  e.type === 'BudgetConsumed' || e.type === 'BudgetExhausted';

export const isProposalEvent = (e: CognitiveEvent): e is CognitiveEvent & { type: 'ProposalSubmitted' | 'ProposalAdmitted' | 'ProposalRejected' } =>
  e.type === 'ProposalSubmitted' || e.type === 'ProposalAdmitted' || e.type === 'ProposalRejected';

export const isSnapshotEvent = (e: CognitiveEvent): e is CognitiveEvent & { type: 'SnapshotCreated' | 'SnapshotRestored' } =>
  e.type === 'SnapshotCreated' || e.type === 'SnapshotRestored';