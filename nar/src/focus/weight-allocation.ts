import { sumBy } from '@senars/util';
import type { Focus } from './Focus.js';

/** Compute the total weight across all foci. */
export const focusTotalWeight = (foci: Iterable<Focus>): number =>
  sumBy(foci, (f) => f.weight);

/** Allocate budget to a focus proportionally to its weight. */
export const allocateFocusBudget = (
  focus: Focus,
  totalWeight: number,
  totalBudget: number
): number =>
  totalWeight === 0 ? 0 : Math.floor((focus.weight / totalWeight) * totalBudget);

/** Focus id to weight. The projection both containers are built from, so the
 *  in-memory view and the persisted one cannot name different weights. */
export const focusWeightEntries = (foci: Iterable<Focus>): [string, number][] =>
  [...foci].map((focus) => [focus.id, focus.weight]);

/** Create a map of focus id to weight. */
export const focusWeightMap = (foci: Iterable<Focus>): Map<string, number> =>
  new Map(focusWeightEntries(foci));

/** Rebalance focus weights to match target weights. */
export const rebalanceFocusWeights = (
  foci: Iterable<Focus>,
  targetWeights: Map<string, number>
): void => {
  for (const focus of foci) {
    const target = targetWeights.get(focus.id);
    if (target !== undefined) {
      focus.setWeight(target);
    }
  }
};

/** Serialize focus weights for persistence. */
export const serializeFocusWeights = (foci: Iterable<Focus>): Record<string, number> =>
  Object.fromEntries(focusWeightEntries(foci));

/** Deserialize focus weights from persistence. */
export const deserializeFocusWeights = (
  foci: Iterable<Focus>,
  weights: Record<string, number>
): void => {
  for (const [id, weight] of Object.entries(weights)) {
    for (const focus of foci) {
      if (focus.id === id) {
        focus.setWeight(weight);
        break;
      }
    }
  }
};