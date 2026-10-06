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
 * `budget-otel.ts`, and the four dimensions both count in live in
 * `budget-resources.ts`; this module is the accounting and the typed bus.
 */
import { clamp, type EventBus, maxScore, occupancy } from '@senars/util';
import { announceBudgetTrace } from './budget-otel.js';
import {
  ALL_RESOURCES,
  BUDGET_RESOURCES,
  type BudgetLimits,
  type BudgetResource,
  type ConsumedBudget,
} from './budget-resources.js';
import type { BudgetExhaustedEvent, ReasoningBudget, TerminationReason } from './schemas/index.js';
import { zeroConsumed } from './schemas/index.js';

export type { BudgetExhaustedEvent, ReasoningBudget, TerminationReason };

export { zeroConsumed };

/**
 * A budget copied, consumption included.
 *
 * Three readers — a thread's snapshot, the gate's getter, a caller stashing the
 * budget for later — needed a value they could hold while the original kept
 * being charged, and each hand-rolled `{ ...budget, consumed: { ...consumed } }`.
 * The inner copy is the load-bearing half: without it the snapshot's counter
 * moves as the live budget is charged, so it is a snapshot of nothing.
 */
export const snapshotBudget = <T extends ReasoningBudget>(budget: T): T => ({
  ...budget,
  consumed: { ...budget.consumed },
});

/**
 * The same ceilings over unspent consumption — the counters at zero and no
 * termination reason, which is what "a fresh spend account for these limits"
 * means. The gate's per-scope cache and the scope table both wanted exactly
 * that and each spelled it out, so neither was obliged to remember the *reason*
 * half: a scope could inherit the base's reason and fail closed on a budget it
 * had never spent. `ceiling` overrides the one limit a scope spends in.
 */
export const freshBudget = <T extends ReasoningBudget>(budget: T, ceiling?: Partial<T>): T => ({
  ...budget,
  ...ceiling,
  consumed: zeroConsumed(),
  terminationReason: undefined,
});

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

/**
 * The one bus method `BudgetSlice` needs — a NAR `NarEventBus` satisfies it.
 *
 * Derived from {@link EventBus} rather than restated: the spelling was a second
 * declaration of `EventBus.emit`, so a change to the emit signature (the void
 * signal form, for instance) had to be made twice and the two could disagree.
 */
export type BudgetEventBus = Pick<EventBus<BudgetEventMap>, 'emit'>;

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
  consumed: zeroConsumed(),
});

/** Internal builder for BudgetSlice — shared by createBudgetSlice and sliceBudget. */
function buildBudgetSlice(
  id: string,
  parentId: string | undefined,
  limits: BudgetLimits,
  wallclockDeadlineMs?: number,
  abortSignal?: AbortSignal
): BudgetSlice {
  return {
    id,
    parentId,
    ...createBudget(limits),
    wallclockDeadlineMs,
    abortSignal,
  };
}

export function createBudgetSlice(
  options: BudgetSliceOptions,
  eventBus?: BudgetEventBus
): BudgetSlice {
  const { id, parentId, wallclockDeadlineMs, abortSignal, ...limits } = options;
  const slice = buildBudgetSlice(id, parentId, limits, wallclockDeadlineMs, abortSignal);
  announce('budget:slice:created', sliceAnnouncement(slice), eventBus);
  return slice;
}

export function sliceBudget(
  parent: BudgetSlice,
  childId: string,
  allocation: Partial<ConsumedBudget>,
  eventBus?: BudgetEventBus
): BudgetSlice {
  const limits: BudgetLimits = {
    maxCycles: allocation.cycles ?? parent.maxCycles - parent.consumed.cycles,
    maxDepth: allocation.depth ?? parent.maxDepth,
    maxMemoryOps: allocation.memoryOps ?? parent.maxMemoryOps - parent.consumed.memoryOps,
    maxLMCalls: allocation.llmCalls ?? parent.maxLMCalls - parent.consumed.llmCalls,
  };
  const slice = buildBudgetSlice(
    childId,
    parent.id,
    limits,
    parent.wallclockDeadlineMs,
    parent.abortSignal
  );
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

export * from './budget-resources.js';

/**
 * Each dimension's event-level name, re-exported from the schema that owns it —
 * it was declared here beside `BUDGET_RESOURCES`, which made two vocabularies for
 * one dimension: this key (`memoryOps`) and the schema's `budgetType` (`memory`),
 * with a `satisfies` that could only check one direction. A gate picking one by
 * hand could report `memory` for a charge against `cycles`. The table and its
 * zod enum now sit in `schemas/reasoning-budget`, where the consumed keys they
 * name are declared.
 */
export { BUDGET_TYPES, BudgetTypeSchema } from './schemas/index.js';

/**
 * The four dimensions with their ceilings in one snapshot — the shape every
 * summary reports, so a caller cannot read a `max*` key the resource table does
 * not name.
 */
export const budgetLimitsOf = (budget: ReasoningBudget): BudgetLimits => ({
  maxCycles: budget.maxCycles,
  maxDepth: budget.maxDepth,
  maxMemoryOps: budget.maxMemoryOps,
  maxLMCalls: budget.maxLMCalls,
});

/** One dimension's ceiling. */
export const budgetLimit = (budget: ReasoningBudget, resource: BudgetResource): number =>
  budget[BUDGET_RESOURCES[resource].total];

/** Unconsumed capacity in one dimension; negative once a charge over-spent it. */
export const budgetRemaining = (budget: ReasoningBudget, resource: BudgetResource): number =>
  budgetLimit(budget, resource) - budget.consumed[resource];

/** Whether `amount` fits in what is left of one dimension — the single grant test. */
export const budgetAffords = (
  budget: ReasoningBudget,
  resource: BudgetResource,
  amount: number
): boolean => budgetRemaining(budget, resource) >= amount;

/** Fraction of one dimension consumed, in `0..1`. An unlimited dimension is unpressured. */
export const budgetPressure = (budget: ReasoningBudget, resource: BudgetResource): number =>
  occupancy(budget.consumed[resource], budgetLimit(budget, resource), 0);

/**
 * The reason a refused charge on `resource` raises: the dimension's own when it is
 * spent, `backpressure` when the charge simply did not fit in what was left.
 */
export const budgetRefusal = (
  budget: ReasoningBudget,
  resource: BudgetResource
): TerminationReason =>
  budgetRemaining(budget, resource) <= 0 ? BUDGET_RESOURCES[resource].reason : 'backpressure';

/** The one accumulation. Refusal is the caller's decision — a slice and a gate
 *  answer it from `budgetAffords` and then own their own event and policy. */
export const chargeBudget = (
  budget: ReasoningBudget,
  resource: BudgetResource,
  amount: number
): void => {
  budget.consumed[resource] += amount;
};

/** A partial budget request across the four AIKR dimensions. */
export type BudgetAllocation = Partial<ConsumedBudget>;

/** Both slice constructors announce a new slice through this one payload builder. */
const sliceAnnouncement = (slice: BudgetSlice): BudgetEventMap['budget:slice:created'] => ({
  sliceId: slice.id,
  parentId: slice.parentId,
  ...budgetLimitsOf(slice),
});

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
  if (!budgetAffords(budget, resource, amount)) {
    const reason = budgetRefusal(budget, resource);
    budget.terminationReason = reason;
    const snapshot = {
      sliceId: budget.id,
      reason,
      consumed: { ...budget.consumed },
      total: budgetLimitsOf(budget),
    };
    announce('budget:slice:exhausted', snapshot, eventBus);
    return false;
  }
  chargeBudget(budget, resource, amount);
  const consumed = budget.consumed[resource];
  const payload = {
    sliceId: budget.id,
    resource,
    amount,
    consumed,
    total: budgetLimit(budget, resource),
    pressure: budgetPressure(budget, resource),
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
  clamp(budgetRemaining(budget, resource), 0, Number.POSITIVE_INFINITY);

export const remainingCycles = (budget: BudgetSlice): number => remainingOf(budget, 'cycles');

/** All four remaining dimensions in one snapshot — the shape budget consumers hand around. */
export const remainingAll = (budget: BudgetSlice): ConsumedBudget => {
  const remaining = {} as ConsumedBudget;
  for (const resource of ALL_RESOURCES) remaining[resource] = remainingOf(budget, resource);
  return remaining;
};

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

/**
 * Whether any dimension has nothing left. The one capacity test, so a gate and a
 * slice cannot answer it differently: the budget gate reads it over its own
 * `ReasoningBudget`, and a slice adds the three things a plain budget does not carry.
 */
export function isCapacityExhausted(budget: ReasoningBudget): boolean {
  return ALL_RESOURCES.some((resource) => budgetRemaining(budget, resource) <= 0);
}

export function isExhausted(budget: BudgetSlice): boolean {
  return (
    budget.terminationReason !== undefined ||
    isCapacityExhausted(budget) ||
    Boolean(budget.wallclockDeadlineMs && Date.now() > budget.wallclockDeadlineMs) ||
    Boolean(budget.abortSignal?.aborted)
  );
}

/** Worst per-dimension pressure — the slice's overall load. */
export function pressure(budget: BudgetSlice): number {
  return maxScore(ALL_RESOURCES, (resource) => budgetPressure(budget, resource));
}
