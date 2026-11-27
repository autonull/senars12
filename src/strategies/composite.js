/**
 * Generic Composite Strategy Pattern
 *
 * A reusable base for composing multiple strategies/selectors/samplers of the same type.
 * Each concrete composite defines how to combine results from its members.
 */
import { selectTopN } from '../util/collections';
import { createLogger } from '../util/logger';
import { SenarsError } from '../errors/senars-error';
const logger = createLogger({ scope: 'strategies:composite' });
/**
 * Generic composite that delegates to member strategies and combines their results.
 *
 * @typeParam TInput - Input type passed to each member
 * @typeParam TItem - Individual item type in member results (array element type)
 * @typeParam TResult - Final combined result type
 */
export class CompositeBase {
    members;
    combine;
    metadata;
    constructor(members, combine, metadata) {
        this.members = members;
        this.combine = combine;
        if (members.length === 0) {
            throw new SenarsError('Composite requires at least one member', 'VALIDATION_ERROR');
        }
        this.metadata = metadata;
    }
    execute(input) {
        const results = this.members.map((member) => {
            try {
                return member.execute(input);
            }
            catch (error) {
                logger.warn('composite member failed', {
                    member: member.metadata?.name,
                    error: error instanceof Error ? error.message : String(error),
                });
                return [];
            }
        });
        return this.combine(results.flat());
    }
}
/** A composite that concatenates all member results in order. */
export function createConcatenationComposite(members, metadata) {
    const combine = (results) => results;
    return new CompositeBase(members, combine, metadata);
}
/**
 * Deduplicates items by a key, keeping the highest-scored item per key.
 * @param keyOf - Function to extract the deduplication key from an item
 * @param scoreOf - Function to score items for comparison
 */
export function createDedupeComposite(members, keyOf, scoreOf, metadata) {
    const combine = (results) => {
        const best = new Map();
        for (const item of results) {
            const key = keyOf(item);
            const held = best.get(key);
            if (!held || scoreOf(item) > scoreOf(held))
                best.set(key, item);
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
export function createCappedUnionComposite(members, keyOf, scoreOf, maxCount, metadata) {
    const combine = (results) => {
        const best = new Map();
        for (const item of results) {
            const key = keyOf(item);
            const held = best.get(key);
            if (!held || scoreOf(item) > scoreOf(held))
                best.set(key, item);
        }
        const deduped = [...best.values()];
        return selectTopN(deduped, maxCount, scoreOf);
    };
    return new CompositeBase(members, combine, metadata);
}
/** A composite that computes a weighted mean of numeric results from members. */
export function createWeightedMeanComposite(members, metadata) {
    const totalWeight = members.reduce((sum, m) => sum + m.weight, 0);
    if (totalWeight <= 0) {
        throw new SenarsError('Weighted composite requires at least one positive weight', 'VALIDATION_ERROR');
    }
    // We need to adapt the members to return number[] instead of number
    const adaptedMembers = members.map((m) => ({
        ...m,
        execute: (input) => [m.execute(input)],
    }));
    const combine = (results) => {
        const weightedSum = results.reduce((sum, val, i) => {
            const weight = members[i]?.weight ?? 0;
            return sum + val * weight;
        }, 0);
        return weightedSum / totalWeight;
    };
    return new CompositeBase(adaptedMembers, combine, metadata);
}
/** Convenience for term-keyed items (premise tasks, concepts). */
export function createDedupeByTerm(members, scoreOf, metadata) {
    return createDedupeComposite(members, (item) => item.term, scoreOf, metadata);
}
/** Convenience for term-keyed items with a cap. */
export function createCappedUnionByTerm(members, scoreOf, maxCount, metadata) {
    return createCappedUnionComposite(members, (item) => item.term, scoreOf, maxCount, metadata);
}
