import type { BagOptions } from '../bag/Bag.js';
import { PriorityBag } from '../bag/Bag.js';
import { Focus, type FocusOptions } from './Focus.js';
import {
  focusTotalWeight,
  allocateFocusBudget,
  focusWeightMap,
  rebalanceFocusWeights,
  serializeFocusWeights,
  deserializeFocusWeights,
} from './weight-allocation.js';

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
    rebalanceFocusWeights(this.all(), targetWeights);
  }

  /** Serialize FocusBag weights for persistence */
  serialize(): SerializedFocusBag {
    return {
      weights: serializeFocusWeights(this.all()),
      decayRate: this.decayRateValue,
      capacity: this.capacity,
    };
  }

  /** Deserialize FocusBag weights from persistence */
  deserialize(data: SerializedFocusBag): void {
    deserializeFocusWeights(this.all(), data.weights);
    this.decayRateValue = data.decayRate;
  }
}

export function createFocus(options: FocusOptions): Focus {
  return new Focus(options);
}
