import type { ViewDataset, ViewSource } from './view-spec.js';

/** A readable the view system can subscribe to — an atom or any get/subscribe pair. */
export interface Readable<T> {
  get(): T;
  subscribe(fn: () => void): () => void;
}

/**
 * Adapt a store atom to the view system's source contract: `get` projects the
 * atom's value into a dataset and `subscribe` forwards its notifications. This
 * is how a product surface feeds `<s-view>` without owning a renderer.
 */
export const viewSource = <T>(
  readable: Readable<T>,
  project: (value: T) => ViewDataset
): ViewSource => ({
  get: () => project(readable.get()),
  subscribe: (fn) => readable.subscribe(fn),
});