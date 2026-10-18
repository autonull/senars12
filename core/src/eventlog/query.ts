/**
 * The one read surface over the unified stream (CORE.19 C1.5).
 *
 * Store-indexable filters — type, correlation, time, cap — push down to
 * `EventLog.query` so both log implementations filter where they index. The
 * payload-level filters — the kernel `cycle` a fire belongs to, and the term an
 * event names — are not indexed by the store, so a query that uses them reads
 * the (still type/correlation-bounded) matches and narrows in memory. Every
 * consumer of the stream — the trace viewer, replay, the explanation generator —
 * reads through here rather than growing a side channel per feature.
 */
import type { CognitiveEvent } from '../schemas/index.js';
import type { EventLog } from './EventLog.js';

export interface StreamQuery {
  /** Type allowlist. Absent or empty means every type. */
  types?: string[];
  correlationId?: string;
  /** Inclusive `[from, to]` on `timestamp`. */
  timeRange?: [number, number];
  /** The kernel cycle a fire belongs to — top-level on `cycle`, else in the payload. */
  cycle?: number;
  /** A term an event names: its own term, a premise, or its conclusion/goal/atom. */
  term?: string;
  /** Keep the most recent N matches. */
  limit?: number;
}

const eventCycle = (event: CognitiveEvent): number | undefined => {
  const fromTop = (event as { cycle?: unknown }).cycle;
  if (typeof fromTop === 'number') return fromTop;
  const fromPayload = (event.payload as { cycle?: unknown }).cycle;
  return typeof fromPayload === 'number' ? fromPayload : undefined;
};

const eventMentionsTerm = (event: CognitiveEvent, term: string): boolean => {
  const payload = event.payload as Record<string, unknown>;
  if (
    payload.term === term ||
    payload.conclusion === term ||
    payload.goal === term ||
    payload.atom === term
  )
    return true;
  const premises = payload.premises;
  return Array.isArray(premises) && premises.includes(term);
};

export async function queryEventStream(
  log: EventLog,
  query: StreamQuery = {}
): Promise<CognitiveEvent[]> {
  const payloadFiltered = query.cycle !== undefined || query.term !== undefined;
  const events = await log.query({
    types: query.types,
    correlationId: query.correlationId,
    timeRange: query.timeRange,
    // A cap cannot be pushed down when a payload filter still has to run: the
    // store would return the most recent N *unfiltered* events and the filter
    // would then find fewer than requested.
    limit: payloadFiltered ? undefined : query.limit,
  });

  let matched = events;
  if (query.cycle !== undefined) matched = matched.filter((e) => eventCycle(e) === query.cycle);
  if (query.term !== undefined) matched = matched.filter((e) => eventMentionsTerm(e, query.term!));
  return query.limit !== undefined ? matched.slice(-query.limit) : matched;
}
