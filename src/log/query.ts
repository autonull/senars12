/**
 * Log Query — flexible query engine for the event log.
 *
 * Provides a declarative query API for filtering, aggregating,
 * and transforming log events without full replay.
 */

import type { LogEntry, CognitiveEvent } from './events.js';
import type { LogStore } from './store.js';
import { isTaskAdmittedEvent, isDerivationAcceptedEvent, isGateEvent, isBudgetEvent, isProposalEvent } from './events.js';

/** Query filter operators. */
export type FilterOp =
  | { eq: unknown }
  | { neq: unknown }
  | { gt: number }
  | { gte: number }
  | { lt: number }
  | { lte: number }
  | { in: unknown[] }
  | { nin: unknown[] }
  | { contains: string }
  | { regex: string };

/** Field filter specification. */
export interface FieldFilter {
  field: string;
  op: FilterOp;
}

/** Compound filter (AND/OR). */
export interface CompoundFilter {
  and?: Filter[];
  or?: Filter[];
  not?: Filter;
}

export type Filter = FieldFilter | CompoundFilter;

/** Query projection: which fields to return. */
export interface Projection {
  fields?: string[];
  /** Transform function for each result. */
  map?: (entry: LogEntry) => unknown;
}

/** Query ordering. */
export interface OrderBy {
  field: string;
  direction: 'asc' | 'desc';
}

/** Query options. */
export interface QueryOptions {
  filter?: Filter;
  projection?: Projection;
  orderBy?: OrderBy[];
  limit?: number;
  offset?: number;
  /** Sequence range. */
  fromSeq?: number;
  toSeq?: number;
}

/** Query result. */
export interface QueryResult<T = LogEntry> {
  results: T[];
  total: number;
  hasMore: boolean;
  durationMs: number;
}

/** Aggregation operations. */
export type AggOp =
  | { count: true }
  | { sum: string }
  | { avg: string }
  | { min: string }
  | { max: string }
  | { distinct: string }
  | { histogram: { field: string; buckets: number[] } };

/** Aggregation query. */
export interface AggregationQuery {
  groupBy?: string[];
  aggregations: Record<string, AggOp>;
  filter?: Filter;
  fromSeq?: number;
  toSeq?: number;
}

/** Aggregation result. */
export interface AggregationResult {
  groups: Array<{ keys: Record<string, unknown>; values: Record<string, unknown> }>;
  total: number;
  durationMs: number;
}

/**
 * Evaluate a field filter against an entry.
 */
function evaluateFieldFilter(entry: LogEntry, filter: FieldFilter): boolean {
  const value = getFieldValue(entry, filter.field);
  const op = filter.op;

  if ('eq' in op) return value === op.eq;
  if ('neq' in op) return value !== op.neq;
  if ('gt' in op) return (value as number) > op.gt;
  if ('gte' in op) return (value as number) >= op.gte;
  if ('lt' in op) return (value as number) < op.lt;
  if ('lte' in op) return (value as number) <= op.lte;
  if ('in' in op) return op.in.includes(value);
  if ('nin' in op) return !op.nin.includes(value);
  if ('contains' in op) return String(value).includes(op.contains);
  if ('regex' in op) return new RegExp(op.regex).test(String(value));

  return true;
}

/**
 * Evaluate a compound filter.
 */
function evaluateCompoundFilter(entry: LogEntry, filter: CompoundFilter): boolean {
  if (filter.and) {
    return filter.and.every((f) => evaluateFilter(entry, f));
  }
  if (filter.or) {
    return filter.or.some((f) => evaluateFilter(entry, f));
  }
  if (filter.not) {
    return !evaluateFilter(entry, filter.not);
  }
  return true;
}

/**
 * Evaluate any filter.
 */
function evaluateFilter(entry: LogEntry, filter: Filter): boolean {
  if ('field' in filter) {
    return evaluateFieldFilter(entry, filter);
  }
  return evaluateCompoundFilter(entry, filter);
}

/**
 * Get a field value from a log entry using dot notation.
 */
function getFieldValue(entry: LogEntry, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = entry;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : 1;
  return String(a).localeCompare(String(b));
}

/**
 * Apply projection to an entry.
 */
function applyProjection(entry: LogEntry, projection?: Projection): unknown {
  if (!projection) return entry;

  if (projection.map) {
    return projection.map(entry);
  }

  if (!projection.fields || projection.fields.length === 0) {
    return entry;
  }

  const result: Record<string, unknown> = {};
  for (const field of projection.fields) {
    result[field] = getFieldValue(entry, field);
  }
  return result;
}

/**
 * Execute a query against the log store.
 */
export async function query(
  store: LogStore,
  options: QueryOptions = {}
): Promise<QueryResult> {
  const {
    filter,
    projection,
    orderBy,
    limit = 100,
    offset = 0,
    fromSeq = store.getFirstSeq(),
    toSeq = store.getLastSeq(),
  } = options;

  const startTime = Date.now();
  const results: LogEntry[] = [];
  let total = 0;

  for (let seq = fromSeq; seq <= toSeq; seq++) {
    const entry = await store.read(seq);
    if (!entry) continue;

    total++;

    if (filter && !evaluateFilter(entry, filter)) continue;

    if (results.length >= offset + limit) continue;

    if (results.length >= offset) {
      const projected = applyProjection(entry, projection);
      results.push(projected as LogEntry);
    }
  }

  // Sort if needed
  if (orderBy && orderBy.length > 0) {
    results.sort((a, b) => {
      for (const { field, direction } of orderBy) {
        const av = getFieldValue(a as LogEntry, field);
        const bv = getFieldValue(b as LogEntry, field);
        const cmp = compareValues(av, bv);
        if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }

  return {
    results,
    total,
    hasMore: results.length === limit && total > offset + limit,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Execute an aggregation query.
 */
export async function aggregate(
  store: LogStore,
  query: AggregationQuery
): Promise<AggregationResult> {
  const { groupBy = [], aggregations, filter, fromSeq = store.getFirstSeq(), toSeq = store.getLastSeq() } = query;

  const startTime = Date.now();
  const groups = new Map<string, Map<string, unknown[]>>();

  for (let seq = fromSeq; seq <= toSeq; seq++) {
    const entry = await store.read(seq);
    if (!entry) continue;
    if (filter && !evaluateFilter(entry, filter)) continue;

    // Build group key
    const keyParts = groupBy.map((field) => String(getFieldValue(entry, field)));
    const groupKey = keyParts.join('|');

    if (!groups.has(groupKey)) {
      groups.set(groupKey, new Map());
    }
    const group = groups.get(groupKey)!;

    // Collect values for each aggregation
    for (const [name, agg] of Object.entries(aggregations)) {
      if (!group.has(name)) group.set(name, []);

      if ('count' in agg) {
        group.get(name)!.push(1);
      } else if ('sum' in agg) {
        const value = getFieldValue(entry, agg.sum);
        if (typeof value === 'number') group.get(name)!.push(value);
      } else if ('avg' in agg) {
        const value = getFieldValue(entry, agg.avg);
        if (typeof value === 'number') group.get(name)!.push(value);
      } else if ('min' in agg) {
        const value = getFieldValue(entry, agg.min);
        if (typeof value === 'number') group.get(name)!.push(value);
      } else if ('max' in agg) {
        const value = getFieldValue(entry, agg.max);
        if (typeof value === 'number') group.get(name)!.push(value);
      } else if ('distinct' in agg) {
        const value = getFieldValue(entry, agg.distinct);
        if (value !== undefined) group.get(name)!.push(value);
      } else if ('histogram' in agg) {
        const value = getFieldValue(entry, agg.histogram.field);
        if (typeof value === 'number') group.get(name)!.push(value);
      }
    }
  }

  // Compute aggregations
  const resultGroups = Array.from(groups.entries()).map(([key, aggs]) => {
    const keys: Record<string, unknown> = {};
    const keyParts = key.split('|');
    groupBy.forEach((field, i) => { keys[field] = keyParts[i]; });

    const values: Record<string, unknown> = {};
    for (const [name, values_] of aggs) {
      const agg = aggregations[name];
      if (!agg) continue;
      const nums = values_.filter((v): v is number => typeof v === 'number');
      if ('count' in agg) {
        values[name] = values_.length;
      } else if ('sum' in agg) {
        values[name] = nums.reduce((a, b) => a + b, 0);
      } else if ('avg' in agg) {
        values[name] = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      } else if ('min' in agg) {
        values[name] = nums.length > 0 ? Math.min(...nums) : null;
      } else if ('max' in agg) {
        values[name] = nums.length > 0 ? Math.max(...nums) : null;
      } else if ('distinct' in agg) {
        values[name] = [...new Set(values_)].length;
      } else if ('histogram' in agg && agg.histogram.buckets) {
        const buckets = agg.histogram.buckets;
        const counts = new Array(buckets.length - 1).fill(0);
        for (const v of nums) {
          for (let i = 0; i < buckets.length - 1; i++) {
            if (v >= buckets[i] && v < buckets[i + 1]) {
              counts[i]++;
              break;
            }
          }
        }
        values[name] = counts;
      }
    }

    return { keys, values };
  });

  return {
    groups: resultGroups,
    total: resultGroups.length,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Convenience: query for TaskAdmitted events.
 */
export async function queryTasks(
  store: LogStore,
  options: { taskType?: CognitiveEvent['type']; limit?: number; fromSeq?: number } = {}
): Promise<QueryResult> {
  return query(store, {
    filter: { field: 'event.type', op: { eq: 'TaskAdmitted' } },
    projection: {
      fields: ['seq', 'ts', 'event.term', 'event.type', 'event.truth', 'event.source'],
    },
    orderBy: [{ field: 'ts', direction: 'desc' }],
    limit: options.limit ?? 50,
    fromSeq: options.fromSeq,
  });
}

/**
 * Convenience: query for DerivationAccepted events.
 */
export async function queryDerivations(
  store: LogStore,
  options: { ruleId?: string; limit?: number; fromSeq?: number } = {}
): Promise<QueryResult> {
  let filter: Filter = { field: 'event.type', op: { eq: 'derivation.accepted' } };
  if (options.ruleId) {
    filter = {
      and: [
        filter,
        { field: 'event.payload.ruleId', op: { eq: options.ruleId } },
      ],
    };
  }
  return query(store, {
    filter,
    projection: {
      fields: ['seq', 'ts', 'event.ruleId', 'event.premises', 'event.conclusion', 'event.truth'],
    },
    orderBy: [{ field: 'ts', direction: 'desc' }],
    limit: options.limit ?? 50,
    fromSeq: options.fromSeq,
  });
}

/**
 * Convenience: query for Gate events.
 */
export async function queryGates(
  store: LogStore,
  options: { gateName?: string; passed?: boolean; limit?: number; fromSeq?: number } = {}
): Promise<QueryResult> {
  const filters: Filter[] = [{ field: 'event.type', op: { in: ['GatePassed', 'GateFailed'] } }];
  if (options.gateName) {
    filters.push({ field: 'event.gateName', op: { eq: options.gateName } });
  }
  if (options.passed !== undefined) {
    filters.push({ field: 'event.type', op: { eq: options.passed ? 'GatePassed' : 'GateFailed' } });
  }
  return query(store, {
    filter: filters.length > 1 ? { and: filters } : filters[0],
    projection: {
      fields: ['seq', 'ts', 'event.gateName', 'event.type', 'event.input', 'event.output'],
    },
    orderBy: [{ field: 'ts', direction: 'desc' }],
    limit: options.limit ?? 50,
    fromSeq: options.fromSeq,
  });
}

/**
 * Convenience: query for Budget events.
 */
export async function queryBudgets(
  store: LogStore,
  options: { scope?: string; exhausted?: boolean; limit?: number; fromSeq?: number } = {}
): Promise<QueryResult> {
  const filters: Filter[] = [{ field: 'event.type', op: { in: ['BudgetConsumed', 'BudgetExhausted'] } }];
  if (options.scope) {
    filters.push({ field: 'event.scope', op: { eq: options.scope } });
  }
  if (options.exhausted !== undefined) {
    filters.push({ field: 'event.type', op: { eq: options.exhausted ? 'BudgetExhausted' : 'BudgetConsumed' } });
  }
  return query(store, {
    filter: filters.length > 1 ? { and: filters } : filters[0],
    projection: {
      fields: ['seq', 'ts', 'event.scope', 'event.type', 'event.consumed', 'event.remaining'],
    },
    orderBy: [{ field: 'ts', direction: 'desc' }],
    limit: options.limit ?? 50,
    fromSeq: options.fromSeq,
  });
}