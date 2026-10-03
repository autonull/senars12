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

/** Create a map of focus id to weight. */
export const focusWeightMap = (foci: Iterable<Focus>): Map<string, number> => {
  const weights = new Map<string, number>();
  for (const focus of foci) weights.set(focus.id, focus.weight);
  return weights;
};

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
export const serializeFocusWeights = (foci: Iterable<Focus>): Record<string, number> => {
  const weights: Record<string, number> = {};
  for (const focus of foci) weights[focus.id] = focus.weight;
  return weights;
};

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