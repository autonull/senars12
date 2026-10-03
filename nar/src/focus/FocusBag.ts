import { sumBy } from '@senars/util';
import type { BagOptions } from '../bag/Bag.js';
import { PriorityBag } from '../bag/Bag.js';
import { Focus, type FocusOptions } from './Focus.js';

export interface FocusBagOptions
  extends Pick<
    BagOptions,
    'capacity' | 'decayRate' | 'forgetRate' | 'rng' | 'implementation' | 'clock' | 'id'
  > {}

export interface SerializedFocusBag {
  weights: Record<string, number>;
  decayRate: number;
  capacity: number;
}

export class FocusBag extends PriorityBag<Focus> {
  constructor(options: FocusBagOptions) {
    super({
      capacity: options.capacity,
      decayRate: options.decayRate ?? 0.005,
      forgetRate: options.forgetRate,
      rng: options.rng,
      implementation: options.implementation,
      clock: options.clock,
      id: options.id,
    });
  }

  allocateBudget(focus: Focus, totalBudget: number): number {
    return allocateFocusBudget(focus, focusTotalWeight(this.all()), totalBudget);
  }

  getTotalWeight(): number {
    return focusTotalWeight(this.all());
  }

  getFocusWeights(): Map<string, number> {
    return focusWeightMap(this.all());
  }

  rebalanceWeights(targetWeights: Map<string, number>): void {
    for (const focus of this.all()) {
      const target = targetWeights.get(focus.id);
      if (target !== undefined) {
        focus.setWeight(target);
      }
    }
  }

  /** Serialize FocusBag weights for persistence */
  serialize(): SerializedFocusBag {
    const weights: Record<string, number> = {};
    for (const focus of this.all()) weights[focus.id] = focus.weight;
    return {
      weights,
      decayRate: this.decayRateValue,
      capacity: this.capacity,
    };
  }

  /** Deserialize FocusBag weights from persistence */
  deserialize(data: SerializedFocusBag): void {
    for (const [id, weight] of Object.entries(data.weights)) {
      const focus = this.find((f) => f.id === id);
      if (focus) {
        focus.setWeight(weight);
      }
    }
    this.decayRateValue = data.decayRate;
  }
}

export function createFocus(options: FocusOptions): Focus {
  return new Focus(options);
}

export const focusTotalWeight = (foci: Iterable<Focus>): number => sumBy(foci, (f) => f.weight);

export const allocateFocusBudget = (
  focus: Focus,
  totalWeight: number,
  totalBudget: number
): number =>
  totalWeight === 0 ? 0 : Math.floor((focus.weight / totalWeight) * totalBudget);

export const focusWeightMap = (foci: Iterable<Focus>): Map<string, number> => {
  const weights = new Map<string, number>();
  for (const focus of foci) weights.set(focus.id, focus.weight);
  return weights;
};
