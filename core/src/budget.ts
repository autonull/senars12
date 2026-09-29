/**
 * Unified BudgetSlice — single budget object flowing from gate → thread → focus → bag → derivation.
 * AIKRBudget/ThreadScope become views onto this shared slice.
 *
 * Owns the budget event vocabulary as well as the accounting, so the otel
 * emitters in `nar` are reachable through the domain-event sink rather than
 * imported downward.
 */
import { clamp, clamp01, maxScore, pct } from '@senars/util';
import { emitDomainEvent, type DomainEventPayload } from './event-sink.js';
import type { TerminationReason } from './derivation-schemas.js';

export type { TerminationReason };

/** Budget slice consumed resources. */
export interface ConsumedBudget {
  cycles: number;
  depth: number;
  memoryOps: number;
  llmCalls: number;
}

/** Budget slice total resources. */
export interface BudgetSliceTotal {
  totalCycles: number;
  totalDepth: number;
  totalMemoryOps: number;
  totalLMCalls: number;
}

/** The remaining-cycles view the bag and the tick pipeline both consume. */
export interface AIKRBudget {
  cycles: number;
  depth?: number;
}

/** Every `budget:slice:*` payload, so a bus can be typed against this alone. */
export interface BudgetEventMap {
  'budget:slice:created': {
    sliceId: string;
    parentId?: string;
    totalCycles: number;
    totalDepth: number;
    totalMemoryOps: number;
    totalLMCalls: number;
  };
  'budget:slice:consumed': {
    sliceId: string;
    resource: keyof ConsumedBudget;
    amount: number;
    consumed: number;
    total: number;
    pressure: number;
  };
  'budget:slice:exhausted': {
    sliceId: string;
    reason: TerminationReason;
    consumed: ConsumedBudget;
    total: BudgetSliceTotal;
  };
  'budget:slice:merged': {
    parentId: string;
    childId: string;
    consumed: ConsumedBudget;
  };
}

/** The one bus method `BudgetSlice` needs — a NAR `NarEventBus` satisfies it. */
export interface BudgetEventBus {
  emit<K extends keyof BudgetEventMap>(eventName: K, payload: BudgetEventMap[K]): void;
}

export interface BudgetSlice {
  readonly id: string;
  readonly parentId?: string;
  readonly totalCycles: number;
  readonly totalDepth: number;
  readonly totalMemoryOps: number;
  readonly totalLMCalls: number;
  readonly wallclockDeadlineMs?: number;
  readonly abortSignal?: AbortSignal;
  terminationReason?: TerminationReason;
  consumed: ConsumedBudget;
}

export interface BudgetSliceOptions {
  id: string;
  parentId?: string;
  totalCycles: number;
  totalDepth: number;
  totalMemoryOps: number;
  totalLMCalls: number;
  wallclockDeadlineMs?: number;
  abortSignal?: AbortSignal;
}

export function createBudgetSlice(options: BudgetSliceOptions, eventBus?: BudgetEventBus): BudgetSlice {
  const slice: BudgetSlice = {
    id: options.id,
    parentId: options.parentId,
    totalCycles: options.totalCycles,
    totalDepth: options.totalDepth,
    totalMemoryOps: options.totalMemoryOps,
    totalLMCalls: options.totalLMCalls,
    wallclockDeadlineMs: options.wallclockDeadlineMs,
    abortSignal: options.abortSignal,
    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
  };
  announce('budget:slice:created', sliceAnnouncement(slice), eventBus);
  return slice;
}

export function sliceBudget(
  parent: BudgetSlice,
  childId: string,
  allocation: Partial<ConsumedBudget>,
  eventBus?: BudgetEventBus
): BudgetSlice {
  const slice: BudgetSlice = {
    id: childId,
    parentId: parent.id,
    totalCycles: allocation.cycles ?? parent.totalCycles - parent.consumed.cycles,
    totalDepth: allocation.depth ?? parent.totalDepth,
    totalMemoryOps: allocation.memoryOps ?? parent.totalMemoryOps - parent.consumed.memoryOps,
    totalLMCalls: allocation.llmCalls ?? parent.totalLMCalls - parent.consumed.llmCalls,
    wallclockDeadlineMs: parent.wallclockDeadlineMs,
    abortSignal: parent.abortSignal,
    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
  };
  announce('budget:slice:created', sliceAnnouncement(slice), eventBus);
  return slice;
}

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
  totalCycles: 'total_cycles',
  totalDepth: 'total_depth',
  totalMemoryOps: 'total_memory_ops',
  totalLMCalls: 'total_llm_calls',
};

const renameKeys = (payload: Record<string, unknown>): DomainEventPayload =>
  Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [OTEL_KEYS[key] ?? key, value])
  );

const toOtelConsumed = (consumed: ConsumedBudget): DomainEventPayload => ({
  cycles: consumed.cycles,
  depth: consumed.depth,
  memory_ops: consumed.memoryOps,
  llm_calls: consumed.llmCalls,
});

const toOtelTotal = (total: BudgetSliceTotal): DomainEventPayload => ({
  cycles: total.totalCycles,
  depth: total.totalDepth,
  memory_ops: total.totalMemoryOps,
  llm_calls: total.totalLMCalls,
});

/** Bus vocabulary → trace vocabulary, per event: one sink, two spellings. */
type OtelProjection<K extends keyof BudgetEventMap> = (
  payload: BudgetEventMap[K]
) => DomainEventPayload;

const OTEL_PROJECTION: {
  [K in keyof BudgetEventMap]: OtelProjection<K>;
} = {
  'budget:slice:created': (p) => renameKeys(p),
  'budget:slice:consumed': (p) => renameKeys(p),
  'budget:slice:exhausted': (p) =>
    renameKeys({ ...p, consumed: toOtelConsumed(p.consumed), total: toOtelTotal(p.total) }),
  'budget:slice:merged': (p) => renameKeys({ ...p, consumed: toOtelConsumed(p.consumed) }),
};

/** One budget event, two vocabularies: the typed bus and the trace sink. */
function announce<K extends keyof BudgetEventMap>(
  event: K,
  payload: BudgetEventMap[K],
  eventBus?: BudgetEventBus
): void {
  eventBus?.emit(event, payload);
  emitDomainEvent(OTEL_EVENT[event], 'budget.slice', OTEL_PROJECTION[event](payload));
}

/** The four AIKR dimensions, each with its consumed key, total key, and exhaustion reason. */
const RESOURCES = {
  cycles: { total: 'totalCycles', reason: 'cycle-budget' },
  depth: { total: 'totalDepth', reason: 'depth-budget' },
  memoryOps: { total: 'totalMemoryOps', reason: 'memory-budget' },
  llmCalls: { total: 'totalLMCalls', reason: 'llm-budget' },
} as const satisfies Record<
  keyof ConsumedBudget,
  { total: keyof BudgetSliceTotal; reason: TerminationReason }
>;

type BudgetResource = keyof typeof RESOURCES;

const ALL_RESOURCES = Object.keys(RESOURCES) as BudgetResource[];

/** A partial budget request across the four AIKR dimensions. */
export type BudgetAllocation = Partial<ConsumedBudget>;

/** Both slice constructors announce a new slice through this one payload builder. */
const sliceAnnouncement = (
  slice: BudgetSlice
): BudgetEventMap['budget:slice:created'] => ({
  sliceId: slice.id,
  parentId: slice.parentId,
  totalCycles: slice.totalCycles,
  totalDepth: slice.totalDepth,
  totalMemoryOps: slice.totalMemoryOps,
  totalLMCalls: slice.totalLMCalls,
});

const totalsOf = (budget: BudgetSlice): { -readonly [K in keyof BudgetSliceTotal]: number } => ({
  totalCycles: budget.totalCycles,
  totalDepth: budget.totalDepth,
  totalMemoryOps: budget.totalMemoryOps,
  totalLMCalls: budget.totalLMCalls,
});

const totalOf = (budget: BudgetSlice, resource: BudgetResource): number =>
  budget[RESOURCES[resource].total];

/**
 * Fraction of one dimension consumed, in `0..1`. A zero total means the
 * dimension is *unlimited*, not unbounded-and-full, so it reports 0; the clamp
 * is there because a slice may be constructed with pre-consumed values, and
 * `pressure` promises its callers a ratio.
 */
const pressureOf = (budget: BudgetSlice, resource: BudgetResource): number => {
  const total = totalOf(budget, resource);
  return total > 0 ? clamp01(budget.consumed[resource] / total) : 0;
};

/**
 * Charge `amount` to one budget dimension, or terminate the slice when the
 * charge would exceed its total. The single accounting path: exhaustion sets
 * the termination reason exactly once and reports the full consumed/total
 * snapshot; success accumulates and emits the resource-scoped event.
 */
function consume(
  budget: BudgetSlice,
  resource: BudgetResource,
  amount: number,
  eventBus?: BudgetEventBus
): boolean {
  const { reason } = RESOURCES[resource];
  const total = totalOf(budget, resource);
  if (budget.consumed[resource] + amount > total) {
    budget.terminationReason = reason;
    const snapshot = { sliceId: budget.id, reason, consumed: { ...budget.consumed }, total: totalsOf(budget) };
    announce('budget:slice:exhausted', snapshot, eventBus);
    return false;
  }
  budget.consumed[resource] += amount;
  const consumed = budget.consumed[resource];
  const payload = {
    sliceId: budget.id,
    resource,
    amount,
    consumed,
    total,
    pressure: pressureOf(budget, resource),
  };
  announce('budget:slice:consumed', payload, eventBus);
  return true;
}

export const consumeCycles = (budget: BudgetSlice, cycles: number, eventBus?: BudgetEventBus): boolean =>
  consume(budget, 'cycles', cycles, eventBus);

export const consumeDepth = (budget: BudgetSlice, depth: number, eventBus?: BudgetEventBus): boolean =>
  consume(budget, 'depth', depth, eventBus);

export const consumeMemoryOps = (budget: BudgetSlice, ops: number, eventBus?: BudgetEventBus): boolean =>
  consume(budget, 'memoryOps', ops, eventBus);

export const consumeLMCalls = (budget: BudgetSlice, calls: number, eventBus?: BudgetEventBus): boolean =>
  consume(budget, 'llmCalls', calls, eventBus);

export function checkDeadline(budget: BudgetSlice): boolean {
  if (budget.wallclockDeadlineMs && Date.now() > budget.wallclockDeadlineMs) {
    budget.terminationReason = 'deadline';
    return false;
  }
  return true;
}

export function checkAbort(budget: BudgetSlice): boolean {
  if (budget.abortSignal?.aborted) {
    budget.terminationReason = 'aborted';
    return false;
  }
  return true;
}

/** Unconsumed capacity in one dimension, floored at zero. */
const remainingOf = (budget: BudgetSlice, resource: BudgetResource): number =>
  clamp(totalOf(budget, resource) - budget.consumed[resource], 0, Number.POSITIVE_INFINITY);

export const remainingCycles = (budget: BudgetSlice): number => remainingOf(budget, 'cycles');

export const remainingDepth = (budget: BudgetSlice): number => remainingOf(budget, 'depth');

export const remainingMemoryOps = (budget: BudgetSlice): number => remainingOf(budget, 'memoryOps');

export const remainingLMCalls = (budget: BudgetSlice): number => remainingOf(budget, 'llmCalls');

/** All four remaining dimensions in one snapshot — the shape budget consumers hand around. */
export const remainingAll = (budget: BudgetSlice): ConsumedBudget => ({
  cycles: remainingCycles(budget),
  depth: remainingDepth(budget),
  memoryOps: remainingMemoryOps(budget),
  llmCalls: remainingLMCalls(budget),
});

/**
 * Resolve a requested child allocation against the parent's unconsumed capacity
 * — the hard Σ(child) ≤ parent.remaining inheritance bound. `fallback` supplies
 * the per-dimension default for dimensions the caller left unset, so spawn
 * policies (proportional share, all-remaining) stay a one-liner.
 */
export function resolveAllocation(
  budget: BudgetSlice,
  requested: BudgetAllocation = {},
  fallback: (remaining: ConsumedBudget) => BudgetAllocation = () => ({})
): Required<ConsumedBudget> {
  const remaining = remainingAll(budget);
  const defaults = fallback(remaining);
  const resolved = {} as Required<ConsumedBudget>;
  for (const resource of ALL_RESOURCES) {
    resolved[resource] = Math.min(requested[resource] ?? defaults[resource] ?? 0, remaining[resource]);
  }
  return resolved;
}

/**
 * Charge a resolved allocation against a parent slice across all four
 * dimensions through the single `consume` accounting path, so the exhaustion
 * check and `budget:slice:consumed` event fire per dimension. Mutating
 * `budget.consumed` directly bypasses both.
 */
export function chargeAllocation(
  budget: BudgetSlice,
  allocation: BudgetAllocation,
  eventBus?: BudgetEventBus
): void {
  for (const resource of ALL_RESOURCES) {
    const amount = allocation[resource] ?? 0;
    if (amount > 0) consume(budget, resource, amount, eventBus);
  }
}

export function toAIKRBudget(budget: BudgetSlice): AIKRBudget {
  return {
    cycles: remainingCycles(budget),
    depth: remainingDepth(budget) || undefined,
  };
}

/**
 * Fold a child's consumed totals into a parent's. `depth` is a high-water mark
 * rather than a cumulative spend, so it merges by maximum; the rest are
 * additive. The single consumed-field merge for budget trees.
 */
export function mergeConsumed(parent: ConsumedBudget, child: ConsumedBudget): void {
  for (const resource of ALL_RESOURCES) {
    parent[resource] =
      resource === 'depth' ? Math.max(parent[resource], child[resource]) : parent[resource] + child[resource];
  }
}

export function mergeConsumption(parent: BudgetSlice, child: BudgetSlice, eventBus?: BudgetEventBus): void {
  mergeConsumed(parent.consumed, child.consumed);
  if (child.terminationReason && !parent.terminationReason) {
    parent.terminationReason = child.terminationReason;
  }
  announce(
    'budget:slice:merged',
    { parentId: parent.id, childId: child.id, consumed: { ...child.consumed } },
    eventBus
  );
}

export function isExhausted(budget: BudgetSlice): boolean {
  return (
    budget.terminationReason !== undefined ||
    ALL_RESOURCES.some((resource) => budget.consumed[resource] >= totalOf(budget, resource)) ||
    Boolean(budget.wallclockDeadlineMs && Date.now() > budget.wallclockDeadlineMs) ||
    Boolean(budget.abortSignal?.aborted)
  );
}

/** Worst per-dimension pressure — the slice's overall load. */
export function pressure(budget: BudgetSlice): number {
  return maxScore(ALL_RESOURCES, (resource) => pressureOf(budget, resource));
}

/** Collect all budget slices in a tree starting from root. */
export function collectBudgetSlices(root: BudgetSlice, allSlices: Map<string, BudgetSlice> = new Map()): Map<string, BudgetSlice> {
  allSlices.set(root.id, root);
  // Note: In practice, child slices would need to be tracked via a registry
  // This is a placeholder for the CLI --budget command
  return allSlices;
}

/** Format budget slice tree for CLI output. */
export function formatBudgetSliceTree(slices: Map<string, BudgetSlice>): string {
  if (slices.size === 0) return 'No budget slices tracked';
  const lines: string[] = ['Budget Slice Tree:'];
  for (const [id, slice] of slices) {
    const parent = slice.parentId ? ` (parent: ${slice.parentId})` : ' (root)';
    const util = pct(slice.totalCycles > 0 ? slice.consumed.cycles / slice.totalCycles : 0);
    lines.push(
      `  ${id}${parent}: cycles=${slice.consumed.cycles}/${slice.totalCycles} (${util}), pressure=${pct(pressure(slice))}`
    );
    if (slice.terminationReason) {
      lines.push(`    TERMINATED: ${slice.terminationReason}`);
    }
  }
  return lines.join('\n');
}