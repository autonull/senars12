/**
 * Trace-vocabulary projection for the budget slice events.
 *
 * `BudgetSlice` announces one event per accounting step in two vocabularies: the
 * typed bus the kernel's own subscribers read, and the flat snake_case shape a
 * tracer receives. The mapping is only needed while something is listening —
 * before `initOtel` registers an exporter there is no sink — so the projection
 * is behind `hasDomainEventSink` rather than allocating on every `consume`.
 */

import { keyedBy } from '@senars/util';
import type { BudgetEventMap, BudgetLimits, ConsumedBudget } from './budget.js';
import { type DomainEventPayload, emitDomainEvent, hasDomainEventSink } from './event-sink.js';

/** The bus vocabulary and the trace vocabulary for the same four events. */
const OTEL_EVENT = {
  'budget:slice:created': 'budget.slice.created',
  'budget:slice:consumed': 'budget.slice.consumed',
  'budget:slice:exhausted': 'budget.slice.exhausted',
  'budget:slice:merged': 'budget.slice.merged',
} as const satisfies Record<keyof BudgetEventMap, string>;

/** Camel-case payload keys the trace vocabulary spells differently. */
const OTEL_KEYS: Record<string, string> = {
  sliceId: 'id',
  parentId: 'parent_id',
  childId: 'child_id',
  maxCycles: 'total_cycles',
  maxDepth: 'total_depth',
  maxMemoryOps: 'total_memory_ops',
  maxLMCalls: 'total_llm_calls',
};

const renameKeys = (payload: Record<string, unknown>): DomainEventPayload =>
  keyedBy(
    Object.entries(payload),
    ([key]) => OTEL_KEYS[key] ?? key,
    ([, value]) => value
  );

const toTraceConsumed = (consumed: ConsumedBudget): DomainEventPayload => ({
  cycles: consumed.cycles,
  depth: consumed.depth,
  memory_ops: consumed.memoryOps,
  llm_calls: consumed.llmCalls,
});

const toTraceLimits = (limits: BudgetLimits): DomainEventPayload => ({
  cycles: limits.maxCycles,
  depth: limits.maxDepth,
  memory_ops: limits.maxMemoryOps,
  llm_calls: limits.maxLMCalls,
});

/** Bus vocabulary → trace vocabulary, per event: one sink, two spellings. */
type TraceProjection<K extends keyof BudgetEventMap> = (
  payload: BudgetEventMap[K]
) => DomainEventPayload;

const TRACE_PROJECTION: {
  [K in keyof BudgetEventMap]: TraceProjection<K>;
} = {
  'budget:slice:created': (p) => renameKeys(p),
  'budget:slice:consumed': (p) => renameKeys(p),
  'budget:slice:exhausted': (p) =>
    renameKeys({ ...p, consumed: toTraceConsumed(p.consumed), total: toTraceLimits(p.total) }),
  'budget:slice:merged': (p) => renameKeys({ ...p, consumed: toTraceConsumed(p.consumed) }),
};

/** The trace half of a budget event. A no-op until an exporter registers. */
export const announceBudgetTrace = <K extends keyof BudgetEventMap>(
  event: K,
  payload: BudgetEventMap[K]
): void => {
  if (!hasDomainEventSink()) return;
  emitDomainEvent(OTEL_EVENT[event], 'budget.slice', TRACE_PROJECTION[event](payload));
};
