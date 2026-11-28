import { type BudgetLimits, type BudgetResource, type ConsumedBudget } from './budget-resources';
import type { BudgetExhaustedEvent } from '../schemas/cognitive-events';
import type { ReasoningBudget, TerminationReason } from '../schemas/reasoning-budget';
import { zeroConsumed } from '../schemas/reasoning-budget';
import type { BudgetEventMap } from './budget-events';
import type { EventBus } from '@senars/events';
export type { BudgetExhaustedEvent, ReasoningBudget, TerminationReason, BudgetEventMap };
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
export declare const snapshotBudget: <T extends ReasoningBudget>(budget: T) => T;
/**
 * The same ceilings over unspent consumption — the counters at zero and no
 * termination reason, which is what "a fresh spend account for these limits"
 * means. The gate's per-scope cache and the scope table both wanted exactly
 * that and each spelled it out, so neither was obliged to remember the *reason*
 * half: a scope could inherit the base's reason and fail closed on a budget it
 * had never spent. `ceiling` overrides the one limit a scope spends in.
 */
export declare const freshBudget: <T extends ReasoningBudget>(budget: T, ceiling?: Partial<T>) => T;
/** The remaining-cycles view the bag and the tick pipeline both consume. */
export interface AIKRBudget {
    cycles: number;
    depth?: number;
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
export declare const createBudget: (limits: BudgetLimits) => ReasoningBudget;
export declare function createBudgetSlice(options: BudgetSliceOptions, eventBus?: BudgetEventBus): BudgetSlice;
export declare function sliceBudget(parent: BudgetSlice, childId: string, allocation: Partial<ConsumedBudget>, eventBus?: BudgetEventBus): BudgetSlice;
export * from './budget-resources';
/**
 * Each dimension's event-level name, re-exported from the schema that owns it —
 * it was declared here beside `BUDGET_RESOURCES`, which made two vocabularies for
 * one dimension: this key (`memoryOps`) and the schema's `budgetType` (`memory`),
 * with a `satisfies` that could only check one direction. A gate picking one by
 * hand could report `memory` for a charge against `cycles`. The table and its
 * zod enum now sit in `schemas/reasoning-budget`, where the consumed keys they
 * name are declared.
 */
export { BUDGET_TYPES, BudgetTypeSchema } from '../schemas/index';
/**
 * The four dimensions with their ceilings in one snapshot — the shape every
 * summary reports, so a caller cannot read a `max*` key the resource table does
 * not name.
 */
export declare const budgetLimitsOf: (budget: ReasoningBudget) => BudgetLimits;
/** One dimension's ceiling. */
export declare const budgetLimit: (budget: ReasoningBudget, resource: BudgetResource) => number;
/** Unconsumed capacity in one dimension; negative once a charge over-spent it. */
export declare const budgetRemaining: (budget: ReasoningBudget, resource: BudgetResource) => number;
/** Whether `amount` fits in what is left of one dimension — the single grant test. */
export declare const budgetAffords: (budget: ReasoningBudget, resource: BudgetResource, amount: number) => boolean;
/** Fraction of one dimension consumed, in `0..1`. An unlimited dimension is unpressured. */
export declare const budgetPressure: (budget: ReasoningBudget, resource: BudgetResource) => number;
/**
 * The reason a refused charge on `resource` raises: the dimension's own when it is
 * spent, `backpressure` when the charge simply did not fit in what was left.
 */
export declare const budgetRefusal: (budget: ReasoningBudget, resource: BudgetResource) => TerminationReason;
/** The one accumulation. Refusal is the caller's decision — a slice and a gate
 *  answer it from `budgetAffords` and then own their own event and policy. */
export declare const chargeBudget: (budget: ReasoningBudget, resource: BudgetResource, amount: number) => void;
/** A partial budget request across the four AIKR dimensions. */
export type BudgetAllocation = Partial<ConsumedBudget>;
/**
 * The four `budget:slice:*` payloads, built once.
 *
 * Exported because the budget gate emits the same four events about a plain
 * `ReasoningBudget` rather than a `BudgetSlice`, and had re-spelled all four —
 * including `budgetLimitsOf`'s four-key projection, written out twice more. A
 * payload the gate and the slice both hand-roll is a payload whose `total` can
 * disagree with the dimension table, and nothing downstream would report it.
 */
export declare const sliceCreatedPayload: (sliceId: string, parentId: string | undefined, limits: BudgetLimits) => BudgetEventMap['budget:slice:created'];
export declare const sliceConsumedPayload: (sliceId: string, resource: BudgetResource, amount: number, budget: ReasoningBudget) => BudgetEventMap['budget:slice:consumed'];
export declare const sliceExhaustedPayload: (sliceId: string, reason: TerminationReason, budget: ReasoningBudget) => BudgetEventMap['budget:slice:exhausted'];
export declare const sliceMergedPayload: (parentId: string, childId: string, child: ReasoningBudget) => BudgetEventMap['budget:slice:merged'];
/**
 * Charge `amount` to one budget dimension, or terminate the slice when the
 * charge would exceed its total. The single accounting path: exhaustion sets
 * the termination reason exactly once and reports the full consumed/total
 * snapshot; success accumulates and emits the resource-scoped event.
 */
export declare function consume(budget: BudgetSlice, resource: BudgetResource, amount: number, eventBus?: BudgetEventBus): boolean;
export declare const consumeCycles: (budget: BudgetSlice, cycles: number, eventBus?: BudgetEventBus) => boolean;
export declare const consumeDepth: (budget: BudgetSlice, depth: number, eventBus?: BudgetEventBus) => boolean;
export declare const consumeMemoryOps: (budget: BudgetSlice, ops: number, eventBus?: BudgetEventBus) => boolean;
export declare const consumeLMCalls: (budget: BudgetSlice, calls: number, eventBus?: BudgetEventBus) => boolean;
export declare const remainingCycles: (budget: BudgetSlice) => number;
/** All four remaining dimensions in one snapshot — the shape budget consumers hand around. */
export declare const remainingAll: (budget: BudgetSlice) => ConsumedBudget;
/**
 * Resolve a requested child allocation against the parent's unconsumed capacity
 * — the hard Σ(child) ≤ parent.remaining inheritance bound. `fallback` supplies
 * the per-dimension default for dimensions the caller left unset, so spawn
 * policies (proportional share, all-remaining) stay a one-liner.
 */
export declare function resolveAllocation(budget: BudgetSlice, requested?: BudgetAllocation, fallback?: (remaining: ConsumedBudget) => BudgetAllocation): Required<ConsumedBudget>;
/**
 * Charge a resolved allocation against a parent slice across all four
 * dimensions through the single `consume` accounting path, so the exhaustion
 * check and `budget:slice:consumed` event fire per dimension. Mutating
 * `budget.consumed` directly bypasses both.
 */
export declare function chargeAllocation(budget: BudgetSlice, allocation: BudgetAllocation, eventBus?: BudgetEventBus): void;
/**
 * Fold a child's consumed totals into a parent's. `depth` is a high-water mark
 * rather than a cumulative spend, so it merges by maximum; the rest are
 * additive. The single consumed-field merge for budget trees.
 */
export declare function mergeConsumed(parent: ConsumedBudget, child: ConsumedBudget): void;
export declare function mergeConsumption(parent: BudgetSlice, child: BudgetSlice, eventBus?: BudgetEventBus): void;
/**
 * Whether any dimension has nothing left. The one capacity test, so a gate and a
 * slice cannot answer it differently: the budget gate reads it over its own
 * `ReasoningBudget`, and a slice adds the three things a plain budget does not carry.
 */
export declare function isCapacityExhausted(budget: ReasoningBudget): boolean;
export declare function isExhausted(budget: BudgetSlice): boolean;
/** Worst per-dimension pressure — the slice's overall load. */
export declare function pressure(budget: BudgetSlice): number;
//# sourceMappingURL=budget.d.ts.map