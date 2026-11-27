import { PriorityBag } from '../bag/index';
import { Focus } from './Focus';
import { allocateFocusBudget, deserializeFocusWeights, focusTotalWeight, focusWeightMap, rebalanceFocusWeights, serializeFocusWeights, } from './weight-allocation';
export class FocusBag extends PriorityBag {
    constructor(options) {
        super({
            capacity: options.capacity,
            decayRate: options.decayRate ?? 0.005,
            forgetRate: options.forgetRate,
            rng: options.rng,
            clock: options.clock,
            id: options.id,
        });
    }
    allocateBudget(focus, totalBudget) {
        return allocateFocusBudget(focus, focusTotalWeight(this.all()), totalBudget);
    }
    getTotalWeight() {
        return focusTotalWeight(this.all());
    }
    getFocusWeights() {
        return focusWeightMap(this.all());
    }
    rebalanceWeights(targetWeights) {
        rebalanceFocusWeights(this.all(), targetWeights);
    }
    /** Serialize FocusBag weights for persistence */
    serialize() {
        return {
            weights: serializeFocusWeights(this.all()),
            decayRate: this.decayRateValue,
            capacity: this.capacity,
        };
    }
    /** Deserialize FocusBag weights from persistence */
    deserialize(data) {
        deserializeFocusWeights(this.all(), data.weights);
        this.decayRateValue = data.decayRate;
    }
}
export function createFocus(options) {
    return new Focus(options);
}
