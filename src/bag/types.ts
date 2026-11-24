/**
 * Storage-agnostic bag shapes. Kept free of any dependency on the bag
 * implementations so a backend helper (e.g. the Fenwick tree) can name the
 * entries it indexes without importing the base class back.
 */

import type { BagItem } from '../util/bag';

/** Minimal entry shape for storage backends (Fenwick tree, etc.). */
export interface InternalEntry<T extends BagItem> {
  item: T;
  createdAt: number;
  lastAccessedAt: number;
}
