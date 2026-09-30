/**
 * The one budget object — gate → thread → focus → bag → derivation all pass the
 * same `ReasoningBudget`, and a `BudgetSlice` is that budget plus the parent
 * identity the thread tree needs. `AIKRBudget`/`ThreadScope` are views onto it.
 *
 * `ReasoningBudget` is the kernel's validated form (the one the event log and
 * every derivation record carry), so the slice field names are the schema's
 * `max*` names rather than a second vocabulary: an unvalidated `BudgetSlice` is
 * structurally assignable to `ReasoningBudget` with no rename step.
 *
 * Owns the budget event vocabulary as well as the accounting, so the otel
 * emitters in `nar` are reachable through the domain-event sink rather than
 * imported downward. The trace-vocabulary half of that announcement lives in
 * `budget-otel.ts`; this module is the accounting and the typed bus.
 */
import { clamp, maxScore, occupancy } from '@senars/util';
import { announceBudgetTrace } from './budget-otel.js';
import type { ReasoningBudget, TerminationReason } from './schemas/index.js';

export type { ReasoningBudget, TerminationReason };

/** Budget slice consumed resources. */
export type ConsumedBudget = ReasoningBudget['consumed'];

/** The four AIKR dimensions a budget is limited in — its whole ceiling. */
export type BudgetLimits = Pick<
  ReasoningBudget,
  'maxCycles' | 'maxDepth' | 'maxMemoryOps' | 'maxLMCalls'
>;

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
    maxCycles: number;
    maxDepth: number;
    maxMemoryOps: number;
    maxLMCalls: number;
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
    total: BudgetLimits;
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

/** A budget plus the slice identity that threads and focus nodes are keyed by. */
export interface BudgetSlice extends ReasoningBudget {
  readonly id: string;
  readonly parentId?: string;
  readonly abortSignal?: AbortSignal;
}

export type BudgetSliceOptions = BudgetLimits & {
  id: string;
  parentId?: string;
  wallclockDeadlineMs?: number;
  abortSignal?: AbortSignal;
};

/**
 * The one budget constructor. Every ceiling in the system — the gate's default,
 * a System One pass, a focus child — is `createBudget(limits)` over its own
 * limit table, so none of them can drift on the `consumed` reset.
 */
export const createBudget = (limits: BudgetLimits): ReasoningBudget => ({
  ...limits,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
});

export function createBudgetSlice(
  options: BudgetSliceOptions,
  eventBus?: BudgetEventBus
): BudgetSlice {
  const { id, parentId, ...limits } = options;
  const slice: BudgetSlice = {
    id,
    parentId,
    ...createBudget(limits),
    wallclockDeadlineMs: options.wallclockDeadlineMs,
    abortSignal: options.abortSignal,
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
    ...createBudget({
      maxCycles: allocation.cycles ?? parent.maxCycles - parent.consumed.cycles,
      maxDepth: allocation.depth ?? parent.maxDepth,
      maxMemoryOps: allocation.memoryOps ?? parent.maxMemoryOps - parent.consumed.memoryOps,
      maxLMCalls: allocation.llmCalls ?? parent.maxLMCalls - parent.consumed.llmCalls,
    }),
    wallclockDeadlineMs: parent.wallclockDeadlineMs,
    abortSignal: parent.abortSignal,
  };
  announce('budget:slice:created', sliceAnnouncement(slice), eventBus);
  return slice;
}

/** One budget event, two vocabularies: the typed bus, and the trace sink. */
function announce<K extends keyof BudgetEventMap>(
  event: K,
  payload: BudgetEventMap[K],
  eventBus?: BudgetEventBus
): void {
  eventBus?.emit(event, payload);
  announceBudgetTrace(event, payload);
}

/** The four AIKR dimensions, each with its consumed key, total key, and exhaustion reason. */
const RESOURCES = {
  cycles: { total: 'maxCycles', reason: 'cycle-budget' },
  depth: { total: 'maxDepth', reason: 'depth-budget' },
  memoryOps: { total: 'maxMemoryOps', reason: 'memory-budget' },
  llmCalls: { total: 'maxLMCalls', reason: 'llm-budget' },
} as const satisfies Record<
  keyof ConsumedBudget,
  { total: keyof BudgetLimits; reason: TerminationReason }
>;

type BudgetResource = keyof typeof RESOURCES;

const ALL_RESOURCES = Object.keys(RESOURCES) as BudgetResource[];

/** A partial budget request across the four AIKR dimensions. */
export type BudgetAllocation = Partial<ConsumedBudget>;

/** Both slice constructors announce a new slice through this one payload builder. */
const sliceAnnouncement = (slice: BudgetSlice): BudgetEventMap['budget:slice:created'] => ({
  sliceId: slice.id,
  parentId: slice.parentId,
  maxCycles: slice.maxCycles,
  maxDepth: slice.maxDepth,
  maxMemoryOps: slice.maxMemoryOps,
  maxLMCalls: slice.maxLMCalls,
});

const limitsOf = (budget: BudgetSlice): BudgetLimits => ({
  maxCycles: budget.maxCycles,
  maxDepth: budget.maxDepth,
  maxMemoryOps: budget.maxMemoryOps,
  maxLMCalls: budget.maxLMCalls,
});

const totalOf = (budget: BudgetSlice, resource: BudgetResource): number =>
  budget[RESOURCES[resource].total];

/** Fraction of one dimension consumed, in `0..1`. An unlimited dimension is unpressured. */
const pressureOf = (budget: BudgetSlice, resource: BudgetResource): number =>
  occupancy(budget.consumed[resource], totalOf(budget, resource), 0);

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
    const snapshot = {
      sliceId: budget.id,
      reason,
      consumed: { ...budget.consumed },
      total: limitsOf(budget),
    };
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

export const consumeCycles = (
  budget: BudgetSlice,
  cycles: number,
  eventBus?: BudgetEventBus
): boolean => consume(budget, 'cycles', cycles, eventBus);

export const consumeDepth = (
  budget: BudgetSlice,
  depth: number,
  eventBus?: BudgetEventBus
): boolean => consume(budget, 'depth', depth, eventBus);

export const consumeMemoryOps = (
  budget: BudgetSlice,
  ops: number,
  eventBus?: BudgetEventBus
): boolean => consume(budget, 'memoryOps', ops, eventBus);

export const consumeLMCalls = (
  budget: BudgetSlice,
  calls: number,
  eventBus?: BudgetEventBus
): boolean => consume(budget, 'llmCalls', calls, eventBus);

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
    resolved[resource] = Math.min(
      requested[resource] ?? defaults[resource] ?? 0,
      remaining[resource]
    );
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

/**
 * Fold a child's consumed totals into a parent's. `depth` is a high-water mark
 * rather than a cumulative spend, so it merges by maximum; the rest are
 * additive. The single consumed-field merge for budget trees.
 */
export function mergeConsumed(parent: ConsumedBudget, child: ConsumedBudget): void {
  for (const resource of ALL_RESOURCES) {
    parent[resource] =
      resource === 'depth'
        ? Math.max(parent[resource], child[resource])
        : parent[resource] + child[resource];
  }
}

export function mergeConsumption(
  parent: BudgetSlice,
  child: BudgetSlice,
  eventBus?: BudgetEventBus
): void {
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
