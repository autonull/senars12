import {PriorityBag} from '../bag/Bag.js';
import {Focus, FocusOptions} from './Focus.js';

export interface FocusBagOptions {
  capacity: number;
  decayRate?: number;
}

export class FocusBag extends PriorityBag<Focus> {
  constructor(options: FocusBagOptions) {
    super({
      capacity: options.capacity,
      decayRate: options.decayRate ?? 0.005,
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
}

export function createFocus(options: FocusOptions): Focus {
  return new Focus(options);
}