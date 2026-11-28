import { PriorityBag, type Bag, type BagItem, type BagOptions } from '../util/bag';
export { PriorityBag };
export type { Bag, BagItem, BagOptions, EvictStrategy, Histogram, PressureLevel, PressureListener, PressureTransition, CyclesBudget, RandomSource, } from '../util/bag';
export type { BagSlotParams, ResolvedBagSlot } from './registration';
export { bagSlotErrors, resolveBagSlot } from './registration';
export type { InternalEntry } from './types';
/** The one construction path for an AIKR bag: capacity is the caller's bound, the rest is knobs. */
export declare const createBag: <T extends BagItem>(options: BagOptions) => Bag<T>;
//# sourceMappingURL=index.d.ts.map