import { SenarsError } from '@senars/util';

export type { CognitiveEvent } from '../schemas/cognitive-events.js';

import type { CognitiveEvent } from '../schemas/cognitive-events.js';

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

export interface EventLog {
  append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent>;

  subscribe(options?: {
    filter?: (event: CognitiveEvent) => boolean;
    fromId?: string;
    types?: string[];
  }): AsyncIterable<CognitiveEvent>;

  /**
   * Filtered read. Required rather than optional because both implementations
   * index for it and the one caller that needed it — episodic recall — was
   * re-deriving the filter here against a whole-log `getRange`.
   */
  query(query: EventLogQuery): Promise<CognitiveEvent[]>;

  getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]>;

  /** Release the log: stop subscribers, then the store (sqlite holds a handle). */
  close(): Promise<void>;

  getSnapshot<T>(projectionName: string, version: number): Promise<T | null>;

  saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void>;
}

export class EventLogError extends SenarsError {
  constructor(
    code: 'FULL' | 'UNAVAILABLE' | 'INVALID_EVENT' | 'SERIALIZATION_FAILED',
    message: string,
    cause?: Error
  ) {
    super(message, code, undefined, { cause });
    this.name = 'EventLogError';
  }
}

export interface EventLogConfig {
  maxEvents?: number;
  maxEventSize?: number;
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
