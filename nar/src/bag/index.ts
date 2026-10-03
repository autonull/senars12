export type {
  AIKRBudget,
  Bag,
  BagItem,
  BagOptions,
  EvictStrategy,
  InternalEntry,
} from './Bag.js';
export { PriorityBag } from './Bag.js';
export type { BagSlotParams, ResolvedBagSlot } from './registration.js';
export { bagSlotErrors, resolveBagSlot } from './registration.js';

import { type Bag, type BagItem, type BagOptions, PriorityBag } from './Bag.js';

/** The one construction path for an AIKR bag: capacity is the caller's bound, the rest is knobs. */
export const createBag = <T extends BagItem>(options: BagOptions): Bag<T> =>
  new PriorityBag<T>(options);
