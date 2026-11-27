import type { BagOptions } from '../bag/index';
import { PriorityBag } from '../bag/index';
import { Focus, type FocusOptions } from './Focus';
export interface FocusBagOptions extends Pick<BagOptions, 'capacity' | 'decayRate' | 'forgetRate' | 'rng' | 'clock' | 'id'> {
}
export interface SerializedFocusBag {
    weights: Record<string, number>;
    decayRate: number;
    capacity: number;
}
export declare class FocusBag extends PriorityBag<Focus> {
    constructor(options: FocusBagOptions);
    allocateBudget(focus: Focus, totalBudget: number): number;
    getTotalWeight(): number;
    getFocusWeights(): Map<string, number>;
    rebalanceWeights(targetWeights: Map<string, number>): void;
    /** Serialize FocusBag weights for persistence */
    serialize(): SerializedFocusBag;
    /** Deserialize FocusBag weights from persistence */
    deserialize(data: SerializedFocusBag): void;
}
export declare function createFocus(options: FocusOptions): Focus;
//# sourceMappingURL=FocusBag.d.ts.map