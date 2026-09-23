import { PriorityBag } from '../bag/Bag.js';
import type { RandomSource } from '../types/primitives.js';
import { Focus, type FocusOptions } from './Focus.js';

export interface FocusBagOptions {
  capacity: number;
  decayRate?: number;
  /** TODO20 §5s: injectable RNG for deterministic focus selection. */
  rng?: RandomSource;
}

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
      rng: options.rng,
    });
  }

  allocateBudget(focus: Focus, totalBudget: number): number {
    const totalWeight = this.getTotalWeight();
    if (totalWeight === 0) return 0;
    return Math.floor((focus.weight / totalWeight) * totalBudget);
  }

  getTotalWeight(): number {
    let total = 0;
    for (const focus of this.all()) {
      total += focus.weight;
    }
    return total;
  }

  getFocusWeights(): Map<string, number> {
    const weights = new Map<string, number>();
    for (const focus of this.all()) {
      weights.set(focus.id, focus.weight);
    }
    return weights;
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
    for (const [id, weight] of this.getFocusWeights()) {
      weights[id] = weight;
    }
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
