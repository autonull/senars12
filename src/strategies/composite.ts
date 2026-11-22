/**
 * Generic Composite Strategy Pattern
 *
 * A reusable base for composing multiple strategies/selectors/samplers of the same type.
 * Each concrete composite defines how to combine results from its members.
 */

import { selectTopN } from '../util/collections';
import type { Term } from '../terms/index';

/** Common interface for any composable unit. */
export interface Composable<TInput, TOutput> {
  /** The operation that produces a result from input. */
  execute(input: TInput): TOutput;
  /** Optional metadata for identification. */
  readonly metadata?: { name: string; description: string };
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
export class CompositeBase<TInput, TItem, TResult> implements Composable<TInput, TResult> {
  readonly metadata: { name: string; description: string };

  constructor(
    private readonly members: Composable<TInput, TItem[]>[],
    private readonly combine: CombinationStrategy<TItem, TResult>,
    metadata: { name: string; description: string }
  ) {
    if (members.length === 0) {
      throw new Error('Composite requires at least one member');
    }
    this.metadata = metadata;
  }

  execute(input: TInput): TResult {
    const results = this.members.map((member) => {
      try {
        return member.execute(input);
      } catch (error) {
        console.warn(`Composite member ${member.metadata?.name} failed: ${error}`);
        return [] as TItem[];
      }
    });
    return this.combine(results.flat());
  }
}

/** A composite that concatenates all member results in order. */
export function createConcatenationComposite<TInput, TItem>(
  members: Composable<TInput, TItem[]>[],
  metadata: { name: string; description: string }
): CompositeBase<TInput, TItem, TItem[]> {
  const combine: CombinationStrategy<TItem, TItem[]> = (results: TItem[]) => results;
  return new CompositeBase(members, combine, metadata);
}

/**
 * Deduplicates items by a key, keeping the highest-scored item per key.
 * @param keyOf - Function to extract the deduplication key from an item
 * @param scoreOf - Function to score items for comparison
 */
export function createDedupeComposite<TInput, TItem, TKey>(
  members: Composable<TInput, TItem[]>[],
  keyOf: (item: TItem) => TKey,
  scoreOf: (item: TItem) => number,
  metadata: { name: string; description: string }
): CompositeBase<TInput, TItem, TItem[]> {
  const combine: CombinationStrategy<TItem, TItem[]> = (results: TItem[]): TItem[] => {
    const best = new Map<TKey, TItem>();
    for (const item of results) {
      const key = keyOf(item);
      const held = best.get(key);
      if (!held || scoreOf(item) > scoreOf(held)) best.set(key, item);
    }
    return [...best.values()];
  };
  return new CompositeBase(members, combine, metadata);
}

/**
 * Takes the union of all member results, deduplicates by key, and caps at maxCount.
 * @param keyOf - Function to extract the deduplication key from an item
 * @param scoreOf - Function to score items for ranking
 */
export function createCappedUnionComposite<TInput, TItem, TKey>(
  members: Composable<TInput, TItem[]>[],
  keyOf: (item: TItem) => TKey,
  scoreOf: (item: TItem) => number,
  maxCount: number,
  metadata: { name: string; description: string }
): CompositeBase<TInput, TItem, TItem[]> {
  const combine: CombinationStrategy<TItem, TItem[]> = (results: TItem[]): TItem[] => {
    const best = new Map<TKey, TItem>();
    for (const item of results) {
      const key = keyOf(item);
      const held = best.get(key);
      if (!held || scoreOf(item) > scoreOf(held)) best.set(key, item);
    }
    const deduped = [...best.values()];
    return selectTopN(deduped, maxCount, scoreOf);
  };
  return new CompositeBase(members, combine, metadata);
}

/** A composite that computes a weighted mean of numeric results from members. */
export function createWeightedMeanComposite<TInput>(
  members: Array<Composable<TInput, number> & { weight: number }>,
  metadata: { name: string; description: string }
): CompositeBase<TInput, number, number> {
  const totalWeight = members.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight <= 0) {
    throw new Error('Weighted composite requires at least one positive weight');
  }
  // We need to adapt the members to return number[] instead of number
  const adaptedMembers: Composable<TInput, number[]>[] = members.map((m) => ({
    ...m,
    execute: (input) => [m.execute(input)],
  }));
  const combine: CombinationStrategy<number, number> = (results: number[]): number => {
    const weightedSum = results.reduce((sum, val, i) => {
      const weight = members[i]?.weight ?? 0;
      return sum + val * weight;
    }, 0);
    return weightedSum / totalWeight;
  };
  return new CompositeBase(adaptedMembers, combine, metadata);
}

/** Convenience for term-keyed items (premise tasks, concepts). */
export function createDedupeByTerm<TInput, TItem extends { term: Term }>(
  members: Composable<TInput, TItem[]>[],
  scoreOf: (item: TItem) => number,
  metadata: { name: string; description: string }
): CompositeBase<TInput, TItem, TItem[]> {
  return createDedupeComposite(members, (item) => item.term, scoreOf, metadata);
}

/** Convenience for term-keyed items with a cap. */
export function createCappedUnionByTerm<TInput, TItem extends { term: Term }>(
  members: Composable<TInput, TItem[]>[],
  scoreOf: (item: TItem) => number,
  maxCount: number,
  metadata: { name: string; description: string }
): CompositeBase<TInput, TItem, TItem[]> {
  return createCappedUnionComposite(members, (item) => item.term, scoreOf, maxCount, metadata);
}