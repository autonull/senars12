import type { Focus } from './Focus';
/** Compute the total weight across all foci. */
export declare const focusTotalWeight: (foci: Iterable<Focus>) => number;
/** Allocate budget to a focus proportionally to its weight. */
export declare const allocateFocusBudget: (focus: Focus, totalWeight: number, totalBudget: number) => number;
/** Focus id to weight. The projection both containers are built from, so the
 *  in-memory view and the persisted one cannot name different weights. */
export declare const focusWeightEntries: (foci: Iterable<Focus>) => [string, number][];
/** Create a map of focus id to weight. */
export declare const focusWeightMap: (foci: Iterable<Focus>) => Map<string, number>;
/** Rebalance focus weights to match target weights. */
export declare const rebalanceFocusWeights: (foci: Iterable<Focus>, targetWeights: Map<string, number>) => void;
/** Serialize focus weights for persistence. */
export declare const serializeFocusWeights: (foci: Iterable<Focus>) => Record<string, number>;
/** Deserialize focus weights from persistence. */
export declare const deserializeFocusWeights: (foci: Iterable<Focus>, weights: Record<string, number>) => void;
//# sourceMappingURL=weight-allocation.d.ts.map