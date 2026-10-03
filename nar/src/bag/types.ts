/**
 * Storage-agnostic bag shapes. Kept free of any dependency on the bag
 * implementations so a backend helper (e.g. the Fenwick tree) can name the
 * entries it indexes without importing the base class back.
 */

export interface BagItem {
  id: string;
  priority: number;
}

export interface InternalEntry<T extends BagItem> {
  item: T;
  createdAt: number;
  lastAccessedAt: number;
}