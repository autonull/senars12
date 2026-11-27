import { mapToRecord } from '@senars/util/collections';
import { safeRatio, sumBy } from '@senars/util/numeric';
/** Compute the total weight across all foci. */
export const focusTotalWeight = (foci) => sumBy(foci, (f) => f.weight);
/** Allocate budget to a focus proportionally to its weight. */
export const allocateFocusBudget = (focus, totalWeight, totalBudget) => Math.floor(safeRatio(focus.weight, totalWeight) * totalBudget);
/** Focus id to weight. The projection both containers are built from, so the
 *  in-memory view and the persisted one cannot name different weights. */
export const focusWeightEntries = (foci) => [...foci].map((focus) => [focus.id, focus.weight]);
/** Create a map of focus id to weight. */
export const focusWeightMap = (foci) => new Map(focusWeightEntries(foci));
/** Rebalance focus weights to match target weights. */
export const rebalanceFocusWeights = (foci, targetWeights) => {
    for (const focus of foci) {
        const target = targetWeights.get(focus.id);
        if (target !== undefined) {
            focus.setWeight(target);
        }
    }
};
/** Serialize focus weights for persistence. */
export const serializeFocusWeights = (foci) => mapToRecord(focusWeightEntries(foci));
/** Deserialize focus weights from persistence. */
export const deserializeFocusWeights = (foci, weights) => {
    for (const [id, weight] of Object.entries(weights)) {
        for (const focus of foci) {
            if (focus.id === id) {
                focus.setWeight(weight);
                break;
            }
        }
    }
};
