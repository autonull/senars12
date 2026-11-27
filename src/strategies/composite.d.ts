/**
 * Generic Composite Strategy Pattern
 *
 * A reusable base for composing multiple strategies/selectors/samplers of the same type.
 * Each concrete composite defines how to combine results from its members.
 */
import type { Term } from '../terms/index';
/** Common interface for any composable unit. */
export interface Composable<TInput, TOutput> {
    /** The operation that produces a result from input. */
    execute(input: TInput): TOutput;
    /** Optional metadata for identification. */
    readonly metadata?: {
        name: string;
        description: string;
    };
}
/** Combination strategy for composing results. */
export type CombinationStrategy<TItem, TResult> = (results: TItem[]) => TResult;
/**
 * Generic composite that delegates to member strategies and combines their results.
 *
 * @typeParam TInput - Input type passed to each member
 * @typeParam TItem - Individual item type in member results (array element type)
 * @typeParam TResult - Final combined result type
 */
export declare class CompositeBase<TInput, TItem, TResult> implements Composable<TInput, TResult> {
    private readonly members;
    private readonly combine;
    readonly metadata: {
        name: string;
        description: string;
    };
    constructor(members: Composable<TInput, TItem[]>[], combine: CombinationStrategy<TItem, TResult>, metadata: {
        name: string;
        description: string;
    });
    execute(input: TInput): TResult;
}
/** A composite that concatenates all member results in order. */
export declare function createConcatenationComposite<TInput, TItem>(members: Composable<TInput, TItem[]>[], metadata: {
    name: string;
    description: string;
}): CompositeBase<TInput, TItem, TItem[]>;
/**
 * Deduplicates items by a key, keeping the highest-scored item per key.
 * @param keyOf - Function to extract the deduplication key from an item
 * @param scoreOf - Function to score items for comparison
 */
export declare function createDedupeComposite<TInput, TItem, TKey>(members: Composable<TInput, TItem[]>[], keyOf: (item: TItem) => TKey, scoreOf: (item: TItem) => number, metadata: {
    name: string;
    description: string;
}): CompositeBase<TInput, TItem, TItem[]>;
/**
 * Takes the union of all member results, deduplicates by key, and caps at maxCount.
 * @param keyOf - Function to extract the deduplication key from an item
 * @param scoreOf - Function to score items for ranking
 */
export declare function createCappedUnionComposite<TInput, TItem, TKey>(members: Composable<TInput, TItem[]>[], keyOf: (item: TItem) => TKey, scoreOf: (item: TItem) => number, maxCount: number, metadata: {
    name: string;
    description: string;
}): CompositeBase<TInput, TItem, TItem[]>;
/** A composite that computes a weighted mean of numeric results from members. */
export declare function createWeightedMeanComposite<TInput>(members: Array<Composable<TInput, number> & {
    weight: number;
}>, metadata: {
    name: string;
    description: string;
}): CompositeBase<TInput, number, number>;
/** Convenience for term-keyed items (premise tasks, concepts). */
export declare function createDedupeByTerm<TInput, TItem extends {
    term: Term;
}>(members: Composable<TInput, TItem[]>[], scoreOf: (item: TItem) => number, metadata: {
    name: string;
    description: string;
}): CompositeBase<TInput, TItem, TItem[]>;
/** Convenience for term-keyed items with a cap. */
export declare function createCappedUnionByTerm<TInput, TItem extends {
    term: Term;
}>(members: Composable<TInput, TItem[]>[], scoreOf: (item: TItem) => number, maxCount: number, metadata: {
    name: string;
    description: string;
}): CompositeBase<TInput, TItem, TItem[]>;
//# sourceMappingURL=composite.d.ts.map