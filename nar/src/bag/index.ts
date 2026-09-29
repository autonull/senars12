export type {
  AIKRBudget,
  Bag,
  BagImplementation,
  BagItem,
  BagOptions,
  EvictStrategy,
  InternalEntry,
} from './Bag.js';
export { BaseBag, PriorityBag } from './Bag.js';
export { FenwickBag } from './FenwickBag.js';
export {
  BAG_IMPLEMENTATIONS,
  bagSlotErrors,
  resolveBagSlot,
} from './registration.js';
export type { BagSlotParams, ResolvedBagSlot } from './registration.js';
import { type Bag, type BagItem, type BagOptions, PriorityBag } from './Bag.js';
import { FenwickBag } from './FenwickBag.js';

/** Factory to create a Bag instance based on the implementation option. */
export function createBag<T extends BagItem>(options: BagOptions): Bag<T> {
  return options.implementation === 'fenwick'
    ? new FenwickBag<T>(options)
    : new PriorityBag<T>(options);
}
