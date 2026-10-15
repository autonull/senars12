export type {
  Bag,
  BagItem,
  BagOptions,
  CyclesBudget,
  EvictStrategy,
  InternalEntry,
  PressureListener,
  PressureTransition,
  RandomSource,
} from './Bag.js';
export { PriorityBag } from './Bag.js';
export { FenwickTree } from './fenwick.js';

import { type Bag, type BagItem, type BagOptions, PriorityBag } from './Bag.js';

/** The one construction path for an AIKR bag: capacity is the caller's bound, the rest is knobs. */
export const createBag = <T extends BagItem>(options: BagOptions): Bag<T> =>
  new PriorityBag<T>(options);
