/**
 * AIKR Bag — the unified priority bag substrate.
 *
 * This is the single bag implementation used by every layer:
 * the NAR's attention bags, the focus bags, the drive bags,
 * the learning bags, the proposal bags, and the mining bags.
 * One substrate, one policy, one import.
 */
/** Histogram for tracking distributions. */
export interface Histogram {
    readonly edges: readonly number[];
    readonly counts: readonly number[];
    readonly total: number;
    readonly min: number;
    readonly max: number;
    readonly mean: number;
    /** Record a value. */
    record?(value: number): void;
    /** Get percentile. */
    percentile?(p: number): number;
    /** Clear the histogram. */
    clear?(): void;
}
/** The item a bag holds. */
export interface BagItem {
    readonly id: string;
    priority: number;
    readonly decayRate?: number;
    readonly forgetRate?: number;
    readonly stamp?: unknown;
}
/** Options to configure a bag instance. */
export interface BagOptions {
    /** Maximum items the bag holds. Required. */
    capacity: number;
    /** Called when pressure crosses a threshold (eviction, warning, etc.). */
    onPressure?: (transition: PressureTransition) => void;
    /** Clock for time-dependent policies. Defaults to system clock. */
    clock?: () => number;
    /** RNG for stochastic policies. Defaults to ambient. */
    rng?: RandomSource;
    /** Base decay rate for all items (per second). Defaults to 0. */
    decayRate?: number;
    /** Base forget rate for all items (per second). Defaults to 0. */
    forgetRate?: number;
    /** Unique bag identifier for events. Defaults to generated id. */
    id?: string;
    /** Eviction strategy when capacity is reached. Defaults to 'priority'. */
    evictStrategy?: EvictStrategy;
}
/** How the bag reacts when it is over capacity. */
export type EvictStrategy = 'priority' | 'fifo' | 'lru' | 'random';
/** Internal entry with bag-managed fields. */
export interface InternalEntry<T extends BagItem> extends BagItem {
    readonly _insertedAt: number;
    _lastAccessedAt: number;
    _accessCount: number;
    _currentPriority: number;
    /** The original item, preserving methods and non-enumerable properties. */
    readonly _item: T;
}
/** The pressure level the bag reports. */
export type PressureLevel = 'normal' | 'elevated' | 'critical';
/** A pressure transition event. */
export interface PressureTransition {
    bagId: string;
    pressure: PressureLevel;
    capacity: number;
    size: number;
    transition: 'normal->elevated' | 'elevated->critical' | 'critical->elevated' | 'elevated->normal';
}
/** Listener for pressure transitions. */
export type PressureListener = (transition: PressureTransition) => void;
/** A bag with cycle-oriented budget (focus, drives). */
export interface CyclesBudget {
    cycles: number;
    depth?: number;
}
import type { RandomSource } from './random';
/** Random source for bag operations (re-exported from random). */
export type { RandomSource };
/** The bag interface — what a bag is, not how it works. */
export interface Bag<T extends BagItem> {
    /** The bag's unique identifier. */
    readonly id: string;
    /** Current number of items. */
    readonly size: number;
    /** Configured capacity. */
    readonly capacity: number;
    /** Get current pressure level. */
    pressure(): PressureLevel;
    /** Base decay rate for all items (per second). */
    decayRateValue: number;
    /** Base forget rate for all items (per second). */
    forgetRateValue?: number;
    /** Add an item; returns false if eviction failed or item rejected. */
    add(item: T): boolean;
    /** Remove an item by id. */
    remove(id: string): boolean;
    /** Remove all items matching a predicate. */
    removeAll(predicate: (item: T) => boolean): number;
    /** Alias for removeAll. */
    removeMany(predicate: (item: T) => boolean): number;
    /** Get an item by id. */
    get(id: string): T | undefined;
    /** Get all items as array, sorted by priority descending. */
    all(): T[];
    /** Get all items as array (alias for all()). */
    toArray(): T[];
    /** Get all items as iterator. */
    values(): IterableIterator<T>;
    /** Iterate entries as [item, priority] pairs. */
    entries(): IterableIterator<[T, number]>;
    /** Update an item's priority. */
    updatePriority(id: string, priority: number): boolean;
    /** Set the eviction strategy. */
    setEvictStrategy(strategy: EvictStrategy): void;
    /** Evict one item using the given strategy (or current strategy if not provided). */
    evict(strategy?: EvictStrategy): boolean;
    /** Decay all priorities by the configured rate. */
    decay(): void;
    /** Sample items from the bag (priority-proportional). */
    sample(count: number): T[];
    /** Get the highest-priority item without removing it. */
    peek(): T | undefined;
    /** Find first item matching predicate. */
    find(predicate: (item: T) => boolean): T | undefined;
    /** Get the bag version (for synchronization). */
    readonly version: number;
    /** Register a pressure listener. */
    onPressure(listener: PressureListener): () => void;
    /** Clear all items. */
    clear(): void;
}
/** Bounded priority bag — the one implementation. */
export declare class PriorityBag<T extends BagItem> implements Bag<T> {
    #private;
    readonly id: string;
    readonly capacity: number;
    constructor(options: BagOptions);
    get size(): number;
    pressure(): PressureLevel;
    get version(): number;
    get decayRateValue(): number;
    set decayRateValue(value: number);
    get forgetRateValue(): number | undefined;
    set forgetRateValue(value: number | undefined);
    add(item: T): boolean;
    remove(id: string): boolean;
    removeAll(predicate: (item: T) => boolean): number;
    removeMany(predicate: (item: T) => boolean): number;
    get(id: string): T | undefined;
    all(): T[];
    values(): IterableIterator<T>;
    updatePriority(id: string, priority: number): boolean;
    setEvictStrategy(strategy: EvictStrategy): void;
    decay(): void;
    sample(count: number): T[];
    /** Get all items as array (alias for all()). */
    toArray(): T[];
    /** Iterate entries as [item, priority] pairs. */
    entries(): IterableIterator<[T, number]>;
    /** Get the highest-priority item without removing it. */
    peek(): T | undefined;
    /** Find first item matching predicate. */
    find(predicate: (item: T) => boolean): T | undefined;
    onPressure(listener: PressureListener): () => void;
    clear(): void;
    /** Evict one item using the given strategy (or current strategy if not provided). */
    evict(strategy?: EvictStrategy): boolean;
}
//# sourceMappingURL=bag.d.ts.map